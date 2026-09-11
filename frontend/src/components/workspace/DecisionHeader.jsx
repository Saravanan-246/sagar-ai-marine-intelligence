import React, { useState } from "react";
import {
  Ship,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Activity,
} from "lucide-react";
import { useDecisionStore } from "../../store/decisionStore";

export default function DecisionHeader() {
  const {
    decision,
    changeEvent,
    openApprovalModal,
    decisionHealth,
    currentScenario,
    stakeholderAwareness,
  } = useDecisionStore();

  const [expanded, setExpanded] = useState(true);

  const isImpacted = decision.status === "IMPACTED" || decision.status === "DISRUPTION_DETECTED";
  const isRepaired = decision.status === "REPAIRED_COMMITTED";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
      {/* Top row: Identity & Primary State */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-700">
            <Ship className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                {decision.title}
              </h1>
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-mono font-semibold text-slate-700">
                {decision.id}
              </span>
              <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase border ${
                decision.dataSourceType === "SIMULATED"
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-emerald-100 text-emerald-900 border-emerald-300"
              }`}>
                {decision.dataSourceType === "SIMULATED" ? "SIMULATED BENCHMARK" : "PROVENANCE AWARE"}
              </span>

              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                  decision.status === "DRAFT"
                    ? "bg-blue-50 text-blue-800 border border-blue-200"
                    : isImpacted
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}
              >
                {decision.status === "DRAFT" ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                    <span>Version {decision.version} — DRAFT (Uncommitted Review)</span>
                  </>
                ) : isImpacted ? (
                  <>
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    <span>Version {decision.version} — Active Disruption Review</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    <span>Version {decision.version} — Committed &amp; Verified</span>
                  </>
                )}
              </span>

              {stakeholderAwareness?.acknowledged && (
                <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-bold px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                  <span>Stakeholder Awareness Synced</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 mt-1">
              Objective: <span className="font-medium text-slate-700">{decision.objective}</span> • Schedule:{" "}
              <span className="text-slate-700 font-medium">{decision.schedule}</span>
            </p>
          </div>
        </div>

        {/* Health Metric & Primary Action Button */}
        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto flex-wrap">
          {/* Decision Health Score Widget */}
          {decisionHealth && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-2.5 py-1.5 text-xs">
              <Activity className="h-3.5 w-3.5 text-blue-600" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    Decision Health:
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {decisionHealth.overall}/100
                  </span>
                </div>
                <span className="text-[9px] text-slate-500">
                  Safety: {decisionHealth.safety} • Deps: {decisionHealth.dependenciesScore}
                </span>
              </div>
            </div>
          )}

          {isImpacted && (
            <button
              onClick={openApprovalModal}
              disabled={currentScenario === "catastrophic_collapse"}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition shadow-xs ${
                currentScenario === "catastrophic_collapse"
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Review Approval</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-80" />
            </button>
          )}
        </div>
      </div>

      {/* ── 2. WHAT CHANGED? OPERATIONAL REASONING STRIP (5 CORE INVARIANTS) ─ */}
      <div className="border-t border-slate-100 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
              Operational Reasoning Strip
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              (5 Core Invariant Answers)
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Deterministic Evaluation Engine
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* 1. What am I looking at? */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-800 text-[9px] font-bold shrink-0">
                1
              </span>
              <span>What am I looking at?</span>
            </div>
            <p className="text-xs text-slate-800 leading-snug">
              Decision <strong className="font-mono text-slate-900">{decision.id}</strong> ({decision.version}) — {decision.totalDistanceNm} NM {decision.departurePort?.split(" ")[0] || "Origin"} to {decision.destinationPort?.split(" ")[0] || "Destination"} transit.
            </p>
          </div>

          {/* 2. What changed? (VISUALLY STRONGEST WHEN DISRUPTED) */}
          <div
            className={`rounded-lg p-3 space-y-1.5 flex flex-col justify-between transition ${
              isImpacted
                ? "border-2 border-amber-400 bg-amber-50 shadow-xs ring-1 ring-amber-400/30"
                : "border border-slate-200 bg-slate-50/70"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <div
                className={`flex items-center gap-1.5 text-[11px] font-bold ${
                  isImpacted ? "text-amber-950 font-extrabold" : "text-slate-700"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold shrink-0 ${
                    isImpacted
                      ? "bg-amber-500 text-white"
                      : "bg-slate-200 text-slate-800"
                  }`}
                >
                  2
                </span>
                <span>What changed?</span>
              </div>
              {isImpacted && (
                <span className="rounded bg-amber-200/80 text-amber-950 font-mono text-[9px] font-bold px-1.5 py-0.2">
                  DISRUPTED
                </span>
              )}
            </div>
            <p
              className={`text-xs leading-snug ${
                isImpacted ? "text-amber-950 font-semibold" : "text-slate-800"
              }`}
            >
              {decision.status === "DRAFT"
                ? "New operational passage plan drafted. Awaiting sign-off authority."
                : !changeEvent
                ? "No environmental disruptions detected. All corridor legs nominal."
                : isImpacted
                ? `Environmental hazard envelope active near Segment ${changeEvent.affectedSegmentId || "—"} (${changeEvent.location || "coordinates evaluated"}).`
                : `Change remediated via minimal detour around Segment ${changeEvent?.affectedSegmentId || "affected leg"}; v2.0 committed.`}
            </p>
          </div>

          {/* 3. What is affected? (VISUALLY STRONGEST WHEN DISRUPTED) */}
          <div
            className={`rounded-lg p-3 space-y-1.5 flex flex-col justify-between transition ${
              isImpacted
                ? "border-2 border-amber-400 bg-amber-50 shadow-xs ring-1 ring-amber-400/30"
                : "border border-slate-200 bg-slate-50/70"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <div
                className={`flex items-center gap-1.5 text-[11px] font-bold ${
                  isImpacted ? "text-amber-950 font-extrabold" : "text-slate-700"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold shrink-0 ${
                    isImpacted
                      ? "bg-amber-500 text-white"
                      : "bg-slate-200 text-slate-800"
                  }`}
                >
                  3
                </span>
                <span>What is affected?</span>
              </div>
              {isImpacted && (
                <span className="rounded bg-amber-200/80 text-amber-950 font-mono text-[9px] font-bold px-1.5 py-0.2">
                  ISOLATED
                </span>
              )}
            </div>
            <p className="text-xs leading-snug">
              {!changeEvent ? (
                <span className="text-emerald-800 font-bold">Zero segments affected. 100% of planned passage legs intact.</span>
              ) : isImpacted ? (
                <span className="text-amber-950">
                  <strong className="text-red-900 font-extrabold underline decoration-amber-500 underline-offset-2">
                    Segment S3 only.
                  </strong>{" "}
                  <span className="text-emerald-900 font-medium block mt-0.5">
                    Segments S1, S2, S4, S5 remain strictly unaffected &amp; preserved.
                  </span>
                </span>
              ) : (
                <span className="text-emerald-800 font-semibold">All segments preserved or remediated.</span>
              )}
            </p>
          </div>

          {/* 4. What can I do? */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-800 text-[9px] font-bold shrink-0">
                4
              </span>
              <span>What can I do?</span>
            </div>
            <p className="text-xs text-slate-800 leading-snug">
              {decision.status === "DRAFT"
                ? "Review draft context, inspect ocean state forecast feeds, and commit plan."
                : currentScenario === "catastrophic_collapse"
                ? "Acknowledge research limitation: Broader replanning required."
                : isImpacted
                ? "Review minimal repair candidates (R1 Western Detour) in the queue."
                : "Monitor verified INCOIS wave and PFZ advisory feeds along corridor."}
            </p>
          </div>

          {/* 5. What happens if I approve? */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold shrink-0">
                5
              </span>
              <span>What happens if I approve?</span>
            </div>
            <p className="text-xs text-slate-800 leading-snug">
              {decision.status === "DRAFT"
                ? "Plan transitions to v1.0 COMMITTED with strict immutability rules."
                : isImpacted
                ? `Segment ${changeEvent?.affectedSegmentId || "affected leg"} adopts detour via Waypoint W-${changeEvent?.affectedSegmentId || "X"} (+38m delay buffer, preserves corridor integrity); version advances to v2.0.`
                : "Operational decision remains locked and verified."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
