import React, { useState } from "react";
import {
  Users,
  Anchor,
  Radio,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Fish,
  Building2,
  TreePine,
  LifeBuoy,
  ArrowRight,
  Info,
  MapPin,
  Clock,
  Compass,
  FileCheck2,
} from "lucide-react";
import { useDecisionStore } from "../../store/decisionStore";

export default function StakeholderImpactsView() {
  const {
    decision,
    changeEvent,
    routeSegments,
    selectedSegmentId,
    setSelectedSegmentId,
    stakeholderAwareness,
    acknowledgeStakeholderNotice,
    userRole,
  } = useDecisionStore();

  const [activeSector, setActiveSector] = useState("fisheries"); // fisheries | port | environment | disaster

  const isImpacted = decision.status === "IMPACTED" || decision.status === "DISRUPTION_DETECTED";
  const affectedLegId = changeEvent?.affectedSegmentId || (isImpacted ? "S3" : null);

  const activeSegment =
    routeSegments.find((s) => s.id === selectedSegmentId) ||
    routeSegments.find((s) => s.id === affectedLegId) ||
    routeSegments[0] || {
      id: "S3",
      name: "Central Coastal Corridor",
      waveHeightM: 3.8,
      windKts: 28,
      distanceNm: 180,
    };

  const isCurrentSegmentAffected = activeSegment.id === affectedLegId;

  return (
    <div className="space-y-4">
      {/* ── HEADER BANNER ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <Users className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Stakeholder Operational Impact Awareness
            </h2>
            <span className="rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide">
              Read-Only Stakeholder Perspective
            </span>
            <span className="rounded border border-slate-200 bg-slate-50 text-[10px] font-mono font-semibold px-2 py-0.5 text-slate-600">
              Same Workspace Context
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Multi-sector coastal awareness for fisheries, port logistics, environmental preservation, and disaster management. Read-only view embedded directly inside the decision continuity workflow.
          </p>
        </div>

        {/* Status Chip */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              stakeholderAwareness?.acknowledged
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : "bg-amber-50 text-amber-800 border-amber-300"
            }`}
          >
            {stakeholderAwareness?.acknowledged ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            )}
            <span>
              {stakeholderAwareness?.acknowledged
                ? "Awareness Acknowledged"
                : "Pending Stakeholder Review"}
            </span>
          </span>
        </div>
      </div>

      {/* ── 5-STAGE FISHERIES & COASTAL WORKFLOW STRIP ───────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Fisheries &amp; Coastal Decision Continuity Workflow
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Standard Operating Procedure (SOP-CST-04)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Step 1: Marine Decision & Change */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500">STEP 1</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                  isImpacted ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                }`}>
                  {decision.version}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1">
                Marine Decision &amp; Change
              </h4>
              <p className="text-[11px] text-slate-600 leading-snug">
                {changeEvent ? changeEvent.title : "Nominal operational passage locked."}
              </p>
            </div>
            <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-200/60">
              {decision.departurePort.split(" ")[0]} → {decision.destinationPort.split(" ")[0]}
            </div>
          </div>

          {/* Step 2: Affected Coastal Segment */}
          <div className={`rounded-lg border p-3 space-y-1.5 flex flex-col justify-between ${
            isImpacted ? "border-amber-300 bg-amber-50/50" : "border-slate-200 bg-slate-50/80"
          }`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500">STEP 2</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                  isImpacted ? "bg-amber-200 text-amber-900" : "bg-emerald-100 text-emerald-800"
                }`}>
                  {isImpacted ? `Leg ${affectedLegId}` : "All Clear"}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1">
                Affected Coastal Area
              </h4>
              <p className="text-[11px] text-slate-600 leading-snug">
                {isImpacted
                  ? `Nearshore sector ${affectedLegId} subject to wave exceedance envelope.`
                  : "All corridor segments operating within nominal limits."}
              </p>
            </div>
            <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-200/60">
              Corridor Leg: {activeSegment.id}
            </div>
          </div>

          {/* Step 3: Stakeholder Impact Info */}
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-600">STEP 3</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">
                  4 Sectors
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1">
                Stakeholder Impacts
              </h4>
              <p className="text-[11px] text-slate-600 leading-snug">
                Evaluates fisheries safety, port ETA, marine sanctuaries, and SDMA alert level.
              </p>
            </div>
            <div className="text-[10px] font-mono text-indigo-700 pt-1 border-t border-indigo-200/60">
              Active: {activeSector.toUpperCase()}
            </div>
          </div>

          {/* Step 4: Operational Awareness / Action */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500">STEP 4</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                  stakeholderAwareness?.acknowledged
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}>
                  {stakeholderAwareness?.acknowledged ? "LOGGED" : "ACTION REQUIRED"}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1">
                Operational Awareness
              </h4>
              <p className="text-[11px] text-slate-600 leading-snug">
                Broadcast NAVTEX warning and record formal stakeholder acknowledgment.
              </p>
            </div>
            <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-200/60">
              Sign-Off Logged
            </div>
          </div>

          {/* Step 5: Visible to Decision Workflow */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-600">STEP 5</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                  INTEGRATED
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1">
                Decision Workflow Sync
              </h4>
              <p className="text-[11px] text-slate-600 leading-snug">
                Stakeholder awareness is bound to the passage plan and audited in decision history.
              </p>
            </div>
            <div className="text-[10px] font-mono text-emerald-700 pt-1 border-t border-emerald-200/60">
              Audit Linked
            </div>
          </div>
        </div>
      </div>

      {/* ── SEGMENT SELECTOR (AFFECTED COASTAL AREA) ────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-tight text-slate-900">
              Coastal Corridor Legs &amp; Spatial Segments
            </h3>
            <p className="text-[11px] text-slate-500">
              Select any corridor leg to inspect its local coastal and fisheries impact profile.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600">
            {routeSegments.length} Corridor Legs Charted
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {routeSegments.map((seg) => {
            const isAffected = seg.status === "AFFECTED" || seg.id === affectedLegId;
            const isSelected = seg.id === activeSegment.id;

            return (
              <button
                key={seg.id}
                onClick={() => setSelectedSegmentId(seg.id)}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/60 ring-1 ring-blue-600"
                    : isAffected
                    ? "border-amber-300 bg-amber-50/50 hover:border-amber-400"
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    Leg {seg.id}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      isAffected
                        ? "bg-amber-200 text-amber-900"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {isAffected ? "AFFECTED" : "NOMINAL"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 font-medium truncate mt-1" title={seg.name}>
                  {seg.name}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 font-mono">
                  <span>{seg.distanceNm || 120} NM</span>
                  <span>SWH: {seg.waveHeightM || 1.8}m</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 4 STAKEHOLDER SECTORS TABS & DETAIL ───────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
        {/* Sector Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          {[
            { id: "fisheries", label: "1. Fisheries & Coastal Activity", icon: Fish, color: "text-blue-600" },
            { id: "port", label: "2. Port & Logistics Operations", icon: Building2, color: "text-amber-600" },
            { id: "environment", label: "3. Environmental Interests", icon: TreePine, color: "text-emerald-600" },
            { id: "disaster", label: "4. Disaster Management Interests", icon: LifeBuoy, color: "text-red-600" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSector === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSector(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : tab.color}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sector 1: Fisheries & Coastal Activity */}
        {activeSector === "fisheries" && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-tight text-slate-900 flex items-center gap-1.5">
                  <Fish className="h-4 w-4 text-blue-600" />
                  Fisheries &amp; Coastal Craft Impact Evaluation
                </h3>
                <p className="text-[11px] text-slate-500">
                  Cross-referencing INCOIS Potential Fishing Zones (PFZ) and coastal craft safety envelopes against Leg {activeSegment.id}.
                </p>
              </div>

              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                isCurrentSegmentAffected
                  ? "bg-amber-50 text-amber-800 border-amber-300"
                  : "bg-emerald-50 text-emerald-800 border-emerald-300"
              }`}>
                {isCurrentSegmentAffected ? "Advisory Notice Active" : "Normal Coastal Activity"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card 1: Artisanal Fleet Advisory */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Artisanal Craft (&lt;12m)</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    isCurrentSegmentAffected ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {isCurrentSegmentAffected ? "SWELL WARNING" : "SAFE TO VENTURE"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  {isCurrentSegmentAffected
                    ? "Swell height exceeds 3.5m in nearshore corridor. Non-motorized and motorized canoes advised to suspend offshore operations."
                    : "Nearshore sea conditions nominal. Swell ≤1.8m. Safe for artisanal fishing operations."}
                </p>
                <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                  Threshold: 2.5m Swell • Current: {activeSegment.waveHeightM || 1.8}m
                </div>
              </div>

              {/* Card 2: Mechanized Trawlers & PFZ */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Mechanized Deep-Sea Fleet</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                    PFZ ADVISORY
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  {isCurrentSegmentAffected
                    ? "High-yield PFZ bands identified 22 NM offshore of Segment S3. Detour trajectory leaves standard 15 NM standoff buffer for active trawlers."
                    : "PFZ waypoints monitored. Commercial fishing vessels operating along standard bathymetric lines."}
                </p>
                <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                  Buffer: 15 NM Standoff • INCOIS PFZ Synced
                </div>
              </div>

              {/* Card 3: Coastal Communication Channels */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Broadcast Bulletin Status</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                    VHF CH 16 QUEUED
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  NAVTEX Notice to Fishermen prepared in regional coastal languages (Marathi / Konkani / Kannada) for broadcast via coastal radio stations.
                </p>
                <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                  Broadcast Cycle: Every 4 Hours
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sector 2: Port & Logistics Operations */}
        {activeSector === "port" && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-tight text-slate-900 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-amber-600" />
                  Port Infrastructure &amp; Commercial Logistics Impact
                </h3>
                <p className="text-[11px] text-slate-500">
                  Downstream impact on berth reservation windows, pilot boarding grounds, and fairway management.
                </p>
              </div>

              <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-300">
                Berth Slot Protected
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Berth Allocation Window</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                    PRESERVED
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Estimated delay under detour is +38 minutes. Reserved arrival window at {decision.destinationPort.split(" ")[0]} has ±120 minute tolerance. Zero demurrage risk.
                </p>
                <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                  Delay: +38m (Tolerance: ±120m)
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">VTMS &amp; Fairway Coordination</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                    NOTICE LOGGED
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Vessel Traffic Management System (VTMS) notified of 33 NM offshore corridor adjustment. Pilot boarding time updated to 06:38 UTC.
                </p>
                <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                  Pilot Boarding Ground: Unaffected
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Bunker &amp; Logistics Reserves</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                    78% RESERVE REMAINING
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Added voyage distance (+12 NM on detour) increases fuel consumption by 1.8 MT, comfortably within the 15% voyage endurance contingency.
                </p>
                <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                  Endurance: Safe Margins Verified
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sector 3: Environmental Interests */}
        {activeSector === "environment" && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-tight text-slate-900 flex items-center gap-1.5">
                  <TreePine className="h-4 w-4 text-emerald-600" />
                  Ecological Boundaries &amp; Marine Protected Areas (MPA)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Ensuring passage modifications respect designated ecological reserves, coral reefs, and emission control zones.
                </p>
              </div>

              <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-300">
                Full Ecological Invariance
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Marine Sanctuary Buffer</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                    &gt;12 NM MARGIN
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Route detour routes westward away from ecologically sensitive nearshore reefs (Netrani Island / Malvan Sanctuary), preserving a 14.2 NM buffer.
                </p>
                <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                  Boundary Invariant: Maintained
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Ballast &amp; Discharge Envelopes</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-800">
                    ZERO DISCHARGE
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Ballast water exchange operations prohibited in coastal waters shallower than 200m depth. All operations remain strictly in compliance with MARPOL Annex I/V.
                </p>
                <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                  MARPOL Compliance: 100%
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Acoustic &amp; Cetacean Impact</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                    LOW IMPACT
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Offshore routing diverts vessel engines from shallow cetacean feeding corridors near the continental shelf break.
                </p>
                <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                  Depth &gt; 800m on Detour Track
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sector 4: Disaster Management Interests */}
        {activeSector === "disaster" && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-tight text-slate-900 flex items-center gap-1.5">
                  <LifeBuoy className="h-4 w-4 text-red-600" />
                  Coastal Disaster Management &amp; Maritime Search and Rescue
                </h3>
                <p className="text-[11px] text-slate-500">
                  Integration with State Disaster Management Authorities (SDMA) and Indian Coast Guard Maritime Rescue Coordination Centres (MRCC).
                </p>
              </div>

              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                isCurrentSegmentAffected
                  ? "bg-amber-50 text-amber-800 border-amber-300"
                  : "bg-emerald-50 text-emerald-800 border-emerald-300"
              }`}>
                {isCurrentSegmentAffected ? "SDMA Alert: Level 2" : "SDMA Alert: Level 1"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">SDMA Alert State</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    isCurrentSegmentAffected ? "bg-amber-200 text-amber-900" : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {isCurrentSegmentAffected ? "LEVEL 2 (YELLOW)" : "LEVEL 1 (NORMAL)"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  {isCurrentSegmentAffected
                    ? "Coastal district disaster authorities notified of wave height exceedances. Emergency response units at Karwar and Goa placed on standby."
                    : "Normal coastal vigilance state. Routine monitoring active across all maritime districts."}
                </p>
                <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                  Agency: Maharashtra &amp; Goa SDMA
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Coast Guard MRCC Sector</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                    MRCC MUMBAI SYNCED
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Passage tracking and corridor coordinates shared with MRCC Mumbai and Indian Coast Guard District Headquarters No. 11.
                </p>
                <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                  SAR Capability: Full Coverage
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Emergency Safe Haven Harbor</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                    MORMUGAO STANDBY
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Designated maritime refuge port identified at Mormugao Deep Draft Anchorage (distance: 44 NM east from waypoint W-S3) in case of unexpected sea state escalation.
                </p>
                <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                  Refuge Harbor: 44 NM Standby
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── ACTION & DECISION INTEGRATION CARD ──────────────────────── */}
      <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/60 to-blue-50/40 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-indigo-700" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Operational Awareness &amp; Decision Workflow Integration
              </h4>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Acknowledging stakeholder operational awareness integrates fisheries warnings, port ETA preservation, and disaster readiness into the active decision history. This status is visible to Decision Owners, Marine Analysts, and Approval Authorities.
            </p>
            {stakeholderAwareness?.acknowledged && (
              <div className="text-[11px] font-mono text-emerald-800 font-semibold pt-1">
                ✓ Acknowledged at {stakeholderAwareness.acknowledgedAt} by {stakeholderAwareness.acknowledgedBy} ({stakeholderAwareness.sectorAcknowledged || "All Sectors"})
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => acknowledgeStakeholderNotice(activeSector.toUpperCase())}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {stakeholderAwareness?.acknowledged
                  ? `Re-Log Awareness (${activeSector.toUpperCase()})`
                  : "Acknowledge Stakeholder Awareness"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
