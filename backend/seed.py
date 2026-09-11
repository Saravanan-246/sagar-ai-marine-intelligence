"""
Sagar AI — Database Seed Script
Populates the SQLite database with the same canonical demo data used by
the frontend Zustand store, so the backend API returns consistent results
out-of-the-box for hackathon evaluation.

Run once:  python seed.py
"""

import asyncio
import sys
from pathlib import Path

# Ensure backend root is on the path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import init_db, SessionLocal
from app.models import (
    Decision, RouteSegment, Dependency, ChangeEvent,
    RepairCandidate, AuditEntry,
)


DECISION_ID = "DEC-2026-084"
EVENT_ID    = "EVT-SIM-2026-0914"


async def seed():
    await init_db()

    async with SessionLocal() as db:
        # ── Guard: skip if already seeded ──────────────────────────────
        existing = await db.get(Decision, DECISION_ID)
        if existing:
            print(f"Decision {DECISION_ID} already exists — skipping seed.")
            return

        # ── Decision ───────────────────────────────────────────────────
        decision = Decision(
            id=DECISION_ID,
            title="Coastal Survey Operation 01",
            objective="Hydrographic & Environmental Survey along Western Seaboard Corridor",
            status="IMPACTED",
            version="v1.0",
            officer="Decision Owner (Operations Desk)",
            departure_port="Base Station (Nhava Sector)",
            destination_port="Terminus Station (Southern Basin)",
            total_distance_nm=890.0,
            planned_speed_kts=18.5,
            original_eta="2026-09-14 06:00 UTC",
            current_segment="S2",
            schedule="Transit 48h (Committed ETA: Sept 14, 06:00 UTC)",
            data_source_type="SIMULATED",
            data_quality="HIGH_FIDELITY_SIMULATED_BENCHMARK",
        )
        decision.assumptions = [
            "Monsoon swell envelope within standard ±1.5m margin",
            "Terminus berth slot reserved for 06:00 UTC arrival",
            "Continuous radar and sensor telemetry available",
        ]
        db.add(decision)

        # ── Route Segments ─────────────────────────────────────────────
        segments = [
            RouteSegment(
                segment_id="S1", decision_id=DECISION_ID, order_index=0,
                name="Operational Base Fairway to North TSS Sector",
                distance_nm=65, status="COMPLETED",
                condition="Nominal [SIMULATED]", wave_height_m=1.4, wind_kts=14,
                details="Completed on schedule at 18:20 UTC. Pilot discharged successfully.",
                start_lat=18.95, start_lon=72.85, end_lat=18.25, end_lon=72.50,
            ),
            RouteSegment(
                segment_id="S2", decision_id=DECISION_ID, order_index=1,
                name="North TSS Sector to Central Checkpoint",
                distance_nm=155, status="ACTIVE_STABLE",
                condition="Nominal [SIMULATED]", wave_height_m=1.8, wind_kts=18,
                details="Currently active leg. Traversal maintained within planned speed parameters.",
                start_lat=18.25, start_lon=72.50, end_lat=16.98, end_lon=73.15,
            ),
            RouteSegment(
                segment_id="S3", decision_id=DECISION_ID, order_index=2,
                name="Central Checkpoint to Karwar Transition Corridor",
                distance_nm=195, status="AFFECTED",
                condition="Simulated Restricted Zone Intersected",
                wave_height_m=5.4, wind_kts=48,
                details="Simulated restricted-zone expansion directly intersects charted corridor between NM 220 and NM 310.",
                start_lat=16.98, start_lon=73.15, end_lat=13.20, end_lon=74.35,
                repair_waypoint_lat=14.30, repair_waypoint_lon=72.50,
            ),
            RouteSegment(
                segment_id="S4", decision_id=DECISION_ID, order_index=3,
                name="Karwar Transition to South Approach Sector",
                distance_nm=180, status="UNAFFECTED",
                condition="Nominal [SIMULATED]", wave_height_m=2.1, wind_kts=16,
                details="Future planned leg. Hydrographic envelope is nominal and unaffected.",
                start_lat=13.20, start_lon=74.35, end_lat=9.95, end_lon=75.80,
            ),
            RouteSegment(
                segment_id="S5", decision_id=DECISION_ID, order_index=4,
                name="South Approach to Terminus Station & Berth",
                distance_nm=295, status="UNAFFECTED",
                condition="Nominal [SIMULATED]", wave_height_m=1.9, wind_kts=15,
                details="Approach leg into Terminus Station. Scheduled arrival window committed.",
                start_lat=9.95, start_lon=75.80, end_lat=6.95, end_lon=79.85,
            ),
        ]
        for s in segments:
            db.add(s)

        # ── Dependencies ───────────────────────────────────────────────
        deps_raw = [
            dict(
                id="DEP-01", dep_type="SCHEDULE_PORT_WINDOW",
                name="Terminus Berth Window Slot",
                commitment="Sept 14, 06:00 UTC (Window tolerance ±2.0 hours)",
                source="Simulated Port Operations Schedule",
                condition="Arrival timestamp within [04:00, 08:00 UTC]",
                linked_segments=["S5"], impact_level="CRITICAL", status="AT_RISK",
                description="Guaranteed survey berth and crane allocation. Exceeding window by >2.0h disrupts downstream schedule.",
                mitigation_under_repair="Preserved: Candidate R1 arrives at 06:38 UTC (+38 mins, within allowable ±2h window).",
            ),
            dict(
                id="DEP-02", dep_type="SAFETY_DYNAMIC_STABILITY",
                name="Survey Sensor Array & Deck Stability Constraint",
                commitment="Dynamic vessel roll angle strictly ≤ 12.0°",
                source="Simulated Vessel Operations Manual",
                condition="Roll < 12.0° across all traversal legs",
                linked_segments=["S3"], impact_level="CRITICAL", status="VIOLATED",
                description="Acoustic calibration array on deck. Beam seas in hazard zone induce roll exceeding 16.5°, triggering measurement lock.",
                mitigation_under_repair="Preserved: Candidate R1 steers quartering seas, capping roll at 5.8°.",
            ),
            dict(
                id="DEP-03", dep_type="RESOURCE_FUEL_BUDGET",
                name="Voyage Fuel & Endurance Reserve",
                commitment="Planned consumption with max allowable reserve burn variance ≤ +5.0 MT",
                source="Simulated Charterparty Consumption Curve",
                condition="Fuel variance ≤ +5.0 MT",
                linked_segments=["S2", "S3", "S4"], impact_level="MEDIUM", status="AT_RISK",
                description="Navigating directly through gale core increases head-resistance burn by +12.4 MT.",
                mitigation_under_repair="Optimized: Candidate R1 adds +12 NM (+1.8 MT variance), well within reserve threshold.",
            ),
            dict(
                id="DEP-04", dep_type="NAVIGATIONAL_PILOTAGE",
                name="Terminus Fairway Pilot rendezvous",
                commitment="Pilot boarding at 05:30 UTC",
                source="Simulated Harbour Master Coordination Protocol",
                condition="Notice dispatched ≥ 6h prior to arrival",
                linked_segments=["S5"], impact_level="HIGH", status="VALID",
                description="Mandatory pilot team rendezvous window at Terminus Fairway Buoy.",
                mitigation_under_repair="Preserved: Pre-flight advisory dispatches revised 06:38 UTC ETA notice.",
            ),
        ]
        for d in deps_raw:
            dep = Dependency(
                id=d["id"], decision_id=DECISION_ID,
                dep_type=d["dep_type"], name=d["name"],
                commitment=d["commitment"], source=d["source"],
                condition=d["condition"], impact_level=d["impact_level"],
                status=d["status"], description=d["description"],
                mitigation_under_repair=d["mitigation_under_repair"],
            )
            dep.linked_segments = d["linked_segments"]
            db.add(dep)

        # ── Change Event ───────────────────────────────────────────────
        event = ChangeEvent(
            id=EVENT_ID, decision_id=DECISION_ID,
            event_type="ROUTE_RESTRICTION_EXPANSION",
            title="Simulated Restricted Hazard Expansion & Wave Breach",
            severity="HIGH", source="Simulated Environmental Threat Model",
            source_type="SIMULATED", observed_at="2026-09-13 07:45 UTC",
            location="14°35'N, 73°25'E (Goa-Karwar Offshore Corridor)",
            event_lat=14.58, event_lon=73.41, radius_nm=45.0,
            affected_segment_id="S3",
            description=(
                "Simulated localized hazard envelope expands across charted corridor "
                "between NM 220 and NM 310 with wave heights exceeding 5.2m. "
                "Crosses committed Segment S3."
            ),
            quality="SIMULATED_TESTBENCH",
            source_record_id="SYNTHETIC-DATA-FEED-01",
            is_catastrophic=False,
        )
        db.add(event)

        # ── Repair Candidates ──────────────────────────────────────────
        candidates_raw = [
            dict(
                id="R1", tier="RECOMMENDED",
                title="Minimal Repair: Segment S3 Western Arc Detour (WP W3-A)",
                description=(
                    "Preserves 100% of Segments S1, S2, S4, and S5. Replaces only Segment S3 "
                    "by routing 34 NM westward around the hazard envelope via Waypoint W3-A "
                    "(14°18'N, 72°30'E)."
                ),
                plan_churn=0.20, preservation_ratio=0.80,
                what_changes=[
                    "Segment S3 replaced with 2 sub-legs via Waypoint W3-A (14°18'N, 72°30'E)",
                    "Transit distance increased by +12.0 NM (total 902 NM)",
                    "Arrival time delayed by +38 minutes (Revised ETA: Sept 14, 06:38 UTC)",
                    "Fuel consumption increased by +1.8 MT (within allowable +5.0 MT reserve)",
                ],
                what_remains_unchanged=[
                    "Segment S1 (Base Departure) and S2 (Active Traversal) untouched",
                    "Segment S4 (South Sector) and S5 (Terminus Approach) untouched",
                    "Terminus Berth Window PRESERVED (06:38 UTC is well within ±2h allowance)",
                    "Sensor roll limit respected (max roll 5.8° vs 12.0° cap)",
                ],
                tradeoffs="Accepts minor +1.8 MT fuel variance and 38-minute transit delay to completely avoid hazard area.",
                feasibility="FEASIBLE & VERIFIED", score=94,
                recommendation_reason=(
                    "Satisfies minimal change invariant: Preserves 80% of segments, "
                    "protects scheduled port window, and solves all breached constraints."
                ),
                linked_event_id=EVENT_ID,
            ),
            dict(
                id="R2", tier="ALTERNATIVE",
                title="Speed Reduction & Holding Pattern at Terminus of S2",
                description=(
                    "Maintains the original geometric track but orders a 7.5-hour "
                    "slow-steaming holding pattern near S2 terminus to allow the hazard "
                    "area to dissipate before resuming S3."
                ),
                plan_churn=0.40, preservation_ratio=0.60,
                what_changes=[
                    "Speed reduced to 5.2 kts for 7.5 hours near Central Checkpoint",
                    "Arrival time delayed by +8 hours 40 minutes (ETA: Sept 14, 14:40 UTC)",
                    "Violates Terminus Berth Slot window (misses 06:00 ± 2h window)",
                    "Triggers berth renegotiation and risk of 24h anchorage delay",
                ],
                what_remains_unchanged=[
                    "Route coordinates remain identical to original v1.0 plan",
                    "No extra navigational distance added (distance remains 890 NM)",
                    "Zero deviation from charted waypoints",
                ],
                tradeoffs="Avoids coordinate change at the severe cost of breaking the port berth window commitment.",
                feasibility="FEASIBLE BUT OPERATIONALLY COMPROMISING", score=62,
                recommendation_reason="Avoids spatial track change, but causes cascading logistical delays at terminus.",
                linked_event_id=EVENT_ID,
            ),
            dict(
                id="R3", tier="HIGHER_DISRUPTION",
                title="Inshore Coastal Diversion via Shallow Waters (S3-C)",
                description=(
                    "Diverts vessel eastward hugging the shallow coastal corridor "
                    "inside depths 35-50m to find shelter in lee of the coastline."
                ),
                plan_churn=0.60, preservation_ratio=0.40,
                what_changes=[
                    "Completely alters S2, S3, and S4 into congested inshore lanes",
                    "Enters dense mechanized fishing zones (elevated collision hazard)",
                    "Shallow water squat risk for deep-draft vessel in 38m soundings",
                    "Adds +39 NM distance and +7.4 MT fuel consumption",
                ],
                what_remains_unchanged=[
                    "Avoids deep-sea storm wave crests",
                    "Only final segment S5 remains unchanged",
                ],
                tradeoffs="Trades wave stress for extreme navigational traffic density, shallow water grounding risk, and extensive track disruption across 3 legs.",
                feasibility="NOT RECOMMENDED (Safety Hazard)", score=38,
                recommendation_reason="Violates minimal repair principle by disrupting 3 segments when only S3 was affected.",
                linked_event_id=EVENT_ID,
            ),
        ]
        for c in candidates_raw:
            cand = RepairCandidate(
                id=c["id"], decision_id=DECISION_ID,
                tier=c["tier"], title=c["title"], description=c["description"],
                plan_churn=c["plan_churn"], preservation_ratio=c["preservation_ratio"],
                tradeoffs=c["tradeoffs"], feasibility=c["feasibility"],
                score=c["score"], recommendation_reason=c["recommendation_reason"],
                linked_event_id=c.get("linked_event_id"),
            )
            cand.what_changes = c["what_changes"]
            cand.what_remains_unchanged = c["what_remains_unchanged"]
            db.add(cand)

        # ── Audit History ──────────────────────────────────────────────
        audit_entries = [
            AuditEntry(
                decision_id=DECISION_ID, version="v1.0", status="COMMITTED",
                event="Original Plan Committed",
                summary="Coastal Survey Operation 01 approved and locked. 5 nominal segments, 890 NM, ETA 2026-09-14 06:00 UTC.",
                officer="Decision Owner",
            ),
            AuditEntry(
                decision_id=DECISION_ID, version="v1.0-IMPACTED", status="CHANGE_DETECTED",
                event="Event EVT-SIM-2026-0914 Detected",
                summary="Simulated restricted hazard expansion intersected Segment S3. Flagged for human review.",
                officer="Sagar AI Continuity Engine",
            ),
        ]
        for entry in audit_entries:
            db.add(entry)

        await db.commit()
        print(f"✓ Seed complete. Decision {DECISION_ID} inserted with 5 segments, 4 dependencies, 1 event, 3 repair candidates.")


if __name__ == "__main__":
    asyncio.run(seed())
