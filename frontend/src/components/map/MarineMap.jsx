import React, { useState } from "react";
import {
  Compass,
  Layers,
  Info,
  ShieldAlert,
  RefreshCw,
  Waves,
  Fish,
  Radio,
  MapPin,
} from "lucide-react";
import MapLibreMapAdapter from "./MapLibreMapAdapter";
import SvgMapAdapter from "./SvgMapAdapter";
import { useDecisionStore } from "../../store/decisionStore";

/**
 * MarineMap — Provider-Independent Operational Marine Chart Interface
 *
 * Requirements:
 * - Map provider abstraction: MarineMap -> MapLibreMapAdapter (default) / SvgMapAdapter (fallback)
 * - Real geographic context: Arabian Sea / Western Seaboard coastlines, bathymetry, route segments
 * - Verified data provenance:
 *     INCOIS OSF: REAL (live wave telemetry)
 *     INCOIS PFZ: REAL (live thermal / chlorophyll fishing advisory)
 *     AIS: UNAVAILABLE (Directorate General of Lighthouses & Lightships coastal security restriction)
 *     Scenario: SIMULATED benchmark
 * - Connected directly to normalized backend data
 */
export default function MarineMap({
  segments = [],
  selectedSegmentId = "S3",
  onSelectSegment,
  changeEvent,
  selectedRepairId = "R1",
  decision,
  customAdapter,
}) {
  const {
    marineRegistry,
    marineOsfObservations,
    marinePfzObservations,
    marineLoading,
    marineError,
    fetchMarineData,
  } = useDecisionStore();

  const [providerMode, setProviderMode] = useState("maplibre"); // "maplibre" | "svg"
  const [showThreatZone, setShowThreatZone] = useState(true);
  const [showRepairOverlay, setShowRepairOverlay] = useState(true);
  const [showOsfLayer, setShowOsfLayer] = useState(true);
  const [showPfzLayer, setShowPfzLayer] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [hoveredSegment, setHoveredSegment] = useState(null);

  const isRepaired = decision?.status === "REPAIRED_COMMITTED";
  const activeSegmentData = segments.find((s) => s.id === selectedSegmentId);

  // Status provenance from registry
  const osfStatus = marineRegistry?.INCOIS_OSF?.status;
  const pfzStatus = marineRegistry?.INCOIS_PFZ?.status;
  const isOsfReal = osfStatus === "CONNECTED" || marineOsfObservations.length > 0;
  const isPfzReal = pfzStatus === "CONNECTED" || marinePfzObservations.length > 0;

  // Active Adapter Choice
  const ActiveAdapter = customAdapter
    ? customAdapter
    : providerMode === "maplibre"
    ? MapLibreMapAdapter
    : SvgMapAdapter;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col select-none">
      {/* ── Top Navigation & Provenance Header ─────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/90 px-4 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Compass className="h-4 w-4 text-blue-600 shrink-0" />
            <span>Operational Marine Chart: Western Seaboard Corridor</span>
          </div>

          {/* Provenance Indicators */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* INCOIS OSF Wave Provenance */}
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide flex items-center gap-1 border ${
                isOsfReal
                  ? osfStatus === "STALE"
                    ? "bg-amber-50 text-amber-800 border-amber-300"
                    : "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
              title={
                osfStatus === "STALE"
                  ? "INCOIS Ocean State Forecast: Real wave telemetry cached/stale from previous fetch"
                  : "INCOIS Ocean State Forecast: Real wave telemetry via THREDDS WMS"
              }
            >
              <Waves className="h-3 w-3 text-emerald-600" />
              <span>OSF: {isOsfReal ? (osfStatus === "STALE" ? "REAL (CACHED)" : "REAL") : "UNAVAILABLE"}</span>
            </span>

            {/* INCOIS PFZ Provenance */}
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide flex items-center gap-1 border ${
                isPfzReal
                  ? pfzStatus === "STALE"
                    ? "bg-amber-50 text-amber-800 border-amber-300"
                    : "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
              title={
                pfzStatus === "STALE"
                  ? "INCOIS Potential Fishing Zone: Real advisory cached/stale"
                  : "INCOIS Potential Fishing Zone Advisory: Real GeoServer OGC WFS thermal lines"
              }
            >
              <Fish className="h-3 w-3 text-emerald-600" />
              <span>PFZ: {isPfzReal ? (pfzStatus === "STALE" ? "REAL (CACHED)" : "REAL") : "UNAVAILABLE"}</span>
            </span>

            {/* AIS Honesty Provenance */}
            <span
              className="rounded bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.5 text-[10px] font-bold tracking-wide flex items-center gap-1"
              title="DGLL National AIS is restricted for coastal security. No public unauthenticated feed exists. Zero fake vessels are shown."
            >
              <Radio className="h-3 w-3 text-slate-500" />
              <span>AIS: UNAVAILABLE</span>
            </span>

            {/* Scenario Marker */}
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide border ${
              decision.dataSourceType === "COMPUTED"
                ? "bg-blue-50 text-blue-900 border-blue-300"
                : "bg-amber-50 text-amber-900 border-amber-300"
            }`}>
              {decision.dataSourceType === "COMPUTED" ? "CORRIDOR: COMPUTED" : "DECISION: SIMULATED"}
            </span>
          </div>
        </div>

        {/* ── Toolbar Layer Toggles & Engine Actions ─────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          {changeEvent && (
            <>
              <label className="flex items-center gap-1 text-slate-700 cursor-pointer text-[11px] font-medium">
                <input
                  type="checkbox"
                  checked={showThreatZone}
                  onChange={(e) => setShowThreatZone(e.target.checked)}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500 h-3.5 w-3.5"
                />
                <span>Hazard Envelope</span>
              </label>

              <label className="flex items-center gap-1 text-slate-700 cursor-pointer text-[11px] font-medium">
                <input
                  type="checkbox"
                  checked={showRepairOverlay}
                  onChange={(e) => setShowRepairOverlay(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                <span>Detour (W3-A)</span>
              </label>
            </>
          )}

          <label className="flex items-center gap-1 text-slate-700 cursor-pointer text-[11px] font-medium">
            <input
              type="checkbox"
              checked={showOsfLayer}
              onChange={(e) => setShowOsfLayer(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
            />
            <span>Waves (OSF)</span>
          </label>

          <label className="flex items-center gap-1 text-slate-700 cursor-pointer text-[11px] font-medium hidden sm:flex">
            <input
              type="checkbox"
              checked={showPfzLayer}
              onChange={(e) => setShowPfzLayer(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
            />
            <span>PFZ Advisory</span>
          </label>

          {/* Refresh Marine Backend */}
          <button
            onClick={() => fetchMarineData()}
            disabled={marineLoading}
            className="flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            title="Sync marine observations from INCOIS THREDDS and GeoServer"
          >
            <RefreshCw className={`h-3 w-3 text-blue-600 ${marineLoading ? "animate-spin" : ""}`} />
            <span>{marineLoading ? "Syncing..." : "Sync Feeds"}</span>
          </button>

          {/* Provider Abstraction Selector */}
          <div className="flex items-center rounded border border-slate-200 bg-white p-0.5 text-[10px] font-semibold">
            <button
              onClick={() => setProviderMode("maplibre")}
              className={`px-1.5 py-0.5 rounded transition ${
                providerMode === "maplibre"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Interactive
            </button>
            <button
              onClick={() => setProviderMode("svg")}
              className={`px-1.5 py-0.5 rounded transition ${
                providerMode === "svg"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              SVG Fallback
            </button>
          </div>
        </div>
      </div>

      {/* ── Error Banner If Live Marine Fails ───────────────────────────── */}
      {marineError && (
        <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-[11px] text-amber-900">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>{marineError}</span>
          </div>
          <button
            onClick={() => fetchMarineData()}
            className="text-amber-800 underline font-semibold hover:text-amber-950"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* ── Main Map Viewport via Chosen Adapter ───────────────────────── */}
      <div className="relative bg-[#f0f6fb] w-full aspect-16/10 min-h-[440px] max-h-[560px] overflow-hidden">
        <ActiveAdapter
          segments={segments}
          selectedSegmentId={selectedSegmentId}
          onSelectSegment={onSelectSegment}
          onHoverSegment={setHoveredSegment}
          changeEvent={changeEvent}
          isRepaired={isRepaired}
          showThreatZone={showThreatZone}
          showRepairOverlay={showRepairOverlay}
          showGrid={showGrid}
          selectedRepairId={selectedRepairId}
          osfObservations={marineOsfObservations}
          pfzObservations={marinePfzObservations}
          showPfzLayer={showPfzLayer}
          showOsfLayer={showOsfLayer}
        />

        {/* Floating Telemetry Box for Selected Segment */}
        {activeSegmentData && (
          <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-md backdrop-blur-xs max-w-xs text-xs space-y-1.5 pointer-events-none">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold text-slate-900">
                Segment {activeSegmentData.id}: {activeSegmentData.name}
              </span>
              <span
                className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                  activeSegmentData.status === "AFFECTED" || activeSegmentData.status === "IMPACTED"
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : activeSegmentData.status === "REPAIRED_ACTIVE"
                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                    : "bg-blue-100 text-blue-900"
                }`}
              >
                {activeSegmentData.status.replace("_", " ")}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-100">
              <div>
                <span className="text-slate-500 block text-[10px]">Distance</span>
                <span className="font-semibold text-slate-800">
                  {activeSegmentData.distanceNm} NM
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Scenario Hs</span>
                <span
                  className={`font-semibold ${
                    activeSegmentData.waveHeightM > 4 ? "text-red-700" : "text-slate-800"
                  }`}
                >
                  {activeSegmentData.waveHeightM}m <span className="text-[9px] font-normal text-slate-400">[SIM]</span>
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Scenario Wind</span>
                <span
                  className={`font-semibold ${
                    activeSegmentData.windKts > 35 ? "text-red-700" : "text-slate-800"
                  }`}
                >
                  {activeSegmentData.windKts}kt <span className="text-[9px] font-normal text-slate-400">[SIM]</span>
                </span>
              </div>
            </div>

            {/* Real INCOIS Backend Telemetry */}
            {(() => {
              const segOsf = marineOsfObservations.find(
                (obs) => obs.source_record_id && obs.source_record_id.includes(activeSegmentData.id)
              );
              const segPfz = marinePfzObservations.find(
                (obs) => obs.source_record_id && obs.source_record_id.includes(activeSegmentData.id)
              );
              const swhVal = segOsf?.parameters?.significant_wave_height?.value;
              const pfzDist = segPfz?.parameters?.pfz_proximity_distance_nm?.value;

              if (!segOsf && !segPfz) return null;

              return (
                <div className="pt-1 mt-1 border-t border-slate-100 space-y-0.5 text-[10px]">
                  {swhVal !== undefined && swhVal !== null && (
                    <div className="flex items-center justify-between text-blue-900">
                      <div className="flex items-center gap-1">
                        <Waves className="h-3 w-3 text-blue-600" />
                        <span>INCOIS Hs: <strong>{swhVal.toFixed(2)} m</strong></span>
                      </div>
                      <span
                        className={`px-1 py-0.2 rounded font-mono font-bold text-[8px] ${
                          osfStatus === "STALE"
                            ? "bg-amber-100 text-amber-900 border border-amber-200"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        REAL{osfStatus === "STALE" ? " · CACHED" : ""}
                      </span>
                    </div>
                  )}
                  {pfzDist !== undefined && pfzDist !== null && (
                    <div className="flex items-center justify-between text-emerald-900">
                      <div className="flex items-center gap-1">
                        <span>🐟</span>
                        <span>PFZ Distance: <strong>{pfzDist.toFixed(1)} NM</strong></span>
                      </div>
                      <span
                        className={`px-1 py-0.2 rounded font-mono font-bold text-[8px] ${
                          pfzStatus === "STALE"
                            ? "bg-amber-100 text-amber-900 border border-amber-200"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        REAL{pfzStatus === "STALE" ? " · CACHED" : ""}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            <p className="text-[11px] text-slate-600 leading-snug pt-0.5">
              {activeSegmentData.details}
            </p>
          </div>
        )}
      </div>

      {/* ── Operational Map Legend ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="h-2 w-4 rounded-full bg-blue-600" />
            <span className="font-medium">
              Corridor Legs{" "}
              <span className="text-[9px] font-mono text-slate-500">
                [{decision.dataSourceType === "COMPUTED" ? "COMPUTED" : "SIMULATED"}]
              </span>
            </span>
          </div>

          {changeEvent && (
            <>
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="h-2 w-4 rounded-full bg-amber-500 border border-amber-600" />
                <span className="font-bold text-amber-800">
                  Affected S3 <span className="text-[9px] text-amber-700/80">[SIMULATED]</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="h-2 w-4 rounded-full border-2 border-dashed border-sky-600" />
                <span className="font-medium text-sky-800">
                  Detour W3-A <span className="text-[9px] text-sky-700/80">[SIMULATED]</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full bg-red-100 border border-red-500" />
                <span className="font-medium text-red-800">
                  Hazard Zone <span className="text-[9px] text-red-700/80">[SIMULATED]</span>
                </span>
              </div>
            </>
          )}

          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="flex items-center justify-center w-3 h-3 rounded-full bg-emerald-100 border border-emerald-500 text-[8px]">
              🐟
            </span>
            <span className="font-medium text-emerald-800">INCOIS PFZ <span className="text-[9px] font-bold text-emerald-700">[REAL]</span></span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700">
            <Waves className="h-3 w-3 text-blue-600" />
            <span className="font-medium text-blue-800">INCOIS Waves <span className="text-[9px] font-bold text-blue-700">[REAL]</span></span>
          </div>
        </div>

        <div className="text-[10px] text-slate-500 font-mono">
          Provider: {providerMode === "maplibre" ? "MapLibre GL JS (WebGL Interactive)" : "SvgMapAdapter (Vector Fallback)"}
        </div>
      </div>
    </div>
  );
}
