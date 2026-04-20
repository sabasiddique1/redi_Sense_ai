from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
  app_name: str = "ReportIQ Backend"
  environment: Literal["development", "test", "staging", "production"] = (
    "development"
  )
  log_level: str = "INFO"
  api_host: str = "0.0.0.0"
  api_port: int = 8000

  postgres_url: str = Field(
    default="postgresql+psycopg2://reportiq:reportiq@localhost:5432/reportiq",
    validation_alias=AliasChoices("POSTGRES_URL", "DATABASE_URL"),
  )

  openai_api_key: str | None = None
  openai_chat_model: str = "gpt-4o-mini"
  openai_embedding_model: str = "text-embedding-3-small"
  request_timeout_seconds: int = 45

  use_pgvector: bool = True
  vector_dimensions: int = 1536
  embedding_batch_size: int = 8
  embedding_max_retries: int = 5
  embedding_initial_backoff_seconds: float = 1.0
  embedding_max_backoff_seconds: float = 20.0
  embedding_throttle_seconds: float = 0.25
  evidence_chunk_size_tokens: int = 220
  evidence_chunk_overlap_tokens: int = 40
  evidence_search_timeout_seconds: float = 8.0
  evidence_query_embedding_max_retries: int = 1
  evidence_db_statement_timeout_ms: int = 1500
  evidence_vector_candidate_limit: int = 8
  evidence_lexical_candidate_limit: int = 24
  evidence_copilot_top_k: int = 4
  evidence_keyword_filter_limit: int = 12
  evidence_enable_heuristic_rerank: bool = True

  auth0_domain: str | None = None
  auth0_audience: str | None = None
  auth0_issuer: str | None = None
  auth0_algorithms: list[str] = Field(default_factory=lambda: ["RS256"])

  demo_mode_enabled: bool = True
  max_upload_size_mb: int = 10
  storage_root: str = str(REPO_ROOT / "storage")
  allowed_origins: list[str] = Field(
    default_factory=lambda: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]
  )

  model_config = SettingsConfigDict(
    env_file=(str(REPO_ROOT / ".env"), str(BACKEND_DIR / ".env")),
    env_file_encoding="utf-8",
    case_sensitive=False,
    extra="ignore",
  )

  @field_validator("allowed_origins", mode="before")
  @classmethod
  def parse_allowed_origins(cls, value: object) -> object:
    if isinstance(value, str):
      return [item.strip() for item in value.split(",") if item.strip()]
    return value

  @field_validator("auth0_issuer", mode="before")
  @classmethod
  def normalize_auth0_issuer(cls, value: object) -> object:
    if not value:
      return value
    return str(value).rstrip("/") + "/"

  @field_validator("auth0_domain", mode="before")
  @classmethod
  def normalize_auth0_domain(cls, value: object) -> object:
    if not value:
      return value
    return str(value).replace("https://", "").rstrip("/")

  @property
  def auth_enabled(self) -> bool:
    return bool(self.auth0_domain and self.auth0_audience and self.auth0_issuer)

  @property
  def storage_path(self) -> Path:
    return Path(self.storage_root)

  @property
  def upload_max_bytes(self) -> int:
    return self.max_upload_size_mb * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
  settings = Settings()
  if settings.auth0_domain and not settings.auth0_issuer:
    settings.auth0_issuer = f"https://{settings.auth0_domain}/"
  return settings
