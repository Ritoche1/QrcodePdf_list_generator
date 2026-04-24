from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.qr_defaults import (
    STANDARD_QR_BACKGROUND_COLOR,
    STANDARD_QR_ERROR_CORRECTION,
    STANDARD_QR_FOREGROUND_COLOR,
)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_qr_foreground_color: Mapped[str] = mapped_column(
        String(7), nullable=False, default=STANDARD_QR_FOREGROUND_COLOR
    )
    default_qr_background_color: Mapped[str] = mapped_column(
        String(7), nullable=False, default=STANDARD_QR_BACKGROUND_COLOR
    )
    default_qr_error_correction: Mapped[str] = mapped_column(
        String(1), nullable=False, default=STANDARD_QR_ERROR_CORRECTION
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    entries: Mapped[list["Entry"]] = relationship(  # noqa: F821
        "Entry",
        back_populates="project",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Project id={self.id} name={self.name!r}>"
