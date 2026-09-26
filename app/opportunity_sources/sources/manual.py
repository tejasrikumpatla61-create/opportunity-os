"""Declarations of unsupported / manual opportunity sources."""

from typing import List
from app.opportunity_sources.base import BaseOpportunitySource, RawOpportunity


class ManualSource(BaseOpportunitySource):
    """
    Represents sources that require human curation or cannot be automated safely
    (e.g., due to anti-bot measures, login requirements, or terms of service).
    """

    def __init__(self, name: str, reason: str):
        self._name = name
        self._reason = reason

    @property
    def source_name(self) -> str:
        return self._name

    @property
    def is_live(self) -> bool:
        return False

    @property
    def unsupported_reason(self) -> str:
        return self._reason

    async def fetch(self) -> List[RawOpportunity]:
        # Strictly manual — does not attempt scraping or unauthorized requests
        return []


# Registry of known sources that are marked manual/unsupported for compliance & safety
UNSUPPORTED_SOURCES = [
    ManualSource("LinkedIn Jobs", "Requires user authentication and anti-bot protection"),
    ManualSource("Handshake", "Requires verified university SSO login"),
    ManualSource("Indeed Internships", "Restricts automated scraping per robots.txt and Cloudflare"),
]
