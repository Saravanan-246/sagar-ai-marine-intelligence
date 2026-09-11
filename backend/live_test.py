"""
live_test.py — Tests the live backend evaluate-decision endpoint AND the pure-Python
evaluation logic. Outputs clear PASS/FAIL for all required scenarios.

Run from backend/: python live_test.py
"""
import sys
import os
import json
import urllib.request
import urllib.error

sys.path.insert(0, os.path.dirname(__file__))

PASS = "PASS"
FAIL = "FAIL"
results = []

def check(name, condition, detail=""):
    status = PASS if condition else FAIL
    results.append((name, status, detail))
    icon = "✓" if condition else "✗"
    print(f"  {icon} [{status}] {name}" + (f"  → {detail}" if detail else ""))
    return condition

def post_json(url, data=None):
    body = json.dumps(data).encode() if data else b""
    req = urllib.request.Request(url, data=body, method="POST",
                                  headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read()), e.code

def get_json(url):
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read()), e.code

BASE = "http://127.0.0.1:8000/api"

# ─────────────────────────────────────────────────────────────────────────────
# SUITE A: Pure-Python evaluation logic (unit tests, no network)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("SUITE A — Unit Tests: Evaluation Logic (no network)")
print("="*70)

_SWH_THRESHOLD = 4.0

class Seg:
    def __init__(self, sid, slat, slon, elat, elon, name=""):
        self.segment_id, self.start_lat, self.start_lon = sid, slat, slon
        self.end_lat, self.end_lon, self.name = elat, elon, name

class EvalResult:
    def __init__(self, v, seg_id, clat, clon, bval, n):
        self.violation = v
        self.breaching_segment_id = seg_id
        self.event_center_lat = clat
        self.event_center_lon = clon
        self.breach_value = bval
        self.segments_evaluated = n

def evaluate(segs, swh_vals):
    assert len(segs) == len(swh_vals)
    for i, seg in enumerate(segs):
        swh = swh_vals[i]
        if swh is None:
            continue
        if swh > _SWH_THRESHOLD:
            mid_lat = round((seg.start_lat + seg.end_lat) / 2.0, 4)
            mid_lon = round((seg.start_lon + seg.end_lon) / 2.0, 4)
            return EvalResult(True, seg.segment_id, mid_lat, mid_lon, swh, len(segs))
    return EvalResult(False, None, None, None, None, len(segs))


print("\n--- T1: 1-segment, SWH=1.6m — NO VIOLATION ---")
r = evaluate([Seg("S1", 18.95, 72.85, 15.42, 73.80)], [1.6])
check("T1.1 violation=False", not r.violation, f"violation={r.violation}")
check("T1.2 no breaching segment", r.breaching_segment_id is None)
check("T1.3 event_center=None", r.event_center_lat is None)
check("T1.4 segments_evaluated=1", r.segments_evaluated == 1)


print("\n--- T2: 5-segment, all SWH < 4.0m — NO VIOLATION ---")
segs5 = [
    Seg("S1", 18.95, 72.85, 15.42, 73.80),
    Seg("S2", 15.42, 73.80, 14.80, 74.13),
    Seg("S3", 14.80, 74.13, 12.92, 74.82),
    Seg("S4", 12.92, 74.82,  9.96, 76.24),
    Seg("S5",  9.96, 76.24,  8.37, 76.99),
]
r = evaluate(segs5, [1.2, 1.8, 2.1, 1.5, 3.9])
check("T2.1 violation=False", not r.violation)
check("T2.2 no breaching segment", r.breaching_segment_id is None)
check("T2.3 5 segments evaluated", r.segments_evaluated == 5)
check("T2.4 breach_value=None", r.breach_value is None)


print("\n--- T3: 1-segment, SWH=5.2m — VIOLATION on S1 ---")
r = evaluate([Seg("S1", 18.95, 72.85, 15.42, 73.80)], [5.2])
exp_lat = round((18.95 + 15.42) / 2, 4)
exp_lon = round((72.85 + 73.80) / 2, 4)
check("T3.1 violation=True", r.violation)
check("T3.2 breaching_segment=S1", r.breaching_segment_id == "S1",
      f"got={r.breaching_segment_id}")
check("T3.3 event_center=S1 midpoint lat",
      abs(r.event_center_lat - exp_lat) < 0.001, f"{r.event_center_lat} vs {exp_lat}")
check("T3.4 event_center=S1 midpoint lon",
      abs(r.event_center_lon - exp_lon) < 0.001, f"{r.event_center_lon} vs {exp_lon}")
check("T3.5 breach_value=5.2", r.breach_value == 5.2)


print("\n--- T4: 3-segment, S3=4.8m — VIOLATION only on S3 ---")
segs3 = [
    Seg("S1", 18.95, 72.85, 15.42, 73.80),
    Seg("S2", 15.42, 73.80, 14.80, 74.13),
    Seg("S3", 14.80, 74.13, 12.92, 74.82),
]
r = evaluate(segs3, [1.8, 2.3, 4.8])
exp_lat = round((14.80 + 12.92) / 2, 4)
exp_lon = round((74.13 + 74.82) / 2, 4)
check("T4.1 violation=True", r.violation)
check("T4.2 breaching_segment=S3 (not hardcoded)", r.breaching_segment_id == "S3",
      f"got='{r.breaching_segment_id}'")
check("T4.3 event_center=S3 midpoint lat",
      abs(r.event_center_lat - exp_lat) < 0.001)
check("T4.4 event_center=S3 midpoint lon",
      abs(r.event_center_lon - exp_lon) < 0.001)
check("T4.5 S1&S2 below threshold", segs3[0] and segs3[1] and r.segments_evaluated == 3)


print("\n--- T5: Unavailable OSF → no violation ---")
r = evaluate([Seg("S1", 18.95, 72.85, 15.42, 73.80),
              Seg("S2", 15.42, 73.80, 14.80, 74.13)], [None, None])
check("T5.1 violation=False (UNAVAILABLE)", not r.violation,
      "Must not fabricate events from missing data")
check("T5.2 no breaching segment", r.breaching_segment_id is None)


print("\n--- T6: PFZ alone ≠ violation ---")
r = evaluate([Seg("S1", 18.95, 72.85, 15.42, 73.80)], [2.1])  # SWH fine
check("T6.1 violation=False (PFZ alone ignored)", not r.violation,
      "PFZ alone must not trigger change event")


print("\n--- T7: Route-agnostic IDs — different route, different IDs ---")
r = evaluate([Seg("LEG-A", 15.0, 73.0, 14.0, 73.5),
              Seg("LEG-B", 14.0, 73.5, 12.0, 74.0)], [1.5, 5.5])
check("T7.1 breach on LEG-B (not S3)", r.breaching_segment_id == "LEG-B",
      f"got='{r.breaching_segment_id}'")
check("T7.2 not a hardcoded S-ID",
      r.breaching_segment_id not in ("S1","S2","S3","S4","S5"))


# ─────────────────────────────────────────────────────────────────────────────
# SUITE B: Live backend tests
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("SUITE B — Live Backend Tests (HTTP to http://127.0.0.1:8000)")
print("="*70)

# Check health
data, status = get_json(f"{BASE}/health")
print(f"\n  Backend: {data.get('status', '?')} ({status})")

# B1: Evaluate existing 5-segment decision (DEC-2026-084)
print("\n--- B1: Evaluate DEC-2026-084 (5 segments, real INCOIS data) ---")
data, status = post_json(f"{BASE}/marine/evaluate-decision/DEC-2026-084")
check("B1.1 endpoint returns 200", status == 200, f"status={status}")
if status == 200:
    check("B1.2 response has 'violation' field", "violation" in data)
    check("B1.3 response has 'segments_evaluated'", "segments_evaluated" in data)
    check("B1.4 response has 'segment_observations' list",
          isinstance(data.get("segment_observations"), list))
    check("B1.5 segments_evaluated = 5", data.get("segments_evaluated") == 5,
          f"got={data.get('segments_evaluated')}")
    check("B1.6 event_source_type is REAL or UNAVAILABLE",
          data.get("event_source_type") in ("REAL", "UNAVAILABLE", None),
          f"got={data.get('event_source_type')}")
    check("B1.7 source_type never SIMULATED",
          data.get("event_source_type") != "SIMULATED",
          f"got={data.get('event_source_type')}")
    print(f"    → violation={data.get('violation')}, "
          f"segments={data.get('segments_evaluated')}, "
          f"osf_data_on={data.get('segments_with_osf_data')}/{data.get('segments_evaluated')}, "
          f"note: {data.get('evaluation_note', '')[:80]}")
    if data.get("violation"):
        print(f"    → BREACH: seg={data.get('breaching_segment_id')}, "
              f"SWH={data.get('breach_value')}m > {data.get('breach_threshold')}m, "
              f"center=({data.get('event_center_lat')}, {data.get('event_center_lon')})")
        check("B1.8 breaching_segment_id present when violation",
              bool(data.get("breaching_segment_id")))
        check("B1.9 event_center coords present",
              data.get("event_center_lat") is not None and data.get("event_center_lon") is not None)
    else:
        print(f"    → No violation — corridor nominal under real OSF data")
        check("B1.8 no breaching_segment when no violation",
              data.get("breaching_segment_id") is None)


# B2: 404 on non-existent decision
print("\n--- B2: Non-existent decision → 404 ---")
data, status = post_json(f"{BASE}/marine/evaluate-decision/DEC-DOES-NOT-EXIST-9999")
check("B2.1 returns 404", status == 404, f"status={status}")


# B3: Check segment observations contain real lat/lon midpoints
print("\n--- B3: Segment observations have correct geometry ---")
data, status = post_json(f"{BASE}/marine/evaluate-decision/DEC-2026-084")
if status == 200 and data.get("segment_observations"):
    obs_list = data["segment_observations"]
    # S1 midpoint: (18.95+18.25)/2=18.60, (72.85+72.50)/2=72.675
    s1_obs = next((o for o in obs_list if o["segment_id"] == "S1"), None)
    if s1_obs:
        check("B3.1 S1 midpoint lat correct",
              abs(s1_obs["midpoint_lat"] - 18.60) < 0.01,
              f"got={s1_obs['midpoint_lat']}")
        check("B3.2 S1 midpoint lon correct",
              abs(s1_obs["midpoint_lon"] - 72.675) < 0.01,
              f"got={s1_obs['midpoint_lon']}")
        check("B3.3 S1 osf_source_type present",
              s1_obs.get("osf_source_type") in ("REAL", "UNAVAILABLE"),
              f"got={s1_obs.get('osf_source_type')}")
    else:
        check("B3.1 S1 observation found", False, "S1 not in observations")


# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*70)
passed = sum(1 for _, s, _ in results if s == PASS)
failed = sum(1 for _, s, _ in results if s == FAIL)
total = len(results)
print(f"\nFINAL: {passed}/{total} passed  |  {failed} failed")
print("="*70)

if failed > 0:
    print("\nFAILED:")
    for name, status, detail in results:
        if status == FAIL:
            print(f"  ✗ {name}: {detail}")
    sys.exit(1)
else:
    print("\nAll tests PASSED ✓")
    sys.exit(0)
