from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field, field_validator


class EligibilityStatus(str, Enum):
    ELIGIBLE = "ELIGIBLE"
    LIKELY_ELIGIBLE = "LIKELY_ELIGIBLE"
    UNCERTAIN = "UNCERTAIN"
    LIKELY_INELIGIBLE = "LIKELY_INELIGIBLE"
    INELIGIBLE = "INELIGIBLE"


class AnalysisRequest(BaseModel):
    """Temporary request payload for opportunity analysis."""

    student_profile: Optional[Dict[str, Any]] = None
    resume_text: Optional[str] = ""

    model_config = ConfigDict(extra="ignore")


class AnalysisResponse(BaseModel):
    """Pydantic model validating CrewAI analysis result."""

    source_url: Optional[str] = None
    match_level: Optional[str] = None
    match_score: int = Field(..., ge=0, le=100)
    matched_skills: List[str] = Field(default_factory=list)
    documents_needed: List[str] = Field(default_factory=list)
    eligibility_status: EligibilityStatus
    eligibility_summary: Optional[str] = None
    application_blockers: List[str] = Field(default_factory=list)
    matched_requirements: List[str] = Field(default_factory=list)
    missing_requirements: List[str] = Field(default_factory=list)
    unknown_requirements: List[str] = Field(default_factory=list)
    skills_with_no_evidence: List[str] = Field(default_factory=list)
    recommended_next_action: Optional[str] = None
    tasks: List[Union[str, Dict[str, Any]]] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")

    @field_validator("eligibility_status", mode="before")
    @classmethod
    def normalize_eligibility_status(cls, v: Any) -> str:
        if isinstance(v, str):
            clean = v.strip().upper().replace(" ", "_")
            valid = {s.value for s in EligibilityStatus}
            if clean in valid:
                return clean
        return v

    @field_validator("match_score", mode="before")
    @classmethod
    def normalize_match_score(cls, v: Any) -> int:
        if isinstance(v, (int, float)):
            return int(round(v))
        if isinstance(v, str):
            clean = v.strip().replace("%", "")
            try:
                return int(round(float(clean)))
            except ValueError:
                pass
        return v

    @field_validator(
        "matched_skills",
        "documents_needed",
        "application_blockers",
        "matched_requirements",
        "missing_requirements",
        "unknown_requirements",
        "skills_with_no_evidence",
        mode="before",
    )
    @classmethod
    def ensure_string_list(cls, v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, list):
            res = []
            for item in v:
                if isinstance(item, str):
                    res.append(item)
                elif isinstance(item, dict):
                    val = next(iter(item.values()), str(item))
                    res.append(str(val))
                else:
                    res.append(str(item))
            return res
        if isinstance(v, str):
            return [v] if v.strip() else []
        return []
