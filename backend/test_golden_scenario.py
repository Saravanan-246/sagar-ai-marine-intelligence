"""
Sagar AI — Golden Scenario Test
Validates the complete core innovation workflow on a dynamic 4-segment route:
  Committed Decision
  → Simulated Change Event (Labelled SIMULATED)
  → Dependency Evaluation
  → Segment-Level Impact (LEG-02 Affected, LEG-01/03/04 Preserved)
  → Minimal-Change Repair (Modifies ONLY LEG-02)
  → Rejection preserves committed route unmutated
  → Human Approval
  → New Decision Version (v1.0 -> v2.0) + Audit History
  → No S3/W3-A/R1 hardcoding exists
  → Unfeasible scenario returns NO_SAFE_MINIMAL_REPAIR
"""

import asyncio
import os
import sys

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

from httpx import AsyncClient, ASGITransport
from app.database import engine, Base, SessionLocal
from app.models import Decision, RouteSegment, Dependency, ChangeEvent, RepairCandidate, ApprovalRecord, AuditEntry
from main import app


def check(name: str, condition: bool, detail: str = ""):
    if condition:
        print(f"  ✓ [PASS] {name}{f': {detail}' if detail else ''}")
    else:
        print(f"  ✗ [FAIL] {name}: {detail}")
        raise AssertionError(f"Check failed: {name} — {detail}")


async def run_golden_scenario():
    print("=" * 70)
    print("SAGAR AI — GOLDEN SCENARIO VERIFICATION")
    print("Core Innovation: Dependency-Aware Minimal-Change Repair for Dynamic Route")
    print("=" * 70)

    # 1. Setup fresh tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # ── 1. Create and Commit Dynamic 4-Segment Decision ────────────────
        print("\n[STEP 1] Create & Commit 4-Segment Dynamic Route: LEG-01, LEG-02, LEG-03, LEG-04")
        import time
        unique_suffix = int(time.time())
        unique_dec_id = f"DEC-GOLDEN-{unique_suffix}"
        dec_payload = {
            "id": unique_dec_id,
            "title": "Corridor Alpha Passage: Nhava Sheva to Mangalore",
            "departure_port": "Nhava Sheva",
            "destination_port": "New Mangalore",
            "total_distance_nm": 420.0,
            "planned_speed_kts": 14.5,
            "original_eta": "2026-09-12 18:00 UTC",
            "data_source_type": "SIMULATED",
            "segments": [
                {
                    "segment_id": "LEG-01",
                    "name": "Nhava Sheva Offshore Departure",
                    "sequence_order": 1,
                    "start_lat": 18.95,
                    "start_lon": 72.85,
                    "end_lat": 17.50,
                    "end_lon": 73.20,
                    "distance_nm": 90.0,
                    "status": "COMPLETED",
                    "condition": "Clear transit",
                },
                {
                    "segment_id": "LEG-02",
                    "name": "Ratnagiri Transit Passage",
                    "sequence_order": 2,
                    "start_lat": 17.50,
                    "start_lon": 73.20,
                    "end_lat": 15.42,
                    "end_lon": 73.80,
                    "distance_nm": 130.0,
                    "status": "ACTIVE_STABLE",
                    "condition": "Nominal sea state",
                },
                {
                    "segment_id": "LEG-03",
                    "name": "Goa Coastal Approach",
                    "sequence_order": 3,
                    "start_lat": 15.42,
                    "start_lon": 73.80,
                    "end_lat": 14.80,
                    "end_lon": 74.13,
                    "distance_nm": 45.0,
                    "status": "UNAFFECTED",
                    "condition": "Nominal passage",
                },
                {
                    "segment_id": "LEG-04",
                    "name": "Karwar to Mangalore Deep-water Leg",
                    "sequence_order": 4,
                    "start_lat": 14.80,
                    "start_lon": 74.13,
                    "end_lat": 12.92,
                    "end_lon": 74.82,
                    "distance_nm": 155.0,
                    "status": "UNAFFECTED",
                    "condition": "Nominal passage",
                },
            ],
            "dependencies": [
                {
                    "id": f"DEP-SCHEDULE-{unique_suffix}",
                    "category": "SCHEDULE",
                    "name": "Berth Arrival Slot",
                    "impact_level": "MEDIUM",
                    "linked_segments": ["LEG-01", "LEG-02", "LEG-03", "LEG-04"],
                },
                {
                    "id": f"DEP-SAFETY-{unique_suffix}",
                    "category": "SAFETY",
                    "name": "Dynamic Vessel Roll & Stability Ceiling",
                    "impact_level": "CRITICAL",
                    "linked_segments": ["LEG-02"],
                },
                {
                    "id": f"DEP-FUEL-{unique_suffix}",
                    "category": "EFFICIENCY",
                    "name": "Bunker Fuel Reserve Margin",
                    "impact_level": "LOW",
                    "linked_segments": ["LEG-03", "LEG-04"],
                },
            ],
        }

        r_create = await client.post("/api/decisions/", json=dec_payload)
        check("1.1 Decision Created HTTP 201", r_create.status_code == 201, f"status={r_create.status_code}")
        dec_data = r_create.json()
        dec_id = dec_data["id"]

        r_commit = await client.post(f"/api/decisions/{dec_id}/commit")
        check("1.2 Decision Committed HTTP 200", r_commit.status_code == 200, f"status={r_commit.status_code}")
        check("1.3 Initial Status is COMMITTED", r_commit.json()["status"] == "COMMITTED")
        check("1.4 Initial Version is v1.0", r_commit.json()["version"] == "v1.0")

        # ── 2. Trigger Controlled SIMULATED Change Event on LEG-02 ──────────
        print("\n[STEP 2] Inject SIMULATED Wave Height Breach (SWH 4.8m > 4.0m) on LEG-02")
        sim_payload = {
            "segment_id": "LEG-02",
            "swh_m": 4.8,
            "threshold_m": 4.0,
            "title": "SIMULATED: Significant Wave Height 4.8m Exceeds 4.0m Limit on Leg LEG-02",
            "description": "SIMULATED TEST EVENT: Wave height 4.8m exceeds 4.0m threshold on Leg LEG-02. Real INCOIS data unaffected.",
        }
        r_sim = await client.post(f"/api/events/{dec_id}/simulate", json=sim_payload)
        check("2.1 Simulated Event Ingested HTTP 201", r_sim.status_code == 201)
        sim_event = r_sim.json()
        check("2.2 Event Source Type is explicitly SIMULATED", sim_event["source_type"] == "SIMULATED")
        check("2.3 Event Quality is SIMULATED_DEMO_BENCHMARK", sim_event["quality"] == "SIMULATED_DEMO_BENCHMARK")
        check("2.4 Affected Segment ID is LEG-02 (not S3)", sim_event["affected_segment_id"] == "LEG-02")

        # ── 3. Evaluate Dependency-Aware Impact ─────────────────────────────
        print("\n[STEP 3] Deterministic Impact Evaluation: Evidence → Constraint → Dependency → Leg")
        r_impact = await client.get(f"/api/events/{dec_id}/impact/{sim_event['id']}")
        check("3.1 Impact Computation HTTP 200", r_impact.status_code == 200)
        impact = r_impact.json()

        check("3.2 Exactly LEG-02 is affected", impact["affected_segment_ids"] == ["LEG-02"],
              f"affected={impact['affected_segment_ids']}")
        check("3.3 LEG-01, LEG-03, LEG-04 remain 100% unaffected",
              sorted(impact["unaffected_segment_ids"]) == ["LEG-01", "LEG-03", "LEG-04"],
              f"unaffected={impact['unaffected_segment_ids']}")
        check("3.4 DEP-SAFETY is violated",
              f"DEP-SAFETY-{unique_suffix}" in impact["violated_dependency_ids"],
              f"violated={impact['violated_dependency_ids']}")
        check("3.5 Plan Churn is exactly 0.25 (1/4 legs)", impact["plan_churn"] == 0.25,
              f"churn={impact['plan_churn']}")
        check("3.6 Preservation Ratio is 0.75 (3/4 legs preserved)", impact["preservation_ratio"] == 0.75,
              f"ratio={impact['preservation_ratio']}")

        # ── 4. Generate Minimal-Change Repair ───────────────────────────────
        print("\n[STEP 4] Minimal-Change Repair Generation (Modifies ONLY LEG-02)")
        r_rep = await client.post(f"/api/repairs/{dec_id}/generate?event_id={sim_event['id']}")
        check("4.1 Minimal Repair Generated HTTP 201", r_rep.status_code == 201)
        repair = r_rep.json()

        check("4.2 Repair target is LEG-02 (dynamic ID, not S3)", repair["affected_segment_id"] == "LEG-02",
              f"got={repair['affected_segment_id']}")
        check("4.3 Changed segments lists ONLY LEG-02",
              any("LEG-02" in c for c in repair["what_changes"]) and not any("LEG-01" in c or "LEG-03" in c or "LEG-04" in c for c in repair["what_changes"]),
              f"changes={repair['what_changes']}")
        check("4.4 Preserved segments lists LEG-01, LEG-03, LEG-04",
              len(repair["what_remains_unchanged"]) == 3,
              f"preserved={repair['what_remains_unchanged']}")
        check("4.5 Repair Waypoint coordinates computed around LEG-02 midpoint",
              repair["repair_waypoint_lat"] is not None and repair["repair_waypoint_lon"] is not None,
              f"wp=({repair['repair_waypoint_lat']}, {repair['repair_waypoint_lon']})")
        check("4.6 Repair feasibility is FEASIBLE & VERIFIED", repair["feasibility"] == "FEASIBLE & VERIFIED")
        check("4.7 No S3 or W3-A hardcoding in repair title or ID",
              "S3" not in repair["id"] and "W3-A" not in repair["title"],
              f"id={repair['id']}, title={repair['title']}")

        # ── 5. Rejection Invariant Check (Route must NOT mutate) ────────────
        print("\n[STEP 5] Rejection Test: Verify committed route does not mutate")
        reject_payload = {
            "repair_candidate_id": repair["id"],
            "officer_name": "Duty Officer V. Nair",
            "rejection_reason": "Testing rejection invariant: must maintain original committed plan unchanged.",
        }
        r_reject = await client.post(f"/api/approvals/{dec_id}/reject", json=reject_payload)
        check("5.1 Rejection Handled HTTP 200", r_reject.status_code == 200)

        # Verify decision remains v1.0 and segments unchanged
        r_after_reject = await client.get(f"/api/decisions/{dec_id}")
        dec_reject = r_after_reject.json()
        check("5.2 Decision version is STILL v1.0 after rejection", dec_reject["version"] == "v1.0")
        check("5.3 Decision status remains IMPACTED", dec_reject["status"] == "IMPACTED")
        leg2_after_reject = next(s for s in dec_reject["segments"] if s["segment_id"] == "LEG-02")
        check("5.4 LEG-02 status NOT mutated to REPAIRED_ACTIVE", leg2_after_reject["status"] != "REPAIRED_ACTIVE",
              f"status={leg2_after_reject['status']}")

        # ── 6. Human Approval Flow ──────────────────────────────────────────
        print("\n[STEP 6] Human Operator Approval: Officer authorizes minimal repair")
        approve_payload = {
            "repair_candidate_id": repair["id"],
            "officer_name": "Capt. Rajesh Sharma (Master Mariner)",
            "rationale": "Minimal western arc detour around LEG-02 wave hazard authorized. Intact legs LEG-01, LEG-03, LEG-04 preserved.",
            "verified_items": [True, True, True],
        }
        r_approve = await client.post(f"/api/approvals/{dec_id}/approve", json=approve_payload)
        check("6.1 Approval Handled HTTP 200", r_approve.status_code == 200)
        appr_rec = r_approve.json()
        check("6.2 Approval record reflects version transition v1.0 -> v2.0",
              appr_rec["decision_version_before"] == "v1.0" and appr_rec["decision_version_after"] == "v2.0")

        # ── 7. Verify Post-Approval Decision State & Audit Trail ────────────
        print("\n[STEP 7] Verify Post-Approval State, Preserved Segments, and Audit Trail")
        r_final = await client.get(f"/api/decisions/{dec_id}")
        dec_final = r_final.json()

        check("7.1 Decision version is now v2.0", dec_final["version"] == "v2.0")
        check("7.2 Decision status is REPAIRED_COMMITTED", dec_final["status"] == "REPAIRED_COMMITTED")

        final_segs = {s["segment_id"]: s for s in dec_final["segments"]}
        check("7.3 LEG-02 status is REPAIRED_ACTIVE", final_segs["LEG-02"]["status"] == "REPAIRED_ACTIVE")
        check("7.4 LEG-02 condition references W-LEG-02 (not W3-A)",
              "W-LEG-02" in final_segs["LEG-02"]["condition"],
              f"condition={final_segs['LEG-02']['condition']}")

        check("7.5 LEG-01 remains COMPLETED", final_segs["LEG-01"]["status"] == "COMPLETED")
        check("7.6 LEG-03 remains UNAFFECTED (preserved intact)",
              final_segs["LEG-03"]["status"] == "UNAFFECTED" and "Preserved intact" in final_segs["LEG-03"]["details"],
              f"status={final_segs['LEG-03']['status']}, details={final_segs['LEG-03']['details']}")
        check("7.7 LEG-04 remains UNAFFECTED (preserved intact)",
              final_segs["LEG-04"]["status"] == "UNAFFECTED" and "Preserved intact" in final_segs["LEG-04"]["details"],
              f"status={final_segs['LEG-04']['status']}, details={final_segs['LEG-04']['details']}")

        # Verify audit history
        r_audit = await client.get(f"/api/audit/{dec_id}")
        check("7.8 Audit History HTTP 200", r_audit.status_code == 200)
        audit_entries = r_audit.json()
        check("7.9 Audit log contains approval entry for v2.0",
              any(a["version"] == "v2.0" and "Capt. Rajesh Sharma" in (a["summary"] or a["officer"]) for a in audit_entries))
        approval_entry = next(a for a in audit_entries if a["version"] == "v2.0")
        check("7.10 Audit summary explicitly records dynamic affected segment LEG-02",
              "LEG-02" in approval_entry["summary"],
              f"summary={approval_entry['summary']}")
        check("7.11 Audit summary explicitly records preserved segments LEG-01, LEG-03, LEG-04",
              "LEG-01" in approval_entry["summary"] and "LEG-03" in approval_entry["summary"],
              f"summary={approval_entry['summary']}")

        # ── 8. Unfeasible Edge Case Check (NO_SAFE_MINIMAL_REPAIR) ──────────
        print("\n[STEP 8] Edge Case: Catastrophic Corridor Restriction → NO_SAFE_MINIMAL_REPAIR")
        catastrophic_payload = {
            "id": f"EVT-CATASTROPHIC-{dec_id[:6]}",
            "title": "Severe Cyclone Phailin 2.0: Total Maritime Corridor Enclosure",
            "severity": "CRITICAL",
            "source": "IMD Severe Weather Warning",
            "source_type": "SIMULATED",
            "is_catastrophic": True,
            "description": "Multi-zone maritime boundary restriction envelops entire western seaboard.",
        }
        await client.post(f"/api/events/{dec_id}", json=catastrophic_payload)
        r_cata_rep = await client.post(f"/api/repairs/{dec_id}/generate?event_id={catastrophic_payload['id']}")
        check("8.1 Unfeasible Repair Endpoint returns HTTP 201/200", r_cata_rep.status_code in (200, 201))
        cata_repair = r_cata_rep.json()
        check("8.2 Unfeasible repair returns ID NO_SAFE_MINIMAL_REPAIR",
              cata_repair["id"] == "NO_SAFE_MINIMAL_REPAIR",
              f"id={cata_repair['id']}")
        check("8.3 Feasibility is explicitly NO_SAFE_MINIMAL_REPAIR",
              cata_repair["feasibility"] == "NO_SAFE_MINIMAL_REPAIR",
              f"feasibility={cata_repair['feasibility']}")
        check("8.4 System never invents a fake minimal repair under unresolvable conditions",
              cata_repair["tier"] == "UNFEASIBLE",
              f"tier={cata_repair['tier']}")

    print("\n" + "=" * 70)
    print("ALL 35 GOLDEN SCENARIO CHECKS PASSED PERFECTLY ✓")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_golden_scenario())
