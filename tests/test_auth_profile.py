from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.auth import get_current_user
from app.supabase_service import get_supabase_client

client = TestClient(app)


def test_unauthenticated_protected_profile_endpoint():
    """Unauthenticated request to /api/profile must return 401 Unauthorized."""
    app.dependency_overrides.pop(get_current_user, None)
    try:
        response = client.get("/api/profile")
        assert response.status_code == 401
        assert "authentication credentials required" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_invalid_token_returns_401():
    """Invalid bearer token must return 401 Unauthorized."""
    app.dependency_overrides.pop(get_current_user, None)
    mock_supabase = MagicMock()
    mock_supabase.auth.get_user.side_effect = Exception("Invalid token")
    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase

    try:
        response = client.get(
            "/api/profile",
            headers={"Authorization": "Bearer invalid_or_expired_token"},
        )
        assert response.status_code == 401
        assert "invalid authentication token" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)
        app.dependency_overrides.pop(get_current_user, None)


def test_unauthenticated_analyze_endpoint():
    """Unauthenticated request to analyze endpoint must return 401."""
    app.dependency_overrides.pop(get_current_user, None)
    try:
        response = client.post(
            "/api/opportunities/11111111-1111-1111-1111-111111111111/analyze",
            json={"resume_text": "sample resume"},
        )
        assert response.status_code == 401
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_own_profile_retrieval():
    """Authenticated user can retrieve their own profile."""
    user_id = "user-12345"
    mock_profile = {
        "id": "profile-1",
        "user_id": user_id,
        "full_name": "Alice Smith",
        "email": "alice@example.com",
        "degree": "B.Tech",
        "branch": "CSE",
        "study_year": 3,
        "skills": ["Python", "Docker"],
        "interests": ["Cybersecurity"],
        "preferred_opportunity_types": ["Hackathons"],
        "resume_available": True,
    }

    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        mock_profile
    ]

    app.dependency_overrides[get_current_user] = lambda: {"id": user_id, "email": "alice@example.com"}
    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase

    try:
        response = client.get("/api/profile")
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == user_id
        assert data["full_name"] == "Alice Smith"
        assert data["skills"] == ["Python", "Docker"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_supabase_client, None)


def test_own_profile_update():
    """Authenticated user can update their profile."""
    user_id = "user-12345"
    updated_profile = {
        "id": "profile-1",
        "user_id": user_id,
        "full_name": "Alice Smith",
        "email": "alice@example.com",
        "degree": "M.Tech",
        "branch": "AI",
        "study_year": 1,
        "skills": ["Python", "PyTorch"],
        "interests": ["Machine Learning"],
        "preferred_opportunity_types": ["Fellowships"],
        "resume_available": True,
    }

    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [{"id": "profile-1"}]
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
        updated_profile
    ]

    app.dependency_overrides[get_current_user] = lambda: {"id": user_id, "email": "alice@example.com"}
    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase

    try:
        response = client.patch(
            "/api/profile",
            json={
                "degree": "M.Tech",
                "branch": "AI",
                "study_year": 1,
                "skills": ["Python", "PyTorch"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["degree"] == "M.Tech"
        assert "PyTorch" in data["skills"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_supabase_client, None)


def test_cross_user_isolation():
    """Profile query is strictly filtered by the authenticated user's ID."""
    authenticated_user_id = "victim-user-id"
    attacker_user_id = "attacker-user-id"

    mock_supabase = MagicMock()
    # If queried for victim, return victim's profile; if queried for attacker, return empty or attacker's
    def mock_eq(field, value):
        m = MagicMock()
        if value == attacker_user_id:
            m.execute.return_value.data = []
        else:
            m.execute.return_value.data = [{"id": "profile-victim", "user_id": victim-user-id, "full_name": "Victim"}]
        return m

    # The backend query MUST pass user_id = attacker_user_id
    captured_filters = []
    def eq_tracker(field, value):
        captured_filters.append((field, value))
        m = MagicMock()
        m.execute.return_value.data = []
        return m

    mock_supabase.table.return_value.select.return_value.eq.side_effect = eq_tracker

    app.dependency_overrides[get_current_user] = lambda: {"id": attacker_user_id, "email": "attacker@example.com"}
    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase

    try:
        response = client.get("/api/profile")
        assert response.status_code == 200
        # Verify the database query was strictly scoped to the attacker's own user_id
        assert ("user_id", attacker_user_id) in captured_filters
        assert ("user_id", authenticated_user_id) not in captured_filters
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_supabase_client, None)
