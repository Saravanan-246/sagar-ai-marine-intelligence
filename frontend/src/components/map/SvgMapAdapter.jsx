import React from "react";
import { getDeterministicOffshorePath } from "../../data/coastalLocations";

/**
 * SvgMapAdapter — High-Precision Nautical Vector Rendering Provider
 * Provider-independent layer rendering geographic boundaries, navigational
 * waypoints, segment lines, threat zones, and vessel telemetry.
 */
export default function SvgMapAdapter({
  segments = [],
  selectedSegmentId,
  onSelectSegment,
  changeEvent,
  isRepaired,
  showThreatZone = true,
  showRepairOverlay = true,
  showGrid = true,
  selectedRepairId,
  onHoverSegment,
}) {
  // Nautical projection: ~19.5°N (top y=50) to 6.0°N (bottom y=550), 71.0°E (left x=70) to 81.0°E (right x=830)
  const toSvgX = (lon) => 70 + ((lon - 71.0) / 10.0) * 760;
  const toSvgY = (lat) => 50 + ((19.5 - lat) / 13.5) * 500;

  // Waypoints for Coastal Survey Operation 01 (Arabian Sea Corridor)
  const WP_START = { name: "WP0 (Operational Base)", x: toSvgX(72.95), y: toSvgY(18.95) };
  const WP1 = { name: "WP1 (North Sector)", x: toSvgX(72.5), y: toSvgY(18.25) };
  const WP2 = { name: "WP2 (Central Checkpoint)", x: toSvgX(73.15), y: toSvgY(16.98) };
  const WP3 = { name: "WP3 (Karwar Transition)", x: toSvgX(74.35), y: toSvgY(13.2) };
  const WP4 = { name: "WP4 (South Approach)", x: toSvgX(75.8), y: toSvgY(9.95) };
  const WP_END = { name: "WP5 (Terminus Station)", x: toSvgX(79.85), y: toSvgY(6.95) };

  // Repair Waypoint W3-A (Minimal Detour westward around simulated hazard)
  const WP_W3A = { name: "W3-A (Detour Arc)", x: toSvgX(72.5), y: toSvgY(14.3) };
  // R2 Holding Orbit point
  const WP_HOLDING = { name: "Holding Orbit", x: toSvgX(72.7), y: toSvgY(17.1) };
  // R3 Inshore coastal track
  const WP_INSHORE = { name: "S3-C Inshore Lee", x: toSvgX(74.05), y: toSvgY(14.6) };

  // Simulated Hazard Center
  const hazardCenter = {
    x: changeEvent?.eventCoordinates
      ? toSvgX(changeEvent.eventCoordinates[1])
      : toSvgX(73.4),
    y: changeEvent?.eventCoordinates
      ? toSvgY(changeEvent.eventCoordinates[0])
      : toSvgY(14.5),
  };

  return (
    <svg
      viewBox="0 0 900 580"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Soft grid pattern */}
        <pattern id="seaGrid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#e2ecf5" strokeWidth="0.8" />
        </pattern>

        {/* Hazard pattern */}
        <pattern
          id="hazardHatch"
          width="12"
          height="12"
          patternTransform="rotate(45 0 0)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="12" stroke="#f97316" strokeWidth="1.5" opacity="0.3" />
        </pattern>
      </defs>

      {/* Sea background */}
      <rect width="900" height="580" fill="#f0f6fb" />
      <rect width="900" height="580" fill="url(#seaGrid)" />

      {/* Lat/Lon Grid Lines */}
      {showGrid && (
        <g className="text-[10px] font-mono fill-slate-500">
          {[18, 16, 14, 12, 10, 8].map((lat) => {
            const y = toSvgY(lat);
            return (
              <g key={`lat-${lat}`}>
                <line
                  x1="40"
                  y1={y}
                  x2="860"
                  y2={y}
                  stroke="#dbeafe"
                  strokeDasharray="2,4"
                  strokeWidth="1"
                />
                <text x="45" y={y - 4}>
                  {lat}°00'N
                </text>
              </g>
            );
          })}

          {[72, 74, 76, 78, 80].map((lon) => {
            const x = toSvgX(lon);
            return (
              <g key={`lon-${lon}`}>
                <line
                  x1={x}
                  y1="40"
                  x2={x}
                  y2="550"
                  stroke="#dbeafe"
                  strokeDasharray="2,4"
                  strokeWidth="1"
                />
                <text x={x + 4} y="565">
                  {lon}°00'E
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Coastal Landmasses (Peninsular India & Sri Lanka reference) */}
      <g>
        <path
          d={`
            M ${toSvgX(72.8)} ${toSvgY(20.0)}
            L ${toSvgX(72.95)} ${toSvgY(18.95)}
            L ${toSvgX(73.15)} ${toSvgY(18.0)}
            L ${toSvgX(73.30)} ${toSvgY(16.98)}
            L ${toSvgX(73.80)} ${toSvgY(15.50)}
            L ${toSvgX(74.20)} ${toSvgY(14.80)}
            L ${toSvgX(74.60)} ${toSvgY(13.80)}
            L ${toSvgX(74.90)} ${toSvgY(12.80)}
            L ${toSvgX(75.50)} ${toSvgY(11.50)}
            L ${toSvgX(76.20)} ${toSvgY(10.00)}
            L ${toSvgX(76.60)} ${toSvgY(8.80)}
            L ${toSvgX(77.55)} ${toSvgY(8.08)}
            L ${toSvgX(78.20)} ${toSvgY(8.70)}
            L ${toSvgX(79.20)} ${toSvgY(9.25)}
            L ${toSvgX(80.50)} ${toSvgY(12.00)}
            L ${toSvgX(81.50)} ${toSvgY(16.00)}
            L 890 50
            L 890 0
            L ${toSvgX(72.8)} 0
            Z
          `}
          fill="#e2e8f0"
          stroke="#94a3b8"
          strokeWidth="1.2"
        />

        <path
          d={`
            M ${toSvgX(79.7)} ${toSvgY(9.2)}
            L ${toSvgX(80.5)} ${toSvgY(9.5)}
            L ${toSvgX(81.5)} ${toSvgY(8.5)}
            L ${toSvgX(81.8)} ${toSvgY(7.0)}
            L ${toSvgX(80.8)} ${toSvgY(5.9)}
            L ${toSvgX(79.8)} ${toSvgY(6.9)}
            L ${toSvgX(79.6)} ${toSvgY(8.2)}
            Z
          `}
          fill="#e2e8f0"
          stroke="#94a3b8"
          strokeWidth="1.2"
        />

        <text
          x={toSvgX(75.5)}
          y={toSvgY(16.5)}
          className="text-xs font-bold fill-slate-500 uppercase tracking-widest pointer-events-none"
        >
          Coastal Zone Reference
        </text>
        <text
          x={toSvgX(71.5)}
          y={toSvgY(14.0)}
          className="text-xs font-semibold fill-blue-800/40 uppercase tracking-widest pointer-events-none"
        >
          Survey Basin
        </text>
      </g>

      {/* Territorial / Safe Depth Line */}
      <path
        d={`
          M ${toSvgX(72.4)} ${toSvgY(19.2)}
          L ${toSvgX(72.7)} ${toSvgY(18.0)}
          L ${toSvgX(72.9)} ${toSvgY(17.0)}
          L ${toSvgX(73.4)} ${toSvgY(15.5)}
          L ${toSvgX(73.8)} ${toSvgY(14.5)}
          L ${toSvgX(74.4)} ${toSvgY(13.0)}
          L ${toSvgX(75.2)} ${toSvgY(11.0)}
          L ${toSvgX(76.0)} ${toSvgY(9.2)}
          L ${toSvgX(77.0)} ${toSvgY(7.8)}
        `}
        fill="none"
        stroke="#93c5fd"
        strokeWidth="0.8"
        strokeDasharray="4,4"
      />

      {/* Simulated Hazard / Restricted Area Envelope (Conditional on active changeEvent) */}
      {Boolean(changeEvent && showThreatZone && changeEvent.eventCoordinates) && (
        <g className="transition-opacity duration-300">
          <ellipse
            cx={hazardCenter.x}
            cy={hazardCenter.y}
            rx="68"
            ry="55"
            fill="url(#hazardHatch)"
            stroke="#f97316"
            strokeWidth="1.8"
            strokeDasharray="5,4"
          />
          <ellipse
            cx={hazardCenter.x}
            cy={hazardCenter.y}
            rx="35"
            ry="28"
            fill="#fee2e2"
            fillOpacity="0.4"
            stroke="#ef4444"
            strokeWidth="1.5"
          />
          <circle cx={hazardCenter.x} cy={hazardCenter.y} r="4" fill="#dc2626" />
          <text
            x={hazardCenter.x + 8}
            y={hazardCenter.y - 12}
            className="text-[10px] font-bold fill-red-700 pointer-events-none"
          >
            RESTRICTED HAZARD ENVELOPE [SIMULATED]
          </text>
          <text
            x={hazardCenter.x + 8}
            y={hazardCenter.y + 2}
            className="text-[9px] font-mono fill-red-800/80 pointer-events-none"
          >
            {changeEvent?.id || "EVT-SIM-01"} • Threshold Breach
          </text>
        </g>
      )}

      {/* ROUTE SEGMENTS (DYNAMIC FROM CANONICAL PROPS) */}
      {segments && segments.length > 0 ? (
        <g>
          {segments.map((seg) => {
            const points = (seg.coordinates && seg.coordinates.length >= 2)
              ? seg.coordinates
              : (seg.startCoord && seg.endCoord
                  ? getDeterministicOffshorePath(seg.startCoord, seg.endCoord)
                  : []);
            if (points.length < 2) return null;

            const svgPathD = points
              .map((p, idx) => `${idx === 0 ? "M" : "L"} ${toSvgX(p[1])} ${toSvgY(p[0])}`)
              .join(" ");

            const midIdx = Math.floor(points.length / 2);
            const midPt = points[midIdx];
            const midX = toSvgX(midPt[1]);
            const midY = toSvgY(midPt[0]);

            const isSelected = selectedSegmentId === seg.id;
            const isAffected = Boolean(
              changeEvent &&
                !isRepaired &&
                (seg.status === "AFFECTED" || seg.id === changeEvent.affectedSegmentId)
            );
            const isRepairedActive = Boolean(
              changeEvent && isRepaired && seg.status === "REPAIRED_ACTIVE"
            );

            let strokeColor = "#2563eb";
            if (isRepairedActive) strokeColor = "#10b981";
            else if (isAffected) strokeColor = "#f59e0b";

            return (
              <g
                key={seg.id}
                onClick={() => onSelectSegment && onSelectSegment(seg.id)}
                onMouseEnter={() => onHoverSegment && onHoverSegment(seg.id)}
                onMouseLeave={() => onHoverSegment && onHoverSegment(null)}
                className="cursor-pointer"
              >
                {/* Thick hit area */}
                <path
                  d={svgPathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={22}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Selected highlight line */}
                {isSelected && (
                  <path
                    d={svgPathD}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={7.5}
                    strokeOpacity={0.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {/* Route segment line */}
                <path
                  d={svgPathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 4.5 : isAffected ? 4 : 3}
                  strokeDasharray={isAffected ? "8,5" : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {isAffected && !isRepaired && (
                  <g>
                    <rect
                      x={midX - 50}
                      y={midY - 11}
                      width="100"
                      height="20"
                      rx="4"
                      fill="#ffffff"
                      stroke="#d97706"
                      strokeWidth="1.5"
                    />
                    <text
                      x={midX}
                      y={midY + 3}
                      textAnchor="middle"
                      className="text-[9px] font-bold fill-amber-900"
                    >
                      ⚠ AFFECTED: {seg.id}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      ) : null}

      {/* Proposed Repair Candidate Overlay */}
      {Boolean(changeEvent && (showRepairOverlay || isRepaired) && selectedRepairId && selectedRepairId !== "R_NONE") && (
        <g className="transition-all">
          {selectedRepairId === "R2" ? (
            <g>
              <ellipse
                cx={WP_HOLDING.x}
                cy={WP_HOLDING.y}
                rx="35"
                ry="22"
                fill="none"
                stroke="#d97706"
                strokeWidth="2.5"
                strokeDasharray="4,4"
              />
              <line
                x1={WP2.x}
                y1={WP2.y}
                x2={WP_HOLDING.x}
                y2={WP_HOLDING.y}
                stroke="#d97706"
                strokeWidth="2"
                strokeDasharray="3,3"
              />
              <rect
                x={WP_HOLDING.x - 55}
                y={WP_HOLDING.y - 28}
                width="110"
                height="18"
                rx="3"
                fill="#ffffff"
                stroke="#d97706"
                strokeWidth="1"
              />
              <text
                x={WP_HOLDING.x}
                y={WP_HOLDING.y - 16}
                textAnchor="middle"
                className="text-[9px] font-bold fill-amber-900"
              >
                R2: HOLDING ORBIT (7.5h)
              </text>
            </g>
          ) : selectedRepairId === "R3" ? (
            <g>
              <line
                x1={WP2.x}
                y1={WP2.y}
                x2={WP_INSHORE.x}
                y2={WP_INSHORE.y}
                stroke="#dc2626"
                strokeWidth="3"
                strokeDasharray="5,4"
              />
              <line
                x1={WP_INSHORE.x}
                y1={WP_INSHORE.y}
                x2={WP3.x}
                y2={WP3.y}
                stroke="#dc2626"
                strokeWidth="3"
                strokeDasharray="5,4"
              />
              <circle
                cx={WP_INSHORE.x}
                cy={WP_INSHORE.y}
                r="4.5"
                fill="#ffffff"
                stroke="#dc2626"
                strokeWidth="2"
              />
              <rect
                x={WP_INSHORE.x - 50}
                y={WP_INSHORE.y - 24}
                width="100"
                height="18"
                rx="3"
                fill="#ffffff"
                stroke="#dc2626"
                strokeWidth="1"
              />
              <text
                x={WP_INSHORE.x}
                y={WP_INSHORE.y - 12}
                textAnchor="middle"
                className="text-[9px] font-bold fill-red-800"
              >
                R3: INSHORE TRACK
              </text>
            </g>
          ) : (
            <g>
              <line
                x1={WP2.x}
                y1={WP2.y}
                x2={WP_W3A.x}
                y2={WP_W3A.y}
                stroke={isRepaired ? "#16a34a" : "#0284c7"}
                strokeWidth={isRepaired ? 3.5 : 3}
                strokeDasharray="6,4"
                strokeLinecap="round"
              />
              <line
                x1={WP_W3A.x}
                y1={WP_W3A.y}
                x2={WP3.x}
                y2={WP3.y}
                stroke={isRepaired ? "#16a34a" : "#0284c7"}
                strokeWidth={isRepaired ? 3.5 : 3}
                strokeDasharray="6,4"
                strokeLinecap="round"
              />
              <circle
                cx={WP_W3A.x}
                cy={WP_W3A.y}
                r="4.5"
                fill="#ffffff"
                stroke={isRepaired ? "#16a34a" : "#0284c7"}
                strokeWidth="2.5"
              />
              <rect
                x={WP_W3A.x - 48}
                y={WP_W3A.y - 24}
                width="96"
                height="18"
                rx="3"
                fill="#ffffff"
                stroke={isRepaired ? "#16a34a" : "#0284c7"}
                strokeWidth="1"
              />
              <text
                x={WP_W3A.x}
                y={WP_W3A.y - 12}
                textAnchor="middle"
                className={`text-[9px] font-bold ${
                  isRepaired ? "fill-emerald-800" : "fill-sky-800"
                }`}
              >
                {isRepaired ? "COMMITTED: W3-A" : "R1 REPAIR: W3-A"}
              </text>
            </g>
          )}
        </g>
      )}

      {/* Dynamic Waypoint Markers Derived From Canonical Segments */}
      {segments && segments.length > 0 && (
        <g>
          {/* Departure Port WP0 */}
          {(() => {
            const first = segments[0];
            const x = toSvgX(first.startCoord[1]);
            const y = toSvgY(first.startCoord[0]);
            const name = first.name && first.name.includes(" to ") ? first.name.split(" to ")[0] : first.name;
            return (
              <g key="wp-departure">
                <circle cx={x} cy={y} r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                <text x={x + 8} y={y + 4} className="text-[11px] font-bold fill-slate-900">
                  {name}
                </text>
                <text x={x + 8} y={y + 14} className="text-[9px] font-mono fill-slate-500">
                  Departure Fix
                </text>
              </g>
            );
          })()}

          {/* Intermediate & Destination Waypoints */}
          {segments.map((seg, idx) => {
            const isLast = idx === segments.length - 1;
            const x = toSvgX(seg.endCoord[1]);
            const y = toSvgY(seg.endCoord[0]);
            const name = seg.name && seg.name.includes(" to ") ? seg.name.split(" to ")[1] : `WP${idx + 1}`;
            return (
              <g key={`wp-${seg.id}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={isLast ? "5.5" : "3.5"}
                  fill={isLast ? "#2563eb" : "#ffffff"}
                  stroke="#2563eb"
                  strokeWidth="2"
                />
                {isLast ? (
                  <>
                    <text x={x - 85} y={y + 4} className="text-[11px] font-bold fill-slate-900">
                      {name}
                    </text>
                    <text x={x - 85} y={y + 15} className="text-[9px] font-semibold fill-blue-700">
                      Scheduled Terminus
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}
        </g>
      )}
      {/* Explicit Truth Notice Watermark */}
      <g className="pointer-events-none">
        <rect x="20" y="20" width="220" height="38" rx="6" fill="#0f172a" fillOpacity="0.92" stroke="#334155" strokeWidth="1" />
        <circle cx="34" cy="35" r="3" fill="#38bdf8" />
        <text x="44" y="38" className="text-[10px] font-bold fill-sky-300 font-mono tracking-wider">
          COMPUTED PLANNING CORRIDOR
        </text>
        <text x="32" y="50" className="text-[8px] fill-slate-300 font-sans">
          • NOT a live navigational chart • NOT an AIS track
        </text>
      </g>
    </svg>
  );
}
