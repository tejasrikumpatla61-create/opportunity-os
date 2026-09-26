import copy
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.supabase_service import get_supabase_client
from app.crewai_service import (
    get_crewai_service,
    CrewAIKickoffError,
    CrewAIExecutionError,
    CrewAITimeoutError,
    CrewAIMalformedResultError,
)

client = TestClient(app)

SAMPLE_OPPORTUNITY = {
    "id": "11111111-1111-1111-1111-111111111111",
    "title": "Cybersecurity Innovation Challenge",
    "organization": "Security Alliance",
    "opportunity_type": "hackathon",
    "description": "Annual cybersecurity competition.",
    "eligibility": "Undergraduate students",
    "required_skills": ["Python", "Cybersecurity"],
    "requirements": ["Enrolled student", "Team of 2-4"],
    "location": "Virtual",
    "deadline": "2026-10-15T23:59:59Z",
    "source_url": "https://example.com/canonical-challenge",
    "created_at": "2026-09-01T00:00:00Z",
}

SAMPLE_CREWAI_RESULT = {
    "source_url": "https://example.com/canonical-challenge",
    "match_level": "HIGH",
    "match_score": 85,
    "matched_skills": ["Python", "Cybersecurity"],
    "documents_needed": ["Student ID"],
    "eligibility_status": "ELIGIBLE",
    "eligibility_summary": "Meets criteria.",
    "application_blockers": [],
    "matched_requirements": ["Enrolled student"],
    "missing_requirements": [],
    "unknown_requirements": ["Team of 2-4"],
    "skills_with_no_evidence": [],
    "recommended_next_action": "Apply on portal",
    "tasks": ["Form team", "Submit registration"],
}

SAMPLE_REQUEST_BODY = {
    "student_profile": {
        "degree": "B.Tech",
        "branch": "Computer Science and Engineering",
        "study_year": 2,
        "skills": ["Python", "Cybersecurity"],
    },
    "resume_text": "B.Tech CSE student with Python and cybersecurity project experience.",
}


def create_mock_supabase(opportunity_data=None):
    mock = MagicMock()
    mock.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
        [opportunity_data] if opportunity_data is not None else []
    )
    return mock


def test_analyze_valid_opportunity():
    """1. Test analyze valid opportunity returns HTTP 200 and expected structure."""
    mock_supabase = create_mock_supabase(SAMPLE_OPPORTUNITY)
    mock_crewai = MagicMock()
    mock_crewai.kickoff_and_poll.return_value = copy.deepcopy(SAMPLE_CREWAI_RESULT)

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_crewai_service] = lambda: mock_crewai

    try:
        response = client.post(
            f"/api/opportunities/{SAMPLE_OPPORTUNITY['id']}/analyze",
            json=SAMPLE_REQUEST_BODY,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["match_score"] == 85
        assert data["eligibility_status"] == "ELIGIBLE"
        assert data["source_url"] == SAMPLE_OPPORTUNITY["source_url"]
        assert "Python" in data["matched_skills"]
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)
        app.dependency_overrides.pop(get_crewai_service, None)


def test_analyze_invalid_uuid():
    """2. Test invalid opportunity UUID returns HTTP 400 client error."""
    response = client.post(
        "/api/opportunities/not-a-valid-uuid/analyze",
        json=SAMPLE_REQUEST_BODY,
    )
    assert response.status_code == 400
    assert "invalid opportunity uuid" in response.json()["detail"].lower()


def test_analyze_missing_opportunity():
    """3. Test missing opportunity in database returns HTTP 404."""
    mock_supabase = create_mock_supabase(None)
    mock_crewai = MagicMock()

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_crewai_service] = lambda: mock_crewai

    try:
        missing_id = "00000000-0000-0000-0000-000000000000"
        response = client.post(
            f"/api/opportunities/{missing_id}/analyze",
            json=SAMPLE_REQUEST_BODY,
        )
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)
        app.dependency_overrides.pop(get_crewai_service, None)


def test_crewai_kickoff_failure():
    """4. Test CrewAI kickoff failure returns HTTP 502."""
    mock_supabase = create_mock_supabase(SAMPLE_OPPORTUNITY)
    mock_crewai = MagicMock()
    mock_crewai.kickoff_and_poll.side_effect = CrewAIKickoffError("Kickoff endpoint failed")

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_crewai_service] = lambda: mock_crewai

    try:
        response = client.post(
            f"/api/opportunities/{SAMPLE_OPPORTUNITY['id']}/analyze",
            json=SAMPLE_REQUEST_BODY,
        )
        assert response.status_code == 502
        assert "kickoff failed" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)
        app.dependency_overrides.pop(get_crewai_service, None)


def test_crewai_execution_failure():
    """5. Test CrewAI execution failure returns HTTP 502."""
    mock_supabase = create_mock_supabase(SAMPLE_OPPORTUNITY)
    mock_crewai = MagicMock()
    mock_crewai.kickoff_and_poll.side_effect = CrewAIExecutionError("Agent execution crashed")

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_crewai_service] = lambda: mock_crewai

    try:
        response = client.post(
            f"/api/opportunities/{SAMPLE_OPPORTUNITY['id']}/analyze",
            json=SAMPLE_REQUEST_BODY,
        )
        assert response.status_code == 502
        assert "execution failed" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)
        app.dependency_overrides.pop(get_crewai_service, None)


def test_crewai_timeout():
    """6. Test CrewAI timeout returns HTTP 504 Gateway Timeout."""
    mock_supabase = create_mock_supabase(SAMPLE_OPPORTUNITY)
    mock_crewai = MagicMock()
    mock_crewai.kickoff_and_poll.side_effect = CrewAITimeoutError("Timed out polling status")

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_crewai_service] = lambda: mock_crewai

    try:
        response = client.post(
            f"/api/opportunities/{SAMPLE_OPPORTUNITY['id']}/analyze",
            json=SAMPLE_REQUEST_BODY,
        )
        assert response.status_code == 504
        assert "timed out" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)
        app.dependency_overrides.pop(get_crewai_service, None)


def test_crewai_malformed_response():
    """7. Test malformed CrewAI response returns HTTP 502."""
    mock_supabase = create_mock_supabase(SAMPLE_OPPORTUNITY)
    mock_crewai = MagicMock()
    mock_crewai.kickoff_and_poll.side_effect = CrewAIMalformedResultError("Invalid JSON")

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_crewai_service] = lambda: mock_crewai

    try:
        response = client.post(
            f"/api/opportunities/{SAMPLE_OPPORTUNITY['id']}/analyze",
            json=SAMPLE_REQUEST_BODY,
        )
        assert response.status_code == 502
        assert "malformed" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)
        app.dependency_overrides.pop(get_crewai_service, None)


def test_source_url_returned_unchanged():
    """8. Test source_url returned unchanged when matching database."""
    mock_supabase = create_mock_supabase(SAMPLE_OPPORTUNITY)
    mock_crewai = MagicMock()
    mock_crewai.kickoff_and_poll.return_value = copy.deepcopy(SAMPLE_CREWAI_RESULT)

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_crewai_service] = lambda: mock_crewai

    try:
        response = client.post(
            f"/api/opportunities/{SAMPLE_OPPORTUNITY['id']}/analyze",
            json=SAMPLE_REQUEST_BODY,
        )
        assert response.status_code == 200
        assert response.json()["source_url"] == SAMPLE_OPPORTUNITY["source_url"]
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)
        app.dependency_overrides.pop(get_crewai_service, None)


def test_source_url_database_wins_over_ai_hallucination():
    """9. Critical test: if CrewAI hallucinates a different URL, database source_url wins."""
    mock_supabase = create_mock_supabase(SAMPLE_OPPORTUNITY)
    hallucinated_result = copy.deepcopy(SAMPLE_CREWAI_RESULT)
    hallucinated_result["source_url"] = "https://hallucinated-ai-url.com/fake-challenge"

    mock_crewai = MagicMock()
    mock_crewai.kickoff_and_poll.return_value = hallucinated_result

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_crewai_service] = lambda: mock_crewai

    try:
        response = client.post(
            f"/api/opportunities/{SAMPLE_OPPORTUNITY['id']}/analyze",
            json=SAMPLE_REQUEST_BODY,
        )
        assert response.status_code == 200
        # AI URL must NOT be exposed; database URL must win
        assert response.json()["source_url"] == SAMPLE_OPPORTUNITY["source_url"]
        assert response.json()["source_url"] != "https://hallucinated-ai-url.com/fake-challenge"
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)
        app.dependency_overrides.pop(get_crewai_service, None)


def test_match_score_validation():
    """10. Test match_score validation ensures score is bounded between 0 and 100."""
    mock_supabase = create_mock_supabase(SAMPLE_OPPORTUNITY)
    result_with_string_score = copy.deepcopy(SAMPLE_CREWAI_RESULT)
    result_with_string_score["match_score"] = "92%"

    mock_crewai = MagicMock()
    mock_crewai.kickoff_and_poll.return_value = result_with_string_score

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_crewai_service] = lambda: mock_crewai

    try:
        response = client.post(
            f"/api/opportunities/{SAMPLE_OPPORTUNITY['id']}/analyze",
            json=SAMPLE_REQUEST_BODY,
        )
        assert response.status_code == 200
        assert response.json()["match_score"] == 92
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)
        app.dependency_overrides.pop(get_crewai_service, None)
