from typing import Dict
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routes.health import router as health_router
from app.routes.opportunities import router as opportunities_router
from app.routes.auth import router as auth_router
from app.routes.profile import router as profile_router
from app.routes.assistant import router as assistant_router
from app.routes.feed import router as feed_router
from app.routes.admin import router as admin_router
from app.routes.applications import router as applications_router
from app.routes.tasks import router as tasks_router
from app.supabase_service import SupabaseConfigError

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
)

# Exception handler for missing Supabase configuration
@app.exception_handler(SupabaseConfigError)
async def supabase_config_error_handler(
    request: Request, exc: SupabaseConfigError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Supabase service is not configured"},
    )

# Configure CORS with safe origins from settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health_router)
app.include_router(opportunities_router)
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(assistant_router)
app.include_router(feed_router)
app.include_router(admin_router)
app.include_router(applications_router)
app.include_router(tasks_router)


@app.get("/")
def root() -> Dict[str, str]:
    """Root endpoint verifying API is operational."""
    return {
        "name": settings.APP_NAME,
        "status": "running",
    }
