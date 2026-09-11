import React, { useEffect, useRef, useState } from "react";
import {
  Map,
  NavigationControl,
  ScaleControl,
  AttributionControl,
  Marker,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { Waves, Fish, ShieldAlert, Navigation } from "lucide-react";
import { getDeterministicOffshorePath } from "../../data/coastalLocations";

// Official MapLibre GL JS v6 Vite Web Worker initialization
setWorkerUrl(workerUrl);

/**
 * Helper to compute GeoJSON circle polygon for the hazard area
 */
function createGeoJsonCircle(centerLon, centerLat, radiusNm, points = 64) {
  const coords = [];
  const km = radiusNm * 1.852;
  const distanceX = km / (111.32 * Math.cos((centerLat * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([centerLon + x, centerLat + y]);
  }
  coords.push(coords[0]);
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
    properties: {},
  };
}

const LOCAL_DETERMINISTIC_STYLE = {
  version: 8,
  sources: {
    "osm-tiles": {
      type: "raster",
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "nautical-ocean-background",
      type: "background",
      paint: {
        "background-color": "#f0f6fb",
      },
    },
    {
      id: "osm-tiles-layer",
      type: "raster",
      source: "osm-tiles",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const DEFAULT_RASTER_STYLE = LOCAL_DETERMINISTIC_STYLE;

export default function MapLibreMapAdapter({
  segments = [],
  selectedSegmentId = "S3",
  onSelectSegment,
  onHoverSegment,
  changeEvent,
  isRepaired = false,
  showThreatZone = true,
  showRepairOverlay = true,
  showGrid = true,
  selectedRepairId = "R1",
  osfObservations = [],
  pfzObservations = [],
  showPfzLayer = true,
  showOsfLayer = true,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [styleVersion, setStyleVersion] = useState(0);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const configuredStyle = import.meta.env.VITE_MAP_STYLE_URL;
    const initialStyle = configuredStyle || LOCAL_DETERMINISTIC_STYLE;

    const map = new Map({
      container: mapContainerRef.current,
      style: initialStyle,
      center: [75.2, 13.8], // Center of Western Seaboard corridor
      zoom: 5.4,
      minZoom: 3.5,
      maxZoom: 14,
      attributionControl: false,
    });

    map.addControl(new NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new ScaleControl({ unit: "nautical" }), "bottom-left");
    map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution:
          '<a href="https://maplibre.org" target="_blank" rel="noreferrer">MapLibre</a> | &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> | &copy; <a href="https://carto.com" target="_blank" rel="noreferrer">CARTO</a>',
      }),
      "bottom-right"
    );

    let hasLoaded = false;
    let hasFallbackTriggered = false;

    const markMapReady = () => {
      if (!hasLoaded) {
        hasLoaded = true;
        setMapLoaded(true);
      }
      setStyleVersion((v) => v + 1);
      try {
        map.resize();
      } catch {
        // ignore if canvas context is not ready
      }
    };

    const triggerFallback = (reason) => {
      if (hasFallbackTriggered) {
        markMapReady();
        return;
      }
      hasFallbackTriggered = true;
      console.warn("MapLibre style fallback triggered:", reason);
      try {
        map.setStyle(LOCAL_DETERMINISTIC_STYLE);
      } catch (err) {
        console.error("MapLibre fallback style application error:", err);
      }
      markMapReady();
    };

    map.on("load", markMapReady);
    map.on("style.load", markMapReady);

    map.on("error", (e) => {
      const errMsg = e?.error?.message || (typeof e?.error === "string" ? e.error : "");
      const isTileError = errMsg.includes("tile") || (e?.sourceId && e.sourceId.includes("tiles"));

      if (!hasLoaded && !isTileError) {
        triggerFallback(errMsg || "Remote style load error");
      } else if (!hasLoaded && isTileError) {
        // Tile errors should never block the loading overlay
        markMapReady();
      }
    });

    // Deterministic safety timer (2.5s) to guarantee loading overlay NEVER hangs indefinitely
    const safetyTimer = setTimeout(() => {
      if (!hasLoaded) {
        console.warn("MapLibre load safety timeout reached (2500ms); clearing loading overlay with deterministic fallback.");
        triggerFallback("Safety timeout");
      }
    }, 2500);

    // ResizeObserver to handle container layout changes cleanly
    let resizeObserver = null;
    if (typeof window !== "undefined" && window.ResizeObserver && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.resize();
          } catch {
            // ignore
          }
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    mapInstanceRef.current = map;

    return () => {
      clearTimeout(safetyTimer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Route and Layer Data
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;
    if (!map.isStyleLoaded()) {
      map.once("style.load", () => setStyleVersion((v) => v + 1));
      return;
    }

    // Clean up markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // ── 1. ROUTE SEGMENTS GEOJSON ──────────────────────────────────────────
    const segmentsFeatures = segments.map((seg) => {
      const isSelected = seg.id === selectedSegmentId;
      const isAffected = Boolean(
        changeEvent &&
        !isRepaired &&
        (seg.status === "AFFECTED" || seg.id === changeEvent.affectedSegmentId)
      );
      const isRepairedActive = Boolean(
        changeEvent &&
        isRepaired &&
        (seg.status === "REPAIRED_ACTIVE" || seg.id === changeEvent.affectedSegmentId)
      );

      // Coordinate order: [longitude, latitude]
      let coords = [];
      if (seg.coordinates && Array.isArray(seg.coordinates) && seg.coordinates.length >= 2) {
        coords = seg.coordinates.map((c) => [c[1], c[0]]);
      } else if (seg.startCoord && seg.endCoord) {
        const offshorePath = getDeterministicOffshorePath(seg.startCoord, seg.endCoord);
        coords = offshorePath.map((c) => [c[1], c[0]]);
      } else if (seg.startCoord) {
        coords = [[seg.startCoord[1], seg.startCoord[0]]];
      }

      return {
        type: "Feature",
        id: seg.id,
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
        properties: {
          id: seg.id,
          name: seg.name,
          status: seg.status,
          isSelected,
          isAffected,
          isRepairedActive,
          distanceNm: seg.distanceNm,
          waveHeightM: seg.waveHeightM,
          windKts: seg.windKts,
        },
      };
    });

    const segmentsSourceData = {
      type: "FeatureCollection",
      features: segmentsFeatures,
    };

    if (map.getSource("route-segments-src")) {
      map.getSource("route-segments-src").setData(segmentsSourceData);
    } else {
      map.addSource("route-segments-src", {
        type: "geojson",
        data: segmentsSourceData,
      });

      // Wide invisible line for easier click detection
      map.addLayer({
        id: "route-segments-hitarea",
        type: "line",
        source: "route-segments-src",
        paint: {
          "line-width": 20,
          "line-opacity": 0,
        },
      });

      // Highlight line under selected segment
      map.addLayer({
        id: "route-segments-highlight",
        type: "line",
        source: "route-segments-src",
        paint: {
          "line-color": "#38bdf8",
          "line-width": [
            "case",
            ["get", "isSelected"], 9,
            0,
          ],
          "line-opacity": 0.6,
        },
      });

      // Main route line
      map.addLayer({
        id: "route-segments-line",
        type: "line",
        source: "route-segments-src",
        paint: {
          "line-color": [
            "case",
            ["get", "isRepairedActive"], "#10b981",
            ["get", "isAffected"], "#f59e0b",
            "#2563eb",
          ],
          "line-width": [
            "case",
            ["get", "isSelected"], 5.5,
            ["get", "isAffected"], 4.5,
            3.5,
          ],
          "line-dasharray": [
            "case",
            ["get", "isAffected"], ["literal", [4, 3]],
            ["literal", [1]],
          ],
        },
      });

      map.on("click", "route-segments-hitarea", (e) => {
        if (e.features && e.features[0] && onSelectSegment) {
          onSelectSegment(e.features[0].properties.id);
        }
      });

      map.on("mouseenter", "route-segments-hitarea", (e) => {
        map.getCanvas().style.cursor = "pointer";
        if (e.features && e.features[0] && onHoverSegment) {
          onHoverSegment(e.features[0].properties.id);
        }
      });

      map.on("mouseleave", "route-segments-hitarea", () => {
        map.getCanvas().style.cursor = "";
        if (onHoverSegment) onHoverSegment(null);
      });
    }

    // ── 2. REPAIR DETOUR (W3-A / Holding / Inshore / Dynamic Custom Detour) ───────────────
    const affectedSeg = segments.find(
      (s) => s.status === "AFFECTED" || s.id === changeEvent?.affectedSegmentId
    );

    let repairCoords = [];
    if (affectedSeg && affectedSeg.repairWaypoint && affectedSeg.startCoord && affectedSeg.endCoord) {
      repairCoords = [
        [affectedSeg.startCoord[1], affectedSeg.startCoord[0]],
        [affectedSeg.repairWaypoint[1], affectedSeg.repairWaypoint[0]],
        [affectedSeg.endCoord[1], affectedSeg.endCoord[0]],
      ];
    } else {
      repairCoords = [
        [73.15, 16.98], // WP2
        [72.50, 14.30], // W3-A Detour
        [74.35, 13.20], // WP3
      ];
    }
    let repairColor = isRepaired ? "#10b981" : "#0284c7";

    if (selectedRepairId === "R2") {
      // Speed Reduction & Holding Pattern at Terminus of S2
      repairCoords = [
        [73.15, 16.98], // WP2
        [72.85, 16.80], // Orbit pt 1
        [72.75, 17.15], // Orbit pt 2
        [73.15, 16.98], // Back to WP2
        [74.35, 13.20], // WP3
      ];
      repairColor = "#d97706";
    } else if (selectedRepairId === "R3") {
      // Inshore Coastal Diversion via Shallow Waters
      repairCoords = [
        [73.15, 16.98], // WP2
        [73.65, 15.50], // Inshore pt 1
        [74.15, 14.20], // Inshore pt 2
        [74.35, 13.20], // WP3
      ];
      repairColor = "#dc2626";
    }

    const isDetourActive = Boolean(
      changeEvent &&
      (showRepairOverlay || isRepaired) &&
      selectedRepairId &&
      selectedRepairId !== "R_NONE"
    );

    const detourFeature = {
      type: "FeatureCollection",
      features: isDetourActive
        ? [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: repairCoords,
            },
            properties: {
              status: isRepaired ? "COMMITTED" : `PROPOSED_${selectedRepairId}`,
            },
          },
        ]
        : [],
    };

    if (map.getSource("detour-src")) {
      map.getSource("detour-src").setData(detourFeature);
      if (map.getLayer("detour-line")) {
        map.setPaintProperty("detour-line", "line-color", repairColor);
      }
    } else {
      map.addSource("detour-src", {
        type: "geojson",
        data: detourFeature,
      });

      map.addLayer({
        id: "detour-line",
        type: "line",
        source: "detour-src",
        paint: {
          "line-color": repairColor,
          "line-width": 3.5,
          "line-dasharray": [3, 3],
        },
      });
    }

    // ── 3. THREAT / HAZARD ENVELOPE ─────────────────────────────────────────
    const isThreatActive = Boolean(changeEvent && showThreatZone && changeEvent.eventCoordinates);
    const threatCoords = changeEvent?.eventCoordinates || [14.58, 73.41];
    const radius = changeEvent?.radiusNm || 45;

    const threatFeature = {
      type: "FeatureCollection",
      features: isThreatActive
        ? [createGeoJsonCircle(threatCoords[1], threatCoords[0], radius)]
        : [],
    };

    if (map.getSource("threat-zone-src")) {
      map.getSource("threat-zone-src").setData(threatFeature);
    } else {
      map.addSource("threat-zone-src", {
        type: "geojson",
        data: threatFeature,
      });

      map.addLayer({
        id: "threat-zone-fill",
        type: "fill",
        source: "threat-zone-src",
        paint: {
          "fill-color": "#ef4444",
          "fill-opacity": 0.15,
        },
      });

      map.addLayer({
        id: "threat-zone-stroke",
        type: "line",
        source: "threat-zone-src",
        paint: {
          "line-color": "#dc2626",
          "line-width": 2,
          "line-dasharray": [4, 3],
        },
      });
    }

    // ── 4. WAYPOINT MARKERS (DERIVED FROM CANONICAL SEGMENTS) ───────────────
    const waypoints = [];
    if (segments && segments.length > 0) {
      // First waypoint: origin of first segment
      const firstSeg = segments[0];
      const startPortName = firstSeg.name && firstSeg.name.includes(" to ")
        ? firstSeg.name.split(" to ")[0]
        : firstSeg.name || "Departure Port";
      waypoints.push({
        id: "WP0",
        name: startPortName,
        coord: [firstSeg.startCoord[1], firstSeg.startCoord[0]],
        role: "Departure Fix [REAL]",
      });

      // Intermediate and terminus waypoints
      segments.forEach((seg, idx) => {
        const isLast = idx === segments.length - 1;
        const endPortName = seg.name && seg.name.includes(" to ")
          ? seg.name.split(" to ")[1]
          : `Waypoint ${idx + 1}`;
        waypoints.push({
          id: `WP${idx + 1}`,
          name: endPortName,
          coord: [seg.endCoord[1], seg.endCoord[0]],
          role: isLast ? "Destination Terminus [REAL]" : "Corridor Waypoint [REAL]",
        });
      });
    }

    waypoints.forEach((wp) => {
      const el = document.createElement("div");
      el.className =
        "flex items-center justify-center w-5 h-5 rounded-full bg-white border-2 border-blue-600 shadow-md cursor-pointer hover:scale-125 transition-transform";
      el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span>`;

      const popup = new Popup({ offset: 12, closeButton: false }).setHTML(`
        <div class="p-1 text-xs">
          <p class="font-bold text-slate-900">${wp.id}: ${wp.name}</p>
          <p class="text-[10px] text-slate-500 font-mono">${wp.coord[1].toFixed(2)}°N, ${wp.coord[0].toFixed(2)}°E</p>
          <span class="inline-block mt-0.5 px-1.5 py-0.2 bg-emerald-50 text-emerald-900 border border-emerald-200 text-[9px] font-semibold rounded">${wp.role}</span>
        </div>
      `);

      const marker = new Marker({ element: el })
        .setLngLat(wp.coord)
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Detour Waypoint Marker (Only if detour active)
    if (isDetourActive) {
      const activeDetourCoord = affectedSeg && affectedSeg.repairWaypoint
        ? [affectedSeg.repairWaypoint[1], affectedSeg.repairWaypoint[0]]
        : [72.50, 14.30];
      const activeDetourLabel = affectedSeg ? `W-${affectedSeg.id} (Detour)` : "W3-A (Detour)";

      const w3aEl = document.createElement("div");
      w3aEl.className =
        "flex items-center justify-center px-1.5 py-0.5 rounded border border-sky-500 bg-sky-50 text-[9px] font-bold text-sky-800 shadow-sm cursor-pointer hover:scale-110 transition-transform";
      w3aEl.textContent = activeDetourLabel;

      const w3aPopup = new Popup({ offset: 12, closeButton: false }).setHTML(`
        <div class="p-1 text-xs">
          <div class="flex items-center gap-1 font-bold text-sky-900">
            <span>Waypoint ${activeDetourLabel}</span>
            <span class="text-[9px] px-1 py-0.2 bg-amber-100 text-amber-900 rounded font-mono font-bold">PROPOSED REPAIR</span>
          </div>
          <p class="text-[10px] text-slate-500 font-mono">${activeDetourCoord[1].toFixed(2)}°N, ${activeDetourCoord[0].toFixed(2)}°E</p>
          <p class="text-[10px] text-emerald-700 font-semibold mt-0.5">Clears Hazard Envelope with safe western standoff.</p>
        </div>
      `);

      const marker = new Marker({ element: w3aEl })
        .setLngLat(activeDetourCoord)
        .setPopup(w3aPopup)
        .addTo(map);

      markersRef.current.push(marker);
    }

    // ── 5. REAL INCOIS OSF WAVE OBSERVATIONS OVERLAY ───────────────────────
    if (showOsfLayer && osfObservations.length > 0) {
      osfObservations.forEach((obs) => {
        const swh = obs.parameters?.significant_wave_height?.value;
        const swell = obs.parameters?.swell_height?.value;
        const period = obs.parameters?.wave_period?.value;
        if (swh === undefined || swh === null) return;

        const el = document.createElement("div");
        el.className =
          "flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/95 border border-blue-400 shadow-sm text-[10px] font-bold text-blue-900 cursor-pointer hover:scale-110 transition-transform";
        el.innerHTML = `
          <svg class="w-3 h-3 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 12c.5-1 1.5-2 3-2s2.5 1 3 2 1.5 2 3 2 2.5-1 3-2 1.5-2 3-2 2.5 1 3 2M2 17c.5-1 1.5-2 3-2s2.5 1 3 2 1.5 2 3 2 2.5-1 3-2 1.5-2 3-2 2.5 1 3 2" />
          </svg>
          <span>${swh.toFixed(1)}m</span>
        `;

        const popup = new Popup({ offset: 12, closeButton: false }).setHTML(`
          <div class="p-1 text-xs">
            <div class="flex items-center gap-1 font-bold text-slate-900">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>INCOIS Wave Forecast</span>
              <span class="ml-1 text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono font-bold">REAL</span>
            </div>
            <div class="mt-1 space-y-0.5 text-[11px]">
              <p>Wave Hs: <strong class="text-blue-700">${swh.toFixed(2)} m</strong></p>
              ${swell ? `<p>Swell: <strong>${swell.toFixed(2)} m</strong></p>` : ""}
              ${period ? `<p>Period: <strong>${period.toFixed(1)} s</strong></p>` : ""}
              <p class="text-[9px] text-slate-400 font-mono mt-1">Source: ${obs.source_record_id || "THREDDS WMS"}</p>
            </div>
          </div>
        `);

        const marker = new Marker({ element: el })
          .setLngLat([obs.longitude, obs.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // ── 6. REAL INCOIS PFZ ADVISORY OVERLAY ────────────────────────────────
    if (showPfzLayer && pfzObservations.length > 0) {
      pfzObservations.forEach((obs) => {
        const detected = obs.parameters?.pfz_detected?.value === 1.0;
        const distNm = obs.parameters?.pfz_proximity_distance_nm?.value;
        const lengthKm = obs.parameters?.pfz_line_length_km?.value;

        if (!detected && distNm === null) return;

        const el = document.createElement("div");
        el.className =
          "flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-500 shadow-sm text-[10px] font-bold text-emerald-900 cursor-pointer hover:scale-110 transition-transform";
        el.innerHTML = `
          <span class="text-xs">🐟</span>
          <span>${distNm !== null && distNm !== undefined ? `${distNm.toFixed(0)}NM` : "PFZ"}</span>
        `;

        const popup = new Popup({ offset: 12, closeButton: false }).setHTML(`
          <div class="p-1 text-xs">
            <div class="flex items-center gap-1 font-bold text-slate-900">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Potential Fishing Zone Advisory</span>
              <span class="ml-1 text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono font-bold">REAL</span>
            </div>
            <div class="mt-1 space-y-0.5 text-[11px]">
              <p>PFZ Proximity: <strong>${distNm !== null && distNm !== undefined ? `${distNm.toFixed(1)} NM` : "Active"}</strong></p>
              ${lengthKm ? `<p>Feature Length: <strong>${lengthKm.toFixed(1)} km</strong></p>` : ""}
              <p class="text-[9px] text-slate-400 font-mono mt-1">Ref: ${obs.source_record_id || "INCOIS GeoServer WFS"}</p>
            </div>
          </div>
        `);

        const marker = new Marker({ element: el })
          .setLngLat([obs.longitude, obs.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // ── 7. DYNAMIC CAMERA FIT TO CURRENT ROUTE ────────────────────────────
    if (segments && segments.length > 0) {
      try {
        let minLon = Infinity;
        let minLat = Infinity;
        let maxLon = -Infinity;
        let maxLat = -Infinity;

        segments.forEach((seg) => {
          const pts = (seg.coordinates && seg.coordinates.length > 0)
            ? seg.coordinates
            : (seg.startCoord && seg.endCoord
                ? getDeterministicOffshorePath(seg.startCoord, seg.endCoord)
                : [seg.startCoord, seg.endCoord].filter(Boolean));
          pts.forEach((pt) => {
            minLat = Math.min(minLat, pt[0]);
            maxLat = Math.max(maxLat, pt[0]);
            minLon = Math.min(minLon, pt[1]);
            maxLon = Math.max(maxLon, pt[1]);
          });
        });

        if (minLon !== Infinity && maxLon !== -Infinity) {
          // Guard against zero-area bounding box
          if (minLon === maxLon) { minLon -= 0.5; maxLon += 0.5; }
          if (minLat === maxLat) { minLat -= 0.5; maxLat += 0.5; }

          map.fitBounds(
            [
              [minLon, minLat],
              [maxLon, maxLat],
            ],
            {
              padding: { top: 60, bottom: 60, left: 60, right: 60 },
              maxZoom: 9,
              duration: 800,
            }
          );
        }
      } catch (err) {
        console.warn("MapLibre fitBounds deferred:", err);
      }
    }
  }, [
    mapLoaded,
    segments,
    selectedSegmentId,
    changeEvent,
    isRepaired,
    showThreatZone,
    showRepairOverlay,
    selectedRepairId,
    osfObservations,
    pfzObservations,
    showPfzLayer,
    showOsfLayer,
    styleVersion,
  ]);

  return (
    <div className="relative w-full h-full min-h-[420px] bg-slate-100">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Explicit Truth & Planning Corridor Watermark Notice */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-0.5 bg-slate-900/90 text-white px-3 py-2 rounded-lg border border-slate-700/80 shadow-lg backdrop-blur-xs max-w-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-[11px] font-bold tracking-wider text-sky-300 uppercase">
            COMPUTED PLANNING CORRIDOR
          </span>
        </div>
        <div className="text-[9px] text-slate-300 font-medium flex flex-wrap gap-x-2">
          <span>• NOT a live navigational chart</span>
          <span>• NOT an AIS track</span>
        </div>
      </div>

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 z-20">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200">
            <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Rendering MapLibre Interactive Nautical Chart...</span>
          </div>
        </div>
      )}
    </div>
  );
}
