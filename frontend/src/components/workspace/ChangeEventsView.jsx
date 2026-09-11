import React, { useState } from "react";
import {
  Radio,
  AlertTriangle,
  Clock,
  MapPin,
  CheckCircle2,
  Sliders,
  Shield,
  ArrowRight,
  Database,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Info,
} from "lucide-react";
import { useDecisionStore } from "../../store/decisionStore";

export default function ChangeEventsView() {
  const {
    changeEvent,
    setActiveNav,
    openApprovalModal,
    routeSegments,
    decision,
    marineOsfObservations,
    ingestCustomChangeEvent,
    clearCustomChangeEvent,
    evaluateRealMarineEvidence,
    marineEvaluating,
    marineEvalResult,
    marineEvalError,
    userRole,
  } = useDecisionStore();
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [customLat, setCustomLat] = useState("");
  const [customLon, setCustomLon] = useState("");
  const [customRadius, setCustomRadius] = useState("35");

  // Strictly Truthful: Only actual active disruptions appear in the events pipeline
  const events = [];

  if (changeEvent) {
    events.push({
      id: changeEvent.id || "EVT-SIM-2026-0914",
      severity: changeEvent.severity || "HIGH",
      timestamp: changeEvent.observedAt || "2026-09-14 06:12:00Z",
      title: changeEvent.title || "Environmental Wave Exceedance Alert",
      description:
        changeEvent.description ||
        "Environmental condition breaching committed operational parameters.",
      source: changeEvent.source || "INCOIS Threat Model",
      sourceType: changeEvent.sourceType || "COMPUTED",
      location: changeEvent.location || "14.58°N, 73.41°E",
      affectedSegmentId: changeEvent.affectedSegmentId || routeSegments[0]?.id || "S1",
      impactState: "Breaches Operational Limit",
      isCurrent: true,
    });
  }

  const activeReviews = events.filter((e) => e.severity === "HIGH").length;
  const affectedSegId = changeEvent ? changeEvent.affectedSegmentId : null;
  const affectedSegCount = changeEvent ? (changeEvent.affectedSegmentIds?.length || 1) : 0;

  const handleEvaluateSegment = (seg) => {
    if (!seg.startCoord || !seg.endCoord) return;
    const midLat = (seg.startCoord[0] + seg.endCoord[0]) / 2;
    const midLon = (seg.startCoord[1] + seg.endCoord[1]) / 2;

    ingestCustomChangeEvent({
      eventCoordinates: [Number(midLat.toFixed(4)), Number(midLon.toFixed(4))],
      affectedSegmentId: seg.id,
      radiusNm: 30,
      title: `Wave Exceedance Alert (${seg.name.split(" to ")[0]} Corridor)`,
      description: `Significant wave height observed at 5.2m (exceeds 4.0m limit) along corridor near [${midLat.toFixed(2)}°N, ${midLon.toFixed(2)}°E].`,
      source: "INCOIS Coastal Observation & Threat Model",
      sourceType: "COMPUTED",
      severity: "HIGH",
    });
  };

  const handleEvaluateCustomCoords = (e) => {
    e.preventDefault();
    const lat = parseFloat(customLat);
    const lon = parseFloat(customLon);
    const rad = parseFloat(customRadius) || 35;
    if (isNaN(lat) || isNaN(lon)) return;

    ingestCustomChangeEvent({
      eventCoordinates: [lat, lon],
      radiusNm: rad,
      title: `Custom Coordinate Disruption [${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E]`,
      description: `Operator-injected test event at coordinates [${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E] with radius ${rad} NM.`,
      source: "Operator Testbench & Environmental Evaluator",
      sourceType: "COMPUTED",
      severity: "HIGH",
    });
  };

  const handleEvaluateRealEvidence = async () => {
    // Calls the backend pipeline:
    //   real OSF/PFZ for each segment's actual midpoint
    //   → dependency threshold check
    //   → change event only if a genuine breach is found
    await evaluateRealMarineEvidence();
  };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Ingested Change Events
            </h2>
            <span className="rounded bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-bold px-2 py-0.5">
              OPERATIONAL MONITORING
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Normalized environmental and operational changes evaluated against committed decisions.
          </p>
        </div>

        {/* Dynamic Status Summary */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className={`rounded-lg border px-3 py-1.5 text-center ${
            activeReviews > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"
          }`}>
            <span className="text-[10px] text-slate-600 uppercase font-bold block">Requiring Review</span>
            <span className={`font-bold ${activeReviews > 0 ? "text-amber-950" : "text-slate-800"}`}>
              {activeReviews > 0 ? `${activeReviews} Active` : "0 Pending"}
            </span>
          </div>
          <div className={`rounded-lg border px-3 py-1.5 text-center ${
            activeReviews > 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"
          }`}>
            <span className="text-[10px] uppercase font-bold block text-slate-600">High Severity</span>
            <span className={`font-bold ${activeReviews > 0 ? "text-red-950" : "text-emerald-800"}`}>
              {activeReviews > 0 ? `${activeReviews} Event` : "0 Events"}
            </span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
            <span className="text-[10px] text-slate-600 uppercase font-bold block">Corridor Status</span>
            <span className="font-bold text-slate-900">
              {affectedSegCount > 0 ? `Leg ${affectedSegId} (${affectedSegCount}/${routeSegments.length})` : `All ${routeSegments.length} Legs Nominal`}
            </span>
          </div>
        </div>
      </div>

      {/* NOMINAL STANDBY VIEW (WHEN NO DISRUPTIONS ACTIVE) */}
      {events.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs text-center space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Passage Corridor Operating Nominally — Zero Active Disruptions
            </h3>
            <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
              All {routeSegments.length} planning legs between {decision.departurePort} and {decision.destinationPort} are clear of restrictions. No threshold breaches detected along the committed track.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Corridor Standby: 0 Events Active • {routeSegments.length}/{routeSegments.length} Legs Intact</span>
          </div>
        </div>
      )}

      {/* ACTIVE EVENT LIST */}
      {events.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Active Disruption Event
            </h3>
            <button
              onClick={clearCustomChangeEvent}
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold underline cursor-pointer"
            >
              Clear Disruption &amp; Restore Nominal
            </button>
          </div>

          {events.map((evt) => {
            const isHigh = evt.severity === "HIGH";
            return (
              <div
                key={evt.id}
                className="rounded-xl border border-amber-300 bg-amber-50/20 ring-1 ring-amber-300 p-4 transition shadow-xs"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start sm:items-center">
                  {/* LEFT: Severity, Event ID, Timestamp */}
                  <div className="md:col-span-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          isHigh
                            ? "bg-red-100 text-red-800 border border-red-200"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {evt.severity}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {evt.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span>{evt.timestamp}</span>
                    </div>
                  </div>

                  {/* CENTER: Title, Concise Description, Source/Provenance, Location */}
                  <div className="md:col-span-6 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-900">
                        {evt.title}
                      </h4>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                          evt.sourceType === "REAL"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : "bg-amber-50 text-amber-900 border-amber-300"
                        }`}
                      >
                        {evt.sourceType}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      {evt.description}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-slate-400" />
                        {evt.source}
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {evt.location}
                      </span>
                    </div>
                  </div>

                  {/* RIGHT: Affected Segment, Impact State, Action */}
                  <div className="md:col-span-3 flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-slate-200">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Affected: <strong className="text-slate-900">Leg {evt.affectedSegmentId}</strong>
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          isHigh ? "text-red-700" : "text-emerald-700"
                        }`}
                      >
                        {evt.impactState}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsDetailExpanded(!isDetailExpanded)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        <span>{isDetailExpanded ? "Hide Flow" : "Inspect Flow"}</span>
                        {isDetailExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={() => setActiveNav("impact-analysis")}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700 shadow-2xs transition cursor-pointer"
                      >
                        <span>View Impact</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DISRUPTION EVALUATION & TESTING CONTROL PANEL */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-tight text-slate-900">
              Deterministic Event Evaluation &amp; Corridor Testbench
            </h3>
            <p className="text-[11px] text-slate-500">
              Test change-event intersection against current decision legs ({routeSegments.map((s) => s.id).join(", ")}) using deterministic math.
            </p>
          </div>
          {events.length > 0 && (
            <button
              onClick={clearCustomChangeEvent}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <span>Clear Event / Reset Nominal</span>
            </button>
          )}
        </div>

        {/* Quick Corridor Leg Triggers */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
            1. Quick Evaluate Disruption on Route Legs:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {routeSegments.map((seg) => (
              <button
                key={seg.id}
                disabled={userRole?.id === "stakeholder_view"}
                onClick={() => handleEvaluateSegment(seg)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                  userRole?.id === "stakeholder_view"
                    ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-900 text-slate-700 cursor-pointer"
                }`}
                title={userRole?.id === "stakeholder_view" ? "Testing disabled in read-only Stakeholder View" : `Evaluate spatial wave exceedance intersecting Segment ${seg.id}`}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span>Evaluate Leg {seg.id} ({seg.name.split(" to ")[0]})</span>
              </button>
            ))}

            {/* Real INCOIS Evidence Evaluation Button */}
            <button
              onClick={handleEvaluateRealEvidence}
              disabled={marineEvaluating || !decision?.id || userRole?.id === "stakeholder_view"}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                userRole?.id === "stakeholder_view"
                  ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                  : marineEvaluating
                  ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 cursor-pointer"
              }`}
              title="Fetch real INCOIS OSF/PFZ for each route segment midpoint, evaluate against dependency thresholds, and create a change event only if a genuine breach is found."
            >
              <Radio className={`h-3.5 w-3.5 ${marineEvaluating || userRole?.id === "stakeholder_view" ? "text-slate-400" : "text-emerald-700"}`} />
              <span>
                {marineEvaluating ? "Evaluating INCOIS Evidence…" : "Evaluate Real INCOIS OSF/PFZ Evidence"}
              </span>
              {userRole?.id === "marine_analyst" && (
                <span className="rounded bg-emerald-200 text-emerald-950 text-[9px] px-1.5 py-0.2 font-bold uppercase">
                  Analyst Primary
                </span>
              )}
            </button>

            {/* Evaluation result badge */}
            {marineEvalResult && !marineEvaluating && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                marineEvalResult.violation
                  ? "bg-red-50 text-red-800 border-red-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
              }`}>
                {marineEvalResult.violation
                  ? `BREACH: Leg ${marineEvalResult.breaching_segment_id} SWH ${marineEvalResult.breach_value?.toFixed(2)}m > ${marineEvalResult.breach_threshold}m`
                  : `NOMINAL: ${marineEvalResult.segments_evaluated} legs clear (SWH ≤ ${marineEvalResult.breach_threshold ?? 4.0}m)`
                }
              </span>
            )}
            {marineEvalError && !marineEvaluating && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border bg-amber-50 text-amber-800 border-amber-200">
                EVAL ERR: {marineEvalError.slice(0, 60)}
              </span>
            )}
          </div>
        </div>

        {/* Custom Coordinates Evaluation Form */}
        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
            2. Evaluate Arbitrary Coordinates against Current Corridor:
          </span>
          <form onSubmit={handleEvaluateCustomCoords} className="flex items-center gap-2 flex-wrap text-xs">
            <input
              type="number"
              step="0.01"
              placeholder="Latitude (e.g. 15.11)"
              value={customLat}
              onChange={(e) => setCustomLat(e.target.value)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs w-36 focus:outline-hidden focus:border-blue-500"
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="Longitude (e.g. 73.96)"
              value={customLon}
              onChange={(e) => setCustomLon(e.target.value)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs w-36 focus:outline-hidden focus:border-blue-500"
              required
            />
            <input
              type="number"
              step="1"
              placeholder="Radius NM"
              value={customRadius}
              onChange={(e) => setCustomRadius(e.target.value)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs w-24 focus:outline-hidden focus:border-blue-500"
            />
            <button
              type="submit"
              className="rounded-md bg-slate-800 hover:bg-slate-900 text-white font-semibold px-3 py-1 text-xs transition cursor-pointer"
            >
              Evaluate Coordinates
            </button>
          </form>
        </div>
      </div>

      {/* DETAILED EVENT VIEW & DETERMINISTIC REASONING CHAIN */}
      {isDetailExpanded && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Deterministic Decision Reasoning Chain
              </h3>
              <p className="text-[11px] text-slate-500">
                Formal trace demonstrating non-autonomous evaluation from raw marine observation to isolated candidate repair.
              </p>
            </div>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
              ISO-26176 DETERMINISTIC EVAL
            </span>
          </div>

          {/* Dynamic Visual Chain */}
          {changeEvent ? (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                  1. Marine Evidence
                </span>
                <p className="text-xs font-bold text-slate-900">{changeEvent.source}</p>
                <span className={`inline-block text-[9px] font-mono px-1 rounded ${
                  changeEvent.sourceType === "REAL" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
                }`}>
                  {changeEvent.sourceType}
                </span>
                <p className="text-[10px] text-slate-600 mt-1">{changeEvent.location}</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                  2. Detected Change
                </span>
                <p className="text-xs font-bold text-amber-900">{changeEvent.title}</p>
                <span className="inline-block text-[9px] font-mono bg-red-100 text-red-800 px-1 rounded">
                  SEV: {changeEvent.severity}
                </span>
                <p className="text-[10px] text-slate-600 mt-1">Exceeds committed operational envelope.</p>
              </div>

              <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-2.5 space-y-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 block">
                  3. Affected Segment
                </span>
                <p className="text-xs font-bold text-slate-900">Leg {changeEvent.affectedSegmentId} Isolated</p>
                <span className="inline-block text-[9px] font-mono bg-blue-100 text-blue-800 px-1 rounded">
                  {routeSegments.filter((s) => s.id !== changeEvent.affectedSegmentId).map((s) => s.id).join(", ") || "OTHER"} INTACT
                </span>
                <p className="text-[10px] text-slate-600 mt-1">Graph isolation protects unaffected legs.</p>
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50/40 p-2.5 space-y-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-red-800 block">
                  4. Constraint Breach
                </span>
                <p className="text-xs font-bold text-red-950">Threshold Exceeded</p>
                <span className="inline-block text-[9px] font-mono bg-red-100 text-red-800 px-1 rounded">
                  LIMIT COMPROMISED
                </span>
                <p className="text-[10px] text-slate-600 mt-1">Operational ceiling compromised if unaltered.</p>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2.5 space-y-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-800 block">
                  5. Impact Analysis
                </span>
                <p className="text-xs font-bold text-slate-900">
                  {routeSegments.length > 1 ? `${Math.round(((routeSegments.length - 1) / routeSegments.length) * 100)}% Plan Preserved` : "Localized Impact"}
                </p>
                <span className="inline-block text-[9px] font-mono bg-emerald-100 text-emerald-800 px-1 rounded">
                  BOUNDED CHURN
                </span>
                <p className="text-[10px] text-slate-600 mt-1">Controlled delay; corridor integrity evaluated.</p>
              </div>

              <div className="rounded-lg border border-emerald-300 bg-emerald-50/50 p-2.5 space-y-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 block">
                  6. Repair Review
                </span>
                <p className="text-xs font-bold text-slate-900">Candidate R1</p>
                <span className="inline-block text-[9px] font-mono bg-amber-100 text-amber-900 px-1 rounded">
                  REQUIRES OFFICER APPROVAL
                </span>
                <p className="text-[10px] text-slate-600 mt-1">Minimal detour candidate proposed.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 text-center">
              Corridor operates under nominal parameters. No disruption chain active.
            </div>
          )}

          {/* Operational Governance Invariants Banner */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 space-y-2">
            <div className="flex items-center gap-2 text-blue-950 font-bold text-xs">
              <Shield className="h-4 w-4 text-blue-700 shrink-0" />
              <span>Operational Governance &amp; Decision Stability Principles</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] text-slate-700">
              <div className="bg-white/80 rounded p-2 border border-blue-100">
                <span className="font-bold text-slate-900 block">1. Non-Autonomous Ingestion:</span>
                Event ingestion never silently alters a committed decision.
              </div>
              <div className="bg-white/80 rounded p-2 border border-blue-100">
                <span className="font-bold text-slate-900 block">2. Segment Isolation:</span>
                Deterministic impact analysis isolates disruptions strictly to affected legs.
              </div>
              <div className="bg-white/80 rounded p-2 border border-blue-100">
                <span className="font-bold text-slate-900 block">3. Advisory Repair:</span>
                Repair candidates are strictly advisory recommendations.
              </div>
              <div className="bg-white/80 rounded p-2 border border-blue-100">
                <span className="font-bold text-slate-900 block">4. Human Authority:</span>
                Committed state changes require explicit master authorization.
              </div>
            </div>

            {changeEvent && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={openApprovalModal}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
                >
                  <span>Review Human Approval</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
