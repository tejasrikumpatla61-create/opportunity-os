"""Unit and integration tests for Phase 6 Live Opportunity Intelligence."""

from datetime import datetime, timezone, timedelta
from typing import List
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

from app.opportunity_sources import (
    RawOpportunity,
    NormalizedOpportunity,
    normalize_hackerearth_record,
    normalize_generic_record,
    validate_opportunity,
    Deduplicator,
    compute_fingerprint,
    BaseOpportunitySource,
)
from app.personalization import calculate_relevance_score
from app.refresh_service import refresh_opportunities, is_expired, RefreshSummary
from app.main import app
from app.auth import get_current_user


# 1. Source Normalization
def test_hackerearth_normalization():
    raw_data = {
        "title": "Autonomous Drone Challenge",
        "description": "Build computer vision pipelines for drones.",
        "url": "https://www.hackerearth.com/challenges/hackathon/drone-challenge-2026/",
        "end_utc_tz": "2026-11-15 18:29:00+00:00",
        "status": "ONGOING",
    }
    raw = RawOpportunity(source_name="HackerEarth", source_type="public_api", raw_data=raw_data)
    norm = normalize_hackerearth_record(raw)
    
    assert norm.title == "Autonomous Drone Challenge"
    assert norm.organization == "HackerEarth"
    assert norm.opportunity_type == "Hackathon"
    assert norm.source_url == "https://www.hackerearth.com/challenges/hackathon/drone-challenge-2026/"
    assert "2026-11-15" in (norm.deadline or "")
    assert norm.external_id == "drone-challenge-2026"
    assert norm.is_demo is False
    assert norm.status == "active"


def test_generic_normalization():
    raw_data = {
        "title": "Quantum Research Fellowship",
        "organization": "Quantum Labs Institute",
        "type": "fellowship",
        "source_url": "https://quantumlabs.org/fellowship",
        "end_date": "2026-12-01",
        "required_skills": ["Python", "Quantum Physics"],
    }
    raw = RawOpportunity(source_name="QuantumLabs", source_type="web_feed", raw_data=raw_data)
    norm = normalize_generic_record(raw)
    
    assert norm.title == "Quantum Research Fellowship"
    assert norm.organization == "Quantum Labs Institute"
    assert norm.opportunity_type == "Fellowship"
    assert norm.source_url == "https://quantumlabs.org/fellowship"
    assert "2026-12-01" in (norm.deadline or "")
    assert norm.is_demo is False


# 2. Source Validation
def test_validation_valid_record():
    norm = NormalizedOpportunity(
        title="Valid Summer Internship",
        organization="Google",
        opportunity_type="Internship",
        source_name="Careers",
        source_url="https://careers.google.com/jobs/results/123",
        deadline="2026-12-31T23:59:59+00:00",
    )
    is_valid, reason = validate_opportunity(norm)
    assert is_valid is True
    assert reason is None


def test_validation_missing_source_url():
    norm = NormalizedOpportunity(
        title="Valid Title",
        organization="Google",
        opportunity_type="Internship",
        source_name="Careers",
        source_url="not_a_valid_url",
    )
    is_valid, reason = validate_opportunity(norm)
    assert is_valid is False
    assert "source URL" in (reason or "")


def test_validation_malformed_deadline():
    norm = NormalizedOpportunity(
        title="Valid Title",
        organization="Google",
        opportunity_type="Internship",
        source_name="Careers",
        source_url="https://google.com/careers",
        deadline="tomorrow_morning",
    )
    is_valid, reason = validate_opportunity(norm)
    assert is_valid is False
    assert "deadline" in (reason or "")


def test_validation_missing_title_or_org():
    norm1 = NormalizedOpportunity(
        title="",
        organization="Google",
        opportunity_type="Internship",
        source_name="Careers",
        source_url="https://google.com",
    )
    assert validate_opportunity(norm1)[0] is False

    norm2 = NormalizedOpportunity(
        title="Valid Title",
        organization="",
        opportunity_type="Internship",
        source_name="Careers",
        source_url="https://google.com",
    )
    assert validate_opportunity(norm2)[0] is False


# 3. Deduplication & Fingerprinting
def test_deduplicator_matching():
    existing = [
        {
            "id": "existing-uuid-1",
            "title": "Annual Tech Hackathon",
            "organization": "HackerEarth",
            "source_name": "HackerEarth",
            "external_id": "annual-tech-hackathon",
            "source_url": "https://hackerearth.com/challenges/annual-tech",
            "deadline": "2026-10-10T12:00:00+00:00",
        },
        {
            "id": "existing-uuid-2",
            "title": "Cyber Security Challenge",
            "organization": "Defense Corp",
            "source_url": "https://defensecorp.com/cyber-challenge",
            "deadline": "2026-11-20T00:00:00+00:00",
        }
    ]
    dedup = Deduplicator(existing)

    # Match 1: source_name + external_id
    opp1 = NormalizedOpportunity(
        title="Different Title",
        organization="HackerEarth",
        opportunity_type="Hackathon",
        source_name="HackerEarth",
        external_id="annual-tech-hackathon",
        source_url="https://some-other-url.com",
    )
    assert dedup.find_match(opp1)["id"] == "existing-uuid-1"

    # Match 2: exact source_url
    opp2 = NormalizedOpportunity(
        title="Cyber Security Challenge 2026",
        organization="Defense Corp",
        opportunity_type="Hackathon",
        source_name="Unknown",
        source_url="https://defensecorp.com/cyber-challenge/",
    )
    assert dedup.find_match(opp2)["id"] == "existing-uuid-2"

    # Match 3: no match -> returns None
    opp3 = NormalizedOpportunity(
        title="Completely Brand New Event",
        organization="Brand New Org",
        opportunity_type="Hackathon",
        source_name="BrandNew",
        source_url="https://brandnew.org/event",
    )
    assert dedup.find_match(opp3) is None


# 4. Expiration Helper
def test_expiration_handling():
    past_date = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    future_date = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    
    assert is_expired(past_date) is True
    assert is_expired(future_date) is False
    assert is_expired(None) is False


# 5. Mocked Refresh Service Execution
class MockSource(BaseOpportunitySource):
    def __init__(self, items: List[RawOpportunity]):
        self._items = items

    @property
    def source_name(self) -> str:
        return "MockSource"

    @property
    def is_live(self) -> bool:
        return True

    async def fetch(self) -> List[RawOpportunity]:
        return self._items


class MockFailingSource(BaseOpportunitySource):
    @property
    def source_name(self) -> str:
        return "FailingSource"

    @property
    def is_live(self) -> bool:
        return True

    async def fetch(self) -> List[RawOpportunity]:
        raise ConnectionError("Upstream timeout")


@pytest.mark.asyncio
async def test_refresh_service_mocked():
    # Mock database client
    db_store = []

    mock_client = MagicMock()
    
    def mock_table(table_name):
        mock_tbl = MagicMock()
        if table_name == "opportunities":
            mock_select = MagicMock()
            mock_select.execute.return_value = MagicMock(data=list(db_store))
            mock_tbl.select.return_value = mock_select
            
            def mock_insert(data):
                mock_ins = MagicMock()
                item = dict(data)
                item["id"] = f"mock-id-{len(db_store)+1}"
                db_store.append(item)
                mock_ins.execute.return_value = MagicMock(data=[item])
                return mock_ins
            mock_tbl.insert.side_effect = mock_insert

            def mock_update(data):
                mock_up = MagicMock()
                mock_eq = MagicMock()
                def execute_update():
                    return MagicMock(data=[])
                mock_eq.execute.side_effect = execute_update
                mock_up.eq.return_value = mock_eq
                return mock_up
            mock_tbl.update.side_effect = mock_update

        return mock_tbl

    mock_client.table.side_effect = mock_table

    # Test item 1: valid new record
    raw1 = RawOpportunity(
        source_name="MockSource",
        source_type="test",
        raw_data={
            "title": "AI Innovation Hackathon",
            "organization": "Mock AI",
            "source_url": "https://mockai.org/hackathon",
            "type": "Hackathon",
            "deadline": (datetime.now(timezone.utc) + timedelta(days=10)).isoformat(),
        }
    )
    # Test item 2: invalid record (missing source_url)
    raw2 = RawOpportunity(
        source_name="MockSource",
        source_type="test",
        raw_data={"title": "Invalid Event", "organization": "No Url"}
    )

    source = MockSource([raw1, raw2])
    failing_source = MockFailingSource()

    summary = await refresh_opportunities(sources=[source, failing_source], client=mock_client)

    assert summary.sources_checked == 2
    assert summary.records_found == 2
    assert summary.new_records == 1
    assert "FailingSource" in summary.failed_sources


# 6. Personalization Engine Deterministic Ranking
def test_personalization_deterministic_ranking():
    profile = {
        "skills": ["Python", "Machine Learning", "PyTorch"],
        "interests": ["Artificial Intelligence", "Robotics"],
        "degree": "Bachelor of Technology",
        "branch": "Computer Science",
        "preferred_opportunity_types": ["Hackathon", "Internship"],
    }

    # Highly relevant opportunity
    opp_high = {
        "title": "AI & Robotics Innovation Hackathon",
        "opportunity_type": "Hackathon",
        "description": "Build Machine Learning and PyTorch models for robotics.",
        "required_skills": ["Python", "Machine Learning"],
        "requirements": ["Undergraduate Student", "Computer Science"],
    }

    # Low relevance opportunity
    opp_low = {
        "title": "Accounting and Finance Fellowship",
        "opportunity_type": "Fellowship",
        "description": "Financial accounting principles and tax auditing.",
        "required_skills": ["Accounting", "Excel", "Tax Laws"],
        "requirements": ["Finance Degree", "Audit Experience"],
    }

    score_high = calculate_relevance_score(profile, opp_high)
    score_low = calculate_relevance_score(profile, opp_low)

    assert 0 <= score_high <= 100
    assert 0 <= score_low <= 100
    assert score_high > score_low
    assert score_high >= 60
    assert score_low < 35


# 7. Personalized Feed API & Category Separation
def test_feed_api_and_categories():
    client = TestClient(app)

    # Make request to GET /api/feed (using conftest default auth)
    res = client.get("/api/feed")
    assert res.status_code == 200, res.text
    data = res.json()

    # Verify expected categories exist
    assert "new_for_you" in data
    assert "best_matches" in data
    assert "latest_scholarships" in data
    assert "latest_internships" in data
    assert "latest_hackathons" in data
    assert "latest_fellowships" in data
    assert "closing_soon" in data
    assert "new_matches_count" in data

    # Verify demo vs live distinction on items
    for item in data["best_matches"]:
        assert "is_demo" in item
        assert "status" in item
        assert "relevance_score" in item
        if item.get("source_url") and "hackerearth.com" in item["source_url"]:
            assert item["is_demo"] is False


# 8. Feed Checkpoint Update
def test_feed_checkpoint_update():
    client = TestClient(app)
    res = client.post("/api/feed/checkpoint")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert "last_feed_checked_at" in res.json()
