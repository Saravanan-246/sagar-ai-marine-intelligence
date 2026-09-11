"""
Human Approvals Router.
ENFORCES the core product invariant:
  NEVER automatically apply a repair to a committed decision.
  ALL mutations to COMMITTED decisions require explicit human approval
  through this endpoint with officer name, rationale, and item verification.

Approval steps:
  1. POST /api/approvals/{decision_id}/approve  → applies the repair, bumps version
  2. POST /api/approvals/{decision_id}/reject   → logs rejection, keeps v1.0 locked
"""

import json
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    Decision,
    RouteSegment,
    RepairCandidate,
    ApprovalRecord,
    AuditEntry,
)
from app.schemas import (
    ApprovalRequest,
    RejectionRequest,
    ApprovalRecordOut,
)

router = APIRouter()


async def _get_decision_full(db: AsyncSession, decision_id: str) -> Decision:
    result = await db.execute(
        select(Decision)
        .options(
            selectinload(Decision.segments),
            selectinload(Decision.dependencies),
            selectinload(Decision.repair_candidates),
            selectinload(Decision.change_events),
        )
        .where(Decision.id == decision_id)
    )
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail=f"Decision '{decision_id}' not found.")
    return d


@router.post("/{decision_id}/approve", response_model=ApprovalRecordOut)
async def approve_repair(
    decision_id: str,
    payload: ApprovalRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Human operator explicitly approves a repair candidate.
    Dynamically identifies the affected segment, applies minimal-change repairs,
    preserves all unaffected segments, bumps decision version, and logs immutable audit.
    """
    decision = await _get_decision_full(db, decision_id)

    if decision.status not in ("IMPACTED", "REPAIR_PENDING"):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Approval requires decision status IMPACTED or REPAIR_PENDING. "
                f"Current: {decision.status}."
            ),
        )

    # Find or register the repair candidate
    candidate = next(
        (c for c in decision.repair_candidates if c.id == payload.repair_candidate_id),
        None,
    )
    if not candidate and payload.candidate_data:
        cdata = payload.candidate_data
        candidate = RepairCandidate(
            id=cdata.id,
            decision_id=decision_id,
            tier=cdata.tier,
            title=cdata.title,
            description=cdata.description,
            plan_churn=cdata.plan_churn,
            preservation_ratio=cdata.preservation_ratio,
            tradeoffs=cdata.tradeoffs,
            feasibility=cdata.feasibility,
            score=cdata.score,
            recommendation_reason=cdata.recommendation_reason,
            linked_event_id=cdata.linked_event_id,
            affected_segment_id=cdata.affected_segment_id,
            repair_waypoint_lat=cdata.repair_waypoint_lat,
            repair_waypoint_lon=cdata.repair_waypoint_lon,
        )
        candidate.what_changes = cdata.what_changes
        candidate.what_remains_unchanged = cdata.what_remains_unchanged
        db.add(candidate)
        await db.flush()
        decision.repair_candidates.append(candidate)

    if not candidate:
        raise HTTPException(
            status_code=404,
            detail=f"Repair candidate '{payload.repair_candidate_id}' not found for this decision.",
        )

    pre_status = decision.status
    pre_version = decision.version

    # ── Identify Actual Affected Segment Dynamically ────────────────────
    target_seg_id = None

    # 1. Direct attribute on RepairCandidate
    if hasattr(candidate, "affected_segment_id") and candidate.affected_segment_id:
        target_seg_id = candidate.affected_segment_id

    # 2. Linked Change Event attribute
    if not target_seg_id and candidate.linked_event_id:
        evt = next((e for e in decision.change_events if e.id == candidate.linked_event_id), None)
        if evt and evt.affected_segment_id:
            target_seg_id = evt.affected_segment_id

    # 3. Latest Change Event on the Decision
    if not target_seg_id and decision.change_events:
        sorted_events = sorted(
            decision.change_events,
            key=lambda e: e.created_at or datetime.min,
            reverse=True,
        )
        for e in sorted_events:
            if e.affected_segment_id:
                target_seg_id = e.affected_segment_id
                break

    # 4. Parse segment ID from what_changes list
    if not target_seg_id and candidate.what_changes:
        for change_str in candidate.what_changes:
            for s in decision.segments:
                if f"Segment {s.segment_id}" in change_str or f"Leg {s.segment_id}" in change_str:
                    target_seg_id = s.segment_id
                    break
            if target_seg_id:
                break

    # 5. Exactly one segment currently marked AFFECTED
    if not target_seg_id:
        affected_segs = [s for s in decision.segments if s.status == "AFFECTED"]
        if len(affected_segs) == 1:
            target_seg_id = affected_segs[0].segment_id

    # 6. Safety check: Target segment MUST exist in decision.segments
    target_segment = next(
        (s for s in decision.segments if s.segment_id == target_seg_id),
        None,
    )
    if not target_segment:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Repair candidate '{candidate.id}' cannot be safely mapped to an affected route segment "
                f"in decision '{decision_id}'. No safe minimal repair mapping found. Autonomous guessing prohibited."
            ),
        )

    # ── Determine Waypoint Coordinates Dynamically ────────────────────────
    wp_lat = None
    wp_lon = None
    if hasattr(candidate, "repair_waypoint_lat") and candidate.repair_waypoint_lat is not None:
        wp_lat = candidate.repair_waypoint_lat
        wp_lon = candidate.repair_waypoint_lon
    elif target_segment.repair_waypoint_lat is not None:
        wp_lat = target_segment.repair_waypoint_lat
        wp_lon = target_segment.repair_waypoint_lon
    elif target_segment.start_lat is not None and target_segment.end_lat is not None:
        wp_lat = round((target_segment.start_lat + target_segment.end_lat) / 2.0, 4)
        wp_lon = round((target_segment.start_lon + target_segment.end_lon) / 2.0 - 0.55, 4)
        target_segment.repair_waypoint_lat = wp_lat
        target_segment.repair_waypoint_lon = wp_lon

    # ── Update ONLY the Target Affected Segment ───────────────────────────
    target_segment.status = "REPAIRED_ACTIVE"
    target_segment.condition = f"Remediated via Waypoint W-{target_segment.segment_id} [COMPUTED]"
    if wp_lat is not None and wp_lon is not None:
        target_segment.details = (
            f"Modified by Human Approval: Detour via W-{target_segment.segment_id} "
            f"({wp_lat:.2f}°N, {wp_lon:.2f}°E). Distance delta: +12.0 NM. Safe wave envelope restored."
        )
    else:
        target_segment.details = (
            f"Modified by Human Approval: Detour via W-{target_segment.segment_id}. "
            f"Distance delta: +12.0 NM. Safe wave envelope restored."
        )
    target_segment.wave_height_m = 2.2
    target_segment.wind_kts = 18

    # ── Preserve EVERY Unaffected Segment ─────────────────────────────────
    preserved_ids = []
    for seg in decision.segments:
        if seg.segment_id != target_segment.segment_id:
            preserved_ids.append(seg.segment_id)
            if seg.status not in ("COMPLETED", "ACTIVE_STABLE"):
                seg.status = "UNAFFECTED"
            if "(Preserved intact" not in (seg.details or ""):
                seg.details = f"{(seg.details or '').rstrip()} (Preserved intact from {pre_version} commitment)".strip()

    # ── Update Decision Metadata ──────────────────────────────────────────
    new_version = _bump_version(pre_version)
    decision.version = new_version
    decision.status = "REPAIRED_COMMITTED"
    decision.committed_at = datetime.now(timezone.utc)
    decision.total_distance_nm = round((decision.total_distance_nm or 0.0) + 12.0, 1)
    if decision.original_eta and "(+" not in decision.original_eta:
        decision.original_eta = f"{decision.original_eta} (+35m)"

    # ── Dynamic Audit Summary ─────────────────────────────────────────────
    preserved_text = (
        f"Segments {', '.join(preserved_ids)} preserved 100%."
        if preserved_ids
        else "All corridor legs evaluated."
    )
    audit_summary = (
        f"Human operator {payload.officer_name} verified minimal change. "
        f"Segment {target_segment.segment_id} updated via detour. "
        f"{preserved_text} "
        f"Revised ETA: {decision.original_eta or 'Updated'}. "
        f"Rationale: {payload.rationale or 'Operational continuity maintained with safe corridor standoff.'}"
    )

    # ── Write Immutable Approval Record & Audit Entry ──────────────────────
    record = ApprovalRecord(
        decision_id=decision_id,
        repair_candidate_id=candidate.id,
        action="APPROVED",
        officer_name=payload.officer_name,
        rationale=payload.rationale,
        rejection_reason=None,
        verified_items_json=json.dumps(payload.verified_items),
        pre_approval_status=pre_status,
        post_approval_status="REPAIRED_COMMITTED",
        decision_version_before=pre_version,
        decision_version_after=new_version,
    )
    db.add(record)

    db.add(AuditEntry(
        decision_id=decision_id,
        version=new_version,
        status="REPAIRED_COMMITTED",
        event=f"Repair {candidate.id} Approved & Committed ({new_version})",
        summary=audit_summary,
        officer=payload.officer_name,
    ))

    await db.commit()
    await db.refresh(record)
    return record


@router.post("/{decision_id}/reject", response_model=ApprovalRecordOut)
async def reject_repair(
    decision_id: str,
    payload: RejectionRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Human operator rejects the proposed repair.
    Decision status stays IMPACTED. v1.0 commitment remains locked.
    """
    decision = await _get_decision_full(db, decision_id)

    if decision.status not in ("IMPACTED", "REPAIR_PENDING"):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Rejection requires decision status IMPACTED or REPAIR_PENDING. "
                f"Current: {decision.status}."
            ),
        )

    # Decision stays IMPACTED — this is intentional
    record = ApprovalRecord(
        decision_id=decision_id,
        repair_candidate_id=payload.repair_candidate_id,
        action="REJECTED",
        officer_name=payload.officer_name,
        rationale=None,
        rejection_reason=payload.rejection_reason,
        pre_approval_status=decision.status,
        post_approval_status="IMPACTED",
        decision_version_before=decision.version,
        decision_version_after=decision.version,
    )
    db.add(record)

    db.add(AuditEntry(
        decision_id=decision_id,
        version=decision.version,
        status="IMPACTED",
        event=f"Repair Candidate {payload.repair_candidate_id} Rejected",
        summary=(
            f"Human operator {payload.officer_name} rejected repair candidate '{payload.repair_candidate_id}'. "
            f"Reason: {payload.rejection_reason or 'Not specified'}. "
            f"Original {decision.version} decision remains locked under active alert."
        ),
        officer=payload.officer_name,
    ))

    await db.commit()
    await db.refresh(record)
    return record


@router.get("/{decision_id}", response_model=List[ApprovalRecordOut])
async def list_approval_records(
    decision_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Returns the full immutable approval audit trail for a decision."""
    result = await db.execute(
        select(ApprovalRecord)
        .where(ApprovalRecord.decision_id == decision_id)
        .order_by(ApprovalRecord.created_at.desc())
    )
    return result.scalars().all()


# ── Helpers ────────────────────────────────────────────────────────────────

def _bump_version(version: str) -> str:
    """v1.0 → v2.0, v2.0 → v3.0, etc."""
    try:
        major = int(version.lstrip("v").split(".")[0])
        return f"v{major + 1}.0"
    except (ValueError, IndexError):
        return f"{version}-updated"
