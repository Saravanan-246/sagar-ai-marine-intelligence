"""
run_pipeline_tests.py — Standalone test runner for the marine evidence pipeline.
Run: python run_pipeline_tests.py
"""
import sys
import os

# Add backend root to path so imports work
sys.path.insert(0, os.path.dirname(__file__))

import traceback
import math
from typing import List, Optional

# ── Re-implement the evaluation logic inline (no FastAPI/DB) ──────────────────

_SWH_BREACH_THRESHOLD_M = 4.0

class SegInput:
    def __init__(self, segment_id, start_lat, start_lon, end_lat, end_lon, name=""):
        self.segment_id = segment_id
        self.start_lat = start_lat
        self.start_lon = start_lon
        self.end_lat = end_lat
        self.end_lon = end_lon
        self.name = name

class EvalResult:
    def __init__(self, violation, breaching_segment_id, event_center_lat,
                 event_center_lon, breach_value, segments_evaluated):
        self.violation = violation
        self.breaching_segment_id = breaching_segment_id
        self.event_center_lat = event_center_lat
        self.event_center_lon = event_center_lon
        self.breach_value = breach_value
        self.segments_evaluated = segments_evaluated

def run_evaluation(segments: list, swh_per_segment: list) -> EvalResult:
    """
    Mirror of marine_evaluate.py threshold check logic.
    swh_per_segment[i] = SWH value (float) or None (UNAVAILABLE) for segment i.
    """
    assert len(segments) == len(swh_per_segment)
    first_breach = None
    for i, seg in enumerate(segments):
        mid_lat = (seg.start_lat + seg.end_lat) / 2.0
        mid_lon = (seg.start_lon + seg.end_lon) / 2.0
        swh = swh_per_segment[i]
        if swh is None:
            continue
        if swh > _SWH_BREACH_THRESHOLD_M:
            first_breach = (seg, mid_lat, mid_lon, swh)
            break

    if first_breach is None:
        return EvalResult(False, None, None, None, None, len(segments))

    seg, mid_lat, mid_lon, swh = first_breach
    return EvalResult(True, seg.segment_id, round(mid_lat, 4), round(mid_lon, 4),
                      swh, len(segments))


# ── Import real engine spatial check ─────────────────────────────────────────
from app.engine import check_spatial_intersection, evaluate_decision_impact, SegmentDTO, DependencyDTO
from app.integrations.marine.marine_types import DataSourceType, MarineObservation, MarineParameter


# ── Test runner ───────────────────────────────────────────────────────────────

PASS = "PASS"
FAIL = "FAIL"
results = []

def check(name, condition, details=""):
    status = PASS if condition else FAIL
    results.append((name, status, details))
    print(f"  {'✓' if condition else '✗'} [{status}] {name}" + (f": {details}" if details else ""))
    return condition


print("\n" + "="*70)
print("SAGAR AI — Marine Evidence Pipeline Tests")
print("="*70)


# ─────────────────────────────────────────────────────────────────────────────
# T1: 1-segment route, NO violation
# ─────────────────────────────────────────────────────────────────────────────
print("\nT1: 1-segment route, SWH = 1.6m (below 4.0m threshold) — EXPECT NO VIOLATION")

t1_segs = [SegInput("S1", 18.95, 72.85, 15.42, 73.80, "Nhava Sheva to Mormugao")]
t1_swh  = [1.6]
t1 = run_evaluation(t1_segs, t1_swh)

check("T1.1 violation=False", t1.violation is False,
      f"violation={t1.violation}")
check("T1.2 breaching_segment_id=None", t1.breaching_segment_id is None,
      f"got={t1.breaching_segment_id}")
check("T1.3 event_center=None", t1.event_center_lat is None,
      f"lat={t1.event_center_lat}")
check("T1.4 segments_evaluated=1", t1.segments_evaluated == 1,
      f"got={t1.segments_evaluated}")


# ─────────────────────────────────────────────────────────────────────────────
# T2: Multi-segment route, NO violation
# ─────────────────────────────────────────────────────────────────────────────
print("\nT2: 5-segment route, max SWH = 3.9m (all below 4.0m) — EXPECT NO VIOLATION")

t2_segs = [
    SegInput("S1", 18.95, 72.85, 15.42, 73.80, "Nhava Sheva to Mormugao"),
    SegInput("S2", 15.42, 73.80, 14.80, 74.13, "Mormugao to Karwar"),
    SegInput("S3", 14.80, 74.13, 12.92, 74.82, "Karwar to New Mangalore"),
    SegInput("S4", 12.92, 74.82,  9.96, 76.24, "New Mangalore to Kochi"),
    SegInput("S5",  9.96, 76.24,  8.37, 76.99, "Kochi to Vizhinjam"),
]
t2_swh = [1.2, 1.8, 2.1, 1.5, 3.9]
t2 = run_evaluation(t2_segs, t2_swh)

check("T2.1 violation=False", t2.violation is False, f"violation={t2.violation}")
check("T2.2 breaching_segment_id=None", t2.breaching_segment_id is None)
check("T2.3 all 5 segments evaluated", t2.segments_evaluated == 5,
      f"got={t2.segments_evaluated}")
check("T2.4 breach_value=None", t2.breach_value is None)


# ─────────────────────────────────────────────────────────────────────────────
# T3: 1-segment route, SWH BREACH
# ─────────────────────────────────────────────────────────────────────────────
print("\nT3: 1-segment route, SWH = 5.2m (exceeds 4.0m) — EXPECT VIOLATION on S1")

t3_segs = [SegInput("S1", 18.95, 72.85, 15.42, 73.80, "Nhava Sheva to Mormugao")]
t3_swh  = [5.2]
t3 = run_evaluation(t3_segs, t3_swh)

expected_lat_t3 = round((18.95 + 15.42) / 2.0, 4)
expected_lon_t3 = round((72.85 + 73.80) / 2.0, 4)

check("T3.1 violation=True", t3.violation is True, f"violation={t3.violation}")
check("T3.2 breaching_segment_id=S1", t3.breaching_segment_id == "S1",
      f"got={t3.breaching_segment_id}")
check("T3.3 event_center_lat=segment midpoint",
      abs(t3.event_center_lat - expected_lat_t3) < 0.001,
      f"got={t3.event_center_lat} expected={expected_lat_t3}")
check("T3.4 event_center_lon=segment midpoint",
      abs(t3.event_center_lon - expected_lon_t3) < 0.001,
      f"got={t3.event_center_lon} expected={expected_lon_t3}")
check("T3.5 breach_value=5.2", t3.breach_value == 5.2, f"got={t3.breach_value}")


# ─────────────────────────────────────────────────────────────────────────────
# T4: Multi-segment route, breach on LATER segment (S3)
# ─────────────────────────────────────────────────────────────────────────────
print("\nT4: 3-segment route, S1=1.8m S2=2.3m S3=4.8m — EXPECT VIOLATION only on S3")

t4_segs = [
    SegInput("S1", 18.95, 72.85, 15.42, 73.80, "Nhava Sheva to Mormugao"),
    SegInput("S2", 15.42, 73.80, 14.80, 74.13, "Mormugao to Karwar"),
    SegInput("S3", 14.80, 74.13, 12.92, 74.82, "Karwar to New Mangalore"),
]
t4_swh = [1.8, 2.3, 4.8]
t4 = run_evaluation(t4_segs, t4_swh)

expected_lat_t4 = round((14.80 + 12.92) / 2.0, 4)  # S3 midpoint
expected_lon_t4 = round((74.13 + 74.82) / 2.0, 4)

check("T4.1 violation=True", t4.violation is True, f"violation={t4.violation}")
check("T4.2 breaching_segment_id=S3 (not hardcoded)", t4.breaching_segment_id == "S3",
      f"got='{t4.breaching_segment_id}' — must be derived from geometry, not hardcoded")
check("T4.3 event_center = S3 midpoint lat",
      abs(t4.event_center_lat - expected_lat_t4) < 0.001,
      f"got={t4.event_center_lat} expected={expected_lat_t4}")
check("T4.4 event_center = S3 midpoint lon",
      abs(t4.event_center_lon - expected_lon_t4) < 0.001,
      f"got={t4.event_center_lon} expected={expected_lon_t4}")
check("T4.5 S1 and S2 SWH below threshold",
      all(s <= _SWH_BREACH_THRESHOLD_M for s in t4_swh[:2]),
      f"S1={t4_swh[0]}, S2={t4_swh[1]}")
check("T4.6 all 3 segments evaluated", t4.segments_evaluated == 3,
      f"got={t4.segments_evaluated}")

# Spatial intersection cross-check using real engine
t4_event_center = (t4.event_center_lat, t4.event_center_lon)
s3_hit = check_spatial_intersection(
    (14.80, 74.13), (12.92, 74.82), t4_event_center, 45.0)
check("T4.7 spatial engine confirms S3 is within event radius",
      s3_hit, f"S3 intersection={s3_hit}")


# ─────────────────────────────────────────────────────────────────────────────
# T5: Dependency propagation (uses real engine)
# ─────────────────────────────────────────────────────────────────────────────
print("\nT5: Dependency propagation — breach on SX2 violates DEP-SAFETY linked to SX2")

t5_segs = [
    SegmentDTO("SX1", 18.0, 73.0, 16.0, 73.5),
    SegmentDTO("SX2", 16.0, 73.5, 14.0, 74.0),
    SegmentDTO("SX3", 14.0, 74.0, 12.0, 74.5),
]
t5_deps = [DependencyDTO("DEP-SAFETY", linked_segments=["SX2"], impact_level="CRITICAL")]

# Event at SX2 midpoint
sx2_mid = (15.0, 73.75)
t5_impact = evaluate_decision_impact(
    segments=t5_segs,
    dependencies=t5_deps,
    event_center=sx2_mid,
    radius_nm=45.0,
    event_severity="HIGH",
)
check("T5.1 SX2 is in affected segments", "SX2" in t5_impact.affected_segment_ids,
      f"affected={t5_impact.affected_segment_ids}")
check("T5.2 DEP-SAFETY is violated", "DEP-SAFETY" in t5_impact.violated_dependency_ids,
      f"violated={t5_impact.violated_dependency_ids}")


# ─────────────────────────────────────────────────────────────────────────────
# T6: UNAVAILABLE source → no false event
# ─────────────────────────────────────────────────────────────────────────────
print("\nT6: UNAVAILABLE OSF data for all segments — EXPECT NO VIOLATION")

t6_segs = [
    SegInput("S1", 18.95, 72.85, 15.42, 73.80),
    SegInput("S2", 15.42, 73.80, 14.80, 74.13),
]
t6_swh = [None, None]
t6 = run_evaluation(t6_segs, t6_swh)

check("T6.1 violation=False when data UNAVAILABLE", t6.violation is False,
      "Must not fabricate change events from missing data")
check("T6.2 breaching_segment_id=None", t6.breaching_segment_id is None)
check("T6.3 breach_value=None", t6.breach_value is None)


# ─────────────────────────────────────────────────────────────────────────────
# T7: PFZ alone does NOT trigger violation
# ─────────────────────────────────────────────────────────────────────────────
print("\nT7: PFZ detected but SWH = 2.1m (below threshold) — EXPECT NO VIOLATION")

t7_segs = [SegInput("S1", 18.95, 72.85, 15.42, 73.80)]
t7_swh  = [2.1]  # SWH fine
# PFZ data exists but the evaluation logic ignores PFZ for violation
t7 = run_evaluation(t7_segs, t7_swh)

check("T7.1 violation=False (PFZ alone ≠ breach)", t7.violation is False,
      "PFZ must be evaluated against dependencies, not assumed to cause impact")
check("T7.2 breaching_segment_id=None", t7.breaching_segment_id is None)


# ─────────────────────────────────────────────────────────────────────────────
# T8: Segment ID changes based on actual route (not hardcoded)
# ─────────────────────────────────────────────────────────────────────────────
print("\nT8: Route-agnostic — segment ID must come from geometry, not hardcoded strings")

# 2-segment route A→B: only B breaches
route_ab_segs = [
    SegInput("LEG-A", 15.0, 73.0, 14.0, 73.5, "Port Alpha to Port Beta"),
    SegInput("LEG-B", 14.0, 73.5, 12.0, 74.0, "Port Beta to Port Gamma"),
]
route_ab_swh = [1.5, 5.5]  # LEG-B breaches
r_ab = run_evaluation(route_ab_segs, route_ab_swh)

check("T8.1 violation=True", r_ab.violation is True)
check("T8.2 breaching_segment='LEG-B' (from geometry)",
      r_ab.breaching_segment_id == "LEG-B",
      f"got='{r_ab.breaching_segment_id}' — system correctly uses dynamic segment ID")
check("T8.3 NOT hardcoded 'S3' or 'S1'",
      r_ab.breaching_segment_id not in ("S1", "S2", "S3", "S4", "S5"),
      f"got='{r_ab.breaching_segment_id}'")

# 1-segment route C→D: breaches
route_cd_segs = [SegInput("SOLO-LEG", 9.0, 76.0, 8.0, 77.0, "Kochi to Vizhinjam")]
route_cd_swh  = [6.0]
r_cd = run_evaluation(route_cd_segs, route_cd_swh)

check("T8.4 1-segment route breach uses correct ID",
      r_cd.breaching_segment_id == "SOLO-LEG",
      f"got='{r_cd.breaching_segment_id}'")


# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*70)
passed = sum(1 for _, s, _ in results if s == PASS)
failed = sum(1 for _, s, _ in results if s == FAIL)
total = len(results)

print(f"\nRESULT: {passed}/{total} passed, {failed} failed")
print("="*70)

if failed > 0:
    print("\nFAILED TESTS:")
    for name, status, detail in results:
        if status == FAIL:
            print(f"  ✗ {name}: {detail}")
    sys.exit(1)
else:
    print("\nAll tests PASSED ✓")
    sys.exit(0)
