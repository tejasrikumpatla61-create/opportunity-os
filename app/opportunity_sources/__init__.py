"""Opportunity sources package."""

from app.opportunity_sources.base import BaseOpportunitySource, RawOpportunity, NormalizedOpportunity
from app.opportunity_sources.normalizer import (
    normalize_hackerearth_record,
    normalize_generic_record,
    normalize_opportunity_type,
)
from app.opportunity_sources.validator import validate_opportunity
from app.opportunity_sources.deduplicator import Deduplicator, compute_fingerprint
from app.opportunity_sources.sources.hackerearth import HackerEarthSource
from app.opportunity_sources.sources.manual import UNSUPPORTED_SOURCES, ManualSource

__all__ = [
    "BaseOpportunitySource",
    "RawOpportunity",
    "NormalizedOpportunity",
    "normalize_hackerearth_record",
    "normalize_generic_record",
    "normalize_opportunity_type",
    "validate_opportunity",
    "Deduplicator",
    "compute_fingerprint",
    "HackerEarthSource",
    "UNSUPPORTED_SOURCES",
    "ManualSource",
]
