"""
SQLAlchemy async engine + session factory.
Uses SQLite with aiosqlite for simplicity (swap to PostgreSQL via env var).
"""

import os
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# Resolve DB path: place sagar_ai.db next to this file's parent (backend/)
_DB_DIR = Path(__file__).parent.parent
_DB_PATH = _DB_DIR / "sagar_ai.db"

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{_DB_PATH}")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,            # flip to True for SQL query logging
    future=True,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db():
    """Create all tables on startup."""
    # Import models so they register with Base metadata
    from app import models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """FastAPI dependency: yields an async DB session."""
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
