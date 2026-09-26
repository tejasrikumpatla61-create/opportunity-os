import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.auth import get_current_user, get_current_profile_id, require_admin_user
from app.supabase_service import get_supabase_client


class MockSupabaseQuery:
    def __init__(self, table_ref):
        self.table_ref = table_ref
        self.filters = []

    def select(self, fields="*"):
        return self

    def eq(self, field, val):
        self.filters.append((field, str(val)))
        return self

    def in_(self, field, vals):
        str_vals = [str(v) for v in vals]
        self.filters.append((field, str_vals))
        return self

    def _matches(self, row):
        for f, val in self.filters:
            row_val = str(row.get(f, ""))
            if isinstance(val, list):
                if row_val not in val:
                    return False
            else:
                if row_val != val:
                    return False
        return True

    def insert(self, record):
        rec = dict(record)
        if "id" not in rec:
            rec["id"] = str(uuid.uuid4())
        self.table_ref.data.append(rec)
        self._action_result = [rec]
        return self

    def update(self, updates):
        matched = []
        for r in self.table_ref.data:
            if self._matches(r):
                r.update(updates)
                matched.append(dict(r))
        self._action_result = matched
        return self

    def delete(self):
        survivors = []
        deleted = []
        for r in self.table_ref.data:
            if self._matches(r):
                deleted.append(r)
            else:
                survivors.append(r)
        self.table_ref.data = survivors
        self._action_result = deleted
        return self

    def execute(self):
        if hasattr(self, "_action_result"):
            res = self._action_result
        else:
            res = [dict(r) for r in self.table_ref.data if self._matches(r)]
        class Result:
            def __init__(self, d):
                self.data = d
        return Result(res)


class MockTable:
    def __init__(self, initial_data=None):
        self.data = [dict(r) for r in (initial_data or [])]

    def select(self, fields="*"):
        q = MockSupabaseQuery(self)
        return q.select(fields)

    def insert(self, record):
        q = MockSupabaseQuery(self)
        return q.insert(record)

    def update(self, updates):
        q = MockSupabaseQuery(self)
        return q.update(updates)

    def delete(self):
        q = MockSupabaseQuery(self)
        return q.delete()

    def eq(self, field, val):
        q = MockSupabaseQuery(self)
        return q.eq(field, val)


class MockSupabaseClient:
    def __init__(self):
        self._tables = {
            "opportunities": MockTable([
                {
                    "id": "11111111-1111-1111-1111-111111111111",
                    "title": "Smart India Hackathon 2026",
                    "organization": "MoE India",
                    "deadline": "2026-10-15",
                    "status": "active",
                },
                {
                    "id": "22222222-2222-2222-2222-222222222222",
                    "title": "Google Summer of Code 2026",
                    "organization": "Google",
                    "deadline": "2026-11-01",
                    "status": "active",
                },
            ]),
            "profiles": MockTable([
                {"id": "prof-user-a", "user_id": "user-a-id", "email": "userA@example.com"},
                {"id": "prof-user-b", "user_id": "user-b-id", "email": "userB@example.com"},
            ]),
            "applications": MockTable([]),
            "tasks": MockTable([]),
        }

    def table(self, name):
        if name not in self._tables:
            self._tables[name] = MockTable([])
        return self._tables[name]


@pytest.fixture
def mock_db():
    return MockSupabaseClient()


@pytest.fixture
def client(mock_db):
    app.dependency_overrides[get_supabase_client] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user-a-id",
        "email": "userA@example.com",
        "role": "authenticated",
    }
    app.dependency_overrides[get_current_profile_id] = lambda: "prof-user-a"
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_create_application_success(client, mock_db):
    res = client.post("/api/applications", json={
        "opportunity_id": "11111111-1111-1111-1111-111111111111",
        "status": "interested"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["profile_id"] == "prof-user-a"
    assert data["opportunity_id"] == "11111111-1111-1111-1111-111111111111"
    assert data["status"] == "planning"
    assert data["display_status"] == "Interested"


def test_create_application_duplicate_prevention(client, mock_db):
    # First creation
    res1 = client.post("/api/applications", json={
        "opportunity_id": "11111111-1111-1111-1111-111111111111",
        "status": "interested"
    })
    assert res1.status_code == 201

    # Second creation for same opportunity must return 409 Conflict
    res2 = client.post("/api/applications", json={
        "opportunity_id": "11111111-1111-1111-1111-111111111111",
        "status": "preparing"
    })
    assert res2.status_code == 409
    assert "already tracked" in res2.json()["detail"].lower()


def test_list_applications_per_user_isolation(client, mock_db):
    # User A application
    mock_db.table("applications").data.append({
        "id": "a0000000-0000-0000-0000-000000000001",
        "profile_id": "prof-user-a",
        "opportunity_id": "11111111-1111-1111-1111-111111111111",
        "status": "planning",
    })
    # User B application
    mock_db.table("applications").data.append({
        "id": "b0000000-0000-0000-0000-000000000001",
        "profile_id": "prof-user-b",
        "opportunity_id": "22222222-2222-2222-2222-222222222222",
        "status": "in_progress",
    })

    # Client is logged in as User A
    res = client.get("/api/applications")
    assert res.status_code == 200
    apps = res.json()
    assert len(apps) == 1
    assert apps[0]["id"] == "a0000000-0000-0000-0000-000000000001"
    assert apps[0]["opportunity"]["title"] == "Smart India Hackathon 2026"


def test_update_application_status(client, mock_db):
    mock_db.table("applications").data.append({
        "id": "a0000000-0000-0000-0000-000000000001",
        "profile_id": "prof-user-a",
        "opportunity_id": "11111111-1111-1111-1111-111111111111",
        "status": "planning",
    })

    res = client.patch("/api/applications/a0000000-0000-0000-0000-000000000001", json={"status": "preparing"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "in_progress"
    assert data["display_status"] == "Preparing"


def test_update_application_cross_user_forbidden(client, mock_db):
    # User B application
    mock_db.table("applications").data.append({
        "id": "b0000000-0000-0000-0000-000000000001",
        "profile_id": "prof-user-b",
        "opportunity_id": "22222222-2222-2222-2222-222222222222",
        "status": "planning",
    })

    # User A tries to modify User B's application
    res = client.patch("/api/applications/b0000000-0000-0000-0000-000000000001", json={"status": "applied"})
    assert res.status_code == 404


def test_delete_application_and_tasks(client, mock_db):
    mock_db.table("applications").data.append({
        "id": "a0000000-0000-0000-0000-000000000001",
        "profile_id": "prof-user-a",
        "opportunity_id": "11111111-1111-1111-1111-111111111111",
        "status": "planning",
    })
    mock_db.table("tasks").data.append({
        "id": "c0000000-0000-0000-0000-000000000001",
        "application_id": "a0000000-0000-0000-0000-000000000001",
        "title": "Prepare Team",
        "status": "pending",
    })

    res = client.delete("/api/applications/a0000000-0000-0000-0000-000000000001")
    assert res.status_code == 200
    assert len(mock_db.table("applications").data) == 0
    assert len(mock_db.table("tasks").data) == 0


def test_tasks_crud_and_cross_user_isolation(client, mock_db):
    # Setup User A and User B applications
    mock_db.table("applications").data.append({
        "id": "a0000000-0000-0000-0000-000000000001",
        "profile_id": "prof-user-a",
        "opportunity_id": "11111111-1111-1111-1111-111111111111",
        "status": "planning",
    })
    mock_db.table("applications").data.append({
        "id": "b0000000-0000-0000-0000-000000000001",
        "profile_id": "prof-user-b",
        "opportunity_id": "22222222-2222-2222-2222-222222222222",
        "status": "planning",
    })

    # 1. User A creates task
    res_create = client.post("/api/tasks", json={
        "application_id": "a0000000-0000-0000-0000-000000000001",
        "title": "Draft Proposal",
        "priority": "high",
    })
    assert res_create.status_code == 201
    task_id = res_create.json()["id"]

    # 2. User A tries to create task on User B's application -> 404
    res_b = client.post("/api/tasks", json={
        "application_id": "b0000000-0000-0000-0000-000000000001",
        "title": "Intrude",
    })
    assert res_b.status_code == 404

    # 3. User A lists tasks
    res_list = client.get("/api/tasks")
    assert res_list.status_code == 200
    tasks = res_list.json()
    assert len(tasks) == 1
    assert tasks[0]["id"] == task_id
    assert tasks[0]["is_completed"] is False

    # 4. User A completes task
    res_update = client.patch(f"/api/tasks/{task_id}", json={"status": "completed"})
    assert res_update.status_code == 200
    assert res_update.json()["is_completed"] is True
    assert res_update.json()["status"] == "completed"

    # 5. User A deletes task
    res_del = client.delete(f"/api/tasks/{task_id}")
    assert res_del.status_code == 200
    assert len(mock_db.table("tasks").data) == 0


def test_action_plan_to_tasks_conversion(client, mock_db):
    res = client.post("/api/tasks/from-action-plan", json={
        "opportunity_id": "11111111-1111-1111-1111-111111111111",
        "tasks": [
            "Review SIH guidelines",
            {"title": "Form 6-member team", "description": "Ensure 1 female member minimum"},
            "Submit idea PPT"
        ]
    })
    assert res.status_code == 200
    data = res.json()
    assert data["tasks_created"] == 3
    assert len(mock_db.table("applications").data) == 1
    assert len(mock_db.table("tasks").data) == 3

    # Duplicate call should NOT create duplicate tasks
    res_dup = client.post("/api/tasks/from-action-plan", json={
        "opportunity_id": "11111111-1111-1111-1111-111111111111",
        "tasks": [
            "Review SIH guidelines",
            {"title": "Form 6-member team", "description": "Ensure 1 female member minimum"},
            "Submit idea PPT"
        ]
    })
    assert res_dup.status_code == 200
    assert res_dup.json()["tasks_created"] == 0
    assert len(mock_db.table("tasks").data) == 3


def test_admin_refresh_security(client):
    # Non-admin user (student) should be rejected with 403 Forbidden
    res = client.post("/api/admin/opportunities/refresh")
    assert res.status_code == 403
    assert "admin authorization required" in res.json()["detail"].lower()

    # Admin user should be allowed
    app.dependency_overrides[require_admin_user] = lambda: {"email": "admin@opportunityos.dev", "role": "admin"}
    res_admin = client.post("/api/admin/opportunities/refresh")
    assert res_admin.status_code in [200, 500]
