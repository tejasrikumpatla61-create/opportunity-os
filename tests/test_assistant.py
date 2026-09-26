from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.auth import get_current_user
from app.supabase_service import get_supabase_client
from app.gemini_service import (
    get_gemini_service,
    GeminiConfigError,
    GeminiApiError,
)

client = TestClient(app)


def test_assistant_chat_mocked_success():
    """Test successful assistant chat returns structured response."""
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    mock_gemini = MagicMock()
    mock_gemini.generate_chat_response.return_value = {
        "message": "Focus on preparing your cybersecurity resume and forming a 2-person team.",
        "suggested_actions": ["Update resume", "Find teammate", "Review eligibility"],
    }

    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1", "email": "test@example.com"}
    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_gemini_service] = lambda: mock_gemini

    try:
        response = client.post(
            "/api/assistant/chat",
            json={"message": "What should I do first for this hackathon?"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "cybersecurity resume" in data["message"].lower()
        assert len(data["suggested_actions"]) == 3
        assert "Update resume" in data["suggested_actions"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_supabase_client, None)
        app.dependency_overrides.pop(get_gemini_service, None)


def test_assistant_chat_gemini_api_failure():
    """Test Gemini API failure returns 502 Bad Gateway."""
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    mock_gemini = MagicMock()
    mock_gemini.generate_chat_response.side_effect = GeminiApiError("API error")

    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1", "email": "test@example.com"}
    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_gemini_service] = lambda: mock_gemini

    try:
        response = client.post(
            "/api/assistant/chat",
            json={"message": "Help me with requirements"},
        )
        assert response.status_code == 502
        assert "ai assistant service encountered an error" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_supabase_client, None)
        app.dependency_overrides.pop(get_gemini_service, None)


def test_assistant_chat_malformed_response():
    """Test malformed response from Gemini returns 502 Bad Gateway."""
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    mock_gemini = MagicMock()
    mock_gemini.generate_chat_response.side_effect = GeminiApiError("Assistant returned a malformed response")

    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1", "email": "test@example.com"}
    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_gemini_service] = lambda: mock_gemini

    try:
        response = client.post(
            "/api/assistant/chat",
            json={"message": "Analyze my chances"},
        )
        assert response.status_code == 502
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_supabase_client, None)
        app.dependency_overrides.pop(get_gemini_service, None)


def test_assistant_chat_unconfigured_key():
    """Test unconfigured GEMINI_API_KEY returns 503 with specific required message."""
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    mock_gemini = MagicMock()
    mock_gemini.generate_chat_response.side_effect = GeminiConfigError(
        "GEMINI_API_KEY required for live assistant verification."
    )

    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1", "email": "test@example.com"}
    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_gemini_service] = lambda: mock_gemini

    try:
        response = client.post(
            "/api/assistant/chat",
            json={"message": "Hello"},
        )
        assert response.status_code == 503
        assert "gemini_api_key required for live assistant verification" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_supabase_client, None)
        app.dependency_overrides.pop(get_gemini_service, None)
