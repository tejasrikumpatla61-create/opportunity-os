import uuid
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.supabase_service import get_supabase_client, SupabaseConfigError

client = TestClient(app)

SAMPLE_OPPORTUNITY = {
    "id": "11111111-1111-1111-1111-111111111111",
    "title": "Global Hackathon 2026",
    "organization": "OpenAI Foundation",
    "opportunity_type": "hackathon",
    "description": "Annual global hackathon for building AI solutions.",
    "eligibility": "Undergraduate and graduate students worldwide",
    "required_skills": ["Python", "FastAPI", "Machine Learning"],
    "requirements": ["Active student status", "Team of 2-4 members"],
    "location": "Virtual",
    "deadline": "2026-10-15T23:59:59Z",
    "source_url": "https://example.com/hackathon",
    "created_at": "2026-09-01T00:00:00Z",
}


def test_list_opportunities_success():
    """Verify GET /api/opportunities returns HTTP 200 and expected opportunity structure."""
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.execute.return_value.data = [
        SAMPLE_OPPORTUNITY
    ]

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    try:
        response = client.get("/api/opportunities")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["id"] == SAMPLE_OPPORTUNITY["id"]
        assert data[0]["title"] == SAMPLE_OPPORTUNITY["title"]
        assert data[0]["organization"] == SAMPLE_OPPORTUNITY["organization"]
        assert data[0]["opportunity_type"] == SAMPLE_OPPORTUNITY["opportunity_type"]
        assert data[0]["source_url"] == SAMPLE_OPPORTUNITY["source_url"]
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)


def test_get_opportunity_by_id_success():
    """Verify GET /api/opportunities/{id} returns HTTP 200 for a valid UUID."""
    valid_id = SAMPLE_OPPORTUNITY["id"]
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        SAMPLE_OPPORTUNITY
    ]

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    try:
        response = client.get(f"/api/opportunities/{valid_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == valid_id
        assert data["title"] == SAMPLE_OPPORTUNITY["title"]
        assert data["source_url"] == SAMPLE_OPPORTUNITY["source_url"]
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)


def test_get_opportunity_not_found():
    """Verify GET /api/opportunities/{missing_uuid} returns HTTP 404."""
    missing_id = "00000000-0000-0000-0000-000000000000"
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    try:
        response = client.get(f"/api/opportunities/{missing_id}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)


def test_get_opportunity_invalid_uuid():
    """Verify GET /api/opportunities/{invalid_uuid} returns HTTP 400 client error."""
    response = client.get("/api/opportunities/not-a-valid-uuid")
    assert response.status_code == 400
    assert "invalid opportunity uuid" in response.json()["detail"].lower()


def test_missing_supabase_config():
    """Verify missing Supabase configuration returns HTTP 503 without exposing secrets."""
    def raise_config_error():
        raise SupabaseConfigError("Supabase configuration is missing.")

    app.dependency_overrides[get_supabase_client] = raise_config_error
    try:
        response = client.get("/api/opportunities")
        assert response.status_code == 503
        assert response.json()["detail"] == "Supabase service is not configured"
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)


def test_database_query_failure():
    """Verify database request failure returns HTTP 500 without leaking raw internal exception."""
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.execute.side_effect = RuntimeError("DB connection dropped")

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    try:
        response = client.get("/api/opportunities")
        assert response.status_code == 500
        assert "failed to retrieve" in response.json()["detail"].lower()
        # Verify internal raw exception text is not leaked
        assert "DB connection dropped" not in response.text
    finally:
        app.dependency_overrides.pop(get_supabase_client, None)
