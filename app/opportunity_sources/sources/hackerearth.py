"""Live opportunity source adapter for HackerEarth challenges."""

import logging
from typing import List
import httpx
from app.opportunity_sources.base import BaseOpportunitySource, RawOpportunity

logger = logging.getLogger(__name__)


class HackerEarthSource(BaseOpportunitySource):
    """
    Live source adapter connecting to HackerEarth's public events API.
    Fetches real, active hackathons and coding challenges.
    """

    API_URL = "https://www.hackerearth.com/chrome-extension/events/"

    @property
    def source_name(self) -> str:
        return "HackerEarth"

    @property
    def is_live(self) -> bool:
        return True

    async def fetch(self) -> List[RawOpportunity]:
        """Fetch real active events from HackerEarth."""
        raw_items: List[RawOpportunity] = []
        headers = {
            "User-Agent": "OpportunityOS-Platform/1.0 (Student Career Intelligence)",
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(self.API_URL, headers=headers)
                if response.status_code != 200:
                    logger.warning("HackerEarth API returned status %d", response.status_code)
                    return []

                payload = response.json()
                events = payload.get("response", [])
                if not isinstance(events, list):
                    logger.warning("Unexpected HackerEarth response format")
                    return []

                for event in events:
                    if isinstance(event, dict) and event.get("title") and event.get("url"):
                        raw_items.append(
                            RawOpportunity(
                                source_name=self.source_name,
                                source_type="public_api",
                                raw_data=event,
                            )
                        )

            logger.info("Successfully fetched %d raw records from %s", len(raw_items), self.source_name)
            return raw_items
        except Exception as exc:
            logger.error("Failed to fetch from HackerEarth: %s", str(exc))
            raise RuntimeError(f"HackerEarth fetch failed: {str(exc)}") from exc
