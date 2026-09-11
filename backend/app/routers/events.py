"""
Change Events Router.
Records environmental / operational disruptions against a committed decision
and runs the deterministic impact engine to classify affected segments.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Decision, ChangeEvent, AuditEntry, Dependency, RouteSegment
from app.schemas import ChangeEventCreate, ChangeEventOut, ImpactAnalysisOut
from app.engine import (
    evaluate_decision_impact,
    SegmentDTO,
    DependencyDTO,
)

router = APIRouter()


async def _get_decision_or_404(db: AsyncSession, decision_id: str) -> Decision:
    result = await db.execute(select(Decision).where(Decision.id == decision_id))
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail=f"Decision '{decision_id}' not found.")
    return d


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/", response_model=List[ChangeEventOut])
async def list_events(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChangeEvent).order_by(ChangeEvent.created_at.desc()))
    return result.scalars().all()


@router.post(
    "/{decision_id}",
    response_model=ChangeEventOut,
    status_code=status.HTTP_201_CREATED,
)
async def ingest_change_event(
    decision_id: str,
    payload: ChangeEventCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest a new environmental / operational change event against a decision.
    Automatically transitions COMMITTED → IMPACTED and writes an audit entry.
    Does NOT apply any repair — that requires explicit human approval.
    """
    decision = await _get_decision_or_404(db, decision_id)

    # Check for duplicate event id
    existing = await db.get(ChangeEvent, payload.id)
    if existing:
        raise HTTPException(status_code=409, detail=f"Event '{payload.id}' already exists.")

    event = ChangeEvent(
        id=payload.id,
        decision_id=decision_id,
        event_type=payload.event_type,
        title=payload.title,
        severity=payload.severity,
        source=payload.source,
        source_type=payload.source_type,
        observed_at=payload.observed_at,
        location=payload.location,
        event_lat=payload.event_lat,
        event_lon=payload.event_lon,
        radius_nm=payload.radius_nm,
        affected_segment_id=payload.affected_segment_id,
        description=payload.description,
        quality=payload.quality,
        source_record_id=payload.source_record_id,
        is_catastrophic=payload.is_catastrophic,
    )
    db.add(event)

    # Transition decision status
    if decision.status in ("COMMITTED", "IMPACTED"):
        decision.status = "IMPACTED"

    db.add(AuditEntry(
        decision_id=decision_id,
        version=decision.version,
        status="IMPACTED",
        event=f"Change Event Ingested: {payload.id}",
        summary=f"Event '{payload.title}' (severity={payload.severity}) ingested. Decision flagged IMPACTED for human review.",
        officer="Sagar AI Continuity Engine",
    ))

    await db.commit()
    await db.refresh(event)
    return event


@router.get(
    "/{decision_id}/impact/{event_id}",
    response_model=ImpactAnalysisOut,
)
async def compute_impact(
    decision_id: str,
    event_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    On-demand deterministic impact analysis for a specific (decision, event) pair.
    Pure computation — does not mutate any database record.
    """
    decision = await _get_decision_or_404(db, decision_id)

    result = await db.execute(select(ChangeEvent).where(ChangeEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found.")

    # Load segments and dependencies
    seg_result = await db.execute(
        select(RouteSegment).where(RouteSegment.decision_id == decision_id)
    )
    segments = [
        SegmentDTO(
            segment_id=s.segment_id,
            start_lat=s.start_lat,
            start_lon=s.start_lon,
            end_lat=s.end_lat,
            end_lon=s.end_lon,
        )
        for s in seg_result.scalars().all()
    ]

    dep_result = await db.execute(
        select(Dependency).where(Dependency.decision_id == decision_id)
    )
    dependencies = [
        DependencyDTO(
            dep_id=d.id,
            linked_segments=d.linked_segments,
            impact_level=d.impact_level or "MEDIUM",
        )
        for d in dep_result.scalars().all()
    ]

    event_center = (
        (event.event_lat, event.event_lon)
        if event.event_lat is not None and event.event_lon is not None
        else None
    )

    impact = evaluate_decision_impact(
        segments=segments,
        dependencies=dependencies,
        event_center=event_center,
        radius_nm=event.radius_nm or 45.0,
        directly_affected_segment_id=event.affected_segment_id,
        event_severity=event.severity,
        event_description=event.description or "",
        is_catastrophic=event.is_catastrophic,
    )

    return ImpactAnalysisOut(
        decision_id=decision_id,
        event_id=event_id,
        affected_segment_ids=impact.affected_segment_ids,
        unaffected_segment_ids=impact.unaffected_segment_ids,
        violated_dependency_ids=impact.violated_dependency_ids,
        at_risk_dependency_ids=impact.at_risk_dependency_ids,
        severity=impact.severity,
        reason=impact.reason,
        plan_churn=impact.plan_churn,
        preservation_ratio=impact.preservation_ratio,
        is_catastrophic_collapse=impact.is_catastrophic_collapse,
    )
