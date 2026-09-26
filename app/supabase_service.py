import logging
from typing import Optional
from supabase import create_client, Client
from app.config import get_settings

logger = logging.getLogger(__name__)


class SupabaseConfigError(RuntimeError):
    """Raised when required Supabase configuration is missing or invalid."""
    pass


_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """
    Return a centralized Supabase client instance using server-side service role credentials.
    Fails clearly if required Supabase configuration is unavailable.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise SupabaseConfigError(
            "Supabase configuration is missing. Ensure SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY environment variables are set."
        )

    url = settings.SUPABASE_URL.strip().rstrip("/")
    if url.endswith("/rest/v1"):
        url = url[:-len("/rest/v1")].rstrip("/")

    try:
        _supabase_client = create_client(
            url,
            settings.SUPABASE_SERVICE_ROLE_KEY.strip(),
        )
        return _supabase_client
    except Exception as exc:
        logger.error("Failed to initialize Supabase client: %s", type(exc).__name__)
        raise RuntimeError("Failed to initialize Supabase client") from None


def reset_supabase_client() -> None:
    """Reset the cached Supabase client instance (used primarily in testing)."""
    global _supabase_client
    _supabase_client = None
