"""
test_dynamic_approval.py — Comprehensive tests for dynamic human approval & rejection
Verifies:
  1. Approval of a repair affecting a dynamically selected segment (non-S3).
  2. Unaffected segments remain intact and marked preserved.
  3. Backend approval record is persisted.
  4. Version increments correctly (e.g. v1.0 -> v2.0).
  5. Audit entry is created with dynamic summary.
  6. Rejection persists and does not mutate the committed route.
  7. Unmappable candidate is rejected with 422 (no autonomous guessing).
  8. Zero hardcoded S1-S5 or W3-A assumptions.
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
from fastapi import HTTPException

from app.models import (
    Base, Decision, RouteSegment, Dependency, ChangeEvent, RepairCandidate,
    ApprovalRecord, AuditEntry
)
from app.schemas import ApprovalRequest, RejectionRequest, RepairCandidateCreate
from app.routers.approvals import approve_repair, reject_repair


async def create_test_db():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return async_sessionmaker(engine, expire_on_commit=False)


async def run_tests():
    SessionLocal = await create_test_db()
    passed = 0
    failed = 0

    def check(name, cond, details=""):
        nonlocal passed, failed
        if cond:
            passed += 1
            print(f"  \u2713 [PASS] {name}" + (f": {details}" if details else ""))
        else:
            failed += 1
            print(f"  \u2717 [FAIL] {name}" + (f": {details}" if details else ""))

    print("\n" + "="*70)
    print("TEST SUITE: Dynamic Human Approval & Invariant Enforcement")
    print("="*70)

    # ── Test Case 1: Custom Route with Dynamic Segment IDs ─────────────────
    print("\n[TC1] Custom Route with 3 Dynamic Legs (LEG-X, LEG-Y, LEG-Z)")
    async with SessionLocal() as db:
        dec = Decision(
            id="DEC-CUSTOM-001",
            title="Custom Corridor Passage",
            status="IMPACTED",
            version="v1.0",
            total_distance_nm=350.0,
            original_eta="2026-09-15 12:00 UTC",
        )
        db.add(dec)

        s1 = RouteSegment(
            segment_id="LEG-X",
            decision_id="DEC-CUSTOM-001",
            order_index=0,
            name="Port Alpha to Sector Bravo",
            distance_nm=100.0,
            status="ACTIVE_STABLE",
            start_lat=18.0, start_lon=72.0, end_lat=17.0, end_lon=72.5,
            details="Nominal initial transit",
        )
        s2 = RouteSegment(
            segment_id="LEG-Y",
            decision_id="DEC-CUSTOM-001",
            order_index=1,
            name="Sector Bravo to Sector Charlie",
            distance_nm=120.0,
            status="AFFECTED",
            start_lat=17.0, start_lon=72.5, end_lat=15.5, end_lon=73.0,
            details="Intersected by high wave threat envelope",
        )
        s3 = RouteSegment(
            segment_id="LEG-Z",
            decision_id="DEC-CUSTOM-001",
            order_index=2,
            name="Sector Charlie to Destination Delta",
            distance_nm=130.0,
            status="UNAFFECTED",
            start_lat=15.5, start_lon=73.0, end_lat=14.0, end_lon=73.5,
            details="Approaching harbor",
        )
        db.add_all([s1, s2, s3])

        evt = ChangeEvent(
            id="EVT-TEST-001",
            decision_id="DEC-CUSTOM-001",
            title="SWH Threshold Breach",
            affected_segment_id="LEG-Y",
            event_lat=16.25, event_lon=72.75,
            radius_nm=35.0,
        )
        db.add(evt)

        cand = RepairCandidate(
            id="R-DYN-01",
            decision_id="DEC-CUSTOM-001",
            tier="RECOMMENDED",
            title="Minimal Repair: Leg LEG-Y Detour",
            description="Replaces LEG-Y with safe western arc detour",
            plan_churn=0.33,
            preservation_ratio=0.67,
            affected_segment_id="LEG-Y",
            repair_waypoint_lat=16.25,
            repair_waypoint_lon=72.20,
            linked_event_id="EVT-TEST-001",
        )
        cand.what_changes = ["Segment LEG-Y replaced with 2 sub-legs via Waypoint W-LEG-Y"]
        cand.what_remains_unchanged = ["Segment LEG-X preserved", "Segment LEG-Z preserved"]
        db.add(cand)
        await db.commit()

        # Approve repair
        req = ApprovalRequest(
            repair_candidate_id="R-DYN-01",
            officer_name="Capt. R. Sharma",
            rationale="Approved western standoff to clear SWH envelope",
            verified_items=[True, True, True],
        )

        record = await approve_repair("DEC-CUSTOM-001", req, db)

        check("TC1.1 Approval action is APPROVED", record.action == "APPROVED")
        check("TC1.2 Pre-version is v1.0", record.decision_version_before == "v1.0")
        check("TC1.3 Post-version is v2.0", record.decision_version_after == "v2.0")

        # Reload decision from DB and verify segment mutations
        await db.refresh(dec)
        check("TC1.4 Decision status updated to REPAIRED_COMMITTED", dec.status == "REPAIRED_COMMITTED")
        check("TC1.5 Decision version bumped to v2.0", dec.version == "v2.0")
        check("TC1.6 Total distance adjusted (+12 NM)", dec.total_distance_nm == 362.0)

        await db.refresh(s1)
        await db.refresh(s2)
        await db.refresh(s3)

        check("TC1.7 Affected segment LEG-Y status is REPAIRED_ACTIVE", s2.status == "REPAIRED_ACTIVE")
        check("TC1.8 LEG-Y condition references Waypoint W-LEG-Y", "W-LEG-Y" in s2.condition)
        check("TC1.9 LEG-Y wave height remediated to safe 2.2m", s2.wave_height_m == 2.2)

        check("TC1.10 Unaffected segment LEG-X remains unchanged/preserved", "Preserved intact" in s1.details)
        check("TC1.11 Unaffected segment LEG-Z remains preserved", "Preserved intact" in s3.details)
        check("TC1.12 LEG-X and LEG-Z status is not REPAIRED", s1.status != "REPAIRED_ACTIVE" and s3.status != "REPAIRED_ACTIVE")

    # ── Test Case 2: Audit History Verification ────────────────────────────
    print("\n[TC2] Dynamic Audit Log Verification")
    async with SessionLocal() as db:
        from sqlalchemy import select
        audits = (await db.execute(select(AuditEntry).where(AuditEntry.decision_id == "DEC-CUSTOM-001"))).scalars().all()
        check("TC2.1 Audit entry exists for decision", len(audits) >= 1)
        latest_audit = audits[-1]
        check("TC2.2 Audit summary dynamically references LEG-Y", "LEG-Y" in latest_audit.summary)
        check("TC2.3 Audit summary dynamically references preserved legs", "LEG-X" in latest_audit.summary and "LEG-Z" in latest_audit.summary)
        check("TC2.4 Audit summary contains NO mention of S3 or W3-A", "S3" not in latest_audit.summary and "W3-A" not in latest_audit.summary)
        check("TC2.5 Audit officer matches officer_name", latest_audit.officer == "Capt. R. Sharma")

    # ── Test Case 3: Rejection Flow Verification ───────────────────────────
    print("\n[TC3] Human Rejection Flow")
    async with SessionLocal() as db:
        dec2 = Decision(
            id="DEC-REJECT-001",
            title="Passage Plan Alpha-2",
            status="IMPACTED",
            version="v1.0",
            total_distance_nm=200.0,
        )
        db.add(dec2)
        r_seg = RouteSegment(
            segment_id="LEG-R1", decision_id="DEC-REJECT-001", order_index=0,
            name="Test Leg R1",
            status="AFFECTED", details="Unrepaired baseline",
        )
        db.add(r_seg)
        cand2 = RepairCandidate(
            id="R-OPT-99", decision_id="DEC-REJECT-001", tier="ALTERNATIVE",
            title="Detour Option 99", affected_segment_id="LEG-R1",
        )
        db.add(cand2)
        await db.commit()

        rej_req = RejectionRequest(
            repair_candidate_id="R-OPT-99",
            officer_name="Lt. Cmdr. V. Nair",
            rejection_reason="Excessive deviation from charted transit corridor.",
        )
        rej_rec = await reject_repair("DEC-REJECT-001", rej_req, db)

        check("TC3.1 Rejection record action is REJECTED", rej_rec.action == "REJECTED")
        check("TC3.2 Decision version is NOT bumped (remains v1.0)", rej_rec.decision_version_after == "v1.0")

        await db.refresh(dec2)
        await db.refresh(r_seg)
        check("TC3.3 Decision status remains IMPACTED", dec2.status == "IMPACTED")
        check("TC3.4 Decision version remains v1.0", dec2.version == "v1.0")
        check("TC3.5 Segment LEG-R1 was NOT mutated", r_seg.status == "AFFECTED" and r_seg.details == "Unrepaired baseline")

    # ── Test Case 4: Rejection of Unmappable Candidate (Invariant 9) ────────
    print("\n[TC4] Unmappable Candidate Rejection (No Guessing Invariant)")
    async with SessionLocal() as db:
        dec3 = Decision(
            id="DEC-NOMAP-001",
            title="Unmapped Test",
            status="IMPACTED",
            version="v1.0",
        )
        db.add(dec3)
        # Decision has segments CST-1 and CST-2, neither is marked affected
        db.add(RouteSegment(segment_id="CST-1", decision_id="DEC-NOMAP-001", order_index=0, name="Corridor Leg 1", status="ACTIVE_STABLE"))
        db.add(RouteSegment(segment_id="CST-2", decision_id="DEC-NOMAP-001", order_index=1, name="Corridor Leg 2", status="ACTIVE_STABLE"))
        
        # Candidate references an unknown segment NONEXISTENT-LEG
        cand_bad = RepairCandidate(
            id="R-BAD-01", decision_id="DEC-NOMAP-001", tier="ALTERNATIVE",
            title="Ghost Repair", affected_segment_id="NONEXISTENT-LEG",
        )
        db.add(cand_bad)
        await db.commit()

        rejected_with_422 = False
        try:
            await approve_repair("DEC-NOMAP-001", ApprovalRequest(
                repair_candidate_id="R-BAD-01",
                officer_name="Inspector Test",
            ), db)
        except HTTPException as e:
            if e.status_code == 422:
                rejected_with_422 = True

        check("TC4.1 Unmappable repair raises HTTPException 422", rejected_with_422, "Properly blocked autonomous guessing")

    print("\n" + "="*70)
    print(f"RESULTS: {passed}/{passed + failed} assertions passed, {failed} failed")
    print("="*70)
    return failed == 0


if __name__ == "__main__":
    success = asyncio.run(run_tests())
    sys.exit(0 if success else 1)
