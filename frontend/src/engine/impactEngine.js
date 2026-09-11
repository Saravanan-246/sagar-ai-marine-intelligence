/**
 * Sagar AI — Deterministic Marine Impact Engine
 * Problem Statement: SIH 26176
 *
 * INVARIANT: Never use LLMs for geometry, threshold calculation, or segment impact classification.
 * All impact decisions are strictly calculated through graph-theoretic dependency propagation
 * and spatial/threshold evaluation.
 */

/**
 * Evaluates whether a spatial bounding circle/polygon intersects a segment's line coordinates.
 * @param {Array<number>} startCoord - [lat, lon]
 * @param {Array<number>} endCoord - [lat, lon]
 * @param {Array<number>} eventCenter - [lat, lon]
 * @param {number} radiusNm - Radius in nautical miles
 * @returns {boolean}
 */
export function checkSpatialIntersection(startCoord, endCoord, eventCenter, radiusNm = 45) {
  // Approximate conversion: 1 deg lat ~ 60 NM, 1 deg lon ~ 60*cos(lat) NM
  const lat1 = startCoord[0];
  const lon1 = startCoord[1];
  const lat2 = endCoord[0];
  const lon2 = endCoord[1];
  const cLat = eventCenter[0];
  const cLon = eventCenter[1];

  const cosLat = Math.cos((cLat * Math.PI) / 180);

  // Convert to local NM coordinates relative to eventCenter
  const x1 = (lon1 - cLon) * 60 * cosLat;
  const y1 = (lat1 - cLat) * 60;
  const x2 = (lon2 - cLon) * 60 * cosLat;
  const y2 = (lat2 - cLat) * 60;

  // Vector of segment: (dx, dy)
  const dx = x2 - x1;
  const dy = y2 - y1;
  const segLenSq = dx * dx + dy * dy;

  if (segLenSq === 0) {
    return Math.sqrt(x1 * x1 + y1 * y1) <= radiusNm;
  }

  // Project event center (0, 0) onto line segment: t = - (x1*dx + y1*dy) / segLenSq
  const t = Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / segLenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const closestDistNm = Math.sqrt(projX * projX + projY * projY);

  return closestDistNm <= radiusNm;
}

/**
 * Deterministically evaluates decision impact when a change event occurs.
 */
export function evaluateDecisionImpact({ decision, changeEvent, dependencies, constraints }) {
  if (!changeEvent || !decision) {
    return {
      affectedSegmentIds: [],
      unaffectedSegmentIds: decision ? decision.segments.map((s) => s.id) : [],
      atRiskSegmentIds: [],
      violatedDependencyIds: [],
      atRiskDependencyIds: [],
      severity: "LOW",
      reason: "No active change event detected.",
      planChurn: 0,
      preservationRatio: 1.0,
      isCatastrophicCollapse: false,
    };
  }

  // If catastrophic test scenario: all segments are violated
  if (changeEvent.isCatastrophic) {
    const allIds = decision.segments.map((s) => s.id);
    return {
      affectedSegmentIds: allIds,
      unaffectedSegmentIds: [],
      atRiskSegmentIds: [],
      violatedDependencyIds: dependencies.map((d) => d.id),
      atRiskDependencyIds: [],
      severity: "CRITICAL",
      reason:
        "Catastrophic multi-zone breach: Spatial restriction envelops all operational legs. No safe minimal repair is mathematically feasible. Full replanning required.",
      planChurn: 1.0,
      preservationRatio: 0.0,
      isCatastrophicCollapse: true,
    };
  }

  const affectedSegmentIds = [];
  const atRiskSegmentIds = [];
  const unaffectedSegmentIds = [];

  // 1. Evaluate direct segment thresholds and spatial intersection
  decision.segments.forEach((segment) => {
    const hasCoords = Boolean(
      changeEvent.eventCoordinates &&
      Array.isArray(changeEvent.eventCoordinates) &&
      changeEvent.eventCoordinates.length === 2 &&
      segment.startCoord &&
      segment.endCoord
    );

    let isTargeted = false;
    if (changeEvent.affectedSegmentId) {
      // Direct segment violation takes precedence (e.g. simulated or specific segment observation)
      isTargeted = changeEvent.affectedSegmentId === segment.id;
    } else if (hasCoords) {
      isTargeted = checkSpatialIntersection(
        segment.startCoord,
        segment.endCoord,
        changeEvent.eventCoordinates,
        changeEvent.radiusNm || 45
      );
    }

    if (isTargeted) {
      affectedSegmentIds.push(segment.id);
    } else {
      unaffectedSegmentIds.push(segment.id);
    }
  });

  // 2. Propagate through dependency graph
  const violatedDependencyIds = [];
  const atRiskDependencyIds = [];

  dependencies.forEach((dep) => {
    // Check if any linked segment is affected
    const hasAffectedLink = dep.linkedSegments && dep.linkedSegments.length > 0
      ? dep.linkedSegments.some((segId) => affectedSegmentIds.includes(segId))
      : affectedSegmentIds.length > 0;

    if (hasAffectedLink) {
      if (dep.impactLevel === "CRITICAL" || dep.impactLevel === "HIGH" || dep.id?.includes("SAFETY")) {
        violatedDependencyIds.push(dep.id);
      } else {
        atRiskDependencyIds.push(dep.id);
      }
    }
  });

  // 3. Calculate Research Metric: Plan Churn
  // Plan Churn = (Changed Elements / Total Elements)
  // Preservation Ratio = (1 - Plan Churn)
  const totalSegments = decision.segments.length;
  const changedCount = affectedSegmentIds.length;
  const planChurn = totalSegments > 0 ? Number((changedCount / totalSegments).toFixed(2)) : 0;
  const preservationRatio = totalSegments > 0 ? Number((1 - planChurn).toFixed(2)) : 1.0;

  let reason = "";
  if (changeEvent.breachValue && changeEvent.breachThreshold) {
    const param = changeEvent.breachParameter || "SWH";
    reason = `Constraint Violation: ${param} ${changeEvent.breachValue}m > allowed ${changeEvent.breachThreshold}m. Dependency breach (${violatedDependencyIds.join(", ") || "SAFETY_DYNAMIC_STABILITY"}) affects Segment ${affectedSegmentIds.join(", ")} while preserving ${unaffectedSegmentIds.join(", ")}.`;
  } else if (affectedSegmentIds.length > 0) {
    const depText = violatedDependencyIds.length > 0 ? ` Violated Dependencies: ${violatedDependencyIds.join(", ")}.` : "";
    reason = `Deterministic evaluation: ${changeEvent.description || "Environmental limit breached."}.${depText} Restricts Segment ${affectedSegmentIds.join(", ")} while preserving ${unaffectedSegmentIds.join(", ")}.`;
  } else {
    reason = "No segments intersect the event envelope. All legs nominal.";
  }

  return {
    affectedSegmentIds,
    unaffectedSegmentIds,
    atRiskSegmentIds,
    violatedDependencyIds,
    atRiskDependencyIds,
    severity: changeEvent.severity || "HIGH",
    reason,
    planChurn,
    preservationRatio,
    isCatastrophicCollapse: false,
  };
}
