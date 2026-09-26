from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    """Verify GET / returns 200 and expected status payload."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data == {
        "name": "OpportunityOS API",
        "status": "running",
    }


def test_health_endpoint():
    """Verify GET /health returns 200 and expected service health payload."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data == {
        "status": "healthy",
        "service": "opportunityos-backend",
    }
