"""Normalization layer for converting raw source payloads into Canonical Opportunity representation."""

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from dateutil import parser as date_parser
from app.opportunity_sources.base import RawOpportunity, NormalizedOpportunity


STANDARD_OPPORTUNITY_TYPES = {
    "hackathon": "Hackathon",
    "challenge": "Hackathon",
    "competition": "Hackathon",
    "internship": "Internship",
    "fellowship": "Fellowship",
    "scholarship": "Scholarship",
    "grant": "Grant",
    "program": "Program",
}


def normalize_opportunity_type(raw_type: Optional[str]) -> str:
    """Normalize free-text opportunity types to standard types."""
    if not raw_type:
        return "Hackathon"
    cleaned = raw_type.strip().lower()
    for key, standard in STANDARD_OPPORTUNITY_TYPES.items():
        if key in cleaned:
            return standard
    return "Program"


def parse_datetime_safe(date_str: Optional[str]) -> Optional[str]:
    """Parse various datetime representations into ISO-8601 UTC string."""
    if not date_str or not isinstance(date_str, str):
        return None
    cleaned = date_str.strip()
    if not cleaned:
        return None
    try:
        dt = date_parser.parse(cleaned)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.isoformat()
    except (ValueError, TypeError, OverflowError):
        return None


def extract_skills_heuristic(text: str) -> List[str]:
    """Extract common tech skills mentioned in descriptions."""
    common_skills = [
        "Python", "JavaScript", "TypeScript", "React", "Node.js", "Java",
        "C++", "C#", "Go", "Rust", "SQL", "Machine Learning", "AI",
        "Cybersecurity", "Cloud", "AWS", "Azure", "Docker", "Kubernetes",
        "Data Science", "Web Development", "Mobile Development", "Blockchain"
    ]
    found = []
    text_lower = f" {text.lower()} "
    for skill in common_skills:
        pattern = r"\b" + re.escape(skill.lower()) + r"\b"
        if re.search(pattern, text_lower):
            found.append(skill)
    return found


def normalize_hackerearth_record(raw: RawOpportunity) -> NormalizedOpportunity:
    """Normalize a record from HackerEarth API."""
    data = raw.raw_data
    title = str(data.get("title", "")).strip()
    org = "HackerEarth"
    desc = str(data.get("description", "")).strip()
    url = str(data.get("url", "")).strip()
    
    # Deadline: HackerEarth provides 'end_utc_tz' or 'end_tz' or 'end_timestamp'
    raw_deadline = data.get("end_utc_tz") or data.get("end_tz") or data.get("end_timestamp")
    deadline = parse_datetime_safe(str(raw_deadline) if raw_deadline else None)
    
    # External ID from URL slug or title
    slug = url.rstrip("/").split("/")[-1] if url else re.sub(r"[^a-zA-Z0-9]+", "-", title.lower()).strip("-")
    
    skills = extract_skills_heuristic(f"{title} {desc}")
    if not skills:
        skills = ["Software Engineering", "Problem Solving"]

    return NormalizedOpportunity(
        title=title,
        organization=org,
        opportunity_type="Hackathon",
        description=desc or "Challenge hosted on HackerEarth platform.",
        eligibility="Open to global developers, university students, and technology enthusiasts.",
        required_skills=skills,
        requirements=["Online Registration", "Working Prototype or Submission", "Active HackerEarth Profile"],
        location="Online / Global",
        deadline=deadline,
        source_name=raw.source_name,
        source_url=url,
        external_id=slug,
        discovered_at=raw.fetched_at.isoformat(),
        last_verified_at=datetime.now(timezone.utc).isoformat(),
        status="active",
        is_demo=False,
    )


def normalize_generic_record(raw: RawOpportunity) -> NormalizedOpportunity:
    """Fallback normalizer for generic structured records."""
    data = raw.raw_data
    title = str(data.get("title", "")).strip()
    org = str(data.get("organization") or data.get("company") or raw.source_name).strip()
    desc = str(data.get("description", "")).strip()
    url = str(data.get("source_url") or data.get("url", "")).strip()
    opp_type = normalize_opportunity_type(str(data.get("opportunity_type") or data.get("type", "Hackathon")))
    
    deadline = parse_datetime_safe(data.get("deadline") or data.get("end_date"))
    external_id = str(data.get("external_id") or data.get("id") or "").strip() or None
    
    skills = data.get("required_skills")
    if not isinstance(skills, list):
        skills = extract_skills_heuristic(f"{title} {desc}")
    
    return NormalizedOpportunity(
        title=title,
        organization=org,
        opportunity_type=opp_type,
        description=desc,
        eligibility=data.get("eligibility") or "Refer to official source guidelines.",
        required_skills=skills or ["General"],
        requirements=data.get("requirements") or ["Online Application"],
        location=data.get("location") or "Online / Global",
        deadline=deadline,
        source_name=raw.source_name,
        source_url=url,
        external_id=external_id,
        discovered_at=raw.fetched_at.isoformat(),
        last_verified_at=datetime.now(timezone.utc).isoformat(),
        status="active",
        is_demo=False,
    )
