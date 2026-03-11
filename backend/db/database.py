from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from backend.config import get_settings


settings = get_settings()


class Base(DeclarativeBase):
  pass


engine = create_engine(settings.postgres_url, echo=False, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()

