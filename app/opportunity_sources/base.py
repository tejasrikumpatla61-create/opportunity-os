"""Base abstractions and data models for OpportunityOS opportunity sources."""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class RawOpportunity(BaseModel):
    """Raw payload received from an upstream source before normalization."""
    source_name: str
    source_type: str  # e.g., 'public_api', 'web_feed'
    raw_data: Dict[str, Any]
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NormalizedOpportunity(BaseModel):
    """Canonical representation of an opportunity across all sources."""
    id: Optional[str] = None
    title: str
    organization: str
    opportunity_type: str  # 'Hackathon' | 'Internship' | 'Scholarship' | 'Fellowship' | 'Grant' | 'Program'
    description: str = ""
    eligibility: Optional[str] = None
    required_skills: List[str] = Field(default_factory=list)
    requirements: List[str] = Field(default_factory=list)
    location: Optional[str] = "Online / Global"
    deadline: Optional[str] = None  # ISO-8601 string
    source_name: str
    source_url: str
    external_id: Optional[str] = None
    discovered_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_verified_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: str = "active"  # 'active' | 'expired' | 'unverified'
    is_demo: bool = False

    def to_supabase_dict(self) -> Dict[str, Any]:
        """Convert to dict matching Supabase opportunities schema."""
        data = {
            "title": self.title,
            "organization": self.organization,
            "opportunity_type": self.opportunity_type,
            "description": self.description,
            "eligibility": self.eligibility,
            "required_skills": self.required_skills,
            "requirements": self.requirements,
            "location": self.location,
            "deadline": self.deadline,
            "source_url": self.source_url,
        }
        # Include extended tracking fields
        data["source_name"] = self.source_name
        data["external_id"] = self.external_id
        data["source_type"] = "live_source"
        data["discovered_at"] = self.discovered_at
        data["last_verified_at"] = self.last_verified_at
        data["status"] = self.status
        data["is_demo"] = self.is_demo
        if self.id:
            data["id"] = self.id
        return data


class BaseOpportunitySource(ABC):
    """Abstract base class for all opportunity source adapters."""

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Human-readable identifier for the source."""
        pass

    @property
    @abstractmethod
    def is_live(self) -> bool:
        """True if the adapter actively connects to a live automated feed."""
        pass

    @abstractmethod
    async def fetch(self) -> List[RawOpportunity]:
        """Fetch raw opportunities from the provider."""
        pass
