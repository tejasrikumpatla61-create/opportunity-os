import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from supabase import Client

from app.auth import get_current_user
from app.supabase_service import get_supabase_client
from app.resume_service import (
    validate_and_extract_resume,
    save_resume_and_metadata,
    get_user_resume_metadata,
    delete_user_resume,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/profile", tags=["Profile"])


class ResumeMetadataResponse(BaseModel):
    resume_available: bool = False
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_at: Optional[str] = None
    message: Optional[str] = None


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
    resume_file_name: Optional[str] = None
    resume_uploaded_at: Optional[str] = None
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


@router.post("/resume", response_model=ResumeMetadataResponse, status_code=status.HTTP_200_OK)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
) -> ResumeMetadataResponse:
    """
    Upload and extract a student resume (PDF or DOCX, max 5 MB).
    Files are stored in private Supabase Storage scoped to the authenticated user.
    Extracted text and metadata are saved server-side.
    """
    user_id = current_user["id"]
    file_bytes = await file.read()

    safe_filename, extracted_text = validate_and_extract_resume(
        filename=file.filename,
        content_type=file.content_type,
        file_bytes=file_bytes,
    )

    meta = save_resume_and_metadata(
        client=client,
        user_id=user_id,
        safe_filename=safe_filename,
        file_bytes=file_bytes,
        extracted_text=extracted_text,
    )

    return ResumeMetadataResponse(
        resume_available=True,
        file_name=meta.get("file_name"),
        file_size=meta.get("file_size"),
        uploaded_at=meta.get("uploaded_at"),
        message="Resume uploaded and processed successfully.",
    )


@router.get("/resume", response_model=ResumeMetadataResponse)
def get_resume(
    current_user: Dict[str, Any] = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
) -> ResumeMetadataResponse:
    """Retrieve metadata for the authenticated user's resume."""
    user_id = current_user["id"]
    meta = get_user_resume_metadata(client, user_id)
    return ResumeMetadataResponse(**meta)


@router.delete("/resume", response_model=ResumeMetadataResponse)
def delete_resume(
    current_user: Dict[str, Any] = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
) -> ResumeMetadataResponse:
    """Delete the authenticated user's stored resume and clear metadata."""
    user_id = current_user["id"]
    delete_user_resume(client, user_id)
    return ResumeMetadataResponse(
        resume_available=False,
        file_name=None,
        file_size=None,
        uploaded_at=None,
        message="Resume deleted successfully.",
    )
