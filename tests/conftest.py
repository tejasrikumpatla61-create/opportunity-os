import pytest
from app.main import app
from app.auth import get_current_user


@pytest.fixture(autouse=True)
def default_auth_override():
    """Default auth override for existing tests to keep them passing."""
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "11111111-1111-1111-1111-111111111111",
        "email": "student@example.com",
        "role": "authenticated",
    }
    yield
    app.dependency_overrides.pop(get_current_user, None)
