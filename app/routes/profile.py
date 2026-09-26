import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client

from app.auth import get_current_user
from app.supabase_service import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/profile", tags=["Profile"])


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    study_year: Optional[int] = Field(default=None, ge=1, le=10)
    location: Optional[str] = None
    skills: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    preferred_opportunity_types: Optional[List[str]] = None
    resume_available: Optional[bool] = None


class ProfileResponse(BaseModel):
    id: Optional[str] = None
    user_id: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    study_year: Optional[int] = None
    location: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    interests: List[str] = Field(default_factory=list)
    preferred_opportunity_types: List[str] = Field(default_factory=list)
    resume_available: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@router.get("", response_model=ProfileResponse)
def get_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
) -> ProfileResponse:
    """Retrieve the authenticated user's profile. Strictly scoped to authenticated user_id."""
    user_id = current_user["id"]
    try:
        res = client.table("profiles").select("*").eq("user_id", user_id).execute()
        if res.data:
            return ProfileResponse(**res.data[0])
    except Exception as exc:
        logger.error("Supabase error fetching profile: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user profile",
        )

    # Return default empty profile if none exists yet
    return ProfileResponse(
        user_id=user_id,
        email=current_user.get("email"),
        full_name="",
        skills=[],
        interests=[],
        preferred_opportunity_types=[],
        resume_available=False,
    )


@router.patch("", response_model=ProfileResponse)
def update_profile(
    body: ProfileUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
) -> ProfileResponse:
    """
    Update or initialize the authenticated user's profile.
    Strictly scoped to authenticated user_id. Overwrite of other users is prevented.
    """
    user_id = current_user["id"]
    update_data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    update_data["user_id"] = user_id
    if not update_data.get("email"):
        update_data["email"] = current_user.get("email")

    try:
        # Check if profile already exists for this user_id
        check_res = client.table("profiles").select("id").eq("user_id", user_id).execute()
        if check_res.data:
            res = (
                client.table("profiles")
                .update(update_data)
                .eq("user_id", user_id)
                .execute()
            )
        else:
            res = client.table("profiles").insert(update_data).execute()

        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to persist profile data",
            )
        return ProfileResponse(**res.data[0])
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Supabase error updating profile: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile",
        )
