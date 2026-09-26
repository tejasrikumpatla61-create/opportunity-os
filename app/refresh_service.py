"""Opportunity refresh service orchestrating sources, normalization, validation, deduplication, and expiration."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.opportunity_sources import (
    BaseOpportunitySource,
    HackerEarthSource,
    normalize_hackerearth_record,
    normalize_generic_record,
    validate_opportunity,
    Deduplicator,
    NormalizedOpportunity,
)
from app.supabase_service import get_supabase_client

logger = logging.getLogger(__name__)


class RefreshSummary(BaseModel):
    """Structured report returned after running source refreshes."""
    sources_checked: int = 0
    records_found: int = 0
    new_records: int = 0
    updated_records: int = 0
    duplicates_skipped: int = 0
    expired_records: int = 0
    failed_sources: List[str] = Field(default_factory=list)


def is_expired(deadline_str: Optional[str]) -> bool:
    """Check if an opportunity's deadline is in the past."""
    if not deadline_str:
        return False
    try:
        from dateutil import parser as dt_parser
        dl = dt_parser.parse(deadline_str)
        if dl.tzinfo is None:
            dl = dl.replace(tzinfo=timezone.utc)
        return dl < datetime.now(timezone.utc)
    except Exception:
        return False


def _safe_upsert_opportunity(client: Any, opp_data: Dict[str, Any], is_update: bool = False, opp_id: Optional[str] = None) -> bool:
    """
    Attempt to insert or update an opportunity in Supabase.
    If extended Phase 6 columns are not yet in the Postgres schema, fall back to core columns.
    """
    core_columns = [
        "title", "organization", "opportunity_type", "description",
        "eligibility", "required_skills", "requirements", "location",
        "deadline", "source_url"
    ]
    try:
        if is_update and opp_id:
            client.table("opportunities").update(opp_data).eq("id", opp_id).execute()
        else:
            client.table("opportunities").insert(opp_data).execute()
        return True
    except Exception as exc:
        err_msg = str(exc)
        if "does not exist" in err_msg or "PGRST204" in err_msg or "42703" in err_msg:
            logger.info("Extended column missing in Supabase schema. Retrying with core columns.")
            fallback_data = {k: v for k, v in opp_data.items() if k in core_columns}
            try:
                if is_update and opp_id:
                    client.table("opportunities").update(fallback_data).eq("id", opp_id).execute()
                else:
                    client.table("opportunities").insert(fallback_data).execute()
                return True
            except Exception as inner_exc:
                logger.error("Failed even with core columns: %s", str(inner_exc))
                return False
        else:
            logger.error("Supabase upsert error: %s", err_msg)
            return False


async def refresh_opportunities(
    sources: Optional[List[BaseOpportunitySource]] = None,
    client: Optional[Any] = None
) -> RefreshSummary:
    """
    Run enabled opportunity sources, normalize, validate, deduplicate against existing
    records, upsert to database, and expire past opportunities.
    """
    if client is None:
        client = get_supabase_client()

    if sources is None:
        sources = [HackerEarthSource()]

    summary = RefreshSummary()

    # 1. Retrieve current existing records from DB
    try:
        existing_res = client.table("opportunities").select("*").execute()
        existing_records = existing_res.data or []
    except Exception as exc:
        logger.error("Failed to load existing opportunities: %s", str(exc))
        existing_records = []

    deduplicator = Deduplicator(existing_records)

    # 2. Iterate through configured sources
    for source in sources:
        summary.sources_checked += 1
        try:
            raw_items = await source.fetch()
            summary.records_found += len(raw_items)

            for raw in raw_items:
                # Normalize based on source
                if raw.source_name == "HackerEarth":
                    norm = normalize_hackerearth_record(raw)
                else:
                    norm = normalize_generic_record(raw)

                # Validate
                is_valid, reason = validate_opportunity(norm)
                if not is_valid:
                    logger.warning("Rejected invalid record '%s': %s", norm.title, reason)
                    continue

                # Check expiration on incoming record
                if is_expired(norm.deadline):
                    norm.status = "expired"

                # Deduplicate
                matched = deduplicator.find_match(norm)
                if matched:
                    # Update existing record
                    opp_id = matched["id"]
                    update_dict = norm.to_supabase_dict()
                    update_dict["last_verified_at"] = datetime.now(timezone.utc).isoformat()
                    # Do not overwrite created_at or primary id
                    update_dict.pop("id", None)
                    success = _safe_upsert_opportunity(client, update_dict, is_update=True, opp_id=opp_id)
                    if success:
                        summary.updated_records += 1
                    else:
                        summary.duplicates_skipped += 1
                else:
                    # Insert new record
                    insert_dict = norm.to_supabase_dict()
                    success = _safe_upsert_opportunity(client, insert_dict, is_update=False)
                    if success:
                        summary.new_records += 1

        except Exception as exc:
            logger.error("Source '%s' failed during refresh: %s", source.source_name, str(exc))
            summary.failed_sources.append(source.source_name)

    # 3. Handle expiration of existing active opportunities
    now_utc = datetime.now(timezone.utc)
    for rec in existing_records:
        rec_status = rec.get("status", "active")
        rec_deadline = rec.get("deadline")
        if rec_status != "expired" and is_expired(rec_deadline):
            rec_id = rec.get("id")
            if rec_id:
                try:
                    client.table("opportunities").update({"status": "expired"}).eq("id", rec_id).execute()
                    summary.expired_records += 1
                except Exception as exc:
                    logger.debug("Could not update status to expired (column may not exist yet): %s", exc)

    logger.info(
        "Opportunity refresh complete: checked=%d found=%d new=%d updated=%d expired=%d failed=%d",
        summary.sources_checked,
        summary.records_found,
        summary.new_records,
        summary.updated_records,
        summary.expired_records,
        len(summary.failed_sources),
    )
    return summary
