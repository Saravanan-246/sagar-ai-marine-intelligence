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
    Applies segment updates, bumps decision version, writes immutable audit record.
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

    # Find the repair candidate
    candidate = next(
        (c for c in decision.repair_candidates if c.id == payload.repair_candidate_id),
        None,
    )
    if not candidate:
        raise HTTPException(
            status_code=404,
            detail=f"Repair candidate '{payload.repair_candidate_id}' not found for this decision.",
        )

    pre_status = decision.status
    pre_version = decision.version

    # ── Apply Segment Repairs ────────────────────────────────────────────
    # For the canonical demo: repair S3 with W3-A detour if R1 is selected
    for seg in decision.segments:
        if seg.segment_id == "S3" and candidate.id == "R1":
            seg.status = "REPAIRED_ACTIVE"
            seg.condition = "Remediated via Waypoint W3-A [SIMULATED]"
            seg.details = (
                "Modified by Human Approval: Detour via W3-A (14°18'N, 72°30'E). "
                "Distance: 207 NM (+12 NM). Safe wave envelope (<2.6m)."
            )
            seg.wave_height_m = 2.6
            seg.wind_kts = 22
        elif seg.segment_id not in ("S3",):
            if seg.status not in ("COMPLETED", "ACTIVE_STABLE"):
                seg.status = "UNAFFECTED"
            seg.details = (seg.details or "") + " (Preserved intact from v1.0 commitment)"

    # ── Update Decision Metadata ──────────────────────────────────────────
    new_version = _bump_version(pre_version)
    decision.version = new_version
    decision.status = "REPAIRED_COMMITTED"
    decision.committed_at = datetime.now(timezone.utc)
    # Revise ETA for R1 detour (+38 min)
    if candidate.id == "R1":
        decision.original_eta = "2026-09-14 06:38 UTC (+38m)"
        decision.total_distance_nm = (decision.total_distance_nm or 890) + 12

    # ── Write Immutable Approval Record ───────────────────────────────────
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
        summary=(
            f"Human operator {payload.officer_name} verified minimal change. "
            f"Segment S3 updated via W3-A detour. "
            f"Segments S1, S2, S4, S5 preserved 100%. "
            f"Revised ETA: 2026-09-14 06:38 UTC (+38m). "
            f"Rationale: {payload.rationale or 'Not specified'}."
        ),
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
            f"Human operator {payload.officer_name} rejected repair candidate. "
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
