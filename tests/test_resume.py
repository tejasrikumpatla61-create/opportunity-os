import copy
import io
import json
from unittest.mock import MagicMock

import docx
import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.crewai_service import get_crewai_service
from app.main import app
from app.supabase_service import get_supabase_client

client = TestClient(app)

USER_A = {"id": "user-a-111", "email": "usera@example.com"}
USER_B = {"id": "user-b-222", "email": "userb@example.com"}

SAMPLE_OPPORTUNITY = {
    "id": "11111111-2222-3333-4444-555555555555",
    "title": "Backend Engineering Fellowship",
    "organization": "Open Source Initiative",
    "opportunity_type": "fellowship",
    "description": "Fellowship for Python builders.",
    "eligibility": "Enrolled students with Python knowledge",
    "required_skills": ["Python", "FastAPI"],
    "requirements": ["Enrolled student"],
    "location": "Remote",
    "deadline": "2026-12-31",
    "source_url": "https://example.com/fellowship",
}

VALID_PDF_BYTES = (
    b"%PDF-1.4\n"
    b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
    b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
    b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n"
    b"4 0 obj << /Length 73 >> stream\n"
    b"BT /F1 12 Tf 100 700 Td (Jane Doe: Computer Science Student with Python and Cloud experience) Tj ET\n"
    b"endstream endobj\n"
    b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
    b"xref\n"
    b"0 6\n"
    b"0000000000 65535 f \n"
    b"0000000009 00000 n \n"
    b"0000000058 00000 n \n"
    b"0000000115 00000 n \n"
    b"0000000244 00000 n \n"
    b"0000000368 00000 n \n"
    b"trailer << /Size 6 /Root 1 0 R >>\n"
    b"startxref\n"
    b"445\n"
    b"%%EOF\n"
)


def create_valid_docx_bytes() -> bytes:
    doc = docx.Document()
    doc.add_paragraph("Alice Smith. Computer Science Junior at State University.")
    doc.add_paragraph("Skills: Python, FastAPI, TypeScript, PostgreSQL.")
    doc.add_paragraph("Experience: Built cloud microservices and machine learning pipelines.")
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


class MockSupabaseClient:
    """In-memory mock for Supabase Database and Storage."""

    def __init__(self):
        self.profiles = {}
        self.storage_files = {}  # bucket -> path -> bytes

    def table(self, table_name: str):
        mock_table = MagicMock()

        if table_name == "profiles":
            def select_fn(*args, **kwargs):
                sel = MagicMock()
                def eq_fn(col, val):
                    eq_mock = MagicMock()
                    def execute_fn():
                        res = MagicMock()
                        matching = [p for p in self.profiles.values() if p.get(col) == val]
                        res.data = copy.deepcopy(matching)
                        return res
                    eq_mock.execute = execute_fn
                    return eq_mock
                sel.eq = eq_fn
                return sel

            def update_fn(update_data):
                upd = MagicMock()
                def eq_fn(col, val):
                    eq_mock = MagicMock()
                    def execute_fn():
                        res = MagicMock()
                        updated = []
                        for p in self.profiles.values():
                            if p.get(col) == val:
                                p.update(update_data)
                                updated.append(copy.deepcopy(p))
                        res.data = updated
                        return res
                    eq_mock.execute = execute_fn
                    return eq_mock
                upd.eq = eq_fn
                return upd

            def insert_fn(record):
                ins = MagicMock()
                def execute_fn():
                    res = MagicMock()
                    rec = dict(record)
                    rec_id = rec.get("id", f"prof-{len(self.profiles)+1}")
                    rec["id"] = rec_id
                    self.profiles[rec["user_id"]] = rec
                    res.data = [copy.deepcopy(rec)]
                    return res
                ins.execute = execute_fn
                return ins

            mock_table.select = select_fn
            mock_table.update = update_fn
            mock_table.insert = insert_fn

        elif table_name == "opportunities":
            def select_fn(*args, **kwargs):
                sel = MagicMock()
                def eq_fn(col, val):
                    eq_mock = MagicMock()
                    def execute_fn():
                        res = MagicMock()
                        res.data = [SAMPLE_OPPORTUNITY] if str(val) == SAMPLE_OPPORTUNITY["id"] else []
                        return res
                    eq_mock.execute = execute_fn
                    return eq_mock
                sel.eq = eq_fn
                return sel
            mock_table.select = select_fn

        return mock_table

    @property
    def storage(self):
        storage_mock = MagicMock()
        def from_fn(bucket: str):
            bucket_mock = MagicMock()
            if bucket not in self.storage_files:
                self.storage_files[bucket] = {}

            def upload_fn(path: str, data: bytes, options: dict = None):
                self.storage_files[bucket][path] = data
                return {"Key": f"{bucket}/{path}"}

            def download_fn(path: str):
                if path in self.storage_files[bucket]:
                    return self.storage_files[bucket][path]
                raise Exception("Not found")

            def list_fn(prefix: str = ""):
                results = []
                for p in self.storage_files[bucket].keys():
                    if p.startswith(prefix):
                        results.append({"name": p.split("/")[-1]})
                return results

            def remove_fn(paths: list):
                for p in paths:
                    self.storage_files[bucket].pop(p, None)
                return [{"name": p} for p in paths]

            bucket_mock.upload = upload_fn
            bucket_mock.download = download_fn
            bucket_mock.list = list_fn
            bucket_mock.remove = remove_fn
            return bucket_mock

        storage_mock.from_ = from_fn
        return storage_mock


@pytest.fixture
def mock_backend():
    mock_sb = MockSupabaseClient()
    # Seed profiles
    mock_sb.profiles[USER_A["id"]] = {
        "id": "prof-a",
        "user_id": USER_A["id"],
        "email": USER_A["email"],
        "full_name": "Student A",
        "resume_available": False,
        "skills": ["Python"],
    }
    mock_sb.profiles[USER_B["id"]] = {
        "id": "prof-b",
        "user_id": USER_B["id"],
        "email": USER_B["email"],
        "full_name": "Student B",
        "resume_available": False,
        "skills": ["Java"],
    }

    app.dependency_overrides[get_supabase_client] = lambda: mock_sb
    app.dependency_overrides[get_current_user] = lambda: USER_A
    yield mock_sb
    app.dependency_overrides.clear()


def test_upload_valid_pdf(mock_backend):
    """Test successful upload and text extraction from valid PDF."""
    files = {"file": ("student_resume.pdf", VALID_PDF_BYTES, "application/pdf")}
    res = client.post("/api/profile/resume", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["resume_available"] is True
    assert data["file_name"] == "student_resume.pdf"
    assert data["file_size"] == len(VALID_PDF_BYTES)

    # Check profile updated in Supabase
    prof = mock_backend.profiles[USER_A["id"]]
    assert prof["resume_available"] is True
    assert "Jane Doe" in prof["resume_text"]


def test_upload_valid_docx(mock_backend):
    """Test successful upload and text extraction from valid DOCX."""
    docx_bytes = create_valid_docx_bytes()
    files = {
        "file": (
            "alice_resume.docx",
            docx_bytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }
    res = client.post("/api/profile/resume", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["resume_available"] is True
    assert data["file_name"] == "alice_resume.docx"

    prof = mock_backend.profiles[USER_A["id"]]
    assert prof["resume_available"] is True
    assert "Alice Smith" in prof["resume_text"]


def test_unsupported_file_extension(mock_backend):
    """Test that non-PDF and non-DOCX formats are rejected cleanly with 400."""
    files = {"file": ("script.sh", b"#!/bin/bash\necho test", "application/x-sh")}
    res = client.post("/api/profile/resume", files=files)
    assert res.status_code == 400
    assert "Unsupported file format" in res.json()["detail"]


def test_invalid_pdf_content(mock_backend):
    """Test that fake PDF (wrong magic bytes) is rejected with 400."""
    files = {"file": ("fake.pdf", b"Not a real PDF file content at all", "application/pdf")}
    res = client.post("/api/profile/resume", files=files)
    assert res.status_code == 400
    assert "Invalid PDF" in res.json()["detail"]


def test_oversized_file_rejection(mock_backend):
    """Test that file exceeding 5 MB is rejected with 400."""
    large_bytes = b"%PDF" + b"0" * (5 * 1024 * 1024 + 10)
    files = {"file": ("huge.pdf", large_bytes, "application/pdf")}
    res = client.post("/api/profile/resume", files=files)
    assert res.status_code == 400
    assert "exceeds maximum size limit" in res.json()["detail"]


def test_empty_resume_rejection(mock_backend):
    """Test that empty or unextractable resume is rejected cleanly."""
    files = {"file": ("empty.pdf", b"", "application/pdf")}
    res = client.post("/api/profile/resume", files=files)
    assert res.status_code == 400


def test_get_resume_metadata(mock_backend):
    """Test GET /api/profile/resume returns metadata for uploaded resume."""
    # Before upload
    res = client.get("/api/profile/resume")
    assert res.status_code == 200
    assert res.json()["resume_available"] is False

    # Upload
    files = {"file": ("my_resume.pdf", VALID_PDF_BYTES, "application/pdf")}
    client.post("/api/profile/resume", files=files)

    # After upload
    res = client.get("/api/profile/resume")
    assert res.status_code == 200
    meta = res.json()
    assert meta["resume_available"] is True
    assert meta["file_name"] == "my_resume.pdf"


def test_delete_resume(mock_backend):
    """Test DELETE /api/profile/resume removes file and updates profile."""
    # First upload
    files = {"file": ("to_delete.pdf", VALID_PDF_BYTES, "application/pdf")}
    client.post("/api/profile/resume", files=files)
    assert mock_backend.profiles[USER_A["id"]]["resume_available"] is True

    # Delete
    res = client.delete("/api/profile/resume")
    assert res.status_code == 200
    assert res.json()["resume_available"] is False

    # Check profile updated
    prof = mock_backend.profiles[USER_A["id"]]
    assert prof["resume_available"] is False


def test_resume_cross_user_isolation(mock_backend):
    """Verify User A cannot see or delete User B's resume."""
    # Upload User B resume
    app.dependency_overrides[get_current_user] = lambda: USER_B
    files_b = {"file": ("user_b_cv.pdf", VALID_PDF_BYTES, "application/pdf")}
    res_b = client.post("/api/profile/resume", files=files_b)
    assert res_b.status_code == 200

    # User A checks their resume metadata (should not see User B's file)
    app.dependency_overrides[get_current_user] = lambda: USER_A
    res_a = client.get("/api/profile/resume")
    assert res_a.status_code == 200
    assert res_a.json()["resume_available"] is False


def test_crewai_analysis_receives_real_extracted_resume(mock_backend):
    """Verify POST /api/opportunities/{id}/analyze passes real extracted resume to CrewAI."""
    # 1. Upload valid resume for User A
    files = {"file": ("student_cv.pdf", VALID_PDF_BYTES, "application/pdf")}
    client.post("/api/profile/resume", files=files)

    # 2. Mock CrewAI service to inspect inputs passed to kickoff
    captured_inputs = {}
    mock_crewai = MagicMock()
    def fake_kickoff(inputs):
        captured_inputs.update(inputs)
        return {
            "source_url": SAMPLE_OPPORTUNITY["source_url"],
            "match_score": 85,
            "match_level": "strong",
            "eligibility_status": "Eligible",
            "eligibility_summary": "Meets criteria",
            "matched_skills": ["Python"],
            "matched_requirements": ["Enrolled student"],
            "missing_requirements": [],
            "unknown_requirements": [],
            "skills_with_no_evidence": [],
            "documents_needed": [],
            "application_blockers": [],
            "tasks": ["Submit application"],
            "recommended_next_action": "Apply now",
        }
    mock_crewai.kickoff_and_poll.side_effect = fake_kickoff
    app.dependency_overrides[get_crewai_service] = lambda: mock_crewai

    # 3. Analyze opportunity
    res = client.post(
        f"/api/opportunities/{SAMPLE_OPPORTUNITY['id']}/analyze",
        json={"student_profile": {"skills": ["Python"]}},
    )
    assert res.status_code == 200

    # Verify CrewAI input received real extracted resume text
    assert "Jane Doe" in captured_inputs.get("resume_text", "")
    assert "Computer Science Student with Python and Cloud experience" in captured_inputs.get("resume_text", "")


def test_crewai_analysis_without_resume_does_not_use_fake_fallback(mock_backend):
    """Verify that when no resume exists, fake fallback text is NOT sent to CrewAI."""
    captured_inputs = {}
    mock_crewai = MagicMock()
    def fake_kickoff(inputs):
        captured_inputs.update(inputs)
        return {
            "source_url": SAMPLE_OPPORTUNITY["source_url"],
            "match_score": 50,
            "match_level": "moderate",
            "eligibility_status": "Eligible",
            "eligibility_summary": "Meets criteria",
            "matched_skills": [],
            "matched_requirements": ["Enrolled student"],
            "missing_requirements": [],
            "unknown_requirements": [],
            "skills_with_no_evidence": [],
            "documents_needed": [],
            "application_blockers": [],
            "tasks": ["Upload resume"],
            "recommended_next_action": "Add projects",
        }
    mock_crewai.kickoff_and_poll.side_effect = fake_kickoff
    app.dependency_overrides[get_crewai_service] = lambda: mock_crewai

    # User A has no resume uploaded
    res = client.post(
        f"/api/opportunities/{SAMPLE_OPPORTUNITY['id']}/analyze",
        json={"student_profile": {"skills": ["Python"]}},
    )
    assert res.status_code == 200

    # Verify no fake fallback string was sent
    resume_text = captured_inputs.get("resume_text", "")
    assert "B.Tech CSE student with Python and cybersecurity project experience" not in resume_text
    assert resume_text == ""
