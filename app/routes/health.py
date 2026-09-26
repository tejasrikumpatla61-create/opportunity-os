from typing import Dict
from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check() -> Dict[str, str]:
    """Health check endpoint to verify backend service status."""
    return {
        "status": "healthy",
        "service": "opportunityos-backend",
    }
