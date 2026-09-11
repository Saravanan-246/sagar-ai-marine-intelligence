import React from "react";
import { Shield, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { useDecisionStore } from "../../store/decisionStore";

export default function SegmentTimeline() {
  const {
    routeSegments,
    decision,
    changeEvent,
    impactAnalysis,
    selectedSegmentId,
    setSelectedSegmentId,
    setActiveNav,
    setActiveRightTab,
  } = useDecisionStore();

  const isRepaired = decision.status === "REPAIRED_COMMITTED";
  const selectedSegment = routeSegments.find((s) => s.id === selectedSegmentId) || routeSegments[0];

  const affectedCount = changeEvent ? routeSegments.filter((s) => s.status === "AFFECTED" || (decision.dataSourceType === "SIMULATED" && s.id === "S3" && !isRepaired)).length : 0;
  const stableCount = routeSegments.length - affectedCount;
  const preservationRatio = routeSegments.length > 0 ? stableCount / routeSegments.length : 1.0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Segment Continuity Sequence &amp; Preservation Tracker
          </h3>
          <p className="text-xs text-slate-500">
            {changeEvent
              ? "Graph-theoretic isolation: Verifying that disruptions do not cascade to unaffected segments."
              : "Passage corridor continuity: All planning legs verified against registered coastal fairway."}
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-700 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
          <Shield className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span>
            Plan Preservation Ratio: <strong className="text-emerald-700">{Math.round(preservationRatio * 100)}%</strong> ({stableCount}/{routeSegments.length} Segments Stable)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        {routeSegments.map((segment) => {
          const isSelected = segment.id === selectedSegmentId;
          const isAffected = Boolean(
            changeEvent &&
              !isRepaired &&
              (segment.status === "AFFECTED" || (decision.dataSourceType === "SIMULATED" && segment.id === "S3"))
          );
          const isRepairedActive = Boolean(decision.dataSourceType === "SIMULATED" && segment.id === "S3" && isRepaired);
          const isCompleted = segment.status === "COMPLETED";
          const isActive = segment.status === "ACTIVE_STABLE";

          let borderClass = "border-slate-200 bg-white";
          let badgeText = "Stable";
          let badgeClass = "bg-slate-100 text-slate-700";

          if (isAffected) {
            borderClass = "border-amber-300 bg-amber-50/70 shadow-xs ring-1 ring-amber-400";
            badgeText = "AFFECTED";
            badgeClass = "bg-amber-100 text-amber-900 font-bold border border-amber-300";
          } else if (isRepairedActive) {
            borderClass = "border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-400";
            badgeText = "REPAIRED";
            badgeClass = "bg-emerald-100 text-emerald-900 font-bold border border-emerald-300";
          } else if (isCompleted) {
            borderClass = "border-slate-200 bg-slate-50/50";
            badgeText = "Completed";
            badgeClass = "bg-slate-100 text-slate-600";
          } else if (isActive) {
            borderClass = "border-blue-300 bg-blue-50/40";
            badgeText = "Active Leg";
            badgeClass = "bg-blue-100 text-blue-800 font-semibold";
          }

          // Evidence relevant to this segment — use segment's own condition / wave data
          const segmentEvidence = isAffected
            ? segment.condition
              ? `${segment.condition}`
              : (segment.waveHeightM != null
                ? `Hs ${segment.waveHeightM}m > 4.0m limit [${segment.dataSourceType || "COMPUTED"}]`
                : "Disruption active: threshold breach [COMPUTED]")
            : isRepairedActive
            ? segment.condition
              ? `${segment.condition}`
              : (segment.repairWaypoint
                ? `Detour W-${segment.id} (Hs 2.2m) [${segment.dataSourceType || "COMPUTED"}]`
                : "Repaired via detour waypoint [COMPUTED]")
            : segment.waveHeightM != null
            ? `INCOIS: Hs ${segment.waveHeightM}m / ${segment.windKts}kt [REAL]`
            : "Computed Corridor Leg [COMPUTED]";

          return (
            <div
              key={segment.id}
              onClick={() => setSelectedSegmentId && setSelectedSegmentId(segment.id)}
              className={`rounded-lg border p-3 flex flex-col justify-between space-y-2 cursor-pointer transition hover:shadow-xs ${
                isSelected ? "ring-2 ring-blue-600 border-blue-600" : ""
              } ${borderClass}`}
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-900">
                    Segment {segment.id}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-semibold leading-tight ${badgeClass}`}
                  >
                    {badgeText}
                  </span>
                </div>

                <div className="text-[11px] font-medium text-slate-700 mt-1 truncate" title={segment.name}>
                  {segment.name}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/70 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Distance:</span>
                  <span className="font-semibold text-slate-800">{segment.distanceNm} NM</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 gap-1">
                  <span className="shrink-0">Evidence:</span>
                  <span
                    className={`font-mono text-[10px] truncate ${
                      isAffected ? "text-red-700 font-bold" : isRepairedActive ? "text-emerald-700 font-semibold" : "text-slate-700"
                    }`}
                    title={segmentEvidence}
                  >
                    {segmentEvidence}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Preservation:</span>
                  <span
                    className={`font-semibold ${
                      isAffected ? "text-amber-800" : "text-emerald-700"
                    }`}
                  >
                    {isAffected ? "Targeted Repair" : "100% Intact"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Segment Context Inspection Bar */}
      {selectedSegment && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded bg-blue-600 text-white font-bold text-[10px] px-2 py-0.5 shadow-2xs">
              INSPECTING: {selectedSegment.id}
            </span>
            <span className="font-semibold text-slate-900">
              {selectedSegment.name}
            </span>
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span className="text-slate-600 text-[11px]">
              {selectedSegment.details || selectedSegment.condition}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {Boolean(changeEvent && !isRepaired && (selectedSegment.status === "AFFECTED" || (decision.dataSourceType === "SIMULATED" && selectedSegment.id === "S3"))) && (
              <button
                onClick={() => setActiveNav("impact-analysis")}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-300 rounded-md px-2.5 py-1 hover:bg-amber-200 transition shadow-2xs"
              >
                <span>View Impact Analysis</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={() => setActiveRightTab("dependencies")}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-md px-2.5 py-1 hover:bg-slate-100 transition shadow-2xs"
            >
              <span>Inspect Dependencies</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
