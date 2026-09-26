from functools import lru_cache
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings and environment configuration."""

    APP_NAME: str = "OpportunityOS API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    ALLOWED_ORIGINS: Union[str, List[str]] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    # Supabase Configuration
    SUPABASE_URL: Union[str, None] = None
    SUPABASE_SERVICE_ROLE_KEY: Union[str, None] = None

    # CrewAI Configuration
    CREWAI_API_URL: Union[str, None] = None
    CREWAI_BEARER_TOKEN: Union[str, None] = None

    # Gemini Configuration
    GEMINI_API_KEY: Union[str, None] = None

    @field_validator("ALLOWED_ORIGINS")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return cached instance of application settings."""
    return Settings()
