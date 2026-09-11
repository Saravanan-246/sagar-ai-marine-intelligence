"""
Sagar AI — Deterministic Impact Engine (Python)
Problem Statement: SIH 26176

INVARIANT:
  The LLM is NEVER used for geometry, threshold calculation, or segment
  impact classification.  All impact decisions flow through this engine
  using spatial intersection mathematics and graph-theoretic dependency
  propagation — identical in logic to the frontend impactEngine.js.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Optional


# ── Spatial Helpers ────────────────────────────────────────────────────────

def _approx_distance_nm(
    lat1: float, lon1: float,
    lat2: float, lon2: float,
) -> float:
    """
    Planar approximation:  1° lat ≈ 60 NM,  1° lon ≈ 60 · cos(lat) NM.
    Sufficient for regional corridor evaluation (< 3 % error up to 300 NM).
    """
    d_lat = (lat2 - lat1) * 60.0
    cos_lat = math.cos(math.radians((lat1 + lat2) / 2))
    d_lon = (lon2 - lon1) * 60.0 * cos_lat
    return math.sqrt(d_lat ** 2 + d_lon ** 2)


def check_spatial_intersection(
    start_coord: tuple[float, float],
    end_coord: tuple[float, float],
    event_center: tuple[float, float],
    radius_nm: float = 45.0,
) -> bool:
    """
    Returns True if the line segment (start → end) comes within radius_nm
    of event_center using perpendicular vector projection in local nautical coordinates.
    """
    lat1, lon1 = start_coord
    lat2, lon2 = end_coord
    c_lat, c_lon = event_center

    cos_lat = math.cos(math.radians(c_lat))
    x1 = (lon1 - c_lon) * 60.0 * cos_lat
    y1 = (lat1 - c_lat) * 60.0
    x2 = (lon2 - c_lon) * 60.0 * cos_lat
    y2 = (lat2 - c_lat) * 60.0

    dx = x2 - x1
    dy = y2 - y1
    seg_len_sq = dx * dx + dy * dy

    if seg_len_sq == 0:
        return math.sqrt(x1 * x1 + y1 * y1) <= radius_nm

    t = max(0.0, min(1.0, -(x1 * dx + y1 * dy) / seg_len_sq))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    closest_dist_nm = math.sqrt(proj_x * proj_x + proj_y * proj_y)

    return closest_dist_nm <= radius_nm


# ── Data Transfer Objects ─────────────────────────────────────────────────

@dataclass
class SegmentDTO:
    segment_id: str
    start_lat: Optional[float] = None
    start_lon: Optional[float] = None
    end_lat: Optional[float] = None
    end_lon: Optional[float] = None


@dataclass
class DependencyDTO:
    dep_id: str
    linked_segments: List[str] = field(default_factory=list)
    impact_level: str = "MEDIUM"


@dataclass
class ImpactResult:
    affected_segment_ids: List[str]
    unaffected_segment_ids: List[str]
    violated_dependency_ids: List[str]
    at_risk_dependency_ids: List[str]
    severity: str
    reason: str
    plan_churn: float
    preservation_ratio: float
    is_catastrophic_collapse: bool


# ── Engine ────────────────────────────────────────────────────────────────

def evaluate_decision_impact(
    segments: List[SegmentDTO],
    dependencies: List[DependencyDTO],
    *,
    event_center: Optional[tuple[float, float]] = None,
    radius_nm: float = 45.0,
    directly_affected_segment_id: Optional[str] = None,
    event_severity: str = "HIGH",
    event_description: str = "",
    is_catastrophic: bool = False,
) -> ImpactResult:
    """
    Deterministic impact evaluation — equivalent to frontend evaluateDecisionImpact().

    Steps:
      1. Spatial intersection check for each segment.
      2. Graph-theoretic dependency propagation.
      3. Plan-churn / preservation-ratio computation.
    """

    # ── Catastrophic fast-path ──────────────────────────────────────────
    if is_catastrophic:
        all_ids = [s.segment_id for s in segments]
        return ImpactResult(
            affected_segment_ids=all_ids,
            unaffected_segment_ids=[],
            violated_dependency_ids=[d.dep_id for d in dependencies],
            at_risk_dependency_ids=[],
            severity="CRITICAL",
            reason=(
                "Catastrophic multi-zone breach: Spatial restriction envelops "
                "all operational legs. No safe minimal repair is mathematically "
                "feasible. Full replanning required."
            ),
            plan_churn=1.0,
            preservation_ratio=0.0,
            is_catastrophic_collapse=True,
        )

    # ── Step 1: Segment spatial / tag evaluation ────────────────────────
    affected: list[str] = []
    unaffected: list[str] = []

    for seg in segments:
        targeted = False

        # Spatial intersection takes precedence when coordinates are provided
        if (
            event_center is not None
            and seg.start_lat is not None
            and seg.end_lat is not None
        ):
            targeted = check_spatial_intersection(
                (seg.start_lat, seg.start_lon),
                (seg.end_lat,   seg.end_lon),
                event_center,
                radius_nm,
            )
        elif directly_affected_segment_id and seg.segment_id == directly_affected_segment_id:
            targeted = True

        (affected if targeted else unaffected).append(seg.segment_id)

    # ── Step 2: Dependency propagation ─────────────────────────────────
    violated: list[str] = []
    at_risk:  list[str] = []

    for dep in dependencies:
        if any(seg_id in affected for seg_id in dep.linked_segments):
            if dep.impact_level == "CRITICAL":
                violated.append(dep.dep_id)
            else:
                at_risk.append(dep.dep_id)

    # ── Step 3: Research metrics ────────────────────────────────────────
    total = len(segments)
    plan_churn = round(len(affected) / total, 2) if total else 0.0
    preservation_ratio = round(1.0 - plan_churn, 2)

    reason = (
        f"Deterministic spatial evaluation: {event_description}. "
        f"Restricts Segment(s) {', '.join(affected)} "
        f"while preserving {', '.join(unaffected)}."
    ) if affected else "No segments intersect the event envelope."

    return ImpactResult(
        affected_segment_ids=affected,
        unaffected_segment_ids=unaffected,
        violated_dependency_ids=violated,
        at_risk_dependency_ids=at_risk,
        severity=event_severity,
        reason=reason,
        plan_churn=plan_churn,
        preservation_ratio=preservation_ratio,
        is_catastrophic_collapse=False,
    )
