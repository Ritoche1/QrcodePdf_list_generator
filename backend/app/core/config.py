from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "QR Code PDF Generator"
    app_version: str = "1.0.0"
    debug: bool = False

    # Data directory (persistent volume mount point)
    data_dir: Path = Path("/data")

    # Database
    @property
    def db_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.data_dir}/qrcodepdf.db"

    # Files directory for generated QR images and PDFs
    @property
    def files_dir(self) -> Path:
        return self.data_dir / "files"

    # CORS
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost",
        "http://localhost:80",
    ]

    def ensure_dirs(self) -> None:
        """Create necessary data directories if they don't exist."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.files_dir.mkdir(parents=True, exist_ok=True)
        (self.files_dir / "qr").mkdir(parents=True, exist_ok=True)
        (self.files_dir / "pdf").mkdir(parents=True, exist_ok=True)
        (self.files_dir / "export").mkdir(parents=True, exist_ok=True)


settings = Settings()
