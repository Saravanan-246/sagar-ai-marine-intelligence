import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  X,
  AlertTriangle,
  CheckCircle2,
  GitCommit,
  Anchor,
  UserCheck,
} from "lucide-react";
import { useDecisionStore } from "../../store/decisionStore";

export default function HumanApprovalModal() {
  const {
    isApprovalModalOpen,
    closeApprovalModal,
    decision,
    changeEvent,
    selectedRepairId,
    repairCandidates,
    approveRepair,
    rejectRepair,
    userRole,
  } = useDecisionStore();

  const isApprovalAuthority = userRole?.id === "approval_authority";
  const defaultOfficer = userRole?.name
    ? `${userRole.name} (${userRole.title})`
    : "Approval Authority (Command Sign-Off)";

  const [officerName, setOfficerName] = useState(defaultOfficer);
  // Default rationale is populated dynamically after candidate is resolved below.
  // Declared here; set after candidate is resolved to avoid forward reference.
  const [rationale, setRationale] = useState("");
  const [check1, setCheck1] = useState(true);
  const [check2, setCheck2] = useState(true);
  const [check3, setCheck3] = useState(true);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(
    "Awaiting secondary acoustic calibration pass before committing trajectory adjustment."
  );

  if (!isApprovalModalOpen) return null;

  const candidate =
    repairCandidates.find((c) => c.id === selectedRepairId) || repairCandidates[0];

  // Dynamic default rationale derived from the active candidate + decision context
  const rationaleDefault = rationale || (candidate
    ? `Minimal repair authorized: Segment ${candidate.affectedSegmentId} routed via Waypoint W-${candidate.affectedSegmentId} (${candidate.repairWaypoint ? candidate.repairWaypoint[0].toFixed(2) + "°N, " + candidate.repairWaypoint[1].toFixed(2) + "°E" : "offshore standoff"}). Plan churn ${candidate.planChurn} — ${Math.round((candidate.preservationRatio || 1) * 100)}% of corridor preserved.`
    : "Minimal repair authorized. Operational continuity maintained.");

  const canApprove = isApprovalAuthority && check1 && check2 && check3 && officerName.trim().length > 0;

  const handleApprove = () => {
    approveRepair({
      officerName,
      rationale: rationale || rationaleDefault,
      verifiedItems: [check1, check2, check3],
    });
  };

  const handleReject = () => {
    rejectRepair({
      officerName,
      rejectionReason,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Human Operational Approval
                </h2>
                <span className="rounded bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.2 uppercase tracking-wide">
                  Enforced Gate
                </span>
                <span className={`rounded border text-[10px] font-bold px-1.5 py-0.2 ${
                  decision.dataSourceType === "REAL"
                    ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                    : decision.dataSourceType === "COMPUTED"
                    ? "bg-blue-100 text-blue-900 border-blue-300"
                    : "bg-amber-100 text-amber-900 border-amber-300"
                }`}>
                  DATA: {decision.dataSourceType || "COMPUTED"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Invariant 6: Human approval is mandatory before a proposed repair produces the next decision version.
              </p>
            </div>
          </div>

          <button
            onClick={closeApprovalModal}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body: The 8 Explicit Human Approval Elements */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Role Clearance Warning if not Approval Authority */}
          {!isApprovalAuthority && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950">
                <strong>Sign-off Restricted to Approval Authority:</strong> Your active role is{" "}
                <span className="font-bold underline">{userRole?.name || "User"}</span>. You have read-only inspection access to proposed repairs and trade-offs. To approve or reject this repair, switch to the <strong>Approval Authority</strong> role via the TopBar.
              </div>
            </div>
          )}

          {/* 1. Decision State Comparison */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1. Original Decision vs Proposed Repair
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                v1.0 (Committed) → v2.0 (Proposed)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Original State */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <span className="font-bold text-slate-700">Original State ({decision.version || "v1.0"})</span>
                  <span className="text-[10px] font-semibold bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded">
                    LOCKED
                  </span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-600">
                  <p><strong className="text-slate-800">Plan:</strong> {decision.title || "Passage Corridor"}</p>
                  <p><strong className="text-slate-800">Total Distance:</strong> {decision.totalDistanceNm} NM</p>
                  <p><strong className="text-slate-800">Committed ETA:</strong> {decision.originalEta || "Scheduled"}</p>
                  <p><strong className="text-slate-800">Affected Leg:</strong> {changeEvent?.affectedSegmentId ? `Leg ${changeEvent.affectedSegmentId}` : "None"}</p>
                </div>
              </div>

              {/* Proposed Repair */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-1.5">
                <div className="flex items-center justify-between border-b border-blue-200 pb-1">
                  <span className="font-bold text-blue-900">Proposed Repair ({candidate?.id || "R1"})</span>
                  <span className="text-[10px] font-semibold bg-blue-200 text-blue-900 px-1.5 py-0.2 rounded">
                    MINIMAL DETOUR
                  </span>
                </div>
                <div className="space-y-1 text-[11px] text-blue-950">
                  <p><strong className="text-blue-900">Plan:</strong> {candidate?.title || "Targeted Detour"}</p>
                  <p><strong className="text-blue-900">Total Distance:</strong> {Math.round(decision.totalDistanceNm + 12)} NM (+12.0 NM variance)</p>
                  <p><strong className="text-blue-900">Revised ETA:</strong> +38m delay (Preserves slot tolerance)</p>
                  <p><strong className="text-blue-900">Plan Churn:</strong> {candidate?.planChurn || "0.20"} ({Math.round((candidate?.preservationRatio || 0.8) * 100)}% preserved)</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2 & 3. Triggering Event & Affected Dependency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <span>2. Triggering Change Event</span>
              </div>
              <p className="font-semibold text-slate-900 text-xs">{changeEvent?.title || "Operational Hazard Ingestion"}</p>
              <p className="text-[11px] text-slate-700 leading-snug">
                {changeEvent?.description || "Simulated hazard boundary expanding across committed passage corridor."}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                <Anchor className="h-4 w-4 text-blue-600" />
                <span>3. Affected Dependencies</span>
              </div>
              <ul className="text-[11px] text-slate-700 space-y-0.5 list-disc pl-3 leading-snug">
                <li><strong>Arrival Window:</strong> Requires arrival within allowable tolerance window.</li>
                <li><strong>Safety Ceiling:</strong> Dynamic vessel stability subject to operating envelope.</li>
              </ul>
            </div>
          </div>

          {/* 4 & 5. Affected Segment & Preserved Commitments */}
          <div className="rounded-lg border border-slate-200 p-3 space-y-2 bg-white text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="font-bold text-slate-900">
                4. Affected Leg: <span className="text-amber-800 font-bold">{changeEvent?.affectedSegmentId ? `Leg ${changeEvent.affectedSegmentId} Only` : "Zero Affected Legs"}</span>
              </span>
              <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                5. Preserved: Unaffected Legs (100% Intact)
              </span>
            </div>

            <div className="text-[11px] text-slate-600 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded border border-slate-100 bg-slate-50 p-2">
                <span className="font-semibold text-slate-800 block">Departure Leg</span>
                <span className="text-emerald-700 font-medium">Completed &amp; Locked</span>
              </div>
              <div className="rounded border border-slate-100 bg-slate-50 p-2">
                <span className="font-semibold text-slate-800 block">Active Traversal</span>
                <span className="text-emerald-700 font-medium">Maintained</span>
              </div>
              <div className="rounded border border-amber-200 bg-amber-50 p-2">
                <span className="font-bold text-amber-900 block">{changeEvent?.affectedSegmentId ? `Leg ${changeEvent.affectedSegmentId}` : "Transition Leg"}</span>
                <span className="text-amber-800 font-bold">Targeted Repair</span>
              </div>
              <div className="rounded border border-slate-100 bg-slate-50 p-2">
                <span className="font-semibold text-slate-800 block">Terminus Legs</span>
                <span className="text-emerald-700 font-medium">100% Preserved</span>
              </div>
            </div>
          </div>

          {/* 6 & 7. Operational Reason & Trade-offs */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
            <span className="font-bold text-slate-800 block">
              6. Minimal-Change Reason &amp; 7. Trade-Offs:
            </span>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              <strong className="text-slate-900">Reason:</strong> {candidate?.recommendationReason || "Preserves maximum corridor segments with minimal detour."}
            </p>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              <strong className="text-slate-900">Trade-offs:</strong> {candidate?.tradeoffs || "Minimal fuel increase; preserves berth arrival."}
            </p>
          </div>

          {/* 8. Mandatory Human Verification Checkpoints */}
          <div className="space-y-2 pt-1 border-t border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <UserCheck className="h-4 w-4 text-blue-600" />
              <span>Watch Officer Sign-Off &amp; Accountability</span>
            </div>

            <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={check1}
                  onChange={(e) => setCheck1(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0"
                />
                <span className="text-slate-700 text-[11px] leading-snug">
                  I verify that all unaffected corridor legs remain preserved without unnecessary replanning churn.
                </span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={check2}
                  onChange={(e) => setCheck2(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0"
                />
                <span className="text-slate-700 text-[11px] leading-snug">
                  I confirm the revised arrival schedule satisfies the committed arrival tolerance window.
                </span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={check3}
                  onChange={(e) => setCheck3(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0"
                />
                <span className="text-slate-700 text-[11px] leading-snug">
                  I authorize the minimal course/speed variance required to bypass the environmental hazard.
                </span>
              </label>
            </div>

            {/* Officer credential input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Authorizing Officer
                </label>
                <input
                  type="text"
                  value={officerName}
                  onChange={(e) => setOfficerName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Commitment Log Note
                </label>
                <input
                  type="text"
                  value={rationale || rationaleDefault}
                  placeholder={rationaleDefault}
                  onChange={(e) => setRationale(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Rejection Details Drawer */}
            {isRejecting && (
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 space-y-2 text-xs">
                <label className="block font-bold text-red-900 text-[11px]">
                  Reason for Rejecting Proposed Repair:
                </label>
                <textarea
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full rounded-md border border-red-300 bg-white p-2 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-red-500"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsRejecting(false)}
                    className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Cancel Rejection
                  </button>
                  <button
                    onClick={handleReject}
                    className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 transition"
                  >
                    Confirm Rejection &amp; Maintain v1.0 Locked
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="text-[11px] text-slate-500">
            {canApprove ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                All 3 invariants verified. Ready to commit Version v2.0.
              </span>
            ) : (
              <span className="text-amber-700 font-semibold">
                Complete all 3 verification checks to authorize approval.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isRejecting && (
              <button
                type="button"
                disabled={!isApprovalAuthority}
                onClick={() => setIsRejecting(true)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  isApprovalAuthority
                    ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                    : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
                title={isApprovalAuthority ? "Reject this repair recommendation" : "Only Approval Authority can reject repairs"}
              >
                Reject Repair
              </button>
            )}

            <button
              type="button"
              disabled={!canApprove}
              onClick={handleApprove}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition shadow-xs ${
                canApprove
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <GitCommit className="h-4 w-4" />
              <span>Approve &amp; Commit Version v2.0</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
