from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


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
                        "VARCHAR(7) NOT NULL DEFAULT '#000000'"
                    )
                )
            if "default_qr_background_color" not in project_columns:
                await conn.execute(
                    text(
                        "ALTER TABLE projects ADD COLUMN default_qr_background_color "
                        "VARCHAR(7) NOT NULL DEFAULT '#ffffff'"
                    )
                )
            if "default_qr_error_correction" not in project_columns:
                await conn.execute(
                    text(
                        "ALTER TABLE projects ADD COLUMN default_qr_error_correction "
                        "VARCHAR(1) NOT NULL DEFAULT 'M'"
                    )
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
