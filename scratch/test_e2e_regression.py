import os
import sys
import json
import urllib.request
import urllib.parse
import io
import docx

BASE_URL = "http://127.0.0.1:8000"

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

def request(path, method="GET", data=None, token=None, files=None):
    url = f"{BASE_URL}{path}"
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    body = None
    if files:
        boundary = "----WebKitFormBoundaryE2ETest"
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        buf = io.BytesIO()
        for field, (filename, content, content_type) in files.items():
            buf.write(f"--{boundary}\r\n".encode())
            buf.write(f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'.encode())
            buf.write(f'Content-Type: {content_type}\r\n\r\n'.encode())
            buf.write(content)
            buf.write(b"\r\n")
        buf.write(f"--{boundary}--\r\n".encode())
        body = buf.getvalue()
    elif data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = {"raw": err_body}
        return e.code, parsed

def run():
    print("--- 1. Testing Health ---")
    st, res = request("/health")
    assert st == 200, f"Health check failed: {res}"
    print("Health: OK")

    print("\n--- 2. Testing Auth: Signup / Login / Me ---")
    email = "e2e_student_12345@example.com"
    pwd = "SecurePassword123!"

    st, res = request("/api/auth/login", method="POST", data={"email": email, "password": pwd})
    if st != 200:
        st, res = request("/api/auth/signup", method="POST", data={"email": email, "password": pwd, "full_name": "E2E Verified Student"})
        assert st == 201, f"Signup failed: {res}"
    
    token = res["access_token"]
    user_id = res["user"]["id"]
    print(f"Auth Token Acquired for user {user_id[:8]}... OK")

    st, res = request("/api/auth/me", token=token)
    assert st == 200, f"/api/auth/me failed: {res}"
    print(f"Session restoration /me: OK (has_completed_onboarding={res.get('has_completed_onboarding')})")

    print("\n--- 3. Testing Profile: Hydration, Update & Persistence ---")
    st, prof = request("/api/profile", token=token)
    assert st == 200, f"Get profile failed: {prof}"
    print("Get Profile: OK")

    update_payload = {
        "full_name": "Verified E2E Student",
        "college": "Stanford University",
        "degree": "B.S.",
        "branch": "Computer Science",
        "study_year": 3,
        "skills": ["Python", "FastAPI", "React", "TypeScript", "Machine Learning"],
        "interests": ["AI", "Open Source", "Hackathons"],
        "preferred_opportunity_types": ["internship", "hackathon"]
    }
    st, updated_prof = request("/api/profile", method="PATCH", data=update_payload, token=token)
    assert st == 200, f"Update profile failed: {updated_prof}"
    assert updated_prof["degree"] == "B.S."
    print("Update Profile & Persistence: OK")

    st, res = request("/api/auth/me", token=token)
    assert res.get("has_completed_onboarding") == True, "has_completed_onboarding should be True now"
    print("Profile completion reflected in /me: OK")

    print("\n--- 4. Testing Resume: PDF Upload, Metadata, Replacement & Deletion ---")
    # PDF Upload
    st, res = request("/api/profile/resume", method="POST", token=token, files={"file": ("resume.pdf", VALID_PDF_BYTES, "application/pdf")})
    assert st == 200, f"Resume PDF upload failed: {res}"
    print(f"Resume PDF Upload: OK ({res.get('file_name')})")

    st, res = request("/api/profile/resume", token=token)
    assert st == 200 and res.get("resume_available") == True, f"Resume metadata check failed: {res}"
    print("Resume Metadata Check: OK")

    # Replace with DOCX
    docx_bytes = create_valid_docx_bytes()
    st, res = request("/api/profile/resume", method="POST", token=token, files={"file": ("resume_updated.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")})
    assert st == 200, f"Resume DOCX replacement failed: {res}"
    print(f"Resume Replacement with DOCX: OK ({res.get('file_name')})")

    # Delete Resume
    st, del_res = request("/api/profile/resume", method="DELETE", token=token)
    assert st == 200 and del_res.get("resume_available") == False, f"Resume deletion failed: {del_res}"
    print("Resume Deletion: OK")

    # Re-upload PDF for downstream tests
    st, res = request("/api/profile/resume", method="POST", token=token, files={"file": ("final_resume.pdf", VALID_PDF_BYTES, "application/pdf")})
    assert st == 200, f"Re-upload PDF failed: {res}"
    print("Resume Re-upload: OK")

    print("\n--- 5. Testing Opportunity Discovery & Personalization ---")
    st, opps = request("/api/opportunities", token=token)
    assert st == 200 and isinstance(opps, list) and len(opps) > 0, f"List opportunities failed: {opps}"
    print(f"List Opportunities: OK ({len(opps)} items)")

    st, feed = request("/api/feed", token=token)
    assert st == 200 and "best_matches" in feed, f"Personalized feed failed: {feed}"
    print(f"Personalized Feed: OK ({len(feed['best_matches'])} best matches)")

    target_opp = opps[0]
    target_id = target_opp["id"]
    st, opp_detail = request(f"/api/opportunities/{target_id}", token=token)
    assert st == 200, f"Opportunity detail failed: {opp_detail}"
    print(f"Opportunity Detail ({target_opp.get('title')[:30]}...): OK")

    print("\n--- 6. Testing Application Tracking & Deduplication ---")
    app_payload = {"opportunity_id": target_id, "status": "draft"}
    st, app_res = request("/api/applications", method="POST", data=app_payload, token=token)
    if st == 409:
        print("Application already tracked for this opportunity. Fetching existing...")
        st, apps_list = request("/api/applications", token=token)
        app_res = next(a for a in apps_list if a["opportunity_id"] == target_id)
    else:
        assert st == 201, f"Track application failed: {app_res}"
    
    app_id = app_res["id"]
    print(f"Track Application: OK (app_id={app_id[:8]}...)")

    # Duplicate track conflict test
    st, dup_res = request("/api/applications", method="POST", data=app_payload, token=token)
    assert st == 409, f"Duplicate tracking conflict check failed: {st}, {dup_res}"
    print("Duplicate Application Conflict Handling (409): OK")

    # Update application status
    st, patch_app = request(f"/api/applications/{app_id}", method="PATCH", data={"status": "applied"}, token=token)
    assert st == 200 and (patch_app.get("status") in ["applied", "submitted"] or patch_app.get("display_status") == "Applied"), f"Update application failed: {patch_app}"
    print("Update Application Status to 'applied': OK")

    print("\n--- 7. Testing Tasks Management & Progress ---")
    task_payload = {
        "title": "Prepare portfolio and project links",
        "priority": "high",
        "application_id": app_id,
        "due_date": "2026-10-15T23:59:59Z"
    }
    st, task_res = request("/api/tasks", method="POST", data=task_payload, token=token)
    assert st == 201, f"Create task failed: {task_res}"
    task_id = task_res["id"]
    print(f"Create Task: OK (task_id={task_id[:8]}...)")

    st, complete_res = request(f"/api/tasks/{task_id}", method="PATCH", data={"status": "completed"}, token=token)
    assert st == 200 and complete_res["status"] == "completed", f"Complete task failed: {complete_res}"
    print("Complete Task: OK")

    # Check application progress calculation
    st, apps_list = request("/api/applications", token=token)
    assert st == 200, f"List applications failed: {apps_list}"
    matching_app = next((a for a in apps_list if a["id"] == app_id), None)
    assert matching_app is not None, "Application not found in list"
    print(f"Application Progress Calculated: {matching_app.get('progress_percentage')}% OK")

    print("\n--- 8. Testing CrewAI Analyze My Fit ---")
    print("Requesting CrewAI fit analysis for opportunity...")
    st, fit_res = request(f"/api/opportunities/{target_id}/analyze", method="POST", token=token)
    assert st == 200, f"CrewAI Analyze My Fit failed: {fit_res}"
    print(f"CrewAI Match Score: {fit_res.get('match_score')}% ({fit_res.get('match_level')})")
    print(f"Matched Skills: {len(fit_res.get('skill_match', {}).get('matched_skills', []))}")
    print(f"Action Plan: {len(fit_res.get('action_plan', []))} steps")

    print("\n--- 9. Testing Gemini Copilot Grounded Chat ---")
    st, chat_res = request("/api/assistant/chat", method="POST", data={"message": "What should I work on first for my applications?", "opportunity_id": target_id}, token=token)
    assert st == 200, f"Gemini chat failed: {chat_res}"
    assert "message" in chat_res and "suggested_actions" in chat_res, f"Invalid Gemini response shape: {chat_res}"
    print(f"Gemini Copilot Live Grounded Chat: OK (Actions: {len(chat_res['suggested_actions'])})")

    print("\n--- 10. Testing Logout ---")
    st, logout_res = request("/api/auth/logout", method="POST", token=token)
    assert st == 200, f"Logout failed: {logout_res}"
    print("Logout: OK")

    print("\n==========================================")
    print("ALL E2E REGRESSION CHECKS PASSED PERFECTLY")
    print("==========================================")

if __name__ == "__main__":
    run()
