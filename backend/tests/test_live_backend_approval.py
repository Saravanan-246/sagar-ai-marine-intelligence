"""
test_live_backend_approval.py — End-to-end HTTP integration test against running FastAPI server
Tests against http://127.0.0.1:8000/api
"""
import sys
import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000/api"

def api_call(path, method="GET", body=None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as res:
            if res.status == 204:
                return None
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
            raise RuntimeError(f"HTTP {e.code}: {parsed.get('detail', err_body)}")
        except Exception:
            raise RuntimeError(f"HTTP {e.code}: {err_body}")


def run_live_tests():
    import time
    ts = int(time.time() * 1000)
    print("\n" + "="*70)
    print("LIVE BACKEND HTTP INTEGRATION TESTS (http://127.0.0.1:8000/api)")
    print("="*70)

    # 1. Health check
    health = api_call("/health")
    assert health["status"] == "ok"
    print("  ✓ [PASS] Health check ok")

    # 2. Create custom decision with 3 non-S3 segments
    dec_id = f"DEC-LIVE-{ts}"
    create_payload = {
        "id": dec_id,
        "title": "Live Passage Plan 2026",
        "objective": "Survey corridor",
        "status": "DRAFT",
        "version": "v1.0",
        "officer": "Navigation Officer",
        "departure_port": "Port Alpha",
        "destination_port": "Port Delta",
        "total_distance_nm": 420.0,
        "planned_speed_kts": 15.0,
        "original_eta": "2026-09-18 10:00 UTC",
        "current_segment": "LEG-01",
        "schedule": "Standard transit",
        "data_source_type": "COMPUTED",
        "data_quality": "VERIFIED",
        "segments": [
            {
                "segment_id": "LEG-01",
                "order_index": 0,
                "name": "Port Alpha to Waypoint Bravo",
                "distance_nm": 130.0,
                "status": "ACTIVE_STABLE",
                "condition": "Nominal",
                "start_lat": 19.0, "start_lon": 72.5,
                "end_lat": 17.5, "end_lon": 73.0,
            },
            {
                "segment_id": "LEG-02",
                "order_index": 1,
                "name": "Waypoint Bravo to Waypoint Charlie",
                "distance_nm": 140.0,
                "status": "ACTIVE_STABLE",
                "condition": "Nominal",
                "start_lat": 17.5, "start_lon": 73.0,
                "end_lat": 16.0, "end_lon": 73.5,
            },
            {
                "segment_id": "LEG-03",
                "order_index": 2,
                "name": "Waypoint Charlie to Port Delta",
                "distance_nm": 150.0,
                "status": "UNAFFECTED",
                "condition": "Nominal",
                "start_lat": 16.0, "start_lon": 73.5,
                "end_lat": 14.5, "end_lon": 74.0,
            },
        ],
        "dependencies": [
            {
                "id": f"DEP-SAFE-{ts}",
                "dep_type": "SAFETY_DYNAMIC_STABILITY",
                "name": "Vessel dynamic stability limit",
                "commitment": "Roll angle < 10 deg",
                "source": "Stability manual",
                "condition": "SWH < 4.0m",
                "impact_level": "CRITICAL",
                "status": "VALID",
                "linked_segments": ["LEG-01", "LEG-02", "LEG-03"],
            }
        ],
    }

    created = api_call("/decisions/", method="POST", body=create_payload)
    assert created["id"] == dec_id
    print("  \u2713 [PASS] Custom decision created with legs LEG-01, LEG-02, LEG-03")

    # 3. Commit decision
    committed = api_call(f"/decisions/{dec_id}/commit", method="POST")
    assert committed["status"] == "COMMITTED"
    print("  \u2713 [PASS] Decision locked into COMMITTED state (v1.0)")

    # 4. Ingest change event affecting LEG-02
    evt_id = f"EVT-LIVE-{ts}"
    evt_payload = {
        "id": evt_id,
        "title": "Severe Sea State in Sector Charlie",
        "severity": "HIGH",
        "source": "INCOIS Model",
        "source_type": "COMPUTED",
        "affected_segment_id": "LEG-02",
        "event_lat": 16.75,
        "event_lon": 73.25,
        "radius_nm": 30.0,
        "description": "Waves exceeding 5.0m threshold",
    }
    evt_resp = api_call(f"/events/{dec_id}", method="POST", body=evt_payload)
    assert evt_resp["affected_segment_id"] == "LEG-02"
    print("  ✓ [PASS] Change event ingested, targeting LEG-02. Decision status: IMPACTED")

    # 5. Add repair candidate for LEG-02
    cand_id = f"R-LIVE-{ts}"
    rep_payload = {
        "id": cand_id,
        "tier": "RECOMMENDED",
        "title": "Minimal Detour via Waypoint W-LEG-02",
        "description": "30 NM offshore standoff around hazard envelope",
        "plan_churn": 0.33,
        "preservation_ratio": 0.67,
        "what_changes": ["Segment LEG-02 replaced with western arc detour"],
        "what_remains_unchanged": ["Segment LEG-01 preserved", "Segment LEG-03 preserved"],
        "tradeoffs": "+12 NM distance delta",
        "feasibility": "FEASIBLE",
        "score": 92,
        "affected_segment_id": "LEG-02",
        "repair_waypoint_lat": 16.75,
        "repair_waypoint_lon": 72.70,
        "linked_event_id": evt_id,
    }
    cand_resp = api_call(f"/repairs/{dec_id}", method="POST", body=rep_payload)
    assert cand_resp["id"] == cand_id
    print("  ✓ [PASS] Repair candidate registered for LEG-02")

    # 6. Approve repair via human approval endpoint
    app_payload = {
        "repair_candidate_id": cand_id,
        "officer_name": "Fleet Commander K. Rao",
        "rationale": "Authorized standoff around high sea state",
        "verified_items": [True, True, True],
    }
    app_resp = api_call(f"/approvals/{dec_id}/approve", method="POST", body=app_payload)
    assert app_resp["action"] == "APPROVED"
    assert app_resp["decision_version_after"] == "v2.0"
    print("  ✓ [PASS] Human approval accepted, version bumped to v2.0")

    # 7. Verify decision and segments on backend
    dec_after = api_call(f"/decisions/{dec_id}")
    assert dec_after["status"] == "REPAIRED_COMMITTED"
    assert dec_after["version"] == "v2.0"

    segs = {s["segment_id"]: s for s in dec_after["segments"]}
    assert segs["LEG-02"]["status"] == "REPAIRED_ACTIVE"
    assert "W-LEG-02" in segs["LEG-02"]["condition"]
    assert segs["LEG-01"]["status"] != "REPAIRED_ACTIVE"
    assert segs["LEG-03"]["status"] != "REPAIRED_ACTIVE"
    assert "Preserved intact" in segs["LEG-01"]["details"]
    assert "Preserved intact" in segs["LEG-03"]["details"]
    print("  ✓ [PASS] Only LEG-02 was repaired; LEG-01 and LEG-03 100% preserved")

    # 8. Verify audit history
    audits = api_call(f"/audit/{dec_id}")
    assert len(audits) >= 3
    latest = audits[0]
    assert "LEG-02" in latest["summary"]
    assert "LEG-01" in latest["summary"] and "LEG-03" in latest["summary"]
    assert "S3" not in latest["summary"] and "W3-A" not in latest["summary"]
    print(f"  ✓ [PASS] Audit summary verified: \"{latest['summary'][:60]}...\" (zero S3/W3-A)")

    # 9. Test rejection on a second decision
    dec2_id = f"DEC-LIVE-REJ-{ts}"
    create_payload["id"] = dec2_id
    create_payload["title"] = "Passage Plan Rejection Test"
    create_payload["dependencies"] = [
        {
            "id": f"DEP-SAFE-{dec2_id}",
            "dep_type": "SAFETY_DYNAMIC_STABILITY",
            "name": "Vessel dynamic stability limit",
            "commitment": "Roll angle < 10 deg",
            "source": "Stability manual",
            "condition": "SWH < 4.0m",
            "impact_level": "CRITICAL",
            "status": "VALID",
            "linked_segments": ["LEG-01", "LEG-02", "LEG-03"],
        }
    ]
    api_call("/decisions/", method="POST", body=create_payload)
    api_call(f"/decisions/{dec2_id}/commit", method="POST")
    evt_payload["id"] = f"EVT-LIVE-REJ-{ts}"
    api_call(f"/events/{dec2_id}", method="POST", body=evt_payload)
    rep_payload["id"] = f"R-LIVE-REJ-{ts}"
    rep_payload["linked_event_id"] = f"EVT-LIVE-REJ-{ts}"
    api_call(f"/repairs/{dec2_id}", method="POST", body=rep_payload)

    rej_payload = {
        "repair_candidate_id": f"R-LIVE-REJ-{ts}",
        "officer_name": "Chief Mate T. Das",
        "rejection_reason": "Excessive fuel variance for remaining bunker capacity.",
    }
    rej_resp = api_call(f"/approvals/{dec2_id}/reject", method="POST", body=rej_payload)
    assert rej_resp["action"] == "REJECTED"
    assert rej_resp["decision_version_after"] == "v1.0"

    dec2_after = api_call(f"/decisions/{dec2_id}")
    assert dec2_after["status"] == "IMPACTED"
    assert dec2_after["version"] == "v1.0"
    segs2 = {s["segment_id"]: s for s in dec2_after["segments"]}
    assert segs2["LEG-02"]["status"] != "REPAIRED_ACTIVE"
    print("  ✓ [PASS] Rejection correctly maintained v1.0 and did not mutate route")

    print("\n" + "="*70)
    print("ALL LIVE BACKEND INTEGRATION TESTS PASSED \u2713")
    print("="*70)

if __name__ == "__main__":
    run_live_tests()
