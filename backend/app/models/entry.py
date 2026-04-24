import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EntryStatus(str, enum.Enum):
    draft = "draft"
    generated = "generated"
    printed = "printed"
    archived = "archived"


class QrGenerationStatus(str, enum.Enum):
    not_generated = "not_generated"
    generated = "generated"
    outdated = "outdated"
    error = "error"


class ContentType(str, enum.Enum):
    url = "url"
    text = "text"
    vcard = "vcard"
    wifi = "wifi"


class Entry(Base):
    __tablename__ = "entries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content_type: Mapped[str] = mapped_column(
        Enum(ContentType),
        nullable=False,
        default=ContentType.text,
    )
    # JSON string storing the content data (url, text, vcard fields, wifi fields)
    content_data: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    label: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(EntryStatus),
        nullable=False,
        default=EntryStatus.draft,
        index=True,
    )
    # JSON array of tag strings
    tags: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    # Path to the generated QR image file (relative to files_dir)
    qr_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    qr_status: Mapped[str] = mapped_column(
        Enum(QrGenerationStatus),
        nullable=False,
        default=QrGenerationStatus.not_generated,
        index=True,
    )
    qr_data_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    qr_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    qr_error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Optional serial number for printing
    serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
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
    project: Mapped["Project"] = relationship(  # noqa: F821
        "Project",
        back_populates="entries",
    )

    def __repr__(self) -> str:
        return f"<Entry id={self.id} project_id={self.project_id} type={self.content_type}>"
