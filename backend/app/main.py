from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import create_all_tables


# Ensure directories exist before the app starts to allow mounting StaticFiles directly
settings.ensure_dirs()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
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

# Serve generated files statically
app.mount("/files", StaticFiles(directory=str(settings.files_dir)), name="files")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.app_version}
