/**
 * Sagar AI — Backend API Service Layer
 * Problem Statement: SIH 26176
 *
 * Provides typed fetch wrappers for the FastAPI backend.
 * All functions are optional — the frontend works standalone via Zustand.
 * Use these to persist decisions, events, and approvals to the database.
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(detail?.detail || `API error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Health ────────────────────────────────────────────────────────────────

export async function checkHealth() {
  return apiFetch("/health");
}

// ── Decisions ─────────────────────────────────────────────────────────────

export async function listDecisions() {
  return apiFetch("/decisions/");
}

export async function getDecision(id) {
  return apiFetch(`/decisions/${id}`);
}

export async function createDecision(payload) {
  return apiFetch("/decisions/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function commitDecision(id) {
  return apiFetch(`/decisions/${id}/commit`, { method: "POST" });
}

// ── Change Events ─────────────────────────────────────────────────────────

export async function ingestChangeEvent(decisionId, payload) {
  return apiFetch(`/events/${decisionId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function computeImpact(decisionId, eventId) {
  return apiFetch(`/events/${decisionId}/impact/${eventId}`);
}

// ── Repair Candidates ─────────────────────────────────────────────────────

export async function listRepairCandidates(decisionId) {
  return apiFetch(`/repairs/${decisionId}`);
}

export async function addRepairCandidate(decisionId, payload) {
  return apiFetch(`/repairs/${decisionId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Human Approvals ───────────────────────────────────────────────────────

/**
 * Submit human approval.
 * @param {string} decisionId
 * @param {{ repair_candidate_id, officer_name, rationale, verified_items }} payload
 */
export async function approveRepairBackend(decisionId, payload) {
  return apiFetch(`/approvals/${decisionId}/approve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Submit human rejection.
 * @param {string} decisionId
 * @param {{ repair_candidate_id, officer_name, rejection_reason }} payload
 */
export async function rejectRepairBackend(decisionId, payload) {
  return apiFetch(`/approvals/${decisionId}/reject`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listApprovalRecords(decisionId) {
  return apiFetch(`/approvals/${decisionId}`);
}

// ── Audit History ─────────────────────────────────────────────────────────

export async function getAuditHistory(decisionId) {
  return apiFetch(`/audit/${decisionId}`);
}

// ── Marine Data & Telemetry ───────────────────────────────────────────────

export async function getMarineRegistry() {
  return apiFetch("/marine/registry");
}

export async function getMarineOsfWaypoints(timeIso = null) {
  const query = timeIso ? `?time_iso=${encodeURIComponent(timeIso)}` : "";
  return apiFetch(`/marine/osf/waypoints${query}`);
}

export async function getMarinePfzWaypoints() {
  return apiFetch("/marine/pfz/waypoints");
}

export async function getMarineOsfPoint(lat, lon, timeIso = null) {
  const params = new URLSearchParams({ lat, lon });
  if (timeIso) params.append("time_iso", timeIso);
  return apiFetch(`/marine/osf?${params.toString()}`);
}

export async function getMarinePfzPoint(lat, lon) {
  return apiFetch(`/marine/pfz?lat=${lat}&lon=${lon}`);
}

export async function getMarineAisStatus() {
  return apiFetch("/marine/ais/status");
}

/**
 * Evaluate real INCOIS OSF/PFZ evidence against a committed decision's
 * actual route segments and dependency thresholds.
 *
 * Returns a MarineEvaluationResult:
 *   { violation: bool, breaching_segment_id?, event_center_lat?, event_center_lon?,
 *     event_title?, event_description?, breach_value?, breach_threshold?,
 *     event_source_type: "REAL"|"UNAVAILABLE", segment_observations: [...], ... }
 *
 * violation=false → no change event should be created.
 * violation=true  → caller should ingest the returned event data into the pipeline.
 */
export async function evaluateMarineEvidence(decisionId) {
  return apiFetch(`/marine/evaluate-decision/${encodeURIComponent(decisionId)}`, {
    method: "POST",
  });
}

