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
    try:
        prof_res = db_client.table("profiles").select("*").eq("user_id", user_id).execute()
        if prof_res.data:
            profile_context = prof_res.data[0]
    except Exception as exc:
        logger.warning("Could not load user profile for assistant chat: %s", type(exc).__name__)

    # 2. Fetch canonical opportunity if opportunity_id provided
    opportunity_context = None
    if body.opportunity_id:
        opp_id_str = str(body.opportunity_id)
        try:
            opp_res = db_client.table("opportunities").select("*").eq("id", opp_id_str).execute()
            if opp_res.data:
                opportunity_context = opp_res.data[0]
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

    # 3. Call backend Gemini service
    try:
        result = gemini_svc.generate_chat_response(
            user_message=body.message,
            profile_context=profile_context,
            opportunity_context=opportunity_context,
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
