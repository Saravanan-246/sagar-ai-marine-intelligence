import React, { useState, useEffect, useMemo } from "react";
import {
  FilePlus2,
  MapPin,
  Compass,
  ArrowRight,
  AlertTriangle,
  Info,
  Waves,
  Fish,
  Radio,
  Clock,
  ShieldCheck,
  Lock,
  X,
  Search,
  Gauge,
} from "lucide-react";
import { useDecisionStore } from "../../store/decisionStore";
import {
  VERIFIED_COASTAL_LOCATIONS,
  DECISION_TYPES,
} from "../../data/coastalLocations";
import {
  validateDecisionBuilderForm,
  calculatePlanningRouteContext,
} from "../../data/decisionBuilderModel";

export default function DecisionBuilderModal() {
  const {
    isDecisionBuilderOpen,
    closeDecisionBuilder,
    createDraftDecision,
    commitDraftDecision,
    draftDecision,
    userRole,
    marineRegistry,
    marineOsfObservations,
    marinePfzObservations,
  } = useDecisionStore();

  // Step 1: "INPUT", Step 2: "REVIEW"
  const [step, setStep] = useState("INPUT");

  // Form State — Strictly initialized empty per data-truth rules
  const [title, setTitle] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [departureTime, setDepartureTime] = useState(() => {
    const now = new Date();
    now.setHours(now.getHours() + 2);
    return now.toISOString().slice(0, 16);
  });
  const [decisionTypeId, setDecisionTypeId] = useState("COMMERCIAL_CARGO_TRANSIT");
  const [planningSpeedKts, setPlanningSpeedKts] = useState("16.0");

  // Search filters
  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");
  const [fromDropdownOpen, setFromDropdownOpen] = useState(false);
  const [toDropdownOpen, setToDropdownOpen] = useState(false);
  const [validationError, setValidationError] = useState("");

  // Reset form whenever modal opens to guarantee no prefilled or cached selections
  useEffect(() => {
    if (isDecisionBuilderOpen) {
      setStep("INPUT");
      setTitle("");
      setFromLocationId("");
      setToLocationId("");
      setFromSearch("");
      setToSearch("");
      setFromDropdownOpen(false);
      setToDropdownOpen(false);
      setValidationError("");
      setPlanningSpeedKts("16.0");
      const now = new Date();
      now.setHours(now.getHours() + 2);
      setDepartureTime(now.toISOString().slice(0, 16));
    }
  }, [isDecisionBuilderOpen]);

  const selectedDecisionType = useMemo(
    () => DECISION_TYPES.find((t) => t.id === decisionTypeId) || DECISION_TYPES[0],
    [decisionTypeId]
  );

  const fromPort = useMemo(
    () => VERIFIED_COASTAL_LOCATIONS.find((l) => l.id === fromLocationId) || null,
    [fromLocationId]
  );

  const toPort = useMemo(
    () => VERIFIED_COASTAL_LOCATIONS.find((l) => l.id === toLocationId) || null,
    [toLocationId]
  );

  const filteredFromPorts = useMemo(() => {
    if (!fromSearch.trim()) return VERIFIED_COASTAL_LOCATIONS;
    const q = fromSearch.toLowerCase();
    return VERIFIED_COASTAL_LOCATIONS.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.state.toLowerCase().includes(q) ||
        l.portCode.toLowerCase().includes(q)
    );
  }, [fromSearch]);

  const filteredToPorts = useMemo(() => {
    if (!toSearch.trim()) return VERIFIED_COASTAL_LOCATIONS;
    const q = toSearch.toLowerCase();
    return VERIFIED_COASTAL_LOCATIONS.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.state.toLowerCase().includes(q) ||
        l.portCode.toLowerCase().includes(q)
    );
  }, [toSearch]);

  // Instant reactive planning route context derived dynamically from user inputs
  const liveRouteContext = useMemo(() => {
    return calculatePlanningRouteContext({
      fromLocationId,
      toLocationId,
      planningSpeedKts,
      departureTime,
    });
  }, [fromLocationId, toLocationId, planningSpeedKts, departureTime]);

  if (!isDecisionBuilderOpen) return null;

  // Provenance determination from live backend state
  const isOsfReal =
    marineRegistry?.INCOIS_OSF?.status === "CONNECTED" ||
    marineRegistry?.INCOIS_OSF?.status === "STALE" ||
    marineOsfObservations?.length > 0;
  const osfStatus = marineRegistry?.INCOIS_OSF?.status || (marineOsfObservations?.length > 0 ? "CONNECTED" : "UNAVAILABLE");

  const isPfzReal =
    marineRegistry?.INCOIS_PFZ?.status === "CONNECTED" ||
    marineRegistry?.INCOIS_PFZ?.status === "STALE" ||
    marinePfzObservations?.length > 0;
  const pfzStatus = marineRegistry?.INCOIS_PFZ?.status || (marinePfzObservations?.length > 0 ? "CONNECTED" : "UNAVAILABLE");

  const handleSelectDecisionType = (type) => {
    setDecisionTypeId(type.id);
    if (type.defaultPlanningSpeedKts) {
      setPlanningSpeedKts(String(type.defaultPlanningSpeedKts));
    }
  };

  const handleProceedToReview = (e) => {
    e.preventDefault();
    setValidationError("");

    const validation = validateDecisionBuilderForm({
      fromLocationId,
      toLocationId,
      planningSpeedKts,
      departureTime,
    });

    if (!validation.isValid) {
      setValidationError(validation.error);
      return;
    }

    try {
      createDraftDecision({
        title: title.trim(),
        fromLocationId,
        toLocationId,
        departureTime,
        decisionTypeId,
        planningSpeedKts: Number(planningSpeedKts),
      });
      setStep("REVIEW");
    } catch (err) {
      setValidationError(err.message || "Failed to generate passage draft.");
    }
  };

  const handleCommit = () => {
    commitDraftDecision();
    setStep("INPUT");
    setFromLocationId("");
    setToLocationId("");
    setTitle("");
    setValidationError("");
  };

  const handleCancel = () => {
    closeDecisionBuilder();
    setStep("INPUT");
    setValidationError("");
  };

  const isFormSubmittable =
    Boolean(fromLocationId) &&
    Boolean(toLocationId) &&
    fromLocationId !== toLocationId &&
    Number(planningSpeedKts) >= 3 &&
    Number(planningSpeedKts) <= 40;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden select-none">
        {/* ── Dialog Header (Truthful Title & Subtext) ────────────────── */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <FilePlus2 className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  {step === "INPUT"
                    ? "Construct a provenance-aware marine decision context"
                    : "Review Decision Context & Passage Plan"}
                </h2>
                <span className="rounded bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.2 text-[9px] font-bold">
                  {step === "INPUT" ? "STEP 1 OF 2: PLANNING PARAMETERS" : "STEP 2 OF 2: DRAFT CONTEXT REVIEW"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {step === "INPUT"
                  ? "Build a planning decision from verified locations and available marine evidence."
                  : "Review computed planning corridor geometry, operational dependencies, and marine evidence before explicit commitment."}
              </p>
            </div>
          </div>

          <button
            onClick={handleCancel}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable Body ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {validationError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 animate-in fade-in duration-150">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* ════ STEP 1: PARAMETER SELECTION ════════════════════════════ */}
          {step === "INPUT" && (
            <form onSubmit={handleProceedToReview} className="space-y-4">
              {/* 1. FROM → TO Location Pickers (Starts strictly Empty) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    1. Verified Port Coordinates (Project Registry)
                  </label>
                  <span className="text-[10px] font-mono text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                    REAL LOCATION REGISTRY
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* FROM Location (Origin) */}
                  <div className="space-y-1 relative">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-blue-700">
                        <MapPin className="h-3.5 w-3.5 text-blue-600" />
                        <span>FROM (Departure Port)</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Origin Fix</span>
                    </label>

                    {fromPort ? (
                      <div
                        onClick={() => {
                          setFromDropdownOpen(!fromDropdownOpen);
                          setToDropdownOpen(false);
                        }}
                        className="p-3 rounded-xl border border-blue-300 bg-blue-50/40 hover:bg-blue-50/70 cursor-pointer transition space-y-1 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{fromPort.name}</span>
                          <span className="rounded bg-blue-200 text-blue-900 text-[9px] font-mono font-bold px-1.5 py-0.2">
                            {fromPort.portCode}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                          <span>{fromPort.coordinates[0].toFixed(2)}°N, {fromPort.coordinates[1].toFixed(2)}°E</span>
                          <span className="text-[10px] text-slate-500 font-sans">{fromPort.state}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-blue-700 font-medium pt-0.5">
                          <span>Channel: {fromPort.channelType}</span>
                          <span className="font-mono text-emerald-700">{fromPort.sourceProvenance}</span>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setFromDropdownOpen(true);
                          setToDropdownOpen(false);
                        }}
                        className="p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-blue-400 cursor-pointer transition text-slate-500 text-xs flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-slate-400" />
                          <span>Search &amp; select departure port (origin)...</span>
                        </span>
                        <span className="text-[10px] text-blue-600 font-bold">Select Port</span>
                      </div>
                    )}

                    {fromDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl border border-slate-300 bg-white p-2 shadow-lg space-y-1.5 max-h-56 overflow-y-auto">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md">
                          <Search className="h-3 w-3 text-slate-400" />
                          <input
                            type="text"
                            value={fromSearch}
                            onChange={(e) => setFromSearch(e.target.value)}
                            placeholder="Filter ports by name, state, code..."
                            className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden"
                            autoFocus
                          />
                        </div>
                        <div className="space-y-0.5">
                          {filteredFromPorts.map((loc) => (
                            <div
                              key={loc.id}
                              onClick={() => {
                                setFromLocationId(loc.id);
                                setFromDropdownOpen(false);
                                setFromSearch("");
                              }}
                              className={`p-2 rounded-md text-xs cursor-pointer flex items-center justify-between transition ${
                                loc.id === fromLocationId
                                  ? "bg-blue-600 text-white font-semibold"
                                  : "hover:bg-slate-100 text-slate-800"
                              }`}
                            >
                              <div>
                                <p className="font-bold leading-tight">{loc.name}</p>
                                <p className={`text-[10px] font-mono ${loc.id === fromLocationId ? "text-blue-100" : "text-slate-500"}`}>
                                  {loc.coordinates[0].toFixed(2)}°N, {loc.coordinates[1].toFixed(2)}°E • {loc.state}
                                </p>
                              </div>
                              <span className="text-[10px] font-mono opacity-80">{loc.portCode}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TO Location (Destination) */}
                  <div className="space-y-1 relative">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-emerald-700">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                        <span>TO (Destination Port)</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Terminus Fix</span>
                    </label>

                    {toPort ? (
                      <div
                        onClick={() => {
                          setToDropdownOpen(!toDropdownOpen);
                          setFromDropdownOpen(false);
                        }}
                        className="p-3 rounded-xl border border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/70 cursor-pointer transition space-y-1 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{toPort.name}</span>
                          <span className="rounded bg-emerald-200 text-emerald-900 text-[9px] font-mono font-bold px-1.5 py-0.2">
                            {toPort.portCode}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                          <span>{toPort.coordinates[0].toFixed(2)}°N, {toPort.coordinates[1].toFixed(2)}°E</span>
                          <span className="text-[10px] text-slate-500 font-sans">{toPort.state}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-emerald-700 font-medium pt-0.5">
                          <span>Channel: {toPort.channelType}</span>
                          <span className="font-mono text-emerald-700">{toPort.sourceProvenance}</span>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setToDropdownOpen(true);
                          setFromDropdownOpen(false);
                        }}
                        className="p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-emerald-400 cursor-pointer transition text-slate-500 text-xs flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-slate-400" />
                          <span>Search &amp; select destination port (destination)...</span>
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold">Select Port</span>
                      </div>
                    )}

                    {toDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl border border-slate-300 bg-white p-2 shadow-lg space-y-1.5 max-h-56 overflow-y-auto">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md">
                          <Search className="h-3 w-3 text-slate-400" />
                          <input
                            type="text"
                            value={toSearch}
                            onChange={(e) => setToSearch(e.target.value)}
                            placeholder="Filter ports by name, state, code..."
                            className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden"
                            autoFocus
                          />
                        </div>
                        <div className="space-y-0.5">
                          {filteredToPorts.map((loc) => (
                            <div
                              key={loc.id}
                              onClick={() => {
                                setToLocationId(loc.id);
                                setToDropdownOpen(false);
                                setToSearch("");
                              }}
                              className={`p-2 rounded-md text-xs cursor-pointer flex items-center justify-between transition ${
                                loc.id === toLocationId
                                  ? "bg-emerald-600 text-white font-semibold"
                                  : "hover:bg-slate-100 text-slate-800"
                              }`}
                            >
                              <div>
                                <p className="font-bold leading-tight">{loc.name}</p>
                                <p className={`text-[10px] font-mono ${loc.id === toLocationId ? "text-emerald-100" : "text-slate-500"}`}>
                                  {loc.coordinates[0].toFixed(2)}°N, {loc.coordinates[1].toFixed(2)}°E • {loc.state}
                                </p>
                              </div>
                              <span className="text-[10px] font-mono opacity-80">{loc.portCode}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Dynamic Computed Corridor Bar (Active ONLY when both ports are selected) */}
              {liveRouteContext && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-2 animate-in fade-in duration-150">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">
                        {liveRouteContext.fromPort.shortName} → {liveRouteContext.toPort.shortName}
                      </span>
                      <span className="rounded bg-blue-200 text-blue-900 font-mono text-[9px] font-bold px-1.5 py-0.2">
                        COMPUTED PLANNING CORRIDOR
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                      <span className={`px-1.5 py-0.2 rounded border ${isOsfReal ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        OSF: {isOsfReal ? (osfStatus === "STALE" ? "REAL · CACHED" : "REAL") : "UNAVAILABLE"}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded border ${isPfzReal ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        PFZ: {isPfzReal ? (pfzStatus === "STALE" ? "REAL · CACHED" : "REAL") : "UNAVAILABLE"}
                      </span>
                      <span className="px-1.5 py-0.2 rounded border bg-slate-100 text-slate-600 border-slate-200" title="DGLL coastal security restrictions.">
                        AIS: UNAVAILABLE
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border-t border-blue-200/70 pt-2 text-slate-700">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Great-Circle Distance</span>
                      <span className="font-bold text-blue-800 font-mono">{liveRouteContext.totalDistanceNm} NM</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Transit Duration</span>
                      <span className="font-bold text-slate-900 font-mono">~{liveRouteContext.durationHours} hours</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Planning Legs</span>
                      <span className="font-bold text-slate-900 font-mono">{liveRouteContext.segments.length} legs</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Estimated Arrival (UTC)</span>
                      <span className="font-bold text-emerald-700 font-mono text-[11px] truncate block" title={liveRouteContext.etaUtc}>
                        {liveRouteContext.etaUtc}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 italic">
                    {liveRouteContext.geometryDisclaimer}
                  </p>
                </div>
              )}

              {/* 3. Departure Time & Planning Speed */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Departure Time */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-blue-600" />
                      <span>Departure Time</span>
                    </span>
                    <span className="text-[10px] font-mono text-blue-700 font-semibold">
                      Canonical UTC Stored
                    </span>
                  </label>
                  <input
                    type="datetime-local"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>Device Clock: {new Date(departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <span>UTC: {new Date(departureTime).toISOString().replace("T", " ").substring(0, 16)} UTC</span>
                  </div>
                </div>

                {/* Planning Speed (Explicitly labeled Planning Speed, not telemetry) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5 text-blue-600" />
                      <span>Planning Speed</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Knots (kts)
                    </span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="3"
                    max="40"
                    value={planningSpeedKts}
                    onChange={(e) => setPlanningSpeedKts(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                    required
                  />
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    Planning assumption used only for ETA calculation. Not live vessel telemetry.
                  </span>
                </div>
              </div>

              {/* 4. Operational Decision Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Operational Decision Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DECISION_TYPES.map((type) => (
                    <div
                      key={type.id}
                      onClick={() => handleSelectDecisionType(type)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition text-xs ${
                        decisionTypeId === type.id
                          ? "border-blue-600 bg-blue-50/60 font-semibold text-blue-950 shadow-2xs"
                          : "border-slate-200 hover:border-blue-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{type.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5 leading-snug">
                        {type.description}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <span className="text-slate-600">Profile: {type.planningProfile}</span>
                        <span className="text-blue-700">Default: {type.defaultPlanningSpeedKts} kts (assumption)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Passage Title / Custom Designation */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Passage Decision Name (Optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    fromPort && toPort
                      ? `${fromPort.shortName} to ${toPort.shortName} Passage`
                      : "e.g. Nhava Sheva to Kochi Commercial Transit"
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isFormSubmittable}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-xs font-semibold transition ${
                    isFormSubmittable
                      ? "bg-blue-600 text-white hover:bg-blue-700 shadow-xs cursor-pointer"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <span>Generate Decision Draft</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* ════ STEP 2: REVIEW DECISION CONTEXT (DRAFT) ══════════════════ */}
          {step === "REVIEW" && draftDecision && (
            <div className="space-y-4">
              {/* Status Alert Banner: DRAFT */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-950 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Clock className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900">
                        Decision Context Status: DRAFT (Uncommitted)
                      </h3>
                      <span className="rounded bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 text-[9px] font-bold font-mono">
                        {draftDecision.id}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-600 leading-relaxed">
                      This decision is in draft state. Existing committed operational decisions remain strictly untouched until explicit sign-off by <strong className="text-slate-800">{userRole?.title || "Officer"}</strong>.
                    </p>
                  </div>
                </div>

                <span className="rounded bg-blue-600 text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0">
                  DRAFT
                </span>
              </div>

              {/* Decision Metadata Summary */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{draftDecision.title}</h3>
                    <p className="text-xs text-slate-500">{draftDecision.objective}</p>
                  </div>
                  <span className="text-xs font-mono text-slate-600 font-semibold bg-slate-50 px-2 py-1 rounded border border-slate-200">
                    Planning Speed: {draftDecision.plannedSpeedKts} kts
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Origin [REAL]</span>
                    <span className="font-bold text-slate-800">{fromPort?.shortName}</span>
                    <span className="text-[10px] text-slate-500 block font-mono">{fromPort?.coordinates[0]}°N, {fromPort?.coordinates[1]}°E</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Destination [REAL]</span>
                    <span className="font-bold text-slate-800">{toPort?.shortName}</span>
                    <span className="text-[10px] text-slate-500 block font-mono">{toPort?.coordinates[0]}°N, {toPort?.coordinates[1]}°E</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Total Distance [COMPUTED]</span>
                    <span className="font-bold text-blue-700 font-mono">{draftDecision.totalDistanceNm} NM</span>
                    <span className="text-[10px] text-slate-500 block">{draftDecision.segments.length} Planning Legs</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Estimated Arrival [COMPUTED]</span>
                    <span className="font-bold text-emerald-700 font-mono">{draftDecision.originalEta}</span>
                    <span className="text-[10px] text-slate-500 block font-mono">Dep: {draftDecision.departureTime}</span>
                  </div>
                </div>
              </div>

              {/* Route Planning Corridor Section with Explicit Truth Notice */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5 text-blue-600" />
                    <span>Computed Planning Corridor ({draftDecision.segments.length} Legs)</span>
                  </h4>
                  <span className="text-[10px] font-mono text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    COMPUTED PLANNING CORRIDOR
                  </span>
                </div>

                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-800">Notice: </span>
                  {draftDecision.geometryDisclaimer}
                </div>

                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {draftDecision.segments.map((seg) => (
                    <div key={seg.id} className="py-2 flex items-center justify-between text-xs gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-800">
                          {seg.id}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{seg.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            [{seg.startCoord[0]}°N, {seg.startCoord[1]}°E] → [{seg.endCoord[0]}°N, {seg.endCoord[1]}°E]
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-800 font-mono">{seg.distanceNm} NM</span>
                        <span className="text-[10px] text-slate-500 block">Computed Leg</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Provenance-Aware Marine Evidence Status */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                    <span>Marine Evidence Availability &amp; Provenance</span>
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Backend Registry Verification
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {/* OSF */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <Waves className="h-3 w-3 text-blue-600" />
                        <span>INCOIS OSF</span>
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${isOsfReal ? (osfStatus === "STALE" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800") : "bg-slate-200 text-slate-700"}`}>
                        {isOsfReal ? (osfStatus === "STALE" ? "REAL · CACHED" : "REAL") : "UNAVAILABLE"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {isOsfReal ? "Real THREDDS wave forecast points connected." : "Backend THREDDS telemetry query pending."}
                    </p>
                  </div>

                  {/* PFZ */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <Fish className="h-3 w-3 text-emerald-600" />
                        <span>INCOIS PFZ</span>
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${isPfzReal ? (pfzStatus === "STALE" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800") : "bg-slate-200 text-slate-700"}`}>
                        {isPfzReal ? (pfzStatus === "STALE" ? "REAL · CACHED" : "REAL") : "UNAVAILABLE"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {isPfzReal ? "Real GeoServer fishing advisory lines connected." : "GeoServer WFS advisory query pending."}
                    </p>
                  </div>

                  {/* AIS */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <Radio className="h-3 w-3 text-slate-500" />
                        <span>DGLL Coastal AIS</span>
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 text-slate-700">
                        UNAVAILABLE
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      DGLL coastal security restriction. Zero fake vessel positions simulated.
                    </p>
                  </div>
                </div>
              </div>

              {/* Data Truth / Provenance Breakdown Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Data Truth &amp; Provenance Classification
                </span>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded bg-emerald-50 border border-emerald-200 p-2">
                    <span className="font-bold text-emerald-900 block">REAL DATA</span>
                    <span className="text-emerald-800 text-[10px] block mt-0.5">
                      Verified port coordinates &amp; INCOIS observations
                    </span>
                  </div>
                  <div className="rounded bg-blue-50 border border-blue-200 p-2">
                    <span className="font-bold text-blue-900 block">COMPUTED DATA</span>
                    <span className="text-blue-800 text-[10px] block mt-0.5">
                      Haversine distance, corridor legs, duration &amp; ETA
                    </span>
                  </div>
                  <div className="rounded bg-slate-100 border border-slate-200 p-2">
                    <span className="font-bold text-slate-800 block">UNAVAILABLE</span>
                    <span className="text-slate-600 text-[10px] block mt-0.5">
                      DGLL AIS traffic (coastal security)
                    </span>
                  </div>
                </div>
              </div>

              {/* Sign-Off Authorization Role */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                    ✓
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Sign-Off Officer Authority</span>
                    <span className="font-bold text-slate-800">{userRole?.name} ({userRole?.title})</span>
                  </div>
                </div>

                <span className="text-[11px] font-mono text-slate-500">
                  {userRole?.clearance}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep("INPUT")}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  ← Edit Parameters
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Discard Draft
                  </button>

                  <button
                    type="button"
                    disabled={userRole?.id !== "decision_owner"}
                    onClick={handleCommit}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-xs font-semibold shadow-xs transition ${
                      userRole?.id === "decision_owner"
                        ? "bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                    title={userRole?.id === "decision_owner" ? "Commit Operational Decision (Lock v1.0)" : "Only Decision Owner role can commit decisions"}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Commit Operational Decision (Lock v1.0)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
