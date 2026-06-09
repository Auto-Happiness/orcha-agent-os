"""Service settings loaded from environment variables."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    embedding_model: str = "paraphrase-multilingual-MiniLM-L12-v2"
    embedding_dimensions: int = 384
   
    host: str = "0.0.0.0"
    port: int = 5001
    log_level: str = "info"

    batch_size: int = 64
   
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
