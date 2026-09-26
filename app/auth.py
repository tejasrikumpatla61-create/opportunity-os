import logging
from typing import Any, Dict, Optional
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client

from app.supabase_service import get_supabase_client

logger = logging.getLogger(__name__)

security_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """
    Validate Supabase Auth access token and return authenticated user identity.
    Derives user ID strictly from the validated token. Never trusts client user_id.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials.strip()

    try:
        user_response = client.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user = user_response.user
        return {
            "id": str(user.id),
            "email": str(user.email or ""),
            "role": str(user.role or "authenticated"),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Token verification error: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_profile_id(
    current_user: Dict[str, Any] = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
) -> str:
    """
    Resolve and return the canonical profile primary key (profiles.id) for the authenticated user.
    Auto-initializes profile record if not present.
    """
    user_id = current_user["id"]
    try:
        res = client.table("profiles").select("id").eq("user_id", user_id).execute()
        if res.data and len(res.data) > 0:
            return str(res.data[0]["id"])

        # Check by id directly
        res_by_id = client.table("profiles").select("id").eq("id", user_id).execute()
        if res_by_id.data and len(res_by_id.data) > 0:
            return str(res_by_id.data[0]["id"])

        # Auto-initialize minimal profile
        insert_res = client.table("profiles").insert({
            "user_id": user_id,
            "email": current_user.get("email", ""),
            "full_name": current_user.get("email", "").split("@")[0],
        }).execute()
        if insert_res.data and len(insert_res.data) > 0:
            return str(insert_res.data[0]["id"])
    except Exception as exc:
        logger.error("Error resolving profile_id for user %s: %s", user_id, type(exc).__name__)

    # Fallback to user_id string
    return str(user_id)


def require_admin_user(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Enforce server-side admin authorization.
    Verifies user has admin role or is explicitly listed in ADMIN_EMAILS.
    Ordinary students are rejected with HTTP 403 Forbidden.
    """
    from app.config import get_settings
    settings = get_settings()
    admin_emails = settings.ADMIN_EMAILS if isinstance(settings.ADMIN_EMAILS, list) else [settings.ADMIN_EMAILS]
    
    user_email = str(current_user.get("email") or "").strip().lower()
    user_role = str(current_user.get("role") or "").strip().lower()

    if user_role == "admin" or user_email in admin_emails:
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin authorization required.",
    )

