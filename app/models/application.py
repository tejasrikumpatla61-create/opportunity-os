import uuid
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


# Canonical mapping between student-facing UI status and Supabase check constraint
# Supabase constraint: status IN ('planning', 'in_progress', 'submitted')
STATUS_MAP_TO_DB = {
    "interested": "planning",
    "planning": "planning",
    "preparing": "in_progress",
    "in_progress": "in_progress",
    "ready": "in_progress",
    "applied": "submitted",
    "submitted": "submitted",
}

STATUS_MAP_TO_DISPLAY = {
    "planning": "Interested",
    "in_progress": "Preparing",
    "submitted": "Applied",
}


class ApplicationCreate(BaseModel):
    opportunity_id: uuid.UUID
    status: Optional[str] = "planning"


class ApplicationUpdate(BaseModel):
    status: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: str
    profile_id: str
    opportunity_id: str
    status: str
    display_status: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    opportunity: Optional[Dict[str, Any]] = None
    task_count: int = 0
    completed_task_count: int = 0
    progress_percentage: int = 0
