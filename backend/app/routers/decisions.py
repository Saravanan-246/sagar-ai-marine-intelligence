"""
Decisions Router — CRUD for marine operational decisions.

INVARIANT: Only DRAFT decisions may be directly patched.
           COMMITTED decisions cannot be mutated except via the approvals endpoint.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Decision, RouteSegment, Dependency, AuditEntry
from app.schemas import DecisionCreate, DecisionOut, DecisionUpdate

router = APIRouter()


def _segments_to_orm(seg_schemas, decision_id: str):
    return [
        RouteSegment(
            segment_id=s.segment_id,
            decision_id=decision_id,
            order_index=s.order_index,
            name=s.name,
            distance_nm=s.distance_nm,
            status=s.status,
            condition=s.condition,
            wave_height_m=s.wave_height_m,
            wind_kts=s.wind_kts,
            details=s.details,
            start_lat=s.start_lat,
            start_lon=s.start_lon,
            end_lat=s.end_lat,
            end_lon=s.end_lon,
            repair_waypoint_lat=s.repair_waypoint_lat,
            repair_waypoint_lon=s.repair_waypoint_lon,
        )
        for s in seg_schemas
    ]


def _deps_to_orm(dep_schemas, decision_id: str):
    orm_deps = []
    for d in dep_schemas:
        dep = Dependency(
            id=d.id,
            decision_id=decision_id,
            dep_type=d.dep_type,
            name=d.name,
            commitment=d.commitment,
            source=d.source,
            condition=d.condition,
            impact_level=d.impact_level,
            status=d.status,
            description=d.description,
            mitigation_under_repair=d.mitigation_under_repair,
        )
        dep.linked_segments = d.linked_segments
        orm_deps.append(dep)
    return orm_deps


# ── Helpers ────────────────────────────────────────────────────────────────

async def _get_decision_or_404(db: AsyncSession, decision_id: str) -> Decision:
    result = await db.execute(
        select(Decision)
        .options(
            selectinload(Decision.segments),
            selectinload(Decision.dependencies),
        )
        .where(Decision.id == decision_id)
    )
    decision = result.scalar_one_or_none()
    if not decision:
        raise HTTPException(status_code=404, detail=f"Decision '{decision_id}' not found.")
    return decision


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/", response_model=List[DecisionOut])
async def list_decisions(db: AsyncSession = Depends(get_db)):
    """Return all decisions (summary list)."""
    result = await db.execute(
        select(Decision).options(
            selectinload(Decision.segments),
            selectinload(Decision.dependencies),
        )
    )
    return result.scalars().all()


@router.post("/", response_model=DecisionOut, status_code=status.HTTP_201_CREATED)
async def create_decision(payload: DecisionCreate, db: AsyncSession = Depends(get_db)):
    """Create a new decision (starts as DRAFT)."""
    existing = await db.get(Decision, payload.id)
    if existing:
        raise HTTPException(status_code=409, detail=f"Decision '{payload.id}' already exists.")

    decision = Decision(
        id=payload.id,
        title=payload.title,
        objective=payload.objective,
        status=payload.status,
        version=payload.version,
        officer=payload.officer,
        departure_port=payload.departure_port,
        destination_port=payload.destination_port,
        total_distance_nm=payload.total_distance_nm,
        planned_speed_kts=payload.planned_speed_kts,
        original_eta=payload.original_eta,
        current_segment=payload.current_segment,
        schedule=payload.schedule,
        data_source_type=payload.data_source_type,
        data_quality=payload.data_quality,
    )
    decision.assumptions = payload.assumptions

    db.add(decision)

    for seg in _segments_to_orm(payload.segments, payload.id):
        db.add(seg)

    for dep in _deps_to_orm(payload.dependencies, payload.id):
        db.add(dep)

    # Initial audit entry
    db.add(AuditEntry(
        decision_id=payload.id,
        version=payload.version,
        status=payload.status,
        event="Decision Created",
        summary=f"Decision '{payload.title}' created with status {payload.status}.",
        officer=payload.officer or "System",
    ))

    await db.commit()
    return await _get_decision_or_404(db, payload.id)


@router.get("/{decision_id}", response_model=DecisionOut)
async def get_decision(decision_id: str, db: AsyncSession = Depends(get_db)):
    return await _get_decision_or_404(db, decision_id)


@router.patch("/{decision_id}", response_model=DecisionOut)
async def update_decision(
    decision_id: str,
    payload: DecisionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update mutable fields of a decision.
    INVARIANT: COMMITTED decisions may not be patched via this endpoint —
               use the approvals endpoint instead.
    """
    decision = await _get_decision_or_404(db, decision_id)

    if decision.status == "COMMITTED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Decision is COMMITTED. Core invariant: a committed decision "
                "cannot be directly modified. Use POST /api/approvals/{id}/approve "
                "to apply a human-approved repair."
            ),
        )

    updates = payload.model_dump(exclude_none=True)
    for key, value in updates.items():
        if key == "assumptions":
            decision.assumptions = value
        else:
            setattr(decision, key, value)

    db.add(AuditEntry(
        decision_id=decision_id,
        version=decision.version,
        status=decision.status,
        event="Decision Updated",
        summary=f"Fields updated: {', '.join(updates.keys())}.",
        officer=decision.officer or "System",
    ))

    await db.commit()
    return await _get_decision_or_404(db, decision_id)


@router.post("/{decision_id}/commit", response_model=DecisionOut)
async def commit_decision(decision_id: str, db: AsyncSession = Depends(get_db)):
    """Lock a DRAFT decision into COMMITTED state."""
    decision = await _get_decision_or_404(db, decision_id)

    if decision.status not in ("DRAFT",):
        raise HTTPException(
            status_code=409,
            detail=f"Only DRAFT decisions can be committed. Current status: {decision.status}.",
        )

    from datetime import datetime, timezone
    decision.status = "COMMITTED"
    decision.committed_at = datetime.now(timezone.utc)

    db.add(AuditEntry(
        decision_id=decision_id,
        version=decision.version,
        status="COMMITTED",
        event="Decision Committed",
        summary="Decision locked into COMMITTED state. Invariant active: no autonomous mutation permitted.",
        officer=decision.officer or "System",
    ))

    await db.commit()
    return await _get_decision_or_404(db, decision_id)


@router.delete("/{decision_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_decision(decision_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a decision (only DRAFT; COMMITTED decisions are protected)."""
    decision = await _get_decision_or_404(db, decision_id)

    if decision.status == "COMMITTED":
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a COMMITTED decision. Archive or supersede it instead.",
        )

    await db.delete(decision)
    await db.commit()
