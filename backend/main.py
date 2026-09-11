"""
Sagar AI — Marine Decision Continuity System
Backend: FastAPI + SQLite + SQLAlchemy
Problem Statement: SIH 26176

CORE INVARIANT (enforced throughout):
  NEVER automatically modify a committed decision.
  ALL mutations to COMMITTED decisions require explicit human approval.
"""

from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.database import init_db
from app.routers import decisions, events, repairs, approvals, audit, marine
from app.routers import marine_evaluate

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("sagar_ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Sagar AI backend starting — initialising database…")
    await init_db()
    logger.info("Database ready.")
    yield
    logger.info("Sagar AI backend shutting down.")


app = FastAPI(
    title="Sagar AI — Marine Decision Continuity API",
    description=(
        "Dependency-Aware Minimal-Change Repair for Dynamic Marine Decisions. "
        "SIH 2026, Problem Statement 26176. "
        "INVARIANT: Never automatically mutate a committed decision."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Allow the Vite dev server to call the API
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────
app.include_router(decisions.router, prefix="/api/decisions", tags=["Decisions"])
app.include_router(events.router,    prefix="/api/events",    tags=["Change Events"])
app.include_router(repairs.router,   prefix="/api/repairs",   tags=["Repair Candidates"])
app.include_router(approvals.router, prefix="/api/approvals", tags=["Human Approvals"])
app.include_router(audit.router,     prefix="/api/audit",     tags=["Audit History"])
app.include_router(marine.router,         prefix="/api/marine",    tags=["Marine Data (INCOIS OSF)"])
app.include_router(marine_evaluate.router, prefix="/api/marine",    tags=["Marine Data (INCOIS OSF)"])


@app.get("/api/health", tags=["System"])
async def health():
    """Liveness probe."""
    return {"status": "ok", "system": "Sagar AI Marine Decision Continuity API"}
