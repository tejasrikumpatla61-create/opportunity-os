import uuid
from typing import Any, List, Optional
from pydantic import BaseModel, Field


PRIORITY_MAP_TO_DB = {
    "low": "low",
    "medium": "medium",
    "high": "high",
    "critical": "critical",
    "urgent": "critical",
    "normal": "medium",
}

STATUS_MAP_TO_DB = {
    "pending": "pending",
    "todo": "pending",
    "in_progress": "pending",
    "completed": "completed",
    "done": "completed",
}


class TaskCreate(BaseModel):
    application_id: uuid.UUID
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    due_date: Optional[str] = None
    status: Optional[str] = "pending"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None


class TaskResponse(BaseModel):
    id: str
    application_id: str
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    status: str = "pending"
    is_completed: bool = False
    due_date: Optional[str] = None
    created_at: Optional[str] = None
    opportunity_id: Optional[str] = None
    opportunity_title: Optional[str] = None


class ActionPlanTaskImport(BaseModel):
    opportunity_id: uuid.UUID
    tasks: List[Any] = Field(default_factory=list)
