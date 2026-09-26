import logging
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client

from app.auth import get_current_user
from app.supabase_service import get_supabase_client
from app.gemini_service import (
    GeminiService,
    get_gemini_service,
    GeminiConfigError,
    GeminiApiError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assistant", tags=["Assistant"])


class AssistantChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    opportunity_id: Optional[uuid.UUID] = None


class AssistantChatResponse(BaseModel):
    message: str
    suggested_actions: List[str] = Field(default_factory=list)


@router.post("/chat", response_model=AssistantChatResponse)
def assistant_chat(
    body: AssistantChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db_client: Client = Depends(get_supabase_client),
    gemini_svc: GeminiService = Depends(get_gemini_service),
) -> AssistantChatResponse:
    """
    Opportunity AI assistant endpoint.
    Calls backend-only Gemini model grounded on user's profile and canonical opportunity.
    """
    user_id = current_user["id"]

    # 1. Fetch user profile context
    profile_context = None
    profile_id = None
    try:
        prof_res = db_client.table("profiles").select("*").eq("user_id", user_id).execute()
        if prof_res.data:
            full_prof = prof_res.data[0]
            profile_id = full_prof.get("id")
            # Sanitize to relevant context fields
            profile_context = {
                "full_name": full_prof.get("full_name"),
                "college": full_prof.get("college"),
                "degree": full_prof.get("degree"),
                "branch": full_prof.get("branch"),
                "study_year": full_prof.get("study_year"),
                "skills": full_prof.get("skills", []),
                "interests": full_prof.get("interests", []),
                "preferred_opportunity_types": full_prof.get("preferred_opportunity_types", []),
                "resume_available": full_prof.get("resume_available", False),
            }
    except Exception as exc:
        logger.warning("Could not load user profile for assistant chat: %s", type(exc).__name__)

    # 2. Fetch canonical opportunity if opportunity_id provided
    opportunity_context = None
    application_context = None
    tasks_context = None

    if body.opportunity_id:
        opp_id_str = str(body.opportunity_id)
        try:
            opp_res = db_client.table("opportunities").select("*").eq("id", opp_id_str).execute()
            if opp_res.data:
                canonical = opp_res.data[0]
                opportunity_context = {
                    "id": canonical.get("id"),
                    "title": canonical.get("title"),
                    "organization": canonical.get("organization"),
                    "opportunity_type": canonical.get("opportunity_type"),
                    "description": canonical.get("description"),
                    "eligibility": canonical.get("eligibility"),
                    "required_skills": canonical.get("required_skills"),
                    "requirements": canonical.get("requirements"),
                    "location": canonical.get("location"),
                    "deadline": str(canonical.get("deadline")) if canonical.get("deadline") else None,
                    "source_url": canonical.get("source_url"),
                }
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Opportunity with ID '{opp_id_str}' not found",
                )
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Error fetching opportunity for assistant: %s", type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error retrieving opportunity context",
            )

        # 3. Fetch user's tracked application and tasks for this opportunity
        if profile_id:
            try:
                app_res = (
                    db_client.table("applications")
                    .select("*")
                    .eq("profile_id", profile_id)
                    .eq("opportunity_id", opp_id_str)
                    .execute()
                )
                if app_res.data:
                    app_row = app_res.data[0]
                    application_context = {
                        "application_id": app_row["id"],
                        "status": app_row.get("status"),
                    }
                    # Fetch linked tasks
                    task_res = (
                        db_client.table("tasks")
                        .select("title, priority, status, due_date")
                        .eq("application_id", app_row["id"])
                        .execute()
                    )
                    if task_res.data:
                        tasks_context = task_res.data
            except Exception as exc:
                logger.debug("Notice fetching application/task context for assistant: %s", exc)

    elif profile_id:
        # User has not selected a specific opportunity; load active applications summary if any
        try:
            apps_res = (
                db_client.table("applications")
                .select("id, status, opportunity_id")
                .eq("profile_id", profile_id)
                .limit(5)
                .execute()
            )
            if apps_res.data:
                application_context = {
                    "tracked_application_count": len(apps_res.data),
                    "applications": [
                        {"opportunity_id": a.get("opportunity_id"), "status": a.get("status")}
                        for a in apps_res.data
                    ],
                }
        except Exception as exc:
            logger.debug("Notice loading user applications overview: %s", exc)

    # 4. Call backend Gemini service
    try:
        result = gemini_svc.generate_chat_response(
            user_message=body.message,
            profile_context=profile_context,
            opportunity_context=opportunity_context,
            application_context=application_context,
            tasks_context=tasks_context,
        )
        return AssistantChatResponse(**result)
    except GeminiConfigError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Opportunity AI is being connected. (GEMINI_API_KEY required for live assistant verification.)",
        )
    except GeminiApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI assistant service encountered an error. Please try again.",
        )
    except Exception as exc:
        logger.error("Unexpected error in assistant chat: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate assistant response",
        )
