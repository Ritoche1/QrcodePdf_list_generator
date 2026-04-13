from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import create_all_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    settings.ensure_dirs()
    await create_all_tables()
    yield
    # Shutdown (nothing needed for SQLite)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="QR Code PDF Generator API",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
from app.api.router import api_router  # noqa: E402

app.include_router(api_router, prefix="/api/v1")

# Serve generated files statically (optional convenience)
# Mount only after dirs are ensured in lifespan — use a startup event trick
@app.on_event("startup")
async def mount_static():
    try:
        app.mount("/files", StaticFiles(directory=str(settings.files_dir)), name="files")
    except Exception:
        pass  # Directory might not exist yet on first run — lifespan handles it


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.app_version}
