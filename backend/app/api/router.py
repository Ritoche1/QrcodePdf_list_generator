"""Main API router combining all sub-routers."""

from fastapi import APIRouter

from app.api.routes import entries, import_export, pdf, projects, qr, stats

api_router = APIRouter()

# Projects
api_router.include_router(projects.router)

# Entries (project-scoped and standalone)
api_router.include_router(entries.router)

# QR generation
api_router.include_router(qr.router)

# PDF generation and export
api_router.include_router(pdf.router)

# Import/export data
api_router.include_router(import_export.router)

# Stats
api_router.include_router(stats.router)
