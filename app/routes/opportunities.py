import logging
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.models.opportunity import OpportunityResponse
from app.models.analysis import AnalysisRequest, AnalysisResponse
from app.supabase_service import get_supabase_client
from app.auth import get_current_user
from app.crewai_service import (
    CrewAIService,
    get_crewai_service,
    build_crewai_inputs,
    CrewAIConfigError,
    CrewAIAuthError,
    CrewAIKickoffError,
    CrewAIExecutionError,
    CrewAITimeoutError,
    CrewAIMalformedResultError,
)
from app.resume_service import get_user_resume_text

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Opportunities"])


def format_opportunity_record(rec: dict) -> dict:
    res = dict(rec)
    if "is_demo" not in res or res["is_demo"] is None:
        source_url = str(res.get("source_url") or "")
        source_name = str(res.get("source_name") or "")
        if "hackerearth.com" in source_url or source_name == "HackerEarth":
            res["is_demo"] = False
            res["source_name"] = res.get("source_name") or "HackerEarth"
        else:
            res["is_demo"] = True
            res["source_name"] = res.get("source_name") or "OpportunityOS Seed"
    if not res.get("status"):
        res["status"] = "active"
    if not res.get("last_verified_at"):
        res["last_verified_at"] = res.get("created_at")
    return res


@router.get(
    "/api/opportunities",
    response_model=List[OpportunityResponse],
    summary="List opportunities",
)
def list_opportunities(
    client: Client = Depends(get_supabase_client),
) -> List[OpportunityResponse]:
    """Retrieve opportunity records from the Supabase opportunities table."""
    try:
        response = client.table("opportunities").select("*").execute()
    except Exception as exc:
        logger.error("Supabase query error in list_opportunities: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve opportunities from database",
        )

    return [format_opportunity_record(r) for r in (response.data or [])]


def validate_opportunity_id(opportunity_id: str) -> str:
    """Validate that the path parameter is a valid UUID string."""
    try:
        return str(uuid.UUID(opportunity_id))
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid opportunity UUID format",
        )


@router.get(
    "/api/opportunities/{opportunity_id}",
    response_model=OpportunityResponse,
    summary="Get opportunity by ID",
)
def get_opportunity(
    valid_uuid: str = Depends(validate_opportunity_id),
    client: Client = Depends(get_supabase_client),
) -> OpportunityResponse:
    """Retrieve a single opportunity record by UUID."""
    try:
        response = client.table("opportunities").select("*").eq("id", valid_uuid).execute()
    except Exception as exc:
        logger.error("Supabase query error in get_opportunity: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve opportunity from database",
        )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Opportunity with ID '{valid_uuid}' not found",
        )

    return format_opportunity_record(response.data[0])


@router.post(
    "/api/opportunities/{opportunity_id}/analyze",
    response_model=AnalysisResponse,
    summary="Analyze opportunity fit for student",
)
def analyze_opportunity(
    body: AnalysisRequest,
    valid_uuid: str = Depends(validate_opportunity_id),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db_client: Client = Depends(get_supabase_client),
    crewai_svc: CrewAIService = Depends(get_crewai_service),
) -> AnalysisResponse:
    """
    Perform agentic analysis on a canonical Supabase opportunity using CrewAI.
    Enforces anti-hallucination boundaries and source_url integrity.
    """
    # 1. Fetch exact canonical opportunity from Supabase
    try:
        response = db_client.table("opportunities").select("*").eq("id", valid_uuid).execute()
    except Exception as exc:
        logger.error("Supabase query error in analyze_opportunity: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve opportunity from database",
        )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Opportunity with ID '{valid_uuid}' not found",
        )

    opportunity = response.data[0]
    db_source_url = opportunity.get("source_url")

    # 2. Retrieve real extracted resume text & profile for the authenticated student
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    stored_resume_text = None
    if user_id:
        try:
            stored_resume_text = get_user_resume_text(db_client, user_id)
        except Exception as exc:
            logger.debug("Error checking stored resume: %s", exc)

    # Use real extracted resume if available; otherwise use body.resume_text if supplied, else empty
    effective_resume_text = stored_resume_text if stored_resume_text else (body.resume_text or "")

    effective_profile = body.student_profile
    if not effective_profile and user_id:
        try:
            p_res = db_client.table("profiles").select("*").eq("user_id", user_id).execute()
            if p_res.data:
                effective_profile = p_res.data[0]
        except Exception as exc:
            logger.debug("Error loading student profile for analysis: %s", exc)

    inputs = build_crewai_inputs(
        opportunity=opportunity,
        student_profile=effective_profile,
        resume_text=effective_resume_text,
    )

    # 3. Call CrewAI service
    try:
        raw_result = crewai_svc.kickoff_and_poll(inputs)
    except CrewAIConfigError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CrewAI service is not configured",
        )
    except CrewAIAuthError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="CrewAI authentication failed",
        )
    except CrewAITimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="CrewAI execution timed out",
        )
    except CrewAIKickoffError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="CrewAI kickoff failed",
        )
    except CrewAIExecutionError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="CrewAI execution failed",
        )
    except CrewAIMalformedResultError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Malformed response received from CrewAI",
        )
    except Exception as exc:
        logger.error("Unexpected error during CrewAI analysis: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to complete opportunity analysis",
        )

    # 4. Critical source_url integrity enforcement
    if raw_result.get("source_url") != db_source_url:
        logger.warning("Overriding CrewAI source_url with canonical database source_url")
    raw_result["source_url"] = db_source_url

    # 5. Validate output structure with Pydantic
    try:
        return AnalysisResponse.model_validate(raw_result)
    except Exception as exc:
        logger.error("Analysis validation error: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="CrewAI analysis output did not match expected structure",
        )
