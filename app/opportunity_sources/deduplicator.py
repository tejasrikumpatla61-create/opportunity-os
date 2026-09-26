"""Deduplication and fingerprinting for incoming opportunities."""

import hashlib
import re
from typing import Dict, List, Optional
from app.opportunity_sources.base import NormalizedOpportunity


def normalize_string(val: Optional[str]) -> str:
    """Normalize string for canonical fingerprint comparison."""
    if not val:
        return ""
    cleaned = val.lower().strip()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", "", cleaned))


def compute_fingerprint(opp: NormalizedOpportunity) -> str:
    """
    Compute a deterministic fingerprint for an opportunity.
    Priority 1: source_name + external_id
    Priority 2: normalized organization + normalized title + source_url + deadline
    """
    if opp.source_name and opp.external_id:
        seed = f"{opp.source_name.strip().lower()}::{opp.external_id.strip()}"
        return hashlib.sha256(seed.encode("utf-8")).hexdigest()

    norm_org = normalize_string(opp.organization)
    norm_title = normalize_string(opp.title)
    clean_url = (opp.source_url or "").strip().lower().rstrip("/")
    clean_deadline = (opp.deadline or "")[:10]  # Date portion
    
    seed = f"{norm_org}|{norm_title}|{clean_url}|{clean_deadline}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


class Deduplicator:
    """
    Tracks existing database opportunities and matches incoming opportunities
    by external_id, exact source_url, or deterministic title/org fingerprint.
    """

    def __init__(self, existing_records: List[Dict]):
        # Map: (source_name, external_id) -> record
        self.by_external_id: Dict[str, Dict] = {}
        # Map: normalized source_url -> record
        self.by_url: Dict[str, Dict] = {}
        # Map: fingerprint -> record
        self.by_fingerprint: Dict[str, Dict] = {}

        for rec in existing_records:
            source_name = rec.get("source_name")
            ext_id = rec.get("external_id")
            if source_name and ext_id:
                key = f"{str(source_name).strip().lower()}::{str(ext_id).strip()}"
                self.by_external_id[key] = rec

            raw_url = rec.get("source_url")
            if raw_url and str(raw_url).strip():
                clean_url = str(raw_url).strip().lower().rstrip("/")
                self.by_url[clean_url] = rec

            # Fingerprint on existing record
            norm_org = normalize_string(rec.get("organization"))
            norm_title = normalize_string(rec.get("title"))
            clean_deadline = (rec.get("deadline") or "")[:10]
            clean_url = (rec.get("source_url") or "").strip().lower().rstrip("/")
            fp = hashlib.sha256(f"{norm_org}|{norm_title}|{clean_url}|{clean_deadline}".encode("utf-8")).hexdigest()
            self.by_fingerprint[fp] = rec

    def find_match(self, opp: NormalizedOpportunity) -> Optional[Dict]:
        """Find an existing record matching the incoming opportunity."""
        # 1. Match by source_name + external_id
        if opp.source_name and opp.external_id:
            key = f"{opp.source_name.strip().lower()}::{opp.external_id.strip()}"
            if key in self.by_external_id:
                return self.by_external_id[key]

        # 2. Match by exact canonical source_url
        if opp.source_url:
            clean_url = opp.source_url.strip().lower().rstrip("/")
            if clean_url in self.by_url:
                return self.by_url[clean_url]

        # 3. Match by content fingerprint
        norm_org = normalize_string(opp.organization)
        norm_title = normalize_string(opp.title)
        clean_url = (opp.source_url or "").strip().lower().rstrip("/")
        clean_deadline = (opp.deadline or "")[:10]
        fp = hashlib.sha256(f"{norm_org}|{norm_title}|{clean_url}|{clean_deadline}".encode("utf-8")).hexdigest()
        return self.by_fingerprint.get(fp)

