import React from "react";
import {
  Network,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Shield,
  Layers,
  Activity,
} from "lucide-react";
import { useDecisionStore } from "../../store/decisionStore";

export default function ImpactAnalysisView() {
  const {
    dependencies,
    constraints,
    routeSegments,
    changeEvent,
    impactAnalysis,
    setActiveNav,
    selectedSegmentId,
    setSelectedSegmentId,
    setActiveRightTab,
    currentScenario,
    decision,
    stakeholderAwareness,
  } = useDecisionStore();

  const isAffectedEvent = Boolean(changeEvent);
  const affectedLegId = changeEvent?.affectedSegmentId || (currentScenario === "standard_s3_breach" ? "S3" : null);
  const preservedCount = impactAnalysis?.unaffectedSegmentIds?.length ?? (isAffectedEvent ? Math.max(0, routeSegments.length - 1) : routeSegments.length);
  const preservedRatioText = `${preservedCount}/${routeSegments.length} Preserved`;

  const causalityFlow = [
    { title: "Committed Decision", desc: `${decision.version || "v1.0"} ${decision.title || "Passage Corridor"}` },
    { title: "Dependency Model", desc: `${dependencies.length} Berth & Stability Commitments` },
    { title: "Change Ingestion", desc: isAffectedEvent ? "Hazard Envelope Ingested" : "Nominal Environmental Feeds" },
    { title: "Dependency Eval", desc: isAffectedEvent ? "Spatial Intersection Check" : "Zero Boundary Breaches" },
    { title: "Segment Impact", desc: isAffectedEvent ? `Leg ${affectedLegId || "Isolated"} (${preservedRatioText})` : `All ${routeSegments.length} Legs Intact` },
    { title: "Minimal Repair", desc: isAffectedEvent ? "Waypoint Detour Evaluated" : "Zero Repair Necessary" },
    { title: "Human Approval", desc: isAffectedEvent ? "Officer Gate Required" : "No Action Required" },
    { title: "Updated Version", desc: isAffectedEvent ? "Targeted Decision v2.0" : "Decision v1.0 Nominal" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Deterministic Impact Analysis Engine
            </h2>
            <span className="rounded bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5">
              Section 10 Implementation
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Graph-theoretic dependency mapping and deterministic spatial intersection. The LLM does NOT calculate impact or segment classifications.
          </p>
        </div>

        <button
          onClick={() => setActiveNav("repair-queue")}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition shrink-0"
        >
          <span>Evaluate Repairs</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Causality Step Chain */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
          End-to-End Decision Continuity Flow
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
          {causalityFlow.map((step, idx) => (
            <div
              key={step.title}
              className={`rounded-lg border p-2 text-xs flex flex-col justify-between transition ${
                idx === 4 && isAffectedEvent
                  ? "border-amber-300 bg-amber-50/70 shadow-2xs"
                  : idx === 5 && isAffectedEvent
                  ? "border-blue-300 bg-blue-50/70"
                  : idx === 6 && isAffectedEvent
                  ? "border-emerald-300 bg-emerald-50/70"
                  : "border-slate-200 bg-slate-50/50"
              }`}
            >
              <div>
                <span className="text-[10px] font-bold text-slate-500 block">
                  0{idx + 1}
                </span>
                <span className="font-bold text-slate-900 block leading-tight text-[11px] mt-0.5">
                  {step.title}
                </span>
              </div>
              <p className="text-[10px] text-slate-600 mt-1 leading-snug">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Segment Disruption vs Preservation Breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Route Segment Impact Classification
          </h3>
          <span className="text-xs font-mono text-slate-500">
            Plan Churn Index: <strong>{impactAnalysis?.planChurn ?? (isAffectedEvent ? 0.2 : 0.0)}</strong> ({preservedRatioText})
          </span>
        </div>

        <div className="space-y-2">
          {routeSegments.map((seg) => {
            const isAffected = Boolean(
              changeEvent &&
                (seg.status === "AFFECTED" ||
                  impactAnalysis?.affectedSegmentIds?.includes(seg.id) ||
                  seg.id === changeEvent.affectedSegmentId)
            );
            const isSelected = seg.id === selectedSegmentId;
            let stressScore = 6;
            if (currentScenario === "catastrophic_collapse") {
              stressScore = 91 + (parseInt(seg.id.replace("S", "") || "1", 10) * 2);
            } else if (isAffected) {
              stressScore = 88;
            } else {
              stressScore = Math.min(24, Math.max(5, Math.round((seg.waveHeightM || 1.8) * 5)));
            }

            return (
              <div
                key={seg.id}
                onClick={() => setSelectedSegmentId(seg.id)}
                className={`rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs cursor-pointer transition ${
                  isSelected
                    ? "border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20 shadow-xs"
                    : "border-slate-200 bg-slate-50/40 hover:bg-slate-50/80"
                }`}
              >
                <div className="space-y-0.5 sm:w-1/3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 block">
                      Segment {seg.id}: {seg.name}
                    </span>
                    {isSelected && (
                      <span className="rounded bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.2">
                        SELECTED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Distance: {seg.distanceNm} NM • Condition: {seg.condition}
                  </p>
                </div>

                {/* Stress Index Bar */}
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Environmental Threat Stress:</span>
                    <span
                      className={`font-bold ${
                        isAffected ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      {stressScore}/100 ({isAffected ? "Threshold Breached" : "Nominal Stability"})
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isAffected ? "bg-red-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${stressScore}%` }}
                    />
                  </div>
                </div>

                {/* Preservation Pill & Inspection Trigger */}
                <div className="sm:w-48 text-right flex items-center justify-end gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${
                      isAffected
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {isAffected ? "AFFECTED: Needs Repair" : "UNAFFECTED: Preserved"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Downstream Dependency Stress Matrix */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
          Downstream Dependency Propagation Matrix
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3">Dependency ID</th>
                <th className="py-2.5 px-3">Operational Commitment</th>
                <th className="py-2.5 px-3">Impact Under Hazard</th>
                <th className="py-2.5 px-3">Resolution Under Repair R1</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
              {dependencies.map((dep) => (
                <tr
                  key={dep.id}
                  onClick={() => setActiveRightTab("dependencies")}
                  className="hover:bg-blue-50/50 transition cursor-pointer"
                  title="Click to inspect dependency details in Context Panel"
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                    {dep.id}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    {dep.name}
                    <span className="block text-[10px] text-slate-500 font-normal">
                      Condition: {dep.commitment}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-red-700 font-medium">
                    {dep.description}
                  </td>
                  <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                    {dep.mitigationUnderRepair}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        dep.status === "VIOLATED"
                          ? "bg-red-100 text-red-800"
                          : dep.status === "AT_RISK"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {dep.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stakeholder Operational Impact Awareness Summary */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Stakeholder Operational Impacts
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.2 rounded border ${
              stakeholderAwareness?.acknowledged
                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                : "bg-indigo-100 text-indigo-800 border-indigo-300"
            }`}>
              {stakeholderAwareness?.acknowledged ? "Awareness Logged" : "Multi-Sector Review"}
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Multi-sector perspective evaluated for fisheries safety (PFZ &amp; craft stand-off), port arrival tolerance (+38m delay), marine sanctuary buffers, and SDMA alert level.
          </p>
        </div>

        <button
          onClick={() => setActiveNav("stakeholder-view")}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition shrink-0 cursor-pointer"
        >
          <span>Open Stakeholder Workflow</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
