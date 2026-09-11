/**
 * Sagar AI — Verified Coastal Port Registry & Corridor Model
 * Problem Statement: SIH 26176
 *
 * Provides a provider-independent location registry of verified Indian coastal
 * locations and ports on the Arabian Sea / Western Seaboard and Southern Corridor.
 *
 * INVARIANT:
 * - Coordinates are verified hydrographic/port coordinates.
 * - Provider-independent: Designed with an interface that can be plugged into a
 *   future official geocoder without altering downstream decision models.
 */

export const VERIFIED_COASTAL_LOCATIONS = [
  {
    id: "LOC-INNSA",
    name: "Nhava Sheva / Mumbai Base (JNPT)",
    shortName: "Nhava Sheva (Mumbai)",
    portCode: "INNSA",
    state: "Maharashtra",
    corridorZone: "North Western Seaboard",
    coordinates: [18.95, 72.85], // [lat, lon]
    details: "Major container terminal and hydrographic base on Konkan Coast. TSS Sector departure fairway.",
    depthChartDatumM: 14.5,
    channelType: "Deepwater Fairway & TSS",
    sourceProvenance: "Project location registry (WGS84 port centroid)",
    dataSourceType: "REAL",
    verificationStatus: "VERIFIED_REGISTRY_ENTRY",
  },
  {
    id: "LOC-INMRM",
    name: "Mormugao Harbour / Goa",
    shortName: "Mormugao (Goa)",
    portCode: "INMRM",
    state: "Goa",
    corridorZone: "Central Western Seaboard",
    coordinates: [15.42, 73.80],
    details: "Natural deepwater harbour at Zuari estuary. Central Western Seaboard checkpoint.",
    depthChartDatumM: 14.1,
    channelType: "Protected Natural Basin",
    sourceProvenance: "Project location registry (WGS84 port centroid)",
    dataSourceType: "REAL",
    verificationStatus: "VERIFIED_REGISTRY_ENTRY",
  },
  {
    id: "LOC-INKRW",
    name: "Karwar Port / Coastal Station",
    shortName: "Karwar (Karnataka)",
    portCode: "INKRW",
    state: "Karnataka",
    corridorZone: "Central Western Seaboard",
    coordinates: [14.80, 74.13],
    details: "Navigational transition hub. Bounded by Karwar hydrographic corridor.",
    depthChartDatumM: 12.0,
    channelType: "Coastal Transition",
    sourceProvenance: "Project location registry (WGS84 port centroid)",
    dataSourceType: "REAL",
    verificationStatus: "VERIFIED_REGISTRY_ENTRY",
  },
  {
    id: "LOC-INNML",
    name: "New Mangalore Port",
    shortName: "New Mangalore",
    portCode: "INNML",
    state: "Karnataka",
    corridorZone: "Mid-South Western Seaboard",
    coordinates: [12.92, 74.82],
    details: "Major all-weather port on Canara coast. INCOIS ocean observation buoy sector.",
    depthChartDatumM: 15.1,
    channelType: "Deepwater Coastal Basin",
    sourceProvenance: "Project location registry (WGS84 port centroid)",
    dataSourceType: "REAL",
    verificationStatus: "VERIFIED_REGISTRY_ENTRY",
  },
  {
    id: "LOC-INCOK",
    name: "Cochin / Kochi Fairway Port",
    shortName: "Kochi (Cochin)",
    portCode: "INCOK",
    state: "Kerala",
    corridorZone: "South Western Seaboard",
    coordinates: [9.96, 76.24],
    details: "Strategic maritime gateway on Arabian Sea - Indian Ocean fairway. TSS rendezvous buoy.",
    depthChartDatumM: 14.5,
    channelType: "Estuarine Deep Basin & Fairway",
    sourceProvenance: "Project location registry (WGS84 port centroid)",
    dataSourceType: "REAL",
    verificationStatus: "VERIFIED_REGISTRY_ENTRY",
  },
  {
    id: "LOC-INVZJ",
    name: "Vizhinjam Transshipment Terminus",
    shortName: "Vizhinjam (Kerala)",
    portCode: "INVZJ",
    state: "Kerala",
    corridorZone: "South Western Seaboard",
    coordinates: [8.37, 76.99],
    details: "Deepwater transshipment terminal near international east-west shipping channel.",
    depthChartDatumM: 18.0,
    channelType: "Ultra-Deepwater Transshipment Basin",
    sourceProvenance: "Project location registry (WGS84 port centroid)",
    dataSourceType: "REAL",
    verificationStatus: "VERIFIED_REGISTRY_ENTRY",
  },
  {
    id: "LOC-INTUT",
    name: "V.O. Chidambaranar / Tuticorin",
    shortName: "VOC Port (Tuticorin)",
    portCode: "INTUT",
    state: "Tamil Nadu",
    corridorZone: "Gulf of Mannar / Southern Corridor",
    coordinates: [8.75, 78.18],
    details: "All-weather sheltered port in Gulf of Mannar. South-eastern coastal terminal.",
    depthChartDatumM: 14.2,
    channelType: "Gulf of Mannar Sheltered Basin",
    sourceProvenance: "Project location registry (WGS84 port centroid)",
    dataSourceType: "REAL",
    verificationStatus: "VERIFIED_REGISTRY_ENTRY",
  },
];

export const DECISION_TYPES = [
  {
    id: "COMMERCIAL_CARGO_TRANSIT",
    label: "Commercial Cargo Transit (Container / Bulk)",
    description: "Scheduled commercial passage with committed berth and fairway rendezvous windows.",
    planningProfile: "Scheduled commercial cargo transit",
    defaultPlanningSpeedKts: 16.5,
  },
  {
    id: "COASTAL_SURVEY_OPERATION",
    label: "Coastal Hydrographic & Survey Operation",
    description: "Hydrographic observation cruise with environmental sensor and roll envelopes.",
    planningProfile: "Hydrographic research & coastal survey",
    defaultPlanningSpeedKts: 14.0,
  },
  {
    id: "TANKER_PETROLEUM_CORRIDOR",
    label: "Coastal Energy & Tanker Transit",
    description: "Hydrocarbon carrier passage under stringent under-keel clearance (UKC) rules.",
    planningProfile: "Deep-draft petroleum / chemical tanker",
    defaultPlanningSpeedKts: 13.5,
  },
  {
    id: "SAR_EMERGENCY_STANDBY",
    label: "Maritime Assistance & SAR Standby",
    description: "Priority deployment fairway with flexible corridor clearance windows.",
    planningProfile: "Maritime assistance & SAR rapid deployment",
    defaultPlanningSpeedKts: 20.0,
  },
];

/**
 * Calculates great-circle nautical distance between two [lat, lon] coordinates.
 */
export function calculateDistanceNm(coord1, coord2) {
  const lat1 = (coord1[0] * Math.PI) / 180;
  const lat2 = (coord2[0] * Math.PI) / 180;
  const dLat = ((coord2[0] - coord1[0]) * Math.PI) / 180;
  const dLon = ((coord2[1] - coord1[1]) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1, Math.round(3440.065 * c));
}

/**
 * Generates an ordered sequence of route segments between two verified ports.
 * Intermediate ports along the Western Seaboard are automatically linked as waypoints.
 */
export function generateCorridorSegments(fromLocationId, toLocationId) {
  const fromIdx = VERIFIED_COASTAL_LOCATIONS.findIndex((l) => l.id === fromLocationId);
  const toIdx = VERIFIED_COASTAL_LOCATIONS.findIndex((l) => l.id === toLocationId);

  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
    return [];
  }

  // Determine path along ordered coastal sequence
  let path = [];
  if (fromIdx < toIdx) {
    path = VERIFIED_COASTAL_LOCATIONS.slice(fromIdx, toIdx + 1);
  } else {
    path = VERIFIED_COASTAL_LOCATIONS.slice(toIdx, fromIdx + 1).reverse();
  }

  const segments = [];
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const dist = calculateDistanceNm(p1.coordinates, p2.coordinates);

    segments.push({
      id: `S${i + 1}`,
      name: `${p1.shortName} to ${p2.shortName}`,
      distanceNm: dist,
      status: i === 0 ? "ACTIVE_STABLE" : "UNAFFECTED",
      condition: "Computed Planning Leg",
      geometryType: "COMPUTED_PLANNING_CORRIDOR",
      dataSourceType: "COMPUTED",
      waveHeightM: null,
      windKts: null,
      details: `Leg ${i + 1}: Computed planning leg from ${p1.name} (${p1.coordinates[0]}°N, ${p1.coordinates[1]}°E) to ${p2.name} (${p2.coordinates[0]}°N, ${p2.coordinates[1]}°E). Channel: ${p2.channelType}.`,
      startCoord: p1.coordinates,
      endCoord: p2.coordinates,
    });
  }

  return segments;
}
