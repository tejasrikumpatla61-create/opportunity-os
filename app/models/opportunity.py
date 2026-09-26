from datetime import datetime
from typing import Any, Optional, Union
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class OpportunityResponse(BaseModel):
    """Pydantic response model representing an Opportunity record from Supabase."""

    id: Union[UUID, str]
    title: str
    organization: Optional[str] = None
    opportunity_type: Optional[str] = None
    description: Optional[str] = None
    eligibility: Optional[Any] = None
    required_skills: Optional[Any] = None
    requirements: Optional[Any] = None
    location: Optional[str] = None
    deadline: Optional[Union[datetime, str]] = None
    source_url: Optional[str] = None
    created_at: Optional[Union[datetime, str]] = None
    source_name: Optional[str] = None
    external_id: Optional[str] = None
    source_type: Optional[str] = None
    discovered_at: Optional[Union[datetime, str]] = None
    last_verified_at: Optional[Union[datetime, str]] = None
    status: Optional[str] = "active"
    is_demo: Optional[bool] = False
    relevance_score: Optional[int] = None

    model_config = ConfigDict(extra="ignore")
