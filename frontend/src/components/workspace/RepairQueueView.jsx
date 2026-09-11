import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Info,
  Layers,
  AlertOctagon,
} from "lucide-react";
import { useDecisionStore } from "../../store/decisionStore";

export default function RepairQueueView() {
  const {
    repairCandidates,
    selectedRepairId,
    setSelectedRepairId,
    openApprovalModal,
    decision,
    currentScenario,
    userRole,
  } = useDecisionStore();

  const isRepaired = decision.status === "REPAIRED_COMMITTED";

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Minimal-Change Repair Queue
            </h2>
            <span className="rounded bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5">
              Targeted Repair vs Complete Replanning
            </span>
            <span className="rounded bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 border border-slate-200">
              Role: {userRole?.name || "User"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Generating candidates that satisfy the minimal-change objective while bounding plan churn and downstream schedule disruption.
          </p>
        </div>

        {!isRepaired && currentScenario !== "catastrophic_collapse" && (
          <button
            onClick={openApprovalModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition shrink-0 cursor-pointer"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>
              {userRole?.id === "approval_authority"
                ? "Review & Authorize Repair"
                : userRole?.id === "stakeholder_view"
                ? "Inspect Human Approval (Read-Only)"
                : "Inspect Proposed Repair Gate"}
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Research Limitation Alert (Catastrophic Scenario) */}
      {currentScenario === "catastrophic_collapse" && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-5 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-red-900 font-bold text-sm">
            <AlertOctagon className="h-5 w-5 text-red-600 shrink-0" />
            <span>Research Limitation Triggered: No Safe Minimal Repair Feasible</span>
          </div>
          <p className="text-xs text-red-950 leading-relaxed">
            <strong>Theoretical Boundary:</strong> Minimal-change repair relies on isolating a localized sub-graph of compromised segments.
            In this catastrophic multi-zone breach, all 5 operational segments violate core spatial and physical constraints simultaneously.
            The system adheres to <strong>Invariant 1 &amp; Invariant 6</strong> and will NOT force a bad repair when none is mathematically feasible.
          </p>
          <div className="pt-1 text-xs text-red-800 font-semibold">
            System Recommendation: Abort minimal repair queue → Escalate to Broader Global Replanning Engine.
          </div>
        </div>
      )}

      {/* Candidate Cards Grid */}
      {currentScenario !== "catastrophic_collapse" && repairCandidates.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3 shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Passage Corridor Operating Nominally</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              No active disruption events or constraint violations detected along the committed passage corridor. No repairs required.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
            <span>Status: Zero-Repair Standby</span>
          </div>
        </div>
      )}

      {currentScenario !== "catastrophic_collapse" && repairCandidates.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {repairCandidates.map((candidate) => {
            const isSelected = selectedRepairId === candidate.id;
            const isRecommended = candidate.tier === "RECOMMENDED";
            const isAlternative = candidate.tier === "ALTERNATIVE";
            const isHigherDisruption = candidate.tier === "HIGHER_DISRUPTION";

            let tierBadgeClass = "bg-blue-100 text-blue-800 border-blue-200";
            let tierLabel = "Recommended Minimal";
            let cardBorderClass = isSelected
              ? "border-blue-500 ring-2 ring-blue-500/20 bg-white"
              : "border-slate-200 bg-white hover:border-slate-300";

            if (isAlternative) {
              tierBadgeClass = "bg-slate-100 text-slate-800 border-slate-200";
              tierLabel = "Alternative Strategy";
            } else if (isHigherDisruption) {
              tierBadgeClass = "bg-amber-100 text-amber-900 border-amber-200";
              tierLabel = "Higher Disruption";
            }

            return (
              <div
                key={candidate.id}
                className={`rounded-xl border p-4 flex flex-col justify-between space-y-4 shadow-xs transition ${cardBorderClass}`}
              >
                <div className="space-y-3">
                  {/* Header Badge & Title */}
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tierBadgeClass}`}
                    >
                      {tierLabel}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-slate-500">
                      {candidate.id}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {candidate.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {candidate.description}
                    </p>
                  </div>

                  {/* Research Metrics (Plan Churn & Preservation) */}
                  <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium">Plan Churn Metric:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {candidate.planChurn} ({Math.round(candidate.planChurn * 100)}% churn)
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium">Preservation Ratio:</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {candidate.preservationRatio} ({Math.round(candidate.preservationRatio * 100)}% preserved)
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium">Feasibility Status:</span>
                      <span
                        className={`font-semibold ${
                          isHigherDisruption ? "text-amber-800" : "text-emerald-700"
                        }`}
                      >
                        {candidate.feasibility}
                      </span>
                    </div>
                  </div>

                  {/* What Changes */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      What Changes:
                    </div>
                    <ul className="space-y-1 pl-2">
                      {candidate.whatChanges.map((item, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-slate-700 list-disc list-outside leading-tight"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* What Remains Unchanged */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      What Remains Unchanged (Preserved):
                    </div>
                    <ul className="space-y-1 pl-2">
                      {candidate.whatRemainsUnchanged.map((item, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-slate-700 list-disc list-outside leading-tight"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Trade-offs & Reasoning */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="rounded bg-slate-50 p-2 border border-slate-100">
                      <span className="font-bold text-slate-800 block text-[11px] mb-0.5">
                        Operational Trade-offs:
                      </span>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {candidate.tradeoffs}
                      </p>
                    </div>

                    <div>
                      <span className="font-bold text-slate-800 block text-[11px] mb-0.5">
                        Minimal-Change Rationale:
                      </span>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {candidate.recommendationReason}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Selection Action button */}
                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedRepairId(candidate.id)}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-xs"
                        : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Selected for Approval</span>
                      </>
                    ) : (
                      <span>Select Candidate {candidate.id}</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
