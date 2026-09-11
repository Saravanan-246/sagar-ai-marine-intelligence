# Sagar AI — Backend

**FastAPI + SQLite + SQLAlchemy**  
SIH 2026 · Problem Statement 26176

## Core Invariant

> **A committed marine decision is NEVER automatically modified.**  
> All mutations to `COMMITTED` decisions require explicit human approval via `POST /api/approvals/{id}/approve`.

---

## Stack

| Layer | Technology |
|---|---|
| Web Framework | FastAPI 0.115+ |
| ORM | SQLAlchemy 2.0 (async) |
| Database | SQLite via aiosqlite (default) |
| Validation | Pydantic v2 |
| Server | Uvicorn |

---

## Quick Start (Windows)

```bat
cd backend

REM Option 1: double-click start.bat
start.bat

REM Option 2: manual
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python seed.py
.venv\Scripts\uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at:
- **API Base:**  `http://127.0.0.1:8000/api/`
- **Swagger UI:** `http://127.0.0.1:8000/api/docs`
- **ReDoc:**      `http://127.0.0.1:8000/api/redoc`

---

## API Surface

### Decisions
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/decisions/` | List all decisions |
| `POST` | `/api/decisions/` | Create a DRAFT decision |
| `GET` | `/api/decisions/{id}` | Get decision detail |
| `PATCH` | `/api/decisions/{id}` | Update mutable fields (DRAFT only) |
| `POST` | `/api/decisions/{id}/commit` | Lock decision → COMMITTED |
| `DELETE` | `/api/decisions/{id}` | Delete DRAFT decision |

### Change Events
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/events/` | List all events |
| `POST` | `/api/events/{decision_id}` | Ingest a new change event |
| `GET` | `/api/events/{decision_id}/impact/{event_id}` | Run deterministic impact analysis |

### Repair Candidates
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/repairs/{decision_id}` | List repair candidates |
| `POST` | `/api/repairs/{decision_id}` | Add a repair candidate |
| `GET` | `/api/repairs/{decision_id}/{candidate_id}` | Get single candidate |

### Human Approvals *(core invariant enforcement)*
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/approvals/{decision_id}/approve` | Approve a repair (requires officer, rationale, verified items) |
| `POST` | `/api/approvals/{decision_id}/reject` | Reject a repair (v1.0 stays locked) |
| `GET` | `/api/approvals/{decision_id}` | List immutable approval records |

### Audit History *(read-only)*
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/audit/{decision_id}` | Full audit trail for a decision |
| `GET` | `/api/audit/` | All audit entries (all decisions) |

### System
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness probe |

---

## Architecture

```
main.py                    ← FastAPI app, CORS, lifespan
app/
  database.py              ← Async SQLAlchemy engine + session
  models.py                ← ORM models (Decision, Segment, Event, …)
  schemas.py               ← Pydantic v2 request/response schemas
  engine.py                ← Deterministic impact engine (no LLM)
  routers/
    decisions.py           ← CRUD + commit
    events.py              ← Ingest + on-demand impact analysis
    repairs.py             ← Repair candidate store
    approvals.py           ← Human approval gate (core invariant)
    audit.py               ← Read-only audit history
seed.py                    ← Demo data seed (matches frontend store)
start.bat                  ← Windows one-click startup
```

## Research Metrics Computed by Engine

The `engine.py` deterministically calculates (no LLM):

| Metric | Formula | R1 Demo Value |
|---|---|---|
| **Plan Churn** | `changed_segments / total_segments` | `0.20` (1 of 5) |
| **Preservation Ratio** | `1 - plan_churn` | `0.80` (80%) |
| **Feasibility** | Spatial + threshold evaluation | FEASIBLE & VERIFIED |

## Data Integrity Notice

All operational feeds, coordinates, and weather metrics are **SIMULATED / DEMO DATA**.  
No live official credentials (IMD, INCOIS, NAVAREA) are used or fabricated.
