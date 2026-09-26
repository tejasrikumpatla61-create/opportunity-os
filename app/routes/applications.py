import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.auth import get_current_user, get_current_profile_id
from app.supabase_service import get_supabase_client
from app.models.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
    STATUS_MAP_TO_DB,
    STATUS_MAP_TO_DISPLAY,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/applications", tags=["Applications"])


def _format_application_response(
    app_data: Dict[str, Any],
    opportunity: Dict[str, Any] = None,
    tasks: List[Dict[str, Any]] = None,
) -> ApplicationResponse:
    db_status = app_data.get("status", "planning")
    display_status = STATUS_MAP_TO_DISPLAY.get(db_status, "Interested")
    
    task_list = tasks or []
    task_count = len(task_list)
    completed_task_count = sum(1 for t in task_list if t.get("status") == "completed")
    progress = int(round((completed_task_count / task_count) * 100)) if task_count > 0 else 0

    return ApplicationResponse(
        id=str(app_data["id"]),
        profile_id=str(app_data.get("profile_id", "")),
        opportunity_id=str(app_data.get("opportunity_id", "")),
        status=db_status,
        display_status=display_status,
        created_at=app_data.get("created_at"),
        updated_at=app_data.get("updated_at"),
        opportunity=opportunity,
        task_count=task_count,
        completed_task_count=completed_task_count,
        progress_percentage=progress,
    )


@router.get("", response_model=List[ApplicationResponse])
def list_applications(
    profile_id: str = Depends(get_current_profile_id),
    client: Client = Depends(get_supabase_client),
) -> List[ApplicationResponse]:
    """Retrieve all applications belonging strictly to the authenticated user."""
    try:
        app_res = client.table("applications").select("*").eq("profile_id", profile_id).execute()
        raw_apps = app_res.data or []
    except Exception as exc:
        logger.error("Error fetching applications: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve applications.",
        )

    if not raw_apps:
        return []

    # Collect opportunities and tasks to enrich in bulk
    opp_ids = list({a["opportunity_id"] for a in raw_apps if a.get("opportunity_id")})
    app_ids = [a["id"] for a in raw_apps]

    opportunities_by_id: Dict[str, Dict[str, Any]] = {}
    if opp_ids:
        try:
            opp_res = client.table("opportunities").select("*").in_("id", opp_ids).execute()
            for opp in (opp_res.data or []):
                opportunities_by_id[str(opp["id"])] = opp
        except Exception as exc:
            logger.warning("Error fetching opportunities for applications: %s", exc)

    tasks_by_app_id: Dict[str, List[Dict[str, Any]]] = {aid: [] for aid in app_ids}
    if app_ids:
        try:
            task_res = client.table("tasks").select("*").in_("application_id", app_ids).execute()
            for t in (task_res.data or []):
                aid = str(t.get("application_id"))
                if aid in tasks_by_app_id:
                    tasks_by_app_id[aid].append(t)
        except Exception as exc:
            logger.warning("Error fetching tasks for applications: %s", exc)

    return [
        _format_application_response(
            app_data=a,
            opportunity=opportunities_by_id.get(str(a.get("opportunity_id"))),
            tasks=tasks_by_app_id.get(a["id"], []),
        )
        for a in raw_apps
    ]


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application(
    body: ApplicationCreate,
    profile_id: str = Depends(get_current_profile_id),
    client: Client = Depends(get_supabase_client),
) -> ApplicationResponse:
    """Track an opportunity for the authenticated student. Enforces duplicate prevention."""
    opp_id_str = str(body.opportunity_id)

    # 1. Verify opportunity exists
    try:
        opp_res = client.table("opportunities").select("*").eq("id", opp_id_str).execute()
        if not opp_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Opportunity with ID '{opp_id_str}' not found.",
            )
        opportunity = opp_res.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error validating opportunity: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate opportunity.",
        )

    # 2. Prevent duplicate tracking
    try:
        existing = (
            client.table("applications")
            .select("*")
            .eq("profile_id", profile_id)
            .eq("opportunity_id", opp_id_str)
            .execute()
        )
        if existing.data and len(existing.data) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Application is already tracked for this opportunity.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error checking existing application: %s", type(exc).__name__)

    # 3. Map status to DB constraint
    input_status = (body.status or "planning").lower().strip()
    db_status = STATUS_MAP_TO_DB.get(input_status, "planning")
    now_iso = datetime.now(timezone.utc).isoformat()

    # 4. Insert application record
    try:
        insert_res = client.table("applications").insert({
            "profile_id": profile_id,
            "opportunity_id": opp_id_str,
            "status": db_status,
            "created_at": now_iso,
            "updated_at": now_iso,
        }).execute()
        if not insert_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create application record.",
            )
        new_app = insert_res.data[0]
        return _format_application_response(new_app, opportunity=opportunity, tasks=[])
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error creating application: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create application record.",
        )


@router.patch("/{application_id}", response_model=ApplicationResponse)
def update_application(
    application_id: uuid.UUID,
    body: ApplicationUpdate,
    profile_id: str = Depends(get_current_profile_id),
    client: Client = Depends(get_supabase_client),
) -> ApplicationResponse:
    """Update application status. Strictly scoped to the authenticated owner."""
    app_id_str = str(application_id)

    # Check existence and ownership
    try:
        existing = (
            client.table("applications")
            .select("*")
            .eq("id", app_id_str)
            .eq("profile_id", profile_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found or access denied.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error checking application ownership: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error verifying application.",
        )

    update_payload: Dict[str, Any] = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if body.status:
        st_clean = body.status.lower().strip()
        update_payload["status"] = STATUS_MAP_TO_DB.get(st_clean, "planning")

    try:
        update_res = (
            client.table("applications")
            .update(update_payload)
            .eq("id", app_id_str)
            .eq("profile_id", profile_id)
            .execute()
        )
        if not update_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found.",
            )
        updated_app = update_res.data[0]

        # Fetch opportunity and tasks
        opp_res = client.table("opportunities").select("*").eq("id", updated_app["opportunity_id"]).execute()
        opp_data = opp_res.data[0] if opp_res.data else None

        task_res = client.table("tasks").select("*").eq("application_id", app_id_str).execute()
        tasks = task_res.data or []

        return _format_application_response(updated_app, opportunity=opp_data, tasks=tasks)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error updating application: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update application.",
        )


@router.delete("/{application_id}")
def delete_application(
    application_id: uuid.UUID,
    profile_id: str = Depends(get_current_profile_id),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """Delete an application and all its linked tasks. Strictly scoped to authenticated owner."""
    app_id_str = str(application_id)

    # Verify ownership
    try:
        check = (
            client.table("applications")
            .select("id")
            .eq("id", app_id_str)
            .eq("profile_id", profile_id)
            .execute()
        )
        if not check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found or access denied.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error checking application before delete: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error verifying application.",
        )

    # Delete tasks first to maintain integrity
    try:
        client.table("tasks").delete().eq("application_id", app_id_str).execute()
        client.table("applications").delete().eq("id", app_id_str).eq("profile_id", profile_id).execute()
        return {"status": "deleted", "id": app_id_str}
    except Exception as exc:
        logger.error("Error deleting application: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete application.",
        )
