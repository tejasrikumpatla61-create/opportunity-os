"""Admin and maintenance endpoints for OpportunityOS."""

import logging
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user
from app.refresh_service import refresh_opportunities, RefreshSummary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/opportunities/refresh", response_model=RefreshSummary)
async def trigger_opportunities_refresh(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> RefreshSummary:
    """
    Trigger automated refresh from verified live opportunity sources.
    Protected endpoint: requires valid authenticated session.
    """
    try:
        summary = await refresh_opportunities()
        return summary
    except Exception as exc:
        logger.error("Admin refresh failed: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete opportunity refresh.",
        ) from None
