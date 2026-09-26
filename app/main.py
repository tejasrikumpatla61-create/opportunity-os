from typing import Dict
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes.health import router as health_router

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
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


@app.get("/")
def root() -> Dict[str, str]:
    """Root endpoint verifying API is operational."""
    return {
        "name": settings.APP_NAME,
        "status": "running",
    }
