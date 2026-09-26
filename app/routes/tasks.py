import logging
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from app.auth import get_current_user, get_current_profile_id
from app.supabase_service import get_supabase_client
from app.models.task import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    ActionPlanTaskImport,
    PRIORITY_MAP_TO_DB,
    STATUS_MAP_TO_DB,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])

PRIORITY_SORT_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _verify_application_ownership(client: Client, application_id: str, profile_id: str) -> Dict[str, Any]:
    """Verify that an application exists and is owned by the current profile."""
    res = (
        client.table("applications")
        .select("*")
        .eq("id", application_id)
        .eq("profile_id", profile_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found or access denied.",
        )
    return res.data[0]


def _format_task_response(
    task_data: Dict[str, Any],
    opportunity_id: Optional[str] = None,
    opportunity_title: Optional[str] = None,
) -> TaskResponse:
    st = task_data.get("status", "pending")
    return TaskResponse(
        id=str(task_data["id"]),
        application_id=str(task_data.get("application_id", "")),
        title=task_data.get("title", ""),
        description=task_data.get("description"),
        priority=task_data.get("priority", "medium"),
        status=st,
        is_completed=(st == "completed"),
        due_date=task_data.get("due_date"),
        created_at=task_data.get("created_at"),
        opportunity_id=opportunity_id,
        opportunity_title=opportunity_title,
    )


@router.get("", response_model=List[TaskResponse])
def list_tasks(
    application_id: Optional[uuid.UUID] = Query(None),
    profile_id: str = Depends(get_current_profile_id),
    client: Client = Depends(get_supabase_client),
) -> List[TaskResponse]:
    """
    Retrieve tasks strictly owned by the authenticated student.
    Ordered with incomplete tasks first, then by priority (critical > high > medium > low).
    """
    # 1. Fetch user's applications
    app_query = client.table("applications").select("id, opportunity_id").eq("profile_id", profile_id)
    if application_id:
        app_query = app_query.eq("id", str(application_id))

    try:
        app_res = app_query.execute()
        user_apps = app_res.data or []
    except Exception as exc:
        logger.error("Error retrieving user applications for tasks: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve task applications.",
        )

    if not user_apps:
        return []

    app_id_map = {str(a["id"]): str(a.get("opportunity_id", "")) for a in user_apps}
    app_ids = list(app_id_map.keys())

    # 2. Fetch opportunities to display titles
    opp_titles: Dict[str, str] = {}
    opp_ids = [oid for oid in app_id_map.values() if oid]
    if opp_ids:
        try:
            opp_res = client.table("opportunities").select("id, title").in_("id", opp_ids).execute()
            for opp in (opp_res.data or []):
                opp_titles[str(opp["id"])] = opp.get("title", "")
        except Exception as exc:
            logger.warning("Could not fetch opportunity titles for tasks: %s", exc)

    # 3. Fetch tasks belonging to these application IDs
    try:
        task_res = client.table("tasks").select("*").in_("application_id", app_ids).execute()
        tasks = task_res.data or []
    except Exception as exc:
        logger.error("Error retrieving tasks: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve tasks.",
        )

    # Sort: pending first (0 for pending, 1 for completed), then priority
    def task_sort_key(t: Dict[str, Any]) -> tuple:
        is_done = 1 if t.get("status") == "completed" else 0
        prio = PRIORITY_SORT_ORDER.get(str(t.get("priority", "medium")).lower(), 2)
        created = t.get("created_at") or ""
        return (is_done, prio, created)

    sorted_tasks = sorted(tasks, key=task_sort_key)

    formatted = []
    for t in sorted_tasks:
        aid = str(t.get("application_id", ""))
        oid = app_id_map.get(aid)
        otitle = opp_titles.get(oid, "") if oid else ""
        formatted.append(_format_task_response(t, opportunity_id=oid, opportunity_title=otitle))

    return formatted


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    body: TaskCreate,
    profile_id: str = Depends(get_current_profile_id),
    client: Client = Depends(get_supabase_client),
) -> TaskResponse:
    """Create a new task. Verifies that the specified application belongs to current student."""
    app_id_str = str(body.application_id)
    app_row = _verify_application_ownership(client, app_id_str, profile_id)

    # Map priority and status to check constraints
    db_prio = PRIORITY_MAP_TO_DB.get((body.priority or "medium").lower(), "medium")
    db_status = STATUS_MAP_TO_DB.get((body.status or "pending").lower(), "pending")

    payload = {
        "application_id": app_id_str,
        "title": body.title.strip(),
        "description": body.description,
        "priority": db_prio,
        "status": db_status,
        "due_date": body.due_date,
    }

    try:
        res = client.table("tasks").insert(payload).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create task.",
            )
        new_task = res.data[0]
        return _format_task_response(new_task, opportunity_id=str(app_row.get("opportunity_id", "")))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error creating task: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create task.",
        )


@router.post("/from-action-plan")
def save_action_plan_tasks(
    body: ActionPlanTaskImport,
    profile_id: str = Depends(get_current_profile_id),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """
    Convert CrewAI action-plan items into persistent student tasks.
    Auto-creates tracked application if one does not exist yet.
    Prevents duplicate task creation if called multiple times.
    """
    opp_id_str = str(body.opportunity_id)

    # 1. Verify opportunity
    opp_res = client.table("opportunities").select("id, title").eq("id", opp_id_str).execute()
    if not opp_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found.",
        )
    opportunity = opp_res.data[0]

    # 2. Get or create tracked application
    app_res = (
        client.table("applications")
        .select("id")
        .eq("profile_id", profile_id)
        .eq("opportunity_id", opp_id_str)
        .execute()
    )
    if app_res.data and len(app_res.data) > 0:
        application_id = str(app_res.data[0]["id"])
    else:
        new_app = client.table("applications").insert({
            "profile_id": profile_id,
            "opportunity_id": opp_id_str,
            "status": "planning",
        }).execute()
        application_id = str(new_app.data[0]["id"])

    # 3. Check existing task titles to prevent duplicate task creation
    existing_tasks_res = client.table("tasks").select("title").eq("application_id", application_id).execute()
    existing_titles = {str(t.get("title", "")).strip().lower() for t in (existing_tasks_res.data or [])}

    # 4. Insert incoming action-plan tasks
    created_count = 0
    for item in body.tasks:
        if isinstance(item, str):
            task_title = item.strip()
            task_desc = None
        elif isinstance(item, dict):
            task_title = str(item.get("title") or item.get("name") or "").strip()
            task_desc = item.get("description")
        else:
            continue

        if not task_title:
            continue

        # Skip if already exists
        if task_title.lower() in existing_titles:
            continue

        try:
            client.table("tasks").insert({
                "application_id": application_id,
                "title": task_title,
                "description": task_desc,
                "priority": "high",
                "status": "pending",
            }).execute()
            existing_titles.add(task_title.lower())
            created_count += 1
        except Exception as exc:
            logger.error("Failed to insert action plan task '%s': %s", task_title, exc)

    return {
        "status": "ok",
        "application_id": application_id,
        "opportunity_id": opp_id_str,
        "opportunity_title": opportunity.get("title"),
        "tasks_created": created_count,
        "message": f"{created_count} action plan tasks saved to your workspace.",
    }


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: uuid.UUID,
    body: TaskUpdate,
    profile_id: str = Depends(get_current_profile_id),
    client: Client = Depends(get_supabase_client),
) -> TaskResponse:
    """Update task completion status, title, or priority. Strictly scoped to task owner."""
    task_id_str = str(task_id)

    # 1. Fetch task
    try:
        t_res = client.table("tasks").select("*").eq("id", task_id_str).execute()
        if not t_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found.",
            )
        task = t_res.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error retrieving task: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve task.",
        )

    # 2. Verify application ownership
    _verify_application_ownership(client, task["application_id"], profile_id)

    # 3. Build update payload
    update_data: Dict[str, Any] = {}
    if body.title is not None and body.title.strip():
        update_data["title"] = body.title.strip()
    if body.description is not None:
        update_data["description"] = body.description
    if body.priority is not None:
        update_data["priority"] = PRIORITY_MAP_TO_DB.get(body.priority.lower(), "medium")
    if body.due_date is not None:
        update_data["due_date"] = body.due_date
    if body.status is not None:
        update_data["status"] = STATUS_MAP_TO_DB.get(body.status.lower(), "pending")

    try:
        res = client.table("tasks").update(update_data).eq("id", task_id_str).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Failed to update task.",
            )
        return _format_task_response(res.data[0])
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error updating task: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update task.",
        )


@router.delete("/{task_id}")
def delete_task(
    task_id: uuid.UUID,
    profile_id: str = Depends(get_current_profile_id),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """Delete a task. Strictly scoped to authenticated owner."""
    task_id_str = str(task_id)

    # 1. Fetch task
    t_res = client.table("tasks").select("*").eq("id", task_id_str).execute()
    if not t_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )
    task = t_res.data[0]

    # 2. Verify application ownership
    _verify_application_ownership(client, task["application_id"], profile_id)

    # 3. Delete task
    try:
        client.table("tasks").delete().eq("id", task_id_str).execute()
        return {"status": "deleted", "id": task_id_str}
    except Exception as exc:
        logger.error("Error deleting task: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete task.",
        )
