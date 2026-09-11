import React, { useEffect } from "react";
import TopBar from "../components/layout/TopBar";
import Sidebar from "../components/layout/Sidebar";
import RightPanel from "../components/layout/RightPanel";
import DecisionHeader from "../components/workspace/DecisionHeader";
import MarineMap from "../components/map/MarineMap";
import SegmentTimeline from "../components/workspace/SegmentTimeline";
import RepairQueueView from "../components/workspace/RepairQueueView";
import ImpactAnalysisView from "../components/workspace/ImpactAnalysisView";
import ChangeEventsView from "../components/workspace/ChangeEventsView";
import DecisionHistoryView from "../components/workspace/DecisionHistoryView";
import StakeholderImpactsView from "../components/workspace/StakeholderImpactsView";
import HumanApprovalModal from "../components/workspace/HumanApprovalModal";
import DecisionBuilderModal from "../components/workspace/DecisionBuilderModal";
import RoleSelectionModal from "../components/workspace/RoleSelectionModal";
import { useDecisionStore } from "../store/decisionStore";
import { CheckCircle2, AlertTriangle, X, ShieldCheck, ArrowRight, AlertOctagon, Users } from "lucide-react";

export default function WorkspacePage() {
  const {
    activeNav,
    setActiveNav,
    approvalFeedback,
    clearFeedback,
    decision,
    routeSegments,
    changeEvent,
    selectedRepairId,
    repairCandidates,
    openApprovalModal,
    currentScenario,
    selectedSegmentId,
    setSelectedSegmentId,
    fetchMarineData,
    isRoleModalOpen,
    closeRoleModal,
    userRole,
  } = useDecisionStore();

  useEffect(() => {
    fetchMarineData();
  }, [fetchMarineData]);

  const isImpacted = decision.status === "IMPACTED" || decision.status === "DISRUPTION_DETECTED";
  const activeCandidate = repairCandidates.find((r) => r.id === selectedRepairId) || repairCandidates[0];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100/70 text-slate-900 font-sans antialiased">
      {/* Top Application Shell Header */}
      <TopBar />

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Navigation Sidebar (Desktop + Mobile Drawer) */}
        <Sidebar />

        {/* Center Main Content Region */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-5 space-y-4 min-w-0">
          {/* Action / Approval Feedback Banner */}
          {approvalFeedback && (
            <div
              className={`rounded-xl border p-3.5 sm:p-4 shadow-xs flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
                approvalFeedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50/90 text-emerald-950"
                  : "border-amber-200 bg-amber-50/90 text-amber-950"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {approvalFeedback.type === "success" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-xs font-bold leading-tight">
                    {approvalFeedback.title}
                  </h4>
                  <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                    {approvalFeedback.message}
                  </p>
                  <span className="text-[10px] font-mono opacity-70 mt-1 block">
                    Logged at {approvalFeedback.timestamp}
                  </span>
                </div>
              </div>

              <button
                onClick={clearFeedback}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition"
                title="Dismiss feedback"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ACTIVE DECISION VIEW (PRIMARY WORKSPACE) */}
          {activeNav === "active-decisions" && (
            <div className="space-y-4">
              {/* Decision Header answering the 5 UX questions */}
              <DecisionHeader />

              {/* Segment Timeline Sequence */}
              <SegmentTimeline />

              {/* Provider-Independent Nautical Map Component */}
              <MarineMap
                segments={routeSegments}
                selectedSegmentId={selectedSegmentId}
                onSelectSegment={setSelectedSegmentId}
                changeEvent={changeEvent}
                selectedRepairId={selectedRepairId}
                decision={decision}
              />


              {/* Operational Approval Action Dock */}
              {isImpacted && (
                <div
                  className={`rounded-xl border p-3.5 sm:p-4 shadow-xs transition ${
                    currentScenario === "catastrophic_collapse"
                      ? "border-red-300 bg-red-50/70"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-blue-600" />
                          {currentScenario === "catastrophic_collapse"
                            ? "Operational Continuity Interruption"
                            : `Candidate ${activeCandidate.id}: ${activeCandidate.title}`}
                        </span>
                        <span className="rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5">
                          PENDING HUMAN APPROVAL
                        </span>
                      </div>

                      {currentScenario === "catastrophic_collapse" ? (
                        <p className="text-xs text-red-900 leading-snug">
                          No safe minimal repair exists. Multiple core dependencies are violated. Broader replanning is required.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                          <div className="bg-slate-50 border border-slate-200/80 rounded-md p-2">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Preservation</span>
                            <span className="font-bold text-emerald-700">
                              {Math.round((activeCandidate.preservationRatio || 0.8) * 100)}% Plan Preserved
                            </span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200/80 rounded-md p-2">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Plan Churn</span>
                            <span className="font-bold text-slate-800">
                              {Math.round((activeCandidate.planChurn || 0.2) * 100)}% Churn
                            </span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200/80 rounded-md p-2 col-span-2">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Consequence &amp; Trade-offs</span>
                            <span className="font-semibold text-slate-900 line-clamp-1" title={activeCandidate.tradeoffs}>
                              {activeCandidate.tradeoffs || "+38 min delay • Preserves Tuticorin Berth • Roll ≤5.8°"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                      <button
                        onClick={() => setActiveNav("repair-queue")}
                        className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
                      >
                        Compare Candidates
                      </button>

                      {userRole?.id === "stakeholder_view" ? (
                        <button
                          onClick={() => setActiveNav("stakeholder-view")}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs transition cursor-pointer"
                        >
                          <Users className="h-4 w-4" />
                          <span>View Stakeholder Impacts</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        currentScenario !== "catastrophic_collapse" && (
                          <button
                            onClick={openApprovalModal}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition cursor-pointer"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            <span>
                              {userRole?.id === "approval_authority" ? "Review & Sign Approval" : "Inspect Approval Gate"}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CHANGE EVENTS VIEW */}
          {activeNav === "change-events" && <ChangeEventsView />}

          {/* IMPACT ANALYSIS VIEW */}
          {activeNav === "impact-analysis" && <ImpactAnalysisView />}

          {/* REPAIR QUEUE VIEW */}
          {activeNav === "repair-queue" && <RepairQueueView />}

          {/* STAKEHOLDER IMPACTS VIEW */}
          {activeNav === "stakeholder-view" && <StakeholderImpactsView />}

          {/* DECISION HISTORY VIEW */}
          {activeNav === "decision-history" && <DecisionHistoryView />}
        </main>

        {/* Right Contextual Intelligence Panel (Desktop + Mobile Drawer) */}
        <RightPanel />
      </div>

      {/* Enforced Non-Autonomous Human Approval Modal */}
      <HumanApprovalModal />

      {/* From -> To Decision Builder Modal */}
      <DecisionBuilderModal />

      {/* Role Selection Modal */}
      <RoleSelectionModal isOpen={isRoleModalOpen} onClose={closeRoleModal} />
    </div>
  );
}
