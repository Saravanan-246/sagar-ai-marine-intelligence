import React, { useState } from "react";
import {
  FilePlus2,
  Navigation,
  Radio,
  Network,
  Wrench,
  History,
  Activity,
  ShieldCheck,
  X,
  Info,
  Users,
} from "lucide-react";
import { useDecisionStore } from "../../store/decisionStore";

export default function Sidebar() {
  const {
    activeNav,
    setActiveNav,
    decision,
    mobileSidebarOpen,
    toggleMobileSidebar,
    openDecisionBuilder,
    changeEvent,
    routeSegments,
    repairCandidates,
    currentScenario,
    committedCustomDecision,
    userRole,
    stakeholderAwareness,
  } = useDecisionStore();

  const isImpacted = decision.status === "IMPACTED" || decision.status === "DISRUPTION_DETECTED";
  const isRepaired = decision.status === "REPAIRED_COMMITTED";
  const affectedCount = changeEvent
    ? routeSegments.filter((s) => s.status === "AFFECTED" || (decision.dataSourceType === "SIMULATED" && s.id === "S3" && !isRepaired)).length
    : 0;

  const navItems = [
    {
      id: "active-decisions",
      label: "Active Decisions",
      icon: Navigation,
      badge: isImpacted ? "1 Disrupted" : isRepaired ? "1 Repaired" : "1 Committed",
      badgeClass: isImpacted
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : isRepaired
        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
        : "bg-blue-100 text-blue-800 border-blue-200",
    },
    {
      id: "change-events",
      label: "Change Events",
      icon: Radio,
      badge: changeEvent ? (changeEvent.isCatastrophic ? "Critical Alert" : "1 Ingested") : "0 Events",
      badgeClass: changeEvent?.isCatastrophic
        ? "bg-red-100 text-red-800 border-red-200"
        : "bg-amber-100 text-amber-800 border-amber-200",
    },
    {
      id: "impact-analysis",
      label: "Impact Analysis",
      icon: Network,
      badge: `${affectedCount} Affected`,
      badgeClass: affectedCount > 0 ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-slate-100 text-slate-700 border-slate-200",
    },
    {
      id: "repair-queue",
      label: "Repair Queue",
      icon: Wrench,
      badge: currentScenario === "catastrophic_collapse" ? "0 Feasible" : `${repairCandidates.length} Candidates`,
      badgeClass: currentScenario === "catastrophic_collapse" ? "bg-red-100 text-red-800 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      id: "stakeholder-view",
      label: "Stakeholder Impacts",
      icon: Users,
      badge: stakeholderAwareness?.acknowledged ? "Logged" : "Multi-Sector",
      badgeClass: stakeholderAwareness?.acknowledged
        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
        : "bg-indigo-100 text-indigo-800 border-indigo-200",
    },
    {
      id: "decision-history",
      label: "Decision History",
      icon: History,
      badge: null,
      badgeClass: "",
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={toggleMobileSidebar}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col justify-between select-none transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-3 space-y-3">
          {/* Mobile Header Close */}
          <div className="flex items-center justify-between lg:hidden pb-1 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800">Navigation</span>
            <button
              onClick={toggleMobileSidebar}
              className="p-1 text-slate-500 hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Active Operational Perspective */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500">
                Operational Role
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-200">
                {userRole?.badge || "Active"}
              </span>
            </div>
            <div className="text-xs font-bold text-slate-900 truncate" title={userRole?.name}>
              {userRole?.name || "Decision Owner"}
            </div>
            <p className="text-[10px] text-slate-500 line-clamp-1 leading-tight" title={userRole?.clearance}>
              {userRole?.clearance || "Operational Perspective"}
            </p>
          </div>

          {/* Action Button: New Decision (Gated by Role Permission) */}
          <div>
            {userRole?.permissions?.canCreateDecision ? (
              <button
                onClick={openDecisionBuilder}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-blue-300 bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-2xs cursor-pointer"
                title="Construct a new passage decision context"
              >
                <FilePlus2 className="h-4 w-4 text-white" />
                <span>+ New Decision</span>
              </button>
            ) : (
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-400 cursor-not-allowed"
                title="Decision creation restricted to Decision Owner role"
              >
                <FilePlus2 className="h-4 w-4 text-slate-400" />
                <span>+ New Decision</span>
                <span className="text-[9px] text-slate-400 font-normal">(Owner only)</span>
              </button>
            )}
          </div>

          {/* Navigation links */}
          <nav className="space-y-1">
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Continuity Modules
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition ${
                    isActive
                      ? "bg-blue-600 text-white font-semibold shadow-xs"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-white" : "text-slate-500"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                        isActive
                          ? "bg-white/20 text-white border-white/30"
                          : item.badgeClass
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Operational Feeds & Data Status (Explicitly labeled SIMULATED, no fake claims) */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-blue-600" />
              Data Source Status
            </span>
            <span className={`text-[9px] font-bold border px-1.5 py-0.2 rounded ${
              committedCustomDecision
                ? "text-blue-800 bg-blue-100 border-blue-300"
                : "text-amber-800 bg-amber-100 border-amber-300"
            }`}>
              {committedCustomDecision ? "COMPUTED" : "SIMULATED"}
            </span>
          </div>

          <div className="space-y-1 text-[11px] text-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Mode:</span>
              <span className="font-mono text-slate-800 font-semibold truncate max-w-[130px]" title={committedCustomDecision ? `${committedCustomDecision.departurePort.split(" ")[0]} → ${committedCustomDecision.destinationPort.split(" ")[0]}` : "Benchmark Testbench"}>
                {committedCustomDecision
                  ? `${committedCustomDecision.departurePort.split(" ")[0]} → ${committedCustomDecision.destinationPort.split(" ")[0]}`
                  : "Benchmark Testbench"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Planning Speed:</span>
              <span className="font-mono text-slate-800">
                {committedCustomDecision ? `${decision.plannedSpeedKts || 16.5} kts (Planning Assumption)` : "18.5 kts (Benchmark)"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Hazard Feed:</span>
              <span className="font-mono text-slate-800">
                {committedCustomDecision ? "Real INCOIS Feeds" : currentScenario === "catastrophic_collapse" ? "Multi-Zone Crisis" : "Synthetic Model"}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/80 flex items-center gap-1.5 text-[10px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>Invariant: Non-Autonomous Human Sign-Off Enforced</span>
          </div>
        </div>
      </aside>
    </>
  );
}
