import json
import logging
import re
import time
from datetime import date
from typing import Any, Dict, Optional, Tuple, Union
import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class CrewAIConfigError(Exception):
    """Raised when CrewAI configuration is missing or invalid."""
    pass


class CrewAIAuthError(Exception):
    """Raised when authentication with CrewAI fails."""
    pass


class CrewAIKickoffError(Exception):
    """Raised when CrewAI kickoff request fails."""
    pass


class CrewAIExecutionError(Exception):
    """Raised when CrewAI execution finishes with a failed state."""
    pass


class CrewAITimeoutError(Exception):
    """Raised when CrewAI execution polling times out."""
    pass


class CrewAIMalformedResultError(Exception):
    """Raised when CrewAI result cannot be parsed into expected structure."""
    pass


def get_crewai_credentials() -> Tuple[str, str]:
    """Retrieve and validate CrewAI configuration from settings."""
    settings = get_settings()
    api_url = settings.CREWAI_API_URL
    token = settings.CREWAI_BEARER_TOKEN

    if not api_url or not token:
        raise CrewAIConfigError("CrewAI configuration is missing. Ensure CREWAI_API_URL and CREWAI_BEARER_TOKEN are set.")

    return api_url.strip().rstrip("/"), token.strip()


def build_crewai_inputs(
    opportunity: Dict[str, Any],
    student_profile: Optional[Dict[str, Any]] = None,
    resume_text: Optional[str] = "",
) -> Dict[str, Any]:
    """
    Build deterministic inputs for CrewAI kickoff:
    today_date, source_url, student_profile, deadline, opportunity, resume_text.
    """
    today_date = date.today().isoformat()
    db_source_url = opportunity.get("source_url") or ""

    canonical_opp = {
        "id": str(opportunity.get("id")),
        "title": opportunity.get("title"),
        "organization": opportunity.get("organization"),
        "opportunity_type": opportunity.get("opportunity_type"),
        "description": opportunity.get("description"),
        "eligibility": opportunity.get("eligibility"),
        "required_skills": opportunity.get("required_skills"),
        "requirements": opportunity.get("requirements"),
        "location": opportunity.get("location"),
        "deadline": str(opportunity.get("deadline")) if opportunity.get("deadline") else None,
        "source_url": db_source_url,
    }

    deadline_str = str(opportunity.get("deadline")) if opportunity.get("deadline") else ""
    profile_val = student_profile if student_profile is not None else {}

    # Serialize profile and opportunity clearly
    profile_serialized = (
        json.dumps(profile_val, indent=2)
        if isinstance(profile_val, (dict, list))
        else str(profile_val)
    )
    opp_serialized = json.dumps(canonical_opp, indent=2)

    return {
        "today_date": today_date,
        "source_url": db_source_url,
        "student_profile": profile_serialized,
        "deadline": deadline_str,
        "opportunity": opp_serialized,
        "resume_text": resume_text or "",
    }


def parse_crewai_result(raw_result: Any) -> Dict[str, Any]:
    """
    Parse and normalize CrewAI output into a dictionary.
    Handles raw dicts, JSON strings, markdown code blocks, or nested fields.
    """
    if isinstance(raw_result, dict):
        # Look for nested result containers if present
        for candidate_key in ["result", "output", "json_dict", "data", "final_output"]:
            if candidate_key in raw_result and isinstance(raw_result[candidate_key], (dict, str)):
                extracted = raw_result[candidate_key]
                if isinstance(extracted, dict) and "eligibility_status" in extracted:
                    return extracted
                if isinstance(extracted, str):
                    try:
                        return parse_crewai_result(extracted)
                    except Exception:
                        pass
        return raw_result

    if isinstance(raw_result, str):
        cleaned = raw_result.strip()
        # Remove markdown code blocks if wrapped in ```json ... ```
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
            cleaned = cleaned.strip()

        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                return parse_crewai_result(parsed)
        except json.JSONDecodeError as exc:
            logger.error("JSON decode error parsing CrewAI result: %s", type(exc).__name__)
            raise CrewAIMalformedResultError("Failed to parse CrewAI result as valid JSON") from None

    raise CrewAIMalformedResultError(f"Unexpected CrewAI result format: {type(raw_result).__name__}")


class CrewAIService:
    """Service to interact with the deployed CrewAI crew."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        bearer_token: Optional[str] = None,
        poll_interval: float = 2.0,
        max_poll_attempts: int = 150,
        timeout: float = 30.0,
    ) -> None:
        self._base_url = base_url
        self._bearer_token = bearer_token
        self.poll_interval = poll_interval
        self.max_poll_attempts = max_poll_attempts
        self.timeout = timeout

    def _get_config(self) -> Tuple[str, str]:
        if self._base_url and self._bearer_token:
            return self._base_url.strip().rstrip("/"), self._bearer_token.strip()
        return get_crewai_credentials()

    def check_health(self) -> Dict[str, Any]:
        """Check health of deployed CrewAI service."""
        base_url, token = self._get_config()
        headers = {"Authorization": f"Bearer {token}"}
        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.get(f"{base_url}/healthcheck", headers=headers)
                if res.status_code in (401, 403):
                    raise CrewAIAuthError("CrewAI authentication failed")
                res.raise_for_status()
                return res.json()
        except httpx.HTTPStatusError as exc:
            logger.error("CrewAI healthcheck HTTP error: %s", exc.response.status_code)
            raise CrewAIKickoffError("CrewAI healthcheck failed") from None
        except httpx.RequestError as exc:
            logger.error("CrewAI healthcheck network error: %s", type(exc).__name__)
            raise CrewAIKickoffError("CrewAI healthcheck connection error") from None

    def get_inputs_schema(self) -> Dict[str, Any]:
        """Retrieve inputs schema from deployed CrewAI service."""
        base_url, token = self._get_config()
        headers = {"Authorization": f"Bearer {token}"}
        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.get(f"{base_url}/inputs", headers=headers)
                if res.status_code in (401, 403):
                    raise CrewAIAuthError("CrewAI authentication failed")
                res.raise_for_status()
                return res.json()
        except httpx.HTTPStatusError as exc:
            logger.error("CrewAI /inputs HTTP error: %s", exc.response.status_code)
            raise CrewAIKickoffError("CrewAI /inputs failed") from None

    def kickoff_and_poll(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Kick off execution on CrewAI and poll until a terminal state is reached.
        """
        base_url, token = self._get_config()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        # 1. Post to /kickoff
        try:
            with httpx.Client(timeout=self.timeout) as client:
                payload = {"inputs": inputs}
                kickoff_res = client.post(
                    f"{base_url}/kickoff",
                    headers=headers,
                    json=payload,
                )

                if kickoff_res.status_code in (401, 403):
                    raise CrewAIAuthError("CrewAI authentication failed")
                if kickoff_res.status_code >= 400:
                    err_msg = kickoff_res.text
                    logger.error("CrewAI kickoff failed with status %s: %s", kickoff_res.status_code, err_msg)
                    raise CrewAIKickoffError(f"CrewAI kickoff failed: {err_msg}")

                kickoff_data = kickoff_res.json()
        except (CrewAIAuthError, CrewAIKickoffError):
            raise
        except httpx.RequestError as exc:
            logger.error("CrewAI kickoff network error: %s", type(exc).__name__)
            raise CrewAIKickoffError("Network error connecting to CrewAI kickoff endpoint") from None

        # Extract kickoff ID
        kickoff_id = (
            kickoff_data.get("kickoff_id")
            or kickoff_data.get("id")
            or kickoff_data.get("execution_id")
        )
        if not kickoff_id:
            logger.error("No kickoff ID found in response: %s", list(kickoff_data.keys()))
            raise CrewAIKickoffError("CrewAI kickoff response missing execution ID")

        # 2. Poll /status/{kickoff_id}
        for attempt in range(1, self.max_poll_attempts + 1):
            time.sleep(self.poll_interval)
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    status_res = client.get(
                        f"{base_url}/status/{kickoff_id}",
                        headers=headers,
                    )

                    if status_res.status_code in (401, 403):
                        raise CrewAIAuthError("CrewAI authentication failed during polling")
                    if status_res.status_code >= 400:
                        logger.error("CrewAI status poll failed with code %s", status_res.status_code)
                        raise CrewAIExecutionError("CrewAI status check failed")

                    status_data = status_res.json()
            except (CrewAIAuthError, CrewAIExecutionError):
                raise
            except httpx.RequestError as exc:
                logger.warning("Transient network error during poll attempt %s: %s", attempt, type(exc).__name__)
                continue

            state = str(
                status_data.get("state")
                or status_data.get("status")
                or status_data.get("execution_status")
                or ""
            ).upper()
            if attempt % 5 == 1 or attempt <= 3:
                logger.info("CrewAI poll attempt %s/%s: state=%s", attempt, self.max_poll_attempts, state)

            if state in ("SUCCESS", "COMPLETED", "FINISHED", "DONE"):
                raw_result = (
                    status_data.get("result")
                    or status_data.get("output")
                    or status_data.get("data")
                    or status_data
                )
                return parse_crewai_result(raw_result)

            if state in ("FAILED", "ERROR", "FAILURE", "CANCELLED"):
                error_detail = status_data.get("error") or status_data.get("message") or state
                logger.error("CrewAI execution failed in state %s: %s", state, error_detail)
                raise CrewAIExecutionError(f"CrewAI execution failed: {error_detail}")

        logger.error("CrewAI execution timed out after %s polling attempts", self.max_poll_attempts)
        raise CrewAITimeoutError(f"CrewAI execution timed out after {self.max_poll_attempts * self.poll_interval}s")


_crewai_service_instance: Optional[CrewAIService] = None


def get_crewai_service() -> CrewAIService:
    """Return a singleton instance of CrewAIService."""
    global _crewai_service_instance
    if _crewai_service_instance is None:
        _crewai_service_instance = CrewAIService()
    return _crewai_service_instance
