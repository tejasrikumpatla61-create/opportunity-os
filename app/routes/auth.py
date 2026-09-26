import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from supabase import Client

from app.auth import get_current_user
from app.supabase_service import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(
    body: SignupRequest,
    client: Client = Depends(get_supabase_client),
) -> AuthResponse:
    """Sign up a new user via Supabase Auth and initialize user profile."""
    try:
        # Create user via Supabase Admin Auth
        user_res = client.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
            "user_metadata": {"full_name": body.full_name or ""},
        })
        user = user_res.user
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user account",
            )
    except HTTPException:
        raise
    except Exception as exc:
        err_msg = str(exc)
        if "already registered" in err_msg.lower() or "already exists" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )
        logger.error("Supabase user creation failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed. Please check your credentials.",
        )

    # Initialize profile record in Supabase
    try:
        client.table("profiles").upsert({
            "user_id": str(user.id),
            "email": body.email,
            "full_name": body.full_name or "",
        }, on_conflict="user_id").execute()
    except Exception as exc:
        logger.warning("Could not initialize profile record on signup: %s", type(exc).__name__)

    # Sign in to generate access token
    try:
        session_res = client.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
        token = session_res.session.access_token
    except Exception as exc:
        logger.error("Auto sign-in after signup failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account created but initial login failed. Please sign in manually.",
        )

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user={
            "id": str(user.id),
            "email": body.email,
            "full_name": body.full_name or "",
        },
    )


@router.post("/login", response_model=AuthResponse)
def login(
    body: LoginRequest,
    client: Client = Depends(get_supabase_client),
) -> AuthResponse:
    """Log in an existing user with Supabase Auth credentials."""
    try:
        session_res = client.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
        session = session_res.session
        user = session_res.user
        if not session or not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Login failed for user: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return AuthResponse(
        access_token=session.access_token,
        token_type="bearer",
        user={
            "id": str(user.id),
            "email": str(user.email or ""),
        },
    )


@router.post("/logout")
def logout() -> Dict[str, str]:
    """Log out current user."""
    return {"status": "ok"}


@router.get("/me")
def get_me(
    current_user: Dict[str, Any] = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """Retrieve current authenticated user session and profile status."""
    user_id = current_user["id"]
    profile_data = None
    try:
        res = client.table("profiles").select("*").eq("user_id", user_id).execute()
        if res.data:
            profile_data = res.data[0]
    except Exception as exc:
        logger.error("Error retrieving profile in /me: %s", type(exc).__name__)

    return {
        "user": current_user,
        "profile": profile_data,
        "has_completed_onboarding": bool(profile_data and profile_data.get("degree")),
    }
