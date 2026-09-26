"""Validation rules for live incoming opportunities."""

import re
from typing import Tuple, Optional
from urllib.parse import urlparse
from app.opportunity_sources.base import NormalizedOpportunity


ALLOWED_OPPORTUNITY_TYPES = {
    "Hackathon", "Internship", "Scholarship", "Fellowship", "Grant", "Program"
}


def is_valid_http_url(url: Optional[str]) -> bool:
    """Validate that a URL has a valid http/https scheme and network location."""
    if not url or not isinstance(url, str):
        return False
    try:
        parsed = urlparse(url.strip())
        return parsed.scheme in ("http", "https") and bool(parsed.netloc) and "." in parsed.netloc
    except Exception:
        return False


def validate_opportunity(opp: NormalizedOpportunity) -> Tuple[bool, Optional[str]]:
    """
    Validate normalized opportunity against strict sanity and source safety rules.
    Returns (is_valid, rejection_reason).
    """
    # 1. Title verification
    if not opp.title or len(opp.title.strip()) < 3:
        return False, "Title is missing or too short"

    # 2. Organization verification
    if not opp.organization or len(opp.organization.strip()) < 2:
        return False, "Organization is missing or too short"

    # 3. Opportunity type verification
    if not opp.opportunity_type or opp.opportunity_type not in ALLOWED_OPPORTUNITY_TYPES:
        return False, f"Invalid opportunity type: {opp.opportunity_type}"

    # 4. Source URL verification (must be a valid, real external URL)
    if not is_valid_http_url(opp.source_url):
        return False, f"Invalid or missing source URL: {opp.source_url}"

    # 5. Source name verification
    if not opp.source_name or len(opp.source_name.strip()) < 2:
        return False, "Source name is missing"

    # 6. Deadline sanity: if provided, must be ISO format
    if opp.deadline:
        iso_pattern = r"^\d{4}-\d{2}-\d{2}"
        if not re.match(iso_pattern, opp.deadline):
            return False, f"Malformed deadline timestamp: {opp.deadline}"

    # 7. Structural validity
    if not isinstance(opp.required_skills, list) or not isinstance(opp.requirements, list):
        return False, "Skills and requirements must be structured lists"

    return True, None
