"""
Pydantic v2 schemas (request / response bodies).
Matches the domain model used by the frontend store exactly.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict


# ── Helpers ────────────────────────────────────────────────────────────────

class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Route Segment ─────────────────────────────────────────────────────────

class RouteSegmentCreate(BaseModel):
    segment_id: str
    order_index: int = 0
    name: str
    distance_nm: Optional[float] = None
    status: str = "UNAFFECTED"
    condition: Optional[str] = None
    wave_height_m: Optional[float] = None
    wind_kts: Optional[float] = None
    details: Optional[str] = None
    start_lat: Optional[float] = None
    start_lon: Optional[float] = None
    end_lat: Optional[float] = None
    end_lon: Optional[float] = None
    repair_waypoint_lat: Optional[float] = None
    repair_waypoint_lon: Optional[float] = None


class RouteSegmentOut(OrmBase):
    id: int
    segment_id: str
    decision_id: str
    order_index: int
    name: str
    distance_nm: Optional[float]
    status: str
    condition: Optional[str]
    wave_height_m: Optional[float]
    wind_kts: Optional[float]
    details: Optional[str]
    start_lat: Optional[float]
    start_lon: Optional[float]
    end_lat: Optional[float]
    end_lon: Optional[float]
    repair_waypoint_lat: Optional[float]
    repair_waypoint_lon: Optional[float]


# ── Dependency ────────────────────────────────────────────────────────────

class DependencyCreate(BaseModel):
    id: str
    dep_type: Optional[str] = None
    name: str
    commitment: Optional[str] = None
    source: Optional[str] = None
    condition: Optional[str] = None
    linked_segments: List[str] = Field(default_factory=list)
    impact_level: Optional[str] = None
    status: str = "VALID"
    description: Optional[str] = None
    mitigation_under_repair: Optional[str] = None


class DependencyOut(OrmBase):
    id: str
    decision_id: str
    dep_type: Optional[str]
    name: str
    commitment: Optional[str]
    source: Optional[str]
    condition: Optional[str]
    linked_segments: List[str] = Field(default_factory=list)
    impact_level: Optional[str]
    status: str
    description: Optional[str]
    mitigation_under_repair: Optional[str]


# ── Decision ───────────────────────────────────────────────────────────────

class DecisionCreate(BaseModel):
    id: str = Field(..., description="e.g. DEC-2026-084")
    title: str
    objective: Optional[str] = None
    status: str = "DRAFT"
    version: str = "v1.0"
    officer: Optional[str] = None
    departure_port: Optional[str] = None
    destination_port: Optional[str] = None
    total_distance_nm: Optional[float] = None
    planned_speed_kts: Optional[float] = None
    original_eta: Optional[str] = None
    current_segment: Optional[str] = None
    schedule: Optional[str] = None
    assumptions: List[str] = Field(default_factory=list)
    data_source_type: str = "SIMULATED"
    data_quality: Optional[str] = None
    segments: List[RouteSegmentCreate] = Field(default_factory=list)
    dependencies: List[DependencyCreate] = Field(default_factory=list)


class DecisionUpdate(BaseModel):
    title: Optional[str] = None
    objective: Optional[str] = None
    status: Optional[str] = None
    version: Optional[str] = None
    officer: Optional[str] = None
    departure_port: Optional[str] = None
    destination_port: Optional[str] = None
    total_distance_nm: Optional[float] = None
    planned_speed_kts: Optional[float] = None
    original_eta: Optional[str] = None
    current_segment: Optional[str] = None
    schedule: Optional[str] = None
    assumptions: Optional[List[str]] = None
    data_source_type: Optional[str] = None
    data_quality: Optional[str] = None


class DecisionOut(OrmBase):
    id: str
    title: str
    objective: Optional[str]
    status: str
    version: str
    officer: Optional[str]
    departure_port: Optional[str]
    destination_port: Optional[str]
    total_distance_nm: Optional[float]
    planned_speed_kts: Optional[float]
    original_eta: Optional[str]
    current_segment: Optional[str]
    schedule: Optional[str]
    assumptions: List[str] = Field(default_factory=list)
    data_source_type: Optional[str]
    data_quality: Optional[str]
    created_at: Optional[datetime]
    committed_at: Optional[datetime]
    updated_at: Optional[datetime]
    segments: List[RouteSegmentOut] = Field(default_factory=list)
    dependencies: List[DependencyOut] = Field(default_factory=list)


# ── Change Event ──────────────────────────────────────────────────────────

class ChangeEventCreate(BaseModel):
    id: str
    event_type: Optional[str] = None
    title: str
    severity: str = "HIGH"
    source: Optional[str] = None
    source_type: str = "SIMULATED"
    observed_at: Optional[str] = None
    location: Optional[str] = None
    event_lat: Optional[float] = None
    event_lon: Optional[float] = None
    radius_nm: Optional[float] = None
    affected_segment_id: Optional[str] = None
    description: Optional[str] = None
    quality: Optional[str] = None
    source_record_id: Optional[str] = None
    is_catastrophic: bool = False


class SimulatedBreachRequest(BaseModel):
    """Explicit simulated change event trigger for demonstration/testing."""
    segment_id: str
    swh_m: float = 4.8
    threshold_m: float = 4.0
    title: Optional[str] = None
    description: Optional[str] = None


class ChangeEventOut(OrmBase):
    id: str
    decision_id: str
    event_type: Optional[str]
    title: str
    severity: str
    source: Optional[str]
    source_type: str
    observed_at: Optional[str]
    location: Optional[str]
    event_lat: Optional[float]
    event_lon: Optional[float]
    radius_nm: Optional[float]
    affected_segment_id: Optional[str]
    description: Optional[str]
    quality: Optional[str]
    source_record_id: Optional[str]
    is_catastrophic: bool
    created_at: Optional[datetime]


# ── Repair Candidate ──────────────────────────────────────────────────────

class RepairCandidateCreate(BaseModel):
    id: str
    tier: str = "ALTERNATIVE"
    title: str
    description: Optional[str] = None
    plan_churn: Optional[float] = None
    preservation_ratio: Optional[float] = None
    what_changes: List[str] = Field(default_factory=list)
    what_remains_unchanged: List[str] = Field(default_factory=list)
    tradeoffs: Optional[str] = None
    feasibility: Optional[str] = None
    score: Optional[int] = None
    recommendation_reason: Optional[str] = None
    linked_event_id: Optional[str] = None
    affected_segment_id: Optional[str] = None
    repair_waypoint_lat: Optional[float] = None
    repair_waypoint_lon: Optional[float] = None


class RepairCandidateOut(OrmBase):
    id: str
    decision_id: str
    tier: str
    title: str
    description: Optional[str]
    plan_churn: Optional[float]
    preservation_ratio: Optional[float]
    what_changes: List[str] = Field(default_factory=list)
    what_remains_unchanged: List[str] = Field(default_factory=list)
    tradeoffs: Optional[str]
    feasibility: Optional[str]
    score: Optional[int]
    recommendation_reason: Optional[str]
    linked_event_id: Optional[str]
    affected_segment_id: Optional[str] = None
    repair_waypoint_lat: Optional[float] = None
    repair_waypoint_lon: Optional[float] = None
    created_at: Optional[datetime]


# ── Human Approval ────────────────────────────────────────────────────────

class ApprovalRequest(BaseModel):
    """Posted by human operator through the UI's approval dialog."""
    repair_candidate_id: str
    officer_name: str = Field(..., min_length=3)
    rationale: Optional[str] = None
    verified_items: List[bool] = Field(default_factory=list)
    candidate_data: Optional[RepairCandidateCreate] = None


class RejectionRequest(BaseModel):
    """Posted when operator rejects the proposed repair."""
    repair_candidate_id: str
    officer_name: str = Field(..., min_length=3)
    rejection_reason: Optional[str] = None


class ApprovalRecordOut(OrmBase):
    id: int
    decision_id: str
    repair_candidate_id: Optional[str]
    action: str
    officer_name: str
    rationale: Optional[str]
    rejection_reason: Optional[str]
    verified_items: Optional[List[bool]] = None
    pre_approval_status: Optional[str]
    post_approval_status: Optional[str]
    decision_version_before: Optional[str]
    decision_version_after: Optional[str]
    created_at: Optional[datetime]


# ── Audit ─────────────────────────────────────────────────────────────────

class AuditEntryOut(OrmBase):
    id: int
    decision_id: str
    version: Optional[str]
    status: Optional[str]
    event: str
    summary: Optional[str]
    officer: Optional[str]
    created_at: Optional[datetime]


# ── Impact Analysis (computed, not persisted) ─────────────────────────────

class ImpactAnalysisOut(BaseModel):
    decision_id: str
    event_id: str
    affected_segment_ids: List[str]
    unaffected_segment_ids: List[str]
    violated_dependency_ids: List[str]
    at_risk_dependency_ids: List[str]
    severity: str
    reason: str
    plan_churn: float
    preservation_ratio: float
    is_catastrophic_collapse: bool
