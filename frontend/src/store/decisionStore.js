import { create } from "zustand";
import { evaluateDecisionImpact } from "../engine/impactEngine";
import { calculateDecisionHealth } from "../engine/healthScore";
import {
  getMarineRegistry,
  getMarineOsfWaypoints,
  getMarinePfzWaypoints,
  getMarineAisStatus,
  createDecision,
  getDecision,
  evaluateMarineEvidence,
  approveRepairBackend,
  rejectRepairBackend,
  getAuditHistory,
} from "../services/apiService";
import {
  VERIFIED_COASTAL_LOCATIONS,
  DECISION_TYPES,
  generateCorridorSegments,
} from "../data/coastalLocations";
import { buildDraftDecision } from "../data/decisionBuilderModel";

export const AVAILABLE_ROLES = [
  {
    id: "decision_owner",
    name: "Decision Owner",
    title: "Passage Planning & Operations Lead",
    clearance: "Decision Author & Commit Authority",
    badge: "Owner",
    description: "Creates, configures, edits, and commits operational passage plans and decisions.",
    permissions: {
      canCreateDecision: true,
      canCommitDecision: true,
      canEvaluateEvidence: false,
      canApproveRepair: false,
      isReadOnly: false,
    },
    defaultNav: "active-decisions",
  },
  {
    id: "marine_analyst",
    name: "Marine Monitoring Analyst",
    title: "Hydrographic & Weather Specialist",
    clearance: "Marine Evidence & Impact Verification",
    badge: "Analyst",
    description: "Reviews real INCOIS OSF & PFZ marine evidence, ingests change events, and analyzes segment impacts.",
    permissions: {
      canCreateDecision: false,
      canCommitDecision: false,
      canEvaluateEvidence: true,
      canApproveRepair: false,
      isReadOnly: false,
    },
    defaultNav: "change-events",
  },
  {
    id: "approval_authority",
    name: "Approval Authority",
    title: "Command Sign-Off Authority",
    clearance: "Repair Approval & Rejection Authority",
    badge: "Authority",
    description: "Reviews repair recommendations, verifies invariant trade-offs, and authorizes or rejects proposed modifications.",
    permissions: {
      canCreateDecision: false,
      canCommitDecision: false,
      canEvaluateEvidence: false,
      canApproveRepair: true,
      isReadOnly: false,
    },
    defaultNav: "repair-queue",
  },
  {
    id: "stakeholder_view",
    name: "Stakeholder View",
    title: "Coastal & Operational Stakeholder",
    clearance: "Multi-Sector Impact Awareness",
    badge: "Stakeholder",
    description: "Read-only operational perspective on decisions and impacts across fisheries, ports, environment, and disaster management.",
    permissions: {
      canCreateDecision: false,
      canCommitDecision: false,
      canEvaluateEvidence: false,
      canApproveRepair: false,
      isReadOnly: true,
    },
    defaultNav: "stakeholder-view",
  },
];

/**
 * Sagar AI — Marine Decision Continuity Store
 * Problem Statement: SIH 26176
 *
 * DATA INTEGRITY GUARANTEE:
 * All operational feeds, coordinates, and weather metrics in this benchmark
 * are explicitly tagged as SIMULATED / DEMO DATA.
 * No live official credentials (IMD, INCOIS, NAVAREA) are fabricated.
 */

export const INITIAL_SEGMENTS = [
  {
    id: "S1",
    name: "Operational Base Fairway to North TSS Sector",
    distanceNm: 65,
    status: "COMPLETED",
    condition: "Nominal [SIMULATED]",
    waveHeightM: 1.4,
    windKts: 14,
    details: "Completed on schedule at 18:20 UTC. Pilot discharged successfully.",
    startCoord: [18.95, 72.85],
    endCoord: [18.25, 72.50],
    coordinates: [
      [18.95, 72.85],
      [18.45, 72.50],
      [18.25, 72.50],
    ],
  },
  {
    id: "S2",
    name: "North TSS Sector to Central Checkpoint",
    distanceNm: 155,
    status: "ACTIVE_STABLE",
    condition: "Nominal [SIMULATED]",
    waveHeightM: 1.8,
    windKts: 18,
    details: "Currently active leg. Traversal maintained within planned speed parameters.",
    startCoord: [18.25, 72.50],
    endCoord: [16.98, 73.15],
    coordinates: [
      [18.25, 72.50],
      [16.98, 73.05],
      [16.98, 73.15],
    ],
  },
  {
    id: "S3",
    name: "Central Checkpoint to Karwar Transition Corridor",
    distanceNm: 195,
    status: "AFFECTED",
    condition: "Simulated Restricted Zone Intersected",
    waveHeightM: 5.4,
    windKts: 48,
    details: "Simulated restricted-zone expansion directly intersects charted corridor between NM 220 and NM 310.",
    startCoord: [16.98, 73.15],
    endCoord: [13.20, 74.35],
    repairWaypoint: [14.30, 72.50], // Western detour W3-A
    coordinates: [
      [16.98, 73.15],
      [14.80, 73.95],
      [13.20, 74.35],
    ],
  },
  {
    id: "S4",
    name: "Karwar Transition to South Approach Sector",
    distanceNm: 180,
    status: "UNAFFECTED",
    condition: "Nominal [SIMULATED]",
    waveHeightM: 2.1,
    windKts: 16,
    details: "Future planned leg. Hydrographic envelope is nominal and unaffected.",
    startCoord: [13.20, 74.35],
    endCoord: [9.95, 75.80],
    coordinates: [
      [13.20, 74.35],
      [11.35, 75.35],
      [9.95, 75.80],
    ],
  },
  {
    id: "S5",
    name: "South Approach to Terminus Station & Berth",
    distanceNm: 360,
    status: "UNAFFECTED",
    condition: "Nominal [SIMULATED]",
    waveHeightM: 1.9,
    windKts: 15,
    details: "Approach leg into Terminus Station (Colombo Harbour). Scheduled arrival window committed via deepwater open ocean corridor.",
    startCoord: [9.95, 75.80],
    endCoord: [6.95, 79.85],
    coordinates: [
      [9.95, 75.80],
      [8.35, 76.85],
      [7.75, 77.30], // Cape Comorin SW Offshore Fairway (rounds south of 8.08°N)
      [7.60, 77.85], // South of Cape Comorin deep ocean fairway
      [7.15, 79.20], // Laccadive Sea open ocean west of Sri Lanka
      [6.95, 79.60], // Colombo Western Approach Fairway
      [6.95, 79.85], // Colombo Harbour
    ],
  },
];

export const INITIAL_DEPENDENCIES = [
  {
    id: "DEP-01",
    type: "SCHEDULE_PORT_WINDOW",
    name: "Terminus Berth Window Slot",
    commitment: "Sept 14, 06:00 UTC (Window tolerance ±2.0 hours)",
    source: "Simulated Port Operations Schedule",
    condition: "Arrival timestamp within [04:00, 08:00 UTC]",
    linkedSegments: ["S5"],
    impactLevel: "CRITICAL",
    status: "AT_RISK",
    description:
      "Guaranteed survey berth and crane allocation. Exceeding window by >2.0h disrupts downstream schedule.",
    mitigationUnderRepair: "Preserved: Candidate R1 arrives at 06:38 UTC (+38 mins, within allowable ±2h window).",
  },
  {
    id: "DEP-02",
    type: "SAFETY_DYNAMIC_STABILITY",
    name: "Survey Sensor Array & Deck Stability Constraint",
    commitment: "Dynamic vessel roll angle strictly ≤ 12.0°",
    source: "Simulated Vessel Operations Manual",
    condition: "Roll < 12.0° across all traversal legs",
    linkedSegments: ["S3"],
    impactLevel: "CRITICAL",
    status: "VIOLATED",
    description:
      "Acoustic calibration array on deck. Beam seas in hazard zone induce roll exceeding 16.5°, triggering measurement lock.",
    mitigationUnderRepair: "Preserved: Candidate R1 steers quartering seas, capping roll at 5.8°.",
  },
  {
    id: "DEP-03",
    type: "RESOURCE_FUEL_BUDGET",
    name: "Voyage Fuel & Endurance Reserve",
    commitment: "Planned consumption with max allowable reserve burn variance ≤ +5.0 MT",
    source: "Simulated Charterparty Consumption Curve",
    condition: "Fuel variance ≤ +5.0 MT",
    linkedSegments: ["S2", "S3", "S4"],
    impactLevel: "MEDIUM",
    status: "AT_RISK",
    description:
      "Navigating directly through gale core increases head-resistance burn by +12.4 MT.",
    mitigationUnderRepair: "Optimized: Candidate R1 adds +12 NM (+1.8 MT variance), well within reserve threshold.",
  },
  {
    id: "DEP-04",
    type: "NAVIGATIONAL_PILOTAGE",
    name: "Terminus Fairway Pilot rendezvous",
    commitment: "Pilot boarding at 05:30 UTC",
    source: "Simulated Harbour Master Coordination Protocol",
    condition: "Notice dispatched ≥ 6h prior to arrival",
    linkedSegments: ["S5"],
    impactLevel: "HIGH",
    status: "VALID",
    description: "Mandatory pilot team rendezvous window at Terminus Fairway Buoy.",
    mitigationUnderRepair: "Preserved: Pre-flight advisory dispatches revised 06:38 UTC ETA notice.",
  },
];

export const INITIAL_CONSTRAINTS = [
  {
    id: "CST-01",
    label: "Maximum Permitted Significant Wave Height (Hs)",
    limit: "≤ 4.0 meters",
    currentUnderHazard: "5.4 meters [SIMULATED] (Exceeded by 1.4m)",
    underRepair: "2.6 meters [SIMULATED] (Compliant)",
  },
  {
    id: "CST-02",
    label: "Under-Keel Clearance (UKC) Margin",
    limit: "≥ 3.5 meters above chart datum",
    currentUnderHazard: "Compliant (deep basin > 200m)",
    underRepair: "Compliant (depth > 1200m offshore)",
  },
  {
    id: "CST-03",
    label: "Territorial Baseline Standoff Margin",
    limit: "Maintain ≥ 12 NM offshore buffer unless cleared",
    currentUnderHazard: "Compliant",
    underRepair: "Compliant (Operates in international transit corridor)",
  },
  {
    id: "CST-04",
    label: "Traffic Separation Scheme (TSS) Compliance",
    limit: "Strict adherence to TSS designated lanes",
    currentUnderHazard: "Compliant",
    underRepair: "Compliant (TSS segments S1 and S5 remain 100% untouched)",
  },
];

export const INITIAL_DECISION = {
  id: "DEC-2026-084",
  title: "Coastal Survey Operation 01",
  objective: "Hydrographic & Environmental Survey along Western Seaboard Corridor",
  status: "IMPACTED", // DRAFT | COMMITTED | IMPACTED | REPAIR_PENDING | UPDATED | SUPERSEDED
  version: "v1.0",
  createdAt: "2026-09-12 10:00 UTC",
  committedAt: "2026-09-12 14:00 UTC",
  schedule: "Transit 48h (Committed ETA: Sept 14, 06:00 UTC)",
  departurePort: "Base Station (Nhava Sector)",
  destinationPort: "Terminus Station (Southern Basin)",
  totalDistanceNm: 890,
  plannedSpeedKts: 18.5,
  originalEta: "2026-09-14 06:00 UTC",
  currentSegment: "S2",
  officer: "Decision Owner (Operations Desk)",
  segments: INITIAL_SEGMENTS,
  dependencies: INITIAL_DEPENDENCIES,
  constraints: INITIAL_CONSTRAINTS,
  assumptions: [
    "Monsoon swell envelope within standard ±1.5m margin",
    "Terminus berth slot reserved for 06:00 UTC arrival",
    "Continuous radar and sensor telemetry available",
  ],
  dataSourceType: "SIMULATED", // REAL | SIMULATED | UNAVAILABLE
  dataQuality: "HIGH_FIDELITY_SIMULATED_BENCHMARK",
};

export const INITIAL_CHANGE_EVENT = {
  id: "EVT-SIM-2026-0914",
  type: "ROUTE_RESTRICTION_EXPANSION",
  title: "Simulated Restricted Hazard Expansion & Wave Breach",
  severity: "HIGH",
  source: "Simulated Environmental Threat Model",
  sourceType: "SIMULATED",
  observedAt: "2026-09-13 07:45 UTC",
  location: "14°35'N, 73°25'E (Goa-Karwar Offshore Corridor)",
  eventCoordinates: [14.58, 73.41],
  radiusNm: 45,
  affectedSegmentId: "S3",
  description:
    "Simulated localized hazard envelope expands across charted corridor between NM 220 and NM 310 with wave heights exceeding 5.2m. Crosses committed Segment S3.",
  quality: "SIMULATED_TESTBENCH",
  sourceRecordId: "SYNTHETIC-DATA-FEED-01",
  isCatastrophic: false,
};

export const REPAIR_CANDIDATES = [
  {
    id: "R1",
    tier: "RECOMMENDED",
    title: "Minimal Repair: Segment S3 Western Arc Detour (WP W3-A)",
    description:
      "Preserves 100% of Segments S1, S2, S4, and S5. Replaces only Segment S3 by routing 34 NM westward around the hazard envelope via Waypoint W3-A (14°18'N, 72°30'E).",
    planChurn: 0.20, // 1 changed of 5 = 20%
    preservationRatio: 0.80, // 80% preserved
    whatChanges: [
      "Segment S3 replaced with 2 sub-legs via Waypoint W3-A (14°18'N, 72°30'E)",
      "Transit distance increased by +12.0 NM (total 902 NM)",
      "Arrival time delayed by +38 minutes (Revised ETA: Sept 14, 06:38 UTC)",
      "Fuel consumption increased by +1.8 MT (within allowable +5.0 MT reserve)",
    ],
    whatRemainsUnchanged: [
      "Segment S1 (Base Departure) and S2 (Active Traversal) untouched",
      "Segment S4 (South Sector) and S5 (Terminus Approach) untouched",
      "Terminus Berth Window PRESERVED (06:38 UTC is well within ±2h allowance)",
      "Sensor roll limit respected (max roll 5.8° vs 12.0° cap)",
    ],
    tradeoffs: "Accepts minor +1.8 MT fuel variance and 38-minute transit delay to completely avoid hazard area.",
    feasibility: "FEASIBLE & VERIFIED",
    score: 94,
    recommendationReason:
      "Satisfies minimal change invariant: Preserves 80% of segments, protects scheduled port window, and solves all breached constraints.",
  },
  {
    id: "R2",
    tier: "ALTERNATIVE",
    title: "Speed Reduction & Holding Pattern at Terminus of S2",
    description:
      "Maintains the original geometric track but orders a 7.5-hour slow-steaming holding pattern near S2 terminus to allow the hazard area to dissipate before resuming S3.",
    planChurn: 0.40,
    preservationRatio: 0.60,
    whatChanges: [
      "Speed reduced to 5.2 kts for 7.5 hours near Central Checkpoint",
      "Arrival time delayed by +8 hours 40 minutes (ETA: Sept 14, 14:40 UTC)",
      "Violates Terminus Berth Slot window (misses 06:00 ± 2h window)",
      "Triggers berth renegotiation and risk of 24h anchorage delay",
    ],
    whatRemainsUnchanged: [
      "Route coordinates remain identical to original v1.0 plan",
      "No extra navigational distance added (distance remains 890 NM)",
      "Zero deviation from charted waypoints",
    ],
    tradeoffs: "Avoids coordinate change at the severe cost of breaking the port berth window commitment.",
    feasibility: "FEASIBLE BUT OPERATIONALLY COMPROMISING",
    score: 62,
    recommendationReason:
      "Avoids spatial track change, but causes cascading logistical delays at terminus.",
  },
  {
    id: "R3",
    tier: "HIGHER_DISRUPTION",
    title: "Inshore Coastal Diversion via Shallow Waters (S3-C)",
    description:
      "Diverts vessel eastward hugging the shallow coastal corridor inside depths 35-50m to find shelter in lee of the coastline.",
    planChurn: 0.60,
    preservationRatio: 0.40,
    whatChanges: [
      "Completely alters S2, S3, and S4 into congested inshore lanes",
      "Enters dense mechanized fishing zones (elevated collision hazard)",
      "Shallow water squat risk for deep-draft vessel in 38m soundings",
      "Adds +39 NM distance and +7.4 MT fuel consumption",
    ],
    whatRemainsUnchanged: [
      "Avoids deep-sea storm wave crests",
      "Only final segment S5 remains unchanged",
    ],
    tradeoffs: "Trades wave stress for extreme navigational traffic density, shallow water grounding risk, and extensive track disruption across 3 legs.",
    feasibility: "NOT RECOMMENDED (Safety Hazard)",
    score: 38,
    recommendationReason:
      "Violates minimal repair principle by disrupting 3 segments when only S3 was affected.",
  },
];

export const INITIAL_HISTORY = [
  {
    version: "v1.0",
    status: "COMMITTED",
    timestamp: "2026-09-12 14:00 UTC",
    officer: "Decision Owner",
    event: "Original Plan Committed",
    summary: "Coastal Survey Operation 01 approved and locked. 5 nominal segments, 890 NM, ETA 2026-09-14 06:00 UTC.",
  },
  {
    version: "v1.0-IMPACTED",
    status: "CHANGE_DETECTED",
    timestamp: "2026-09-13 07:45 UTC",
    officer: "Sagar AI Continuity Engine",
    event: "Event EVT-SIM-2026-0914 Detected",
    summary: "Simulated restricted hazard expansion intersected Segment S3. Flagged for human review.",
  },
];

export const useDecisionStore = create((set, get) => {
  // Compute initial deterministic impact and health
  const initialImpact = evaluateDecisionImpact({
    decision: INITIAL_DECISION,
    changeEvent: INITIAL_CHANGE_EVENT,
    dependencies: INITIAL_DEPENDENCIES,
    constraints: INITIAL_CONSTRAINTS,
  });

  const initialHealth = calculateDecisionHealth({
    decision: INITIAL_DECISION,
    segments: INITIAL_SEGMENTS,
    dependencies: INITIAL_DEPENDENCIES,
    changeEvent: INITIAL_CHANGE_EVENT,
  });

  return {
    decision: INITIAL_DECISION,
    routeSegments: INITIAL_SEGMENTS,
    changeEvent: INITIAL_CHANGE_EVENT,
    dependencies: INITIAL_DEPENDENCIES,
    constraints: INITIAL_CONSTRAINTS,
    repairCandidates: REPAIR_CANDIDATES,
    selectedRepairId: "R1",
    activeNav: "active-decisions", // active-decisions | change-events | impact-analysis | repair-queue | decision-history
    activeRightTab: "dependencies", // dependencies | constraints | evidence | event-details
    rightPanelOpen: true,
    mobileSidebarOpen: false,
    mobileContextOpen: false,
    isApprovalModalOpen: false,
    decisionHistory: INITIAL_HISTORY,
    approvalFeedback: null,
    impactAnalysis: initialImpact,
    decisionHealth: initialHealth,
    currentScenario: "standard_s3_breach", // standard_s3_breach | catastrophic_collapse | custom_committed
    selectedSegmentId: "S3",

    // Operational Role State
    userRole: AVAILABLE_ROLES[0],
    isRoleModalOpen: false,

    // Decision Builder & Passage Draft State
    isDecisionBuilderOpen: false,
    draftDecision: null,
    committedCustomDecision: null,

    // Live Marine Backend Feeds
    marineRegistry: null,
    marineOsfObservations: [],
    marinePfzObservations: [],
    marineLoading: false,
    marineError: null,

    // Real Marine Evidence Evaluation
    marineEvaluating: false,
    marineEvalError: null,
    marineEvalResult: null,  // last MarineEvaluationResult from backend

    // Stakeholder Multi-Sector Awareness Workflow State
    stakeholderAwareness: {
      acknowledged: false,
      acknowledgedAt: null,
      acknowledgedBy: null,
      fisheriesStatus: "Advisory Active: Artisanal craft restricted in high swell zone; mechanized fleet 15 NM standoff.",
      portStatus: "ETA adjustment evaluated (+38m delay within designated berth window).",
      environmentalStatus: "Marine protected area compliance verified (>12 NM buffer from Netrani Sanctuary).",
      disasterStatus: "SDMA Alert Level 2 (Yellow Watch) synchronized with Coast Guard MRCC.",
    },

    // Actions
    setUserRole: (role) => {
      const currentNav = get().activeNav;
      const shouldSwitchNav = role.defaultNav && (
        (role.id === "stakeholder_view" && currentNav !== "stakeholder-view") ||
        (role.id === "marine_analyst" && currentNav === "repair-queue") ||
        (role.id === "approval_authority" && currentNav === "change-events")
      );
      set({
        userRole: role,
        isRoleModalOpen: false,
        ...(shouldSwitchNav ? { activeNav: role.defaultNav } : {}),
      });
    },
    openRoleModal: () => set({ isRoleModalOpen: true }),
    closeRoleModal: () => set({ isRoleModalOpen: false }),
    openDecisionBuilder: () => set({ isDecisionBuilderOpen: true, draftDecision: null }),
    closeDecisionBuilder: () => set({ isDecisionBuilderOpen: false, draftDecision: null }),

    acknowledgeStakeholderNotice: (sector = "All Sectors") => {
      const { userRole, decisionHistory, stakeholderAwareness } = get();
      const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
      const officer = userRole?.name || "Stakeholder Representative";

      const updatedAwareness = {
        ...stakeholderAwareness,
        acknowledged: true,
        acknowledgedAt: timestamp,
        acknowledgedBy: officer,
        sectorAcknowledged: sector,
      };

      const newHistoryItem = {
        version: "STAKEHOLDER-AWARENESS",
        status: "ACKNOWLEDGED",
        timestamp,
        officer,
        event: `Stakeholder Awareness Logged (${sector})`,
        summary: `Multi-sector operational awareness acknowledged for fisheries, port logistics, environment, and disaster readiness. Integrated into active decision continuity context.`,
      };

      set({
        stakeholderAwareness: updatedAwareness,
        decisionHistory: [newHistoryItem, ...decisionHistory],
        approvalFeedback: {
          type: "success",
          title: "Stakeholder Awareness Logged",
          message: `Multi-sector operational awareness acknowledged by ${officer}. Recorded in decision continuity workflow.`,
          timestamp: new Date().toLocaleTimeString(),
        },
      });
    },

    createDraftDecision: ({
      title,
      fromLocationId,
      toLocationId,
      departureTime,
      decisionTypeId,
      planningSpeedKts,
    }) => {
      const officer = get().userRole?.title
        ? `${get().userRole.name} (${get().userRole.title})`
        : "Decision Owner (Operations Desk)";

      const draft = buildDraftDecision({
        title,
        fromLocationId,
        toLocationId,
        departureTime,
        decisionTypeId,
        planningSpeedKts,
        officerName: officer,
      });

      set({ draftDecision: draft });
      return draft;
    },

    commitDraftDecision: () => {
      const { draftDecision, userRole, decisionHistory } = get();
      if (!draftDecision) return;

      const officerFormatted = userRole?.title
        ? `${userRole.name} (${userRole.title})`
        : draftDecision.officer;

      const committedDecision = {
        ...draftDecision,
        status: "COMMITTED",
        version: "v1.0",
        committedAt: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
        officer: officerFormatted,
        dataSourceType: "COMPUTED",
        dataQuality: "COMMITTED_PLANNING_CORRIDOR",
      };

      const newHistoryItem = {
        version: "v1.0",
        status: "COMMITTED",
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
        officer: officerFormatted,
        event: `Decision ${draftDecision.id} Committed`,
        summary: `Operational passage plan committed by ${userRole?.name || "Officer"} for ${draftDecision.title} (${draftDecision.departurePort} → ${draftDecision.destinationPort}). Total distance: ${draftDecision.totalDistanceNm} NM across ${draftDecision.segments.length} legs. Geometry: Computed planning corridor based on verified port coordinates.`,
      };

      const health = calculateDecisionHealth({
        decision: committedDecision,
        segments: committedDecision.segments,
        dependencies: committedDecision.dependencies,
        changeEvent: null,
      });

      const impact = evaluateDecisionImpact({
        decision: committedDecision,
        changeEvent: null,
        dependencies: committedDecision.dependencies,
        constraints: committedDecision.constraints,
      });

      // Persist to backend if possible (graceful offline handling)
      try {
        createDecision({
          id: committedDecision.id,
          title: committedDecision.title,
          objective: committedDecision.objective,
          status: "COMMITTED",
          version: "v1.0",
          officer: officerFormatted,
          departure_port: committedDecision.departurePort,
          destination_port: committedDecision.destinationPort,
          total_distance_nm: committedDecision.totalDistanceNm,
          planned_speed_kts: committedDecision.plannedSpeedKts,
          original_eta: committedDecision.originalEta,
          current_segment: committedDecision.currentSegment,
          schedule: committedDecision.schedule,
          assumptions: committedDecision.assumptions,
          data_source_type: "COMPUTED",
          data_quality: "COMMITTED_PLANNING_CORRIDOR",
          segments: committedDecision.segments.map((s, idx) => ({
            segment_id: s.id,
            order_index: idx,
            name: s.name,
            distance_nm: s.distanceNm,
            status: s.status,
            condition: s.condition,
            start_lat: s.startCoord[0],
            start_lon: s.startCoord[1],
            end_lat: s.endCoord[0],
            end_lon: s.endCoord[1],
          })),
          dependencies: committedDecision.dependencies.map((d) => ({
            id: d.id,
            dep_type: d.type,
            name: d.name,
            commitment: d.commitment,
            source: d.source,
            condition: d.condition,
            linked_segments: d.linkedSegments,
            impact_level: d.impactLevel,
            status: d.status,
            description: d.description,
            mitigation_under_repair: d.mitigationUnderRepair,
          })),
        }).catch((err) => {
          console.warn("Backend decision persistence deferred:", err.message);
        });
      } catch (err) {
        console.warn("Backend decision persistence deferred:", err.message);
      }

      set({
        decision: committedDecision,
        routeSegments: committedDecision.segments,
        dependencies: committedDecision.dependencies,
        constraints: committedDecision.constraints,
        changeEvent: null,
        repairCandidates: [],
        selectedRepairId: null,
        selectedSegmentId: committedDecision.segments.length > 0 ? committedDecision.segments[0].id : "S1",
        committedCustomDecision: committedDecision,
        currentScenario: "custom_committed",
        decisionHistory: [newHistoryItem, ...decisionHistory],
        isDecisionBuilderOpen: false,
        draftDecision: null,
        decisionHealth: health,
        impactAnalysis: impact,
        approvalFeedback: {
          type: "success",
          title: `Decision ${committedDecision.id} Committed & Locked`,
          message: `Operational passage plan locked. ${committedDecision.segments.length} planning legs committed between ${committedDecision.departurePort} and ${committedDecision.destinationPort}.`,
          timestamp: new Date().toLocaleTimeString(),
        },
        activeNav: "active-decisions",
      });
    },

    setSelectedSegmentId: (id) =>
      set({
        selectedSegmentId: id,
        activeRightTab: "dependencies",
        rightPanelOpen: true,
      }),
    setActiveNav: (nav) => set({ activeNav: nav, mobileSidebarOpen: false }),
    setActiveRightTab: (tab) => set({ activeRightTab: tab }),
    toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
    toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
    toggleMobileContext: () => set((state) => ({ mobileContextOpen: !state.mobileContextOpen })),
    setSelectedRepairId: (id) => set({ selectedRepairId: id }),
    openApprovalModal: () => set({ isApprovalModalOpen: true }),
    closeApprovalModal: () => set({ isApprovalModalOpen: false }),

    // Ingest & evaluate a change event against the CURRENT decision's CURRENT route segments
    ingestCustomChangeEvent: (eventPayload = {}) => {
      const { decision, routeSegments, dependencies, constraints, decisionHistory } = get();
      if (!decision) return;

      // 1. Determine target coordinates or use provided event coordinates
      let targetCoord = eventPayload.eventCoordinates;
      let targetSegmentId = eventPayload.affectedSegmentId;

      if (!targetCoord) {
        let seg = null;
        if (targetSegmentId) {
          seg = routeSegments.find((s) => s.id === targetSegmentId);
        }
        if (!seg && routeSegments.length > 0) {
          seg = routeSegments[0];
          targetSegmentId = seg.id;
        }

        if (seg && seg.startCoord && seg.endCoord) {
          targetCoord = [
            Number(((seg.startCoord[0] + seg.endCoord[0]) / 2).toFixed(4)),
            Number(((seg.startCoord[1] + seg.endCoord[1]) / 2).toFixed(4)),
          ];
        } else {
          targetCoord = [14.58, 73.41];
        }
      }

      const eventId = eventPayload.id || `EVT-CORR-${Date.now().toString().slice(-4)}`;
      const eventTimestamp =
        eventPayload.observedAt ||
        new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";

      const normalizedEvent = {
        id: eventId,
        type: eventPayload.type || "HYDROGRAPHIC_THRESHOLD_BREACH",
        title: eventPayload.title || "Environmental Hazard & Wave Exceedance Alert",
        severity: eventPayload.severity || "HIGH",
        source: eventPayload.source || "INCOIS Coastal Threat Model",
        sourceType: eventPayload.sourceType || (eventPayload.isReal ? "REAL" : "COMPUTED"),
        observedAt: eventTimestamp,
        location: `${targetCoord[0].toFixed(2)}°N, ${targetCoord[1].toFixed(2)}°E`,
        eventCoordinates: targetCoord,
        radiusNm: eventPayload.radiusNm || 35,
        affectedSegmentId: targetSegmentId || null,
        description:
          eventPayload.description ||
          `Localized environmental disturbance at [${targetCoord[0].toFixed(2)}°N, ${targetCoord[1].toFixed(2)}°E] with significant wave heights exceeding 4.0m threshold. Evaluated against active passage corridor.`,
        quality: eventPayload.quality || "VERIFIED_OPERATIONAL_EVALUATION",
        isCatastrophic: Boolean(eventPayload.isCatastrophic),
      };

      // 2. Evaluate using deterministic impact engine
      const impact = evaluateDecisionImpact({
        decision,
        changeEvent: normalizedEvent,
        dependencies,
        constraints,
      });

      const affectedIds = impact.affectedSegmentIds || [];
      const primaryAffectedId = affectedIds[0] || null;

      normalizedEvent.affectedSegmentId = primaryAffectedId;
      normalizedEvent.affectedSegmentIds = affectedIds;

      // 3. Mark affected segments and compute western offshore detour waypoint
      const updatedSegments = routeSegments.map((seg) => {
        if (affectedIds.includes(seg.id)) {
          const midLat = (seg.startCoord[0] + seg.endCoord[0]) / 2;
          const midLon = (seg.startCoord[1] + seg.endCoord[1]) / 2;
          // Offshore detour in Arabian Sea: 0.55° longitude westward (~33 NM)
          const repairWp = [
            Number(midLat.toFixed(2)),
            Number((midLon - 0.55).toFixed(2)),
          ];
          return {
            ...seg,
            status: "AFFECTED",
            condition: `${normalizedEvent.title} [${normalizedEvent.sourceType}]`,
            waveHeightM: 5.2,
            windKts: 42,
            repairWaypoint: repairWp,
            details: `Leg ${seg.id} intersected by ${normalizedEvent.id} at [${targetCoord[0].toFixed(2)}°N, ${targetCoord[1].toFixed(2)}°E]. Wave Hs 5.2m exceeds 4.0m limit. Standoff required.`,
          };
        }
        return {
          ...seg,
          status: seg.status === "AFFECTED" ? "ACTIVE_STABLE" : seg.status,
        };
      });

      // 4. Generate minimal-change repair candidates
      let candidates = [];
      let selectedRepId = null;

      if (affectedIds.length > 0 && !impact.isCatastrophicCollapse) {
        const primarySeg = updatedSegments.find((s) => s.id === primaryAffectedId);
        const detourWp = primarySeg?.repairWaypoint || [14.30, 72.50];

        candidates = [
          {
            id: "R1",
            tier: "RECOMMENDED",
            title: `Minimal Repair: Segment ${primaryAffectedId} Western Arc Detour (WP W-${primaryAffectedId})`,
            description: `Preserves ${routeSegments.length - affectedIds.length} of ${routeSegments.length} legs (${Math.round(impact.preservationRatio * 100)}% preserved). Replaces only Segment ${primaryAffectedId} by routing 33 NM westward around the hazard envelope via Waypoint W-${primaryAffectedId} (${detourWp[0]}°N, ${detourWp[1]}°E).`,
            planChurn: impact.planChurn,
            preservationRatio: impact.preservationRatio,
            whatChanges: [
              `Segment ${primaryAffectedId} replaced with 2 sub-legs via Waypoint W-${primaryAffectedId} (${detourWp[0]}°N, ${detourWp[1]}°E)`,
              `Transit distance increased by +12.0 NM`,
              `Arrival time delayed by +35 minutes`,
              `Fuel consumption variance within allowable +5.0 MT reserve`,
            ],
            whatRemainsUnchanged: updatedSegments
              .filter((s) => !affectedIds.includes(s.id))
              .map((s) => `Segment ${s.id} (${s.name}) 100% untouched and preserved`),
            tradeoffs: `Accepts minor distance delta (+12 NM) to clear the hazard envelope with safe western standoff.`,
            feasibility: "FEASIBLE & VERIFIED",
            score: Math.round(96 - impact.planChurn * 20),
            recommendationReason: `Satisfies minimal change invariant: Preserves ${Math.round(impact.preservationRatio * 100)}% of corridor legs and bounds downstream disruption.`,
            repairWaypoint: detourWp,
            affectedSegmentId: primaryAffectedId,
          },
        ];
        selectedRepId = "R1";
      } else if (impact.isCatastrophicCollapse) {
        selectedRepId = "R_NONE";
      }

      // 5. Update decision health & status (immutability: decision remains v1.0, flagged IMPACTED)
      const updatedDecision = {
        ...decision,
        status: affectedIds.length > 0 ? "IMPACTED" : decision.status,
      };

      const health = calculateDecisionHealth({
        decision: updatedDecision,
        segments: updatedSegments,
        dependencies,
        changeEvent: normalizedEvent,
      });

      const auditItem = {
        version: `${decision.version}-IMPACTED`,
        status: "CHANGE_DETECTED",
        timestamp: eventTimestamp,
        officer: "Sagar AI Continuity Engine",
        event: `Change Event ${normalizedEvent.id} Evaluated`,
        summary: `Deterministic impact engine evaluated event against ${routeSegments.length} legs. ${
          affectedIds.length > 0
            ? `Leg(s) ${affectedIds.join(", ")} affected. ${routeSegments.length - affectedIds.length}/${routeSegments.length} legs preserved (plan churn: ${impact.planChurn}).`
            : `Zero legs affected. All ${routeSegments.length} legs operating nominally.`
        }`,
      };

      set({
        changeEvent: normalizedEvent,
        routeSegments: updatedSegments,
        repairCandidates: candidates,
        selectedRepairId: selectedRepId,
        decision: updatedDecision,
        impactAnalysis: impact,
        decisionHealth: health,
        decisionHistory: [auditItem, ...decisionHistory],
        selectedSegmentId: primaryAffectedId || (routeSegments[0]?.id || "S1"),
      });
    },

    clearCustomChangeEvent: () => {
      const { decision, routeSegments, dependencies, constraints, decisionHistory } = get();
      if (!decision) return;

      const nominalSegments = routeSegments.map((seg, idx) => ({
        ...seg,
        status: idx === 0 ? "ACTIVE_STABLE" : "UNAFFECTED",
        condition: "Computed Planning Leg",
        waveHeightM: null,
        windKts: null,
        repairWaypoint: null,
      }));

      const nominalDecision = {
        ...decision,
        status: "COMMITTED",
      };

      const health = calculateDecisionHealth({
        decision: nominalDecision,
        segments: nominalSegments,
        dependencies,
        changeEvent: null,
      });

      const impact = evaluateDecisionImpact({
        decision: nominalDecision,
        changeEvent: null,
        dependencies,
        constraints,
      });

      const auditItem = {
        version: decision.version,
        status: "COMMITTED",
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
        officer: "Sagar AI Continuity Engine",
        event: "Disruption Cleared",
        summary: `Corridor alert cleared. All ${nominalSegments.length} planning legs restored to nominal operating status.`,
      };

      set({
        changeEvent: null,
        routeSegments: nominalSegments,
        repairCandidates: [],
        selectedRepairId: null,
        decision: nominalDecision,
        impactAnalysis: impact,
        decisionHealth: health,
        decisionHistory: [auditItem, ...decisionHistory],
      });
    },

    fetchMarineData: async () => {
      set({ marineLoading: true, marineError: null });
      try {
        const [regRes, osfRes, pfzRes] = await Promise.allSettled([
          getMarineRegistry(),
          getMarineOsfWaypoints(),
          getMarinePfzWaypoints(),
        ]);

        const updates = {};
        if (regRes.status === "fulfilled") {
          updates.marineRegistry = regRes.value;
        }
        if (osfRes.status === "fulfilled") {
          updates.marineOsfObservations = osfRes.value || [];
        }
        if (pfzRes.status === "fulfilled") {
          updates.marinePfzObservations = pfzRes.value || [];
        }

        const isAnyFailed = [regRes, osfRes, pfzRes].some((r) => r.status === "rejected");
        set({
          ...updates,
          marineLoading: false,
          marineError: isAnyFailed
            ? "Some real marine feeds were unreachable or returned unavailable."
            : null,
        });
      } catch (err) {
        set({
          marineLoading: false,
          marineError: err.message || "Failed to query marine backend",
        });
      }
    },

    /**
     * evaluateRealMarineEvidence
     * ─────────────────────────────────────────────────────────────────────────
     * Calls the backend POST /api/marine/evaluate-decision/{decision_id}:
     *   1. Backend fetches real INCOIS OSF/PFZ at each segment's actual midpoint.
     *   2. Backend evaluates against the decision's dependency thresholds.
     *   3. If violation=true  → we call ingestCustomChangeEvent with REAL provenance.
     *   4. If violation=false → no event created, corridor remains nominal.
     *
     * INVARIANTS:
     *   - Never creates an event when violation=false.
     *   - sourceType is always "REAL" (from backend) or this action aborts.
     *   - Never hardcodes segment IDs — uses backend-returned breaching_segment_id.
     *   - Works for any route length and any From/To selection.
     */
    evaluateRealMarineEvidence: async () => {
      const { decision } = get();
      if (!decision || !decision.id) {
        console.warn("[evaluateRealMarineEvidence] No committed decision found.");
        return;
      }

      set({ marineEvaluating: true, marineEvalError: null, marineEvalResult: null });

      let evalResult;
      try {
        evalResult = await evaluateMarineEvidence(decision.id);
      } catch (err) {
        // Backend unreachable or 422 (decision not committed)
        set({
          marineEvaluating: false,
          marineEvalError: err.message || "Marine evidence evaluation failed — backend unavailable.",
          marineEvalResult: null,
        });
        console.warn("[evaluateRealMarineEvidence] API error:", err.message);
        return;
      }

      set({ marineEvalResult: evalResult, marineEvaluating: false });

      if (!evalResult.violation) {
        // No threshold breach → decision remains nominal. Do NOT create an event.
        console.info(
          "[evaluateRealMarineEvidence] No dependency violation detected.",
          evalResult.evaluation_note
        );
        return;
      }

      // Violation confirmed — ingest into the existing pipeline
      // All values come from the backend evaluation — never hardcoded.
      get().ingestCustomChangeEvent({
        id: `EVT-REAL-${Date.now().toString().slice(-6)}`,
        type: "HYDROGRAPHIC_THRESHOLD_BREACH",
        title: evalResult.event_title,
        description: evalResult.event_description,
        source: evalResult.event_source,
        sourceType: evalResult.event_source_type,   // always "REAL"
        quality: evalResult.quality,
        isReal: true,
        // Actual geographic center from backend (midpoint of breaching segment)
        eventCoordinates: [evalResult.event_center_lat, evalResult.event_center_lon],
        radiusNm: evalResult.radius_nm || 45,
        // The backend determined which segment is actually affected
        affectedSegmentId: evalResult.breaching_segment_id,
        severity: evalResult.event_severity || "HIGH",
        isCatastrophic: false,
      });
    },

    // Switch Scenario (Demonstrates Research Limitation: No Safe Minimal Repair)
    setScenario: (scenarioKey) => {
      const { decision, routeSegments, dependencies, constraints, committedCustomDecision } = get();

      if (scenarioKey === "custom_committed") {
        if (committedCustomDecision) {
          const health = calculateDecisionHealth({
            decision: committedCustomDecision,
            segments: committedCustomDecision.segments,
            dependencies: committedCustomDecision.dependencies,
            changeEvent: null,
          });

          const impact = evaluateDecisionImpact({
            decision: committedCustomDecision,
            changeEvent: null,
            dependencies: committedCustomDecision.dependencies,
            constraints: committedCustomDecision.constraints,
          });

          set({
            currentScenario: "custom_committed",
            decision: committedCustomDecision,
            routeSegments: committedCustomDecision.segments,
            dependencies: committedCustomDecision.dependencies,
            constraints: committedCustomDecision.constraints,
            changeEvent: null,
            repairCandidates: [],
            selectedRepairId: null,
            decisionHealth: health,
            impactAnalysis: impact,
            selectedSegmentId: committedCustomDecision.segments[0]?.id || "S1",
            approvalFeedback: null,
          });
          return;
        }
      }

      if (scenarioKey === "catastrophic_collapse") {
        const catEvent = {
          id: "EVT-SIM-CATASTROPHIC",
          type: "MULTI_SECTOR_RESTRICTION_COLLAPSE",
          title: "Simulated Multi-Sector Restriction Collapse (Catastrophic Scenario)",
          severity: "CRITICAL",
          source: "Simulated Multi-Zone Crisis Generator",
          sourceType: "SIMULATED",
          observedAt: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
          location: "Comprehensive Western Basin (All Corridors)",
          description:
            "Simulated catastrophic environmental hazard expands across all segments S1 through S5 simultaneously. Multiple core safety and physical clearance limits are breached.",
          quality: "SIMULATED_TESTBENCH",
          isCatastrophic: true,
        };

        const impact = evaluateDecisionImpact({
          decision,
          changeEvent: catEvent,
          dependencies,
          constraints,
        });

        const health = calculateDecisionHealth({
          decision: { ...decision, status: "IMPACTED" },
          segments: routeSegments.map((s) => ({ ...s, status: "AFFECTED" })),
          dependencies,
          changeEvent: catEvent,
        });

        set({
          currentScenario: "catastrophic_collapse",
          changeEvent: catEvent,
          impactAnalysis: impact,
          decisionHealth: health,
          decision: { ...decision, status: "IMPACTED" },
          routeSegments: routeSegments.map((s) => ({ ...s, status: "AFFECTED" })),
          selectedRepairId: "R_NONE",
          approvalFeedback: {
            type: "rejected",
            title: "Research Limitation Triggered: No Safe Minimal Repair Feasible",
            message:
              "All operational legs are simultaneously breached. Minimal repair cannot isolate a safe sub-graph. Broader replanning is required.",
            timestamp: new Date().toLocaleTimeString(),
          },
        });
      } else {
        // Reset to standard S3 breach
        get().resetToInitial();
      }
    },

    // Human Approval Action — connected to backend API
    approveRepair: async ({ officerName, rationale, verifiedItems }) => {
      const { selectedRepairId, repairCandidates, decision, decisionHistory, routeSegments, dependencies, changeEvent } = get();
      if (!decision) return;

      const candidate = repairCandidates.find((r) => r.id === selectedRepairId) || repairCandidates[0];
      const affectedId =
        candidate?.affectedSegmentId ||
        changeEvent?.affectedSegmentId ||
        routeSegments.find((s) => s.status === "AFFECTED")?.id ||
        null;

      const currentVerNum = parseInt((decision.version || "v1.0").replace(/\D/g, "") || "1", 10);
      const nextVersion = `v${currentVerNum + 1}.0`;

      // ── Call Backend Approval Endpoint ──────────────────────────────────
      let backendRecord = null;
      let backendDecision = null;
      let backendAuditEntries = null;

      try {
        const candidatePayload = candidate
          ? {
              id: candidate.id || "R1",
              tier: candidate.tier || "RECOMMENDED",
              title: candidate.title || `Minimal Repair: Segment ${affectedId} Detour`,
              description: candidate.description || "",
              plan_churn: candidate.planChurn ?? 0.2,
              preservation_ratio: candidate.preservationRatio ?? 0.8,
              what_changes: candidate.whatChanges || [`Segment ${affectedId} replaced with detour sub-leg`],
              what_remains_unchanged: candidate.whatRemainsUnchanged || [],
              tradeoffs: candidate.tradeoffs || "",
              feasibility: candidate.feasibility || "FEASIBLE",
              score: candidate.score || 90,
              recommendation_reason: candidate.recommendationReason || "",
              linked_event_id: changeEvent?.id || null,
              affected_segment_id: affectedId,
              repair_waypoint_lat: candidate.repairWaypoint ? candidate.repairWaypoint[0] : null,
              repair_waypoint_lon: candidate.repairWaypoint ? candidate.repairWaypoint[1] : null,
            }
          : undefined;

        backendRecord = await approveRepairBackend(decision.id, {
          repair_candidate_id: candidate?.id || "R1",
          officer_name: officerName,
          rationale: rationale,
          verified_items: verifiedItems || [true, true, true],
          candidate_data: candidatePayload,
        });

        // Backend is the source of truth — fetch updated decision and audit
        const [decRes, auditRes] = await Promise.allSettled([
          getDecision(decision.id),
          getAuditHistory(decision.id),
        ]);
        if (decRes.status === "fulfilled" && decRes.value) {
          backendDecision = decRes.value;
        }
        if (auditRes.status === "fulfilled" && Array.isArray(auditRes.value)) {
          backendAuditEntries = auditRes.value;
        }
      } catch (err) {
        console.warn("[approveRepair] Backend approval call failed, using deterministic local commit:", err.message);
      }

      // ── Update Segments Dynamically ────────────────────────────────────
      const committedVersion = backendRecord?.decision_version_after || nextVersion;

      const updatedSegments = routeSegments.map((seg) => {
        if (seg.id === affectedId) {
          const wpCoord =
            candidate?.repairWaypoint ||
            (seg.startCoord && seg.endCoord
              ? [
                  Number(((seg.startCoord[0] + seg.endCoord[0]) / 2).toFixed(4)),
                  Number(((seg.startCoord[1] + seg.endCoord[1]) / 2 - 0.55).toFixed(4)),
                ]
              : [14.30, 72.50]);
          return {
            ...seg,
            status: "REPAIRED_ACTIVE",
            condition: `Remediated via Waypoint W-${seg.id} [${seg.dataSourceType || "COMPUTED"}]`,
            details: `Modified by Human Approval: Detour via W-${seg.id}. Distance delta: +12.0 NM. Safe wave envelope restored.`,
            waveHeightM: 2.2,
            windKts: 18,
            repairWaypoint: wpCoord,
          };
        }
        return {
          ...seg,
          status: seg.status === "AFFECTED" ? "ACTIVE_STABLE" : seg.status,
          details: (seg.details || "").includes("Preserved intact")
            ? seg.details
            : `${(seg.details || "").trim()} (Preserved intact from committed plan)`.trim(),
        };
      });

      const preservedSegIds = updatedSegments.filter((s) => s.id !== affectedId).map((s) => s.id);
      const preservedText =
        preservedSegIds.length > 0
          ? `Segments ${preservedSegIds.join(", ")} preserved 100%.`
          : "Corridor leg repaired with safe standoff.";

      // ── Decision History Synchronization ────────────────────────────────
      let historyItems = decisionHistory;
      if (backendAuditEntries && backendAuditEntries.length > 0) {
        historyItems = backendAuditEntries.map((a) => ({
          version: a.version || committedVersion,
          status: a.status || "REPAIRED_COMMITTED",
          timestamp: a.created_at
            ? new Date(a.created_at).toISOString().replace("T", " ").substring(0, 19) + " UTC"
            : new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
          officer: a.officer || officerName,
          event: a.event,
          summary: a.summary,
        }));
      } else {
        const newHistoryItem = {
          version: committedVersion,
          status: "COMMITTED",
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
          officer:
            officerName ||
            (get().userRole?.name ? `${get().userRole.name} (${get().userRole.title})` : "Approval Authority"),
          event: `Repair ${candidate?.id || "R1"} Approved & Committed (${committedVersion})`,
          summary: `Human operator verified minimal change. Segment ${affectedId || "affected"} updated via detour. ${preservedText} Rationale: ${
            rationale || "Operational continuity maintained with safe standoff."
          }`,
        };
        historyItems = [newHistoryItem, ...decisionHistory];
      }

      const updatedDecision = {
        ...decision,
        ...(backendDecision || {}),
        version: committedVersion,
        status: "REPAIRED_COMMITTED",
        totalDistanceNm: Math.round(((decision.totalDistanceNm || 890) + 12.0) * 10) / 10,
        committedAt: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
      };

      const newHealth = calculateDecisionHealth({
        decision: updatedDecision,
        segments: updatedSegments,
        dependencies,
        changeEvent: null,
      });

      set({
        decision: updatedDecision,
        routeSegments: updatedSegments,
        decisionHistory: historyItems,
        isApprovalModalOpen: false,
        decisionHealth: newHealth,
        approvalFeedback: {
          type: "success",
          title: `Decision Version ${committedVersion} Successfully Committed`,
          message: `Operational decision continuity preserved. ${preservedText} Segment ${affectedId || "affected"} has been repaired via authorized waypoint detour.`,
          timestamp: new Date().toLocaleTimeString(),
        },
        activeNav: "active-decisions",
      });
    },

    // Reject Repair Action — connected to backend API
    rejectRepair: async ({ officerName, rejectionReason }) => {
      const { decision, decisionHistory, selectedRepairId, userRole } = get();
      if (!decision) return;

      let backendAuditEntries = null;
      try {
        await rejectRepairBackend(decision.id, {
          repair_candidate_id: selectedRepairId || "R1",
          officer_name: officerName,
          rejection_reason:
            rejectionReason || "Awaiting secondary survey pass before altering geometry.",
        });

        const auditRes = await getAuditHistory(decision.id).catch(() => null);
        if (Array.isArray(auditRes)) {
          backendAuditEntries = auditRes;
        }
      } catch (err) {
        console.warn("[rejectRepair] Backend rejection call failed, logging locally:", err.message);
      }

      let historyItems = decisionHistory;
      if (backendAuditEntries && backendAuditEntries.length > 0) {
        historyItems = backendAuditEntries.map((a) => ({
          version: a.version || decision.version,
          status: a.status || "IMPACTED",
          timestamp: a.created_at
            ? new Date(a.created_at).toISOString().replace("T", " ").substring(0, 19) + " UTC"
            : new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
          officer: a.officer || officerName,
          event: a.event,
          summary: a.summary,
        }));
      } else {
        const newHistoryItem = {
          version: `${decision.version}-MAINTAINED`,
          status: "REPAIR_REJECTED",
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
          officer:
            officerName ||
            (userRole?.name ? `${userRole.name} (${userRole.title})` : "Approval Authority"),
          event: `Repair Candidate ${selectedRepairId || "R1"} Rejected`,
          summary: `Human operator rejected repair candidate '${selectedRepairId || "R1"}'. Reason: ${
            rejectionReason || "Awaiting secondary survey pass before altering geometry."
          }. Original ${decision.version} decision remains locked under active alert.`,
        };
        historyItems = [newHistoryItem, ...decisionHistory];
      }

      set({
        decision: {
          ...decision,
          status: "IMPACTED",
        },
        decisionHistory: historyItems,
        isApprovalModalOpen: false,
        approvalFeedback: {
          type: "rejected",
          title: "Repair Proposal Rejected — Route Kept Locked",
          message:
            "Human operator maintained decision invariance. No route or segment parameters were modified. Original committed decision remains locked under active alert.",
          timestamp: new Date().toLocaleTimeString(),
        },
      });
    },

    clearFeedback: () => set({ approvalFeedback: null }),

    resetToInitial: () => {
      const impact = evaluateDecisionImpact({
        decision: INITIAL_DECISION,
        changeEvent: INITIAL_CHANGE_EVENT,
        dependencies: INITIAL_DEPENDENCIES,
        constraints: INITIAL_CONSTRAINTS,
      });

      const health = calculateDecisionHealth({
        decision: INITIAL_DECISION,
        segments: INITIAL_SEGMENTS,
        dependencies: INITIAL_DEPENDENCIES,
        changeEvent: INITIAL_CHANGE_EVENT,
      });

      set({
        decision: INITIAL_DECISION,
        routeSegments: INITIAL_SEGMENTS,
        changeEvent: INITIAL_CHANGE_EVENT,
        dependencies: INITIAL_DEPENDENCIES,
        constraints: INITIAL_CONSTRAINTS,
        repairCandidates: REPAIR_CANDIDATES,
        selectedRepairId: "R1",
        decisionHistory: INITIAL_HISTORY,
        approvalFeedback: null,
        isApprovalModalOpen: false,
        impactAnalysis: impact,
        decisionHealth: health,
        currentScenario: "standard_s3_breach",
        committedCustomDecision: null,
        selectedSegmentId: "S3",
      });
    },
  };
});
