from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
  # Core
  app_name: str = "ReportIQ Backend"
  environment: str = "development"

  # Database
  postgres_url: str = "postgresql://user:password@localhost:5432/reportunit"

  # OpenAI / AI providers
  openai_api_key: str | None = None
  openai_model: str = "gpt-4o-mini"

  # Vector DB
  use_pinecone: bool = False
  pinecone_api_key: str | None = None
  pinecone_environment: str | None = None
  pinecone_index: str = "reportiq-evidence"

  use_pgvector: bool = True

  # Auth0
  auth0_domain: str | None = None
  auth0_audience: str | None = None
  auth0_issuer: str | None = None
  auth0_algorithms: list[str] = ["RS256"]

  class Config:
    env_file = ".env"
    env_file_encoding = "utf-8"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
  return Settings()

