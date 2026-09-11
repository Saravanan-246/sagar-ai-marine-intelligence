import React from "react";
import {
  Compass,
  UserCheck,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Anchor,
  AlertTriangle,
  CheckCircle2,
  Menu,
  X,
  Layers,
  FlaskConical,
} from "lucide-react";
import { useDecisionStore } from "../../store/decisionStore";
import { Link } from "react-router-dom";

export default function TopBar() {
  const {
    decision,
    rightPanelOpen,
    toggleRightPanel,
    toggleMobileSidebar,
    toggleMobileContext,
    mobileSidebarOpen,
    resetToInitial,
    currentScenario,
    setScenario,
    userRole,
    openRoleModal,
    committedCustomDecision,
  } = useDecisionStore();

  const isImpacted = decision.status === "IMPACTED" || decision.status === "DISRUPTION_DETECTED";
  const isRepaired = decision.status === "REPAIRED_COMMITTED";
  const isDraft = decision.status === "DRAFT";

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-4 lg:px-6 shadow-xs select-none">
      {/* Brand & Mobile Drawer Toggles */}
      <div className="flex items-center gap-2.5">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={toggleMobileSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden"
          title="Toggle Navigation Menu"
        >
          {mobileSidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        <Link
          to="/"
          title="Return to Overview"
          className="flex items-center gap-2 group transition"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white shadow-xs group-hover:bg-blue-700 transition">
            <Anchor className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-slate-900">
                Sagar AI
              </span>
              <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider text-blue-700">
                SIH 26176
              </span>
            </div>
            <p className="text-[10px] leading-none text-slate-500 hidden sm:block">
              Marine Decision Continuity System
            </p>
          </div>
        </Link>

        <div className="h-5 w-px bg-slate-200 hidden md:block mx-1" />

        {/* Current Workspace Info */}
        <div className="hidden md:flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
            Workspace
          </span>
          <span className="text-xs font-semibold text-slate-800 truncate max-w-[240px]" title={decision.title || "Coastal Survey Operation 01"}>
            {decision.title || "Coastal Survey Operation 01"} ({decision.dataSourceType || "SIMULATED"})
          </span>
        </div>
      </div>

      {/* Center: Current Decision Status Banner & Scenario Selector */}
      <div className="hidden lg:flex items-center gap-3">
        {/* Scenario Selector: Demonstrating Research Limitations */}
        <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">
          <FlaskConical className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-[11px] font-semibold text-slate-700">Scenario:</span>
          <select
            value={currentScenario}
            onChange={(e) => setScenario(e.target.value)}
            className="rounded bg-white border border-slate-200 text-[11px] font-medium text-slate-800 px-2 py-0.5 focus:outline-hidden"
          >
            {committedCustomDecision && (
              <option value="custom_committed">
                Committed Plan: {committedCustomDecision.departurePort.split(" ")[0]} → {committedCustomDecision.destinationPort.split(" ")[0]}
              </option>
            )}
            <option value="standard_s3_breach">Demo Benchmark: Coastal Survey 01 (S3 Breach)</option>
            <option value="catastrophic_collapse">Demo Benchmark: Catastrophic Collapse (Multi-Sector)</option>
          </select>
        </div>

        {/* Status indicator badge */}
        {isDraft && (
          <div className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span>{decision.version} • Draft Review</span>
          </div>
        )}

        {isImpacted && (
          <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>{decision.version} • Disruption Review Active</span>
          </div>
        )}

        {isRepaired && (
          <div className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>{decision.version} • Committed &amp; Continuity Preserved</span>
          </div>
        )}
      </div>

      {/* Right User & Utility Controls */}
      <div className="flex items-center gap-2">
        {/* Reset State button */}
        <button
          onClick={resetToInitial}
          title="Reset to Initial Benchmark State"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
        >
          <RotateCcw className="h-3 w-3 text-slate-500" />
          <span className="hidden sm:inline">Reset State</span>
        </button>

        {/* User Identity / Role Selector Trigger */}
        <button
          onClick={openRoleModal}
          title="Click to Switch Operational Sign-Off Role"
          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 px-2 py-1 transition cursor-pointer"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <UserCheck className="h-3 w-3" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-semibold text-slate-900 leading-tight flex items-center gap-1.5">
              <span>{userRole?.name || "Decision Owner"}</span>
              <span className="text-[9px] font-bold px-1 rounded bg-blue-100 text-blue-800">
                {userRole?.badge || "Role"}
              </span>
            </div>
            <div className="text-[9px] text-slate-500 leading-tight truncate max-w-[130px]">
              {userRole?.title || "Passage Planning & Operations"}
            </div>
          </div>
        </button>

        {/* Toggle Right Context Panel (Desktop & Tablet) */}
        <button
          onClick={toggleRightPanel}
          title={rightPanelOpen ? "Collapse Context Panel" : "Expand Context Panel"}
          className={`hidden lg:flex h-8 w-8 items-center justify-center rounded-md border transition ${
            rightPanelOpen
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {rightPanelOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </button>

        {/* Mobile Context Panel Drawer Toggle */}
        <button
          onClick={toggleMobileContext}
          title="Toggle Context Panel"
          className="flex lg:hidden h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          <Layers className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
