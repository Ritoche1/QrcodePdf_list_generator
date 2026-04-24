from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings
from app.core.qr_defaults import (
    STANDARD_QR_BACKGROUND_COLOR,
    STANDARD_QR_ERROR_CORRECTION,
    STANDARD_QR_FOREGROUND_COLOR,
)


class Base(DeclarativeBase):
    pass


# Lazy-initialized engine (created after settings.ensure_dirs() is called)
_engine = None
_async_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.db_url,
            echo=settings.debug,
            connect_args={"check_same_thread": False},
        )
    return _engine


def get_session_factory():
    global _async_session_factory
    if _async_session_factory is None:
        _async_session_factory = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _async_session_factory


async def create_all_tables() -> None:
    """Create all database tables."""
    # Import models to register them with Base
    import app.models  # noqa: F401

    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if conn.dialect.name == "sqlite":
            result = await conn.execute(text("PRAGMA table_info(projects)"))
            project_columns = {row[1] for row in result.fetchall()}
            if "default_qr_foreground_color" not in project_columns:
                await conn.execute(
                    text(
                        "ALTER TABLE projects ADD COLUMN default_qr_foreground_color "
                        f"VARCHAR(7) NOT NULL DEFAULT '{STANDARD_QR_FOREGROUND_COLOR}'"
                    )
                )
            if "default_qr_background_color" not in project_columns:
                await conn.execute(
                    text(
                        "ALTER TABLE projects ADD COLUMN default_qr_background_color "
                        f"VARCHAR(7) NOT NULL DEFAULT '{STANDARD_QR_BACKGROUND_COLOR}'"
                    )
                )
            if "default_qr_error_correction" not in project_columns:
                await conn.execute(
                    text(
                        "ALTER TABLE projects ADD COLUMN default_qr_error_correction "
                        f"VARCHAR(1) NOT NULL DEFAULT '{STANDARD_QR_ERROR_CORRECTION}'"
                    )
                )
            result = await conn.execute(text("PRAGMA table_info(entries)"))
            entry_columns = {row[1] for row in result.fetchall()}
            if "qr_status" not in entry_columns:
                await conn.execute(
                    text(
                        "ALTER TABLE entries ADD COLUMN qr_status "
                        "VARCHAR(20) NOT NULL DEFAULT 'not_generated'"
                    )
                )
            if "qr_data_hash" not in entry_columns:
                await conn.execute(text("ALTER TABLE entries ADD COLUMN qr_data_hash VARCHAR(64)"))
            if "qr_generated_at" not in entry_columns:
                await conn.execute(text("ALTER TABLE entries ADD COLUMN qr_generated_at DATETIME"))
            if "qr_error_message" not in entry_columns:
                await conn.execute(
                    text("ALTER TABLE entries ADD COLUMN qr_error_message VARCHAR(500)")
                )


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields an async database session."""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
