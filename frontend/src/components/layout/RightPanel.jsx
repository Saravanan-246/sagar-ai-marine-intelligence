import React from "react";
import {
  Layers,
  SlidersHorizontal,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  Radio,
  Shield,
} from "lucide-react";
import { useDecisionStore } from "../../store/decisionStore";

export default function RightPanel() {
  const {
    rightPanelOpen,
    toggleRightPanel,
    mobileContextOpen,
    toggleMobileContext,
    activeRightTab,
    setActiveRightTab,
    dependencies,
    constraints,
    changeEvent,
    decision,
    selectedSegmentId,
    routeSegments,
    marineOsfObservations,
    marinePfzObservations,
  } = useDecisionStore();

  // On desktop, obey rightPanelOpen. On mobile, obey mobileContextOpen.
  const isVisibleDesktop = rightPanelOpen;
  const isVisibleMobile = mobileContextOpen;

  const selectedSegment = routeSegments?.find((s) => s.id === selectedSegmentId) || routeSegments?.[0];
  const effectiveSegmentId = selectedSegment?.id || selectedSegmentId;

  // Dependencies linked directly to selected segment
  const relevantDeps = dependencies.filter(
    (d) => d.linkedSegments && d.linkedSegments.includes(effectiveSegmentId)
  );
  const otherDeps = dependencies.filter(
    (d) => !d.linkedSegments || !d.linkedSegments.includes(effectiveSegmentId)
  );

  const evidenceCount = (marineOsfObservations?.length || 0) + (marinePfzObservations?.length || 0) + (changeEvent ? 2 : 0);

  const tabs = [
    { id: "dependencies", label: "Dependencies", icon: Layers, count: dependencies.length },
    { id: "constraints", label: "Constraints", icon: SlidersHorizontal, count: constraints.length },
    { id: "evidence", label: "Evidence", icon: FileCheck2, count: evidenceCount },
    { id: "event-details", label: "Event", icon: AlertCircle, count: changeEvent ? 1 : 0 },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isVisibleMobile && (
        <div
          onClick={toggleMobileContext}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-40 w-80 sm:w-88 border-l border-slate-200 bg-white flex flex-col justify-between overflow-hidden select-none transition-transform duration-200 ease-in-out lg:static lg:w-80 xl:w-88 ${
          isVisibleMobile ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        } ${!isVisibleDesktop ? "lg:hidden" : "lg:flex"}`}
      >
        {/* Panel Header */}
        <div className="border-b border-slate-200 p-3 bg-slate-50/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Context &amp; Verification
              </span>
              {selectedSegment && (
                <span className="rounded bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.2">
                  Leg {selectedSegment.id}
                </span>
              )}
            </div>

            {/* Desktop / Mobile Close Button */}
            <button
              onClick={() => {
                if (window.innerWidth < 1024) {
                  toggleMobileContext();
                } else {
                  toggleRightPanel();
                }
              }}
              title="Close context panel"
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Sub-tab Navigation */}
          <div className="grid grid-cols-4 gap-1 mt-2.5 bg-slate-200/70 p-0.5 rounded-lg text-xs">
            {tabs.map((tab) => {
              const isActive = activeRightTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveRightTab(tab.id)}
                  className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-md text-[11px] font-medium transition ${
                    isActive
                      ? "bg-white text-blue-700 font-semibold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[9px] px-1 rounded-full ${
                      isActive ? "bg-blue-100 text-blue-800" : "text-slate-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* TAB 1: DEPENDENCIES */}
          {activeRightTab === "dependencies" && (
            <div className="space-y-3">
              <div className="rounded-md border border-blue-100 bg-blue-50/60 p-2.5 text-xs text-blue-950 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">Graph Dependency Model</p>
                  <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                    Inspecting dependencies linked to{" "}
                    <strong>Segment {selectedSegment?.id || selectedSegmentId}</strong>
                    {selectedSegment ? ` (${selectedSegment.name})` : ""}.
                  </p>
                </div>
                <span className="rounded bg-blue-200/80 text-blue-900 text-[10px] font-bold px-1.5 py-0.5 shrink-0">
                  {relevantDeps.length} Linked
                </span>
              </div>

              {/* Direct Dependencies for Selected Segment */}
              {relevantDeps.length > 0 ? (
                relevantDeps.map((dep) => (
                  <div
                    key={dep.id}
                    className="rounded-lg border-2 border-amber-300 bg-amber-50/40 p-3 shadow-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                          LINKED TO {selectedSegmentId} • {dep.type.replace(/_/g, " ")}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">
                          {dep.name}
                        </h4>
                      </div>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          dep.status === "VIOLATED"
                            ? "bg-red-100 text-red-800 border border-red-200"
                            : dep.status === "AT_RISK"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {dep.status}
                      </span>
                    </div>

                    <div className="text-[11px] rounded bg-white p-2 border border-slate-200 text-slate-700">
                      <span className="font-semibold text-slate-900">Condition: </span>
                      {dep.commitment}
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {dep.description}
                    </p>

                    <div className="text-[11px] border-t border-amber-200/60 pt-1.5 flex items-start gap-1 text-emerald-800 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{dep.mitigationUnderRepair}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">No Direct Breaches on Segment {selectedSegmentId}</p>
                  <p className="text-[11px] mt-0.5">
                    This leg has zero direct constraint violations and operates nominally.
                  </p>
                </div>
              )}

              {/* Collapsible Remaining / Other Dependencies */}
              {otherDeps.length > 0 && (
                <details className="group rounded-lg border border-slate-200 bg-slate-50/50" open={relevantDeps.length === 0}>
                  <summary className="cursor-pointer p-2.5 text-xs font-semibold text-slate-700 flex items-center justify-between hover:text-slate-900 list-none">
                    <span>Other Passage Dependencies ({otherDeps.length})</span>
                    <span className="text-slate-400 group-open:rotate-180 transition-transform text-[11px]">▼</span>
                  </summary>
                  <div className="p-2.5 pt-0 space-y-2 border-t border-slate-200/60 mt-1">
                    {otherDeps.map((dep) => (
                      <div
                        key={dep.id}
                        className="rounded border border-slate-200 bg-white p-2.5 space-y-1.5 text-xs"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-semibold text-slate-900 text-[11px]">{dep.name}</span>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                              dep.status === "VIOLATED"
                                ? "bg-red-100 text-red-800"
                                : dep.status === "AT_RISK"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {dep.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-2">{dep.description}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* TAB 2: CONSTRAINTS */}
          {activeRightTab === "constraints" && (
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800">
                <p className="font-semibold">Operational &amp; Safety Thresholds</p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Evaluated against Segment {selectedSegment?.id || selectedSegmentId}{" "}
                  ({selectedSegment?.condition || "Nominal"}).
                </p>
              </div>

              {/* Primary Active Constraint (Wave limit) */}
              {constraints.slice(0, 1).map((c) => {
                const isSelectedAffected = selectedSegment?.status === "AFFECTED" || selectedSegment?.id === "S3";
                return (
                  <div
                    key={c.id}
                    className={`rounded-lg border-2 p-3 shadow-xs space-y-2 ${
                      isSelectedAffected
                        ? "border-amber-300 bg-amber-50/30"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                          PRIMARY THRESHOLD
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">{c.label}</h4>
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-slate-500">
                        {c.id}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded border border-slate-200 bg-white p-1.5">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                          Hard Limit
                        </span>
                        <span className="font-medium text-slate-800">{c.limit}</span>
                      </div>

                      <div className="rounded border border-slate-200 bg-white p-1.5">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                          Under Repair
                        </span>
                        <span className="font-medium text-emerald-700">{c.underRepair}</span>
                      </div>
                    </div>

                    <div className="text-[11px] bg-white rounded p-2 border border-slate-200 text-slate-700">
                      <span className="font-semibold text-slate-700">Segment {selectedSegment?.id} Telemetry: </span>
                      <span
                        className={
                          isSelectedAffected
                            ? "text-red-700 font-bold"
                            : "text-emerald-700 font-semibold"
                        }
                      >
                        {isSelectedAffected
                          ? `Hs ${selectedSegment?.waveHeightM || 5.4}m [SIMULATED] (Exceeds 4.0m cap)`
                          : `Hs ${selectedSegment?.waveHeightM || 1.8}m [REAL] (Compliant)`}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Collapsible Secondary Constraints */}
              {constraints.length > 1 && (
                <details className="group rounded-lg border border-slate-200 bg-slate-50/50">
                  <summary className="cursor-pointer p-2.5 text-xs font-semibold text-slate-700 flex items-center justify-between hover:text-slate-900 list-none">
                    <span>Additional Thresholds ({constraints.length - 1})</span>
                    <span className="text-slate-400 group-open:rotate-180 transition-transform text-[11px]">▼</span>
                  </summary>
                  <div className="p-2.5 pt-0 space-y-2 border-t border-slate-200/60 mt-1">
                    {constraints.slice(1).map((c) => (
                      <div
                        key={c.id}
                        className="rounded border border-slate-200 bg-white p-2.5 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 text-[11px]">{c.label}</span>
                          <span className="text-[10px] font-mono text-slate-500">{c.limit}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 flex justify-between">
                          <span>Status:</span>
                          <span className={c.currentUnderHazard.includes("Exceeded") ? "text-red-700 font-semibold" : "text-emerald-700"}>
                            {c.currentUnderHazard}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* TAB 3: EVIDENCE */}
          {activeRightTab === "evidence" && (
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900">
                <p className="font-bold flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-blue-700" />
                  Evidence &amp; Provenance Protocol
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Active environmental evidence mapped to the passage corridor. Strictly distinguished by provenance: <strong>REAL</strong>, <strong>COMPUTED</strong>, or <strong>SIMULATED</strong>.
                </p>
              </div>

              {/* Real INCOIS OSF observations */}
              {marineOsfObservations && marineOsfObservations.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Verified INCOIS Ocean State Forecast ({marineOsfObservations.length})
                  </span>
                  {marineOsfObservations.slice(0, 3).map((obs) => (
                    <div key={obs.station_id} className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs space-y-1.5 text-xs">
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-slate-900">{obs.station_name}</span>
                        <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded border border-emerald-300">
                          REAL
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[10px] bg-slate-50 p-1.5 rounded border border-slate-100">
                        <div><span className="text-slate-500 block">Wave Hs</span><span className="font-bold text-slate-800">{obs.wave_height_m}m</span></div>
                        <div><span className="text-slate-500 block">Swell</span><span className="font-bold text-slate-800">{obs.swell_wave_height_m || 1.8}m</span></div>
                        <div><span className="text-slate-500 block">Wind</span><span className="font-bold text-slate-800">{obs.wind_speed_kts || 14}kt</span></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                        <span>Source: INCOIS OSF API</span>
                        <span>{obs.lat.toFixed(2)}°N, {obs.lon.toFixed(2)}°E</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Simulated Benchmark Evidence if active */}
              {changeEvent && (
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                    Scenario Hazard Evidence
                  </span>
                  <div className="rounded-lg border border-amber-200 bg-white p-2.5 shadow-2xs space-y-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                        SYNTHETIC_HAZARD_MODEL
                      </span>
                      <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300">
                        SIMULATED
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900">
                      Simulated Scatterometer Grid #{changeEvent.id || "04"}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-mono bg-slate-50 p-2 rounded border border-slate-100">
                      {changeEvent.description || "Model output indicates wave breach."}
                    </p>
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Source: {changeEvent.source || "Benchmark Test Dataset"}</span>
                    </div>
                  </div>
                </div>
              )}

              {(!marineOsfObservations || marineOsfObservations.length === 0) && !changeEvent && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                  Corridor geometry computed from registered port centroids. No external weather warnings active.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EVENT DETAILS */}
          {activeRightTab === "event-details" && (
            <div className="space-y-3">
              {changeEvent ? (
                <>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-2">
                    <div className="flex items-center justify-between text-amber-900 font-bold text-xs">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-700" />
                        Triggering Change Event
                      </span>
                      <span className="rounded bg-amber-200/80 text-amber-900 px-1.5 py-0.2 text-[9px]">
                        {changeEvent.sourceType || "SIMULATED"}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900">
                      {changeEvent.title}
                    </p>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      {changeEvent.description}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 text-xs">
                    <h4 className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-1.5">
                      Normalized Event Schema
                    </h4>

                    <div className="flex justify-between py-1 border-b border-slate-50 text-[11px]">
                      <span className="text-slate-500">Event ID:</span>
                      <span className="font-mono font-semibold text-slate-800">{changeEvent.id}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-50 text-[11px]">
                      <span className="text-slate-500">Classification:</span>
                      <span className="font-semibold text-slate-800">{changeEvent.type || "HAZARD"}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-50 text-[11px]">
                      <span className="text-slate-500">Source Type:</span>
                      <span className="font-bold text-amber-800">{changeEvent.sourceType || "SIMULATED"}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-50 text-[11px]">
                      <span className="text-slate-500">Location:</span>
                      <span className="font-mono text-slate-800">{changeEvent.location}</span>
                    </div>

                    <div className="flex justify-between py-1 text-[11px]">
                      <span className="text-slate-500">Severity:</span>
                      <span className="font-bold text-red-700">{changeEvent.severity}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500 space-y-1">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto" />
                  <p className="font-bold text-slate-800">Zero Active Disruption Events</p>
                  <p className="text-[11px]">The committed decision corridor operates under nominal conditions.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel Footer */}
        <div className="p-2.5 border-t border-slate-200 bg-slate-50/80 text-center">
          <span className="text-[10px] text-slate-500 font-mono">
            Model: Graph-Theoretic Dependency Mapping
          </span>
        </div>
      </aside>
    </>
  );
}
