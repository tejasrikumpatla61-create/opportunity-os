"""Feed endpoints providing personalized opportunity sections and checkpoints."""

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from dateutil import parser as dt_parser

from app.auth import get_current_user
from app.personalization import calculate_relevance_score
from app.refresh_service import is_expired
from app.supabase_service import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/feed", tags=["feed"])


def _parse_iso(dt_val: Any) -> Optional[datetime]:
    if not dt_val:
        return None
    try:
        dt = dt_parser.parse(str(dt_val))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _enrich_opportunity(opp: Dict[str, Any], profile: Dict[str, Any]) -> Dict[str, Any]:
    """Attach dynamic relevance_score, status, and is_demo indicators."""
    enriched = dict(opp)
    
    # 1. Relevance score
    enriched["relevance_score"] = calculate_relevance_score(profile, enriched)
    
    # 2. Status check
    deadline = enriched.get("deadline")
    if is_expired(deadline):
        enriched["status"] = "expired"
    else:
        enriched["status"] = enriched.get("status") or "active"

    # 3. is_demo distinction
    if "is_demo" not in enriched or enriched["is_demo"] is None:
        source_url = str(enriched.get("source_url") or "")
        source_name = str(enriched.get("source_name") or "")
        if "hackerearth.com" in source_url or source_name == "HackerEarth":
            enriched["is_demo"] = False
            enriched["source_name"] = enriched.get("source_name") or "HackerEarth"
        else:
            enriched["is_demo"] = True
            enriched["source_name"] = enriched.get("source_name") or "OpportunityOS Seed"
    else:
        enriched["is_demo"] = bool(enriched["is_demo"])

    return enriched


@router.get("")
async def get_personalized_feed(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Return personalized opportunity feed categorized into:
    - new_for_you
    - best_matches
    - latest_scholarships
    - latest_internships
    - latest_hackathons
    - latest_fellowships
    - closing_soon
    """
    client = get_supabase_client()
    user_id = current_user["id"]

    # 1. Fetch user's profile
    try:
        prof_res = client.table("profiles").select("*").eq("user_id", user_id).execute()
        if not prof_res.data:
            prof_res = client.table("profiles").select("*").eq("id", user_id).execute()
        profile = prof_res.data[0] if prof_res.data else {}
    except Exception as exc:
        logger.error("Failed to load user profile for feed: %s", str(exc))
        profile = {}

    last_feed_checked_at = _parse_iso(profile.get("last_feed_checked_at"))
    now_utc = datetime.now(timezone.utc)

    # 2. Fetch all opportunities from database
    try:
        opps_res = client.table("opportunities").select("*").execute()
        all_raw_opps = opps_res.data or []
    except Exception as exc:
        logger.error("Failed to load opportunities for feed: %s", str(exc))
        all_raw_opps = []

    # 3. Enrich with relevance score, expiration, and demo flag
    enriched_opps = [_enrich_opportunity(o, profile) for o in all_raw_opps]

    # Filter to active only for main feed sections
    active_opps = [o for o in enriched_opps if o["status"] != "expired"]

    # 4. Compute sections
    # A. Best Matches: sorted by relevance_score descending
    best_matches = sorted(active_opps, key=lambda x: x["relevance_score"], reverse=True)[:8]

    # B. New for You: verified live (not demo), discovered after checkpoint (or within last 7 days if first check), relevance >= 30
    cutoff = last_feed_checked_at if last_feed_checked_at else (now_utc - timedelta(days=7))
    new_for_you = []
    for opp in active_opps:
        if not opp.get("is_demo"):
            disc_time = _parse_iso(opp.get("discovered_at") or opp.get("created_at"))
            # Qualifies as new if discovered after checkpoint and relevant
            if disc_time and disc_time >= cutoff and opp["relevance_score"] >= 30:
                new_for_you.append(opp)
    new_for_you = sorted(new_for_you, key=lambda x: x["relevance_score"], reverse=True)

    # C. Category sections
    def filter_by_type(types: List[str]) -> List[Dict[str, Any]]:
        matches = [o for o in active_opps if str(o.get("opportunity_type", "")).lower() in [t.lower() for t in types]]
        # Sort by deadline asc if deadline exists, else relevance
        return sorted(matches, key=lambda x: x.get("deadline") or "9999", reverse=False)

    latest_scholarships = filter_by_type(["Scholarship"])
    latest_internships = filter_by_type(["Internship"])
    latest_hackathons = filter_by_type(["Hackathon"])
    latest_fellowships = filter_by_type(["Fellowship", "Grant", "Program"])

    # D. Closing Soon (deadlines within next 14 days)
    closing_soon = []
    fourteen_days_later = now_utc + timedelta(days=14)
    for opp in active_opps:
        dl = _parse_iso(opp.get("deadline"))
        if dl and now_utc <= dl <= fourteen_days_later:
            closing_soon.append(opp)
    closing_soon = sorted(closing_soon, key=lambda x: _parse_iso(x.get("deadline")) or now_utc)

    return {
        "new_for_you": new_for_you,
        "best_matches": best_matches,
        "latest_scholarships": latest_scholarships,
        "latest_internships": latest_internships,
        "latest_hackathons": latest_hackathons,
        "latest_fellowships": latest_fellowships,
        "closing_soon": closing_soon,
        "new_matches_count": len(new_for_you),
        "last_checked": last_feed_checked_at.isoformat() if last_feed_checked_at else None,
    }


@router.post("/checkpoint")
async def update_feed_checkpoint(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Update user's last_feed_checked_at timestamp to acknowledge current new items."""
    client = get_supabase_client()
    user_id = current_user["id"]
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        client.table("profiles").update({"last_feed_checked_at": now_iso}).eq("user_id", user_id).execute()
    except Exception as exc:
        logger.debug("Failed updating last_feed_checked_at in profiles: %s", exc)
    return {"status": "ok", "last_feed_checked_at": now_iso}
