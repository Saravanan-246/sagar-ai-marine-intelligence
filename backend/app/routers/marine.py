"""
Marine Data Router — /api/marine/

Exposes real INCOIS Ocean State Forecast data via normalised endpoints.

GET /api/marine/status          — Source health, cache age, last fetch
GET /api/marine/osf             — Normalised forecast for one or more points
GET /api/marine/osf/waypoints   — Batch query for the scenario route waypoints
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.integrations.marine.ais import ais_adapter
from app.integrations.marine.incois_osf import incois_osf
from app.integrations.marine.marine_types import (
    FetchStatus,
    MarineObservation,
    MarineSourceStatus,
)
from app.integrations.marine.pfz import incois_pfz
from app.integrations.marine.registry import marine_registry

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Scenario Waypoints (match the DEC-2026-084 route) ─────────────────────
# These are the mid-points of each route segment used in the demo scenario.
# Used by /api/marine/osf/waypoints for bulk fetch.
_SCENARIO_WAYPOINTS = [
    {"segment": "S1", "name": "Base to North TSS Midpoint",    "lat": 18.60, "lon": 72.68},
    {"segment": "S2", "name": "North TSS to Central Midpoint", "lat": 17.62, "lon": 72.83},
    {"segment": "S3", "name": "Central to Karwar Midpoint",    "lat": 15.09, "lon": 73.75},
    {"segment": "S4", "name": "Karwar to South Approach",      "lat": 11.58, "lon": 75.08},
    {"segment": "S5", "name": "South Approach to Terminus",    "lat": 8.45,  "lon": 77.83},
]


# ── /api/marine/status ────────────────────────────────────────────────────

@router.get(
    "/status",
    response_model=MarineSourceStatus,
    summary="INCOIS OSF Data Source Status",
    description=(
        "Returns the health of the INCOIS Ocean State Forecast integration: "
        "CONNECTED (fresh data), STALE (>60 min since last fetch), or UNAVAILABLE."
    ),
)
async def get_marine_status() -> MarineSourceStatus:
    return await incois_osf.get_status()


# ── /api/marine/osf ───────────────────────────────────────────────────────

@router.get(
    "/osf",
    response_model=List[MarineObservation],
    summary="INCOIS OSF Point Forecast",
    description=(
        "Returns real INCOIS Ocean State Forecast data for a single lat/lon point. "
        "Data is labelled source_type=REAL only when the live INCOIS THREDDS WMS "
        "returns a valid response. No fallback values are ever synthesised. "
        "Parameters: SWH (Significant Wave Height), SWELL, WP (Wave Period), SWP."
    ),
)
async def get_osf_forecast(
    lat: float = Query(
        ...,
        ge=-90, le=90,
        description="Latitude in decimal degrees (N)",
        example=15.09,
    ),
    lon: float = Query(
        ...,
        ge=-180, le=180,
        description="Longitude in decimal degrees (E)",
        example=73.75,
    ),
    time_iso: Optional[str] = Query(
        default=None,
        description=(
            "ISO-8601 UTC time for the forecast lookup. "
            "If omitted, the nearest 3-hourly slot to current UTC is used. "
            "Must be within the 7-day rolling INCOIS forecast window."
        ),
        example="2026-09-10T15:00:00.000Z",
    ),
) -> List[MarineObservation]:
    observations = await incois_osf.fetch(lat, lon, time_iso=time_iso)

    if not observations:
        status = await incois_osf.get_status()
        if status.status == FetchStatus.UNAVAILABLE:
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "INCOIS OSF source unavailable",
                    "source": "INCOIS",
                    "source_type": "REAL",
                    "note": "No fallback synthetic values are provided. Check /api/marine/status.",
                },
            )
        raise HTTPException(
            status_code=404,
            detail={
                "error": f"No data returned for ({lat}, {lon}). "
                         f"Point may be outside INCOIS OSF coverage (64.95–95.05°E, 4.95–25.05°N), "
                         f"or the requested time is outside the 7-day forecast window.",
                "source_type": "REAL",
            },
        )

    return observations


# ── /api/marine/osf/waypoints ─────────────────────────────────────────────

@router.get(
    "/osf/waypoints",
    response_model=List[MarineObservation],
    summary="INCOIS OSF Forecast for Scenario Route Waypoints",
    description=(
        "Batch-fetches real INCOIS OSF data for the five segment midpoints "
        "of the DEC-2026-084 Coastal Survey Operation route. "
        "Each observation is labelled with the corresponding route segment."
    ),
)
async def get_osf_waypoint_forecast(
    time_iso: Optional[str] = Query(
        default=None,
        description="ISO-8601 UTC time. Defaults to nearest 3-hour slot.",
    ),
) -> List[MarineObservation]:
    all_obs: List[MarineObservation] = []

    for wp in _SCENARIO_WAYPOINTS:
        obs_list = await incois_osf.fetch(wp["lat"], wp["lon"], time_iso=time_iso)
        for obs in obs_list:
            # Annotate with segment metadata
            obs.source_record_id = f"INCOIS-OSF-{wp['segment']}-{obs.dataset_file}"
            all_obs.append(obs)

    if not all_obs:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "No INCOIS OSF data retrieved for any route waypoint.",
                "source_type": "REAL",
                "note": "Check /api/marine/status for source health.",
            },
        )

    return all_obs


# ── /api/marine/registry ──────────────────────────────────────────────────

@router.get(
    "/registry",
    response_model=Dict[str, MarineSourceStatus],
    summary="Marine Data Source Registry Status",
    description=(
        "Returns health, cache status, coverage, and provenance for all registered "
        "marine data adapters: INCOIS OSF (REAL), INCOIS PFZ (REAL), AIS (UNAVAILABLE)."
    ),
)
async def get_registry_status() -> Dict[str, MarineSourceStatus]:
    return await marine_registry.get_all_statuses()


# ── /api/marine/pfz ───────────────────────────────────────────────────────

@router.get(
    "/pfz",
    response_model=List[MarineObservation],
    summary="INCOIS PFZ Point Advisory",
    description=(
        "Returns real INCOIS Potential Fishing Zone (PFZ) advisory data for a single lat/lon point. "
        "Queries live INCOIS GeoServer WFS (PFZ_Automation:pfzlines). "
        "Parameters: pfz_detected, pfz_proximity_distance_nm, pfz_line_length_km."
    ),
)
async def get_pfz_advisory(
    lat: float = Query(
        ...,
        ge=-90, le=90,
        description="Latitude in decimal degrees (N)",
        example=14.62,
    ),
    lon: float = Query(
        ...,
        ge=-180, le=180,
        description="Longitude in decimal degrees (E)",
        example=74.16,
    ),
) -> List[MarineObservation]:
    observations = await incois_pfz.fetch(lat, lon)

    if not observations:
        status = await incois_pfz.get_status()
        if status.status == FetchStatus.UNAVAILABLE:
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "INCOIS PFZ WFS service unavailable",
                    "source": "INCOIS",
                    "source_type": "REAL",
                    "note": "Check /api/marine/registry for source health.",
                },
            )
        raise HTTPException(
            status_code=404,
            detail={
                "error": f"No PFZ data returned for ({lat}, {lon}). "
                         f"Point may be outside INCOIS PFZ coverage (67.15–93.37°E, 11.64–23.06°N).",
                "source_type": "REAL",
            },
        )

    return observations


# ── /api/marine/pfz/waypoints ─────────────────────────────────────────────

@router.get(
    "/pfz/waypoints",
    response_model=List[MarineObservation],
    summary="INCOIS PFZ Advisory for Scenario Route Waypoints",
    description=(
        "Batch-fetches real INCOIS PFZ data for the five segment midpoints "
        "of the DEC-2026-084 Coastal Survey Operation route."
    ),
)
async def get_pfz_waypoint_advisories() -> List[MarineObservation]:
    all_obs: List[MarineObservation] = []

    for wp in _SCENARIO_WAYPOINTS:
        obs_list = await incois_pfz.fetch(wp["lat"], wp["lon"])
        for obs in obs_list:
            obs.source_record_id = f"INCOIS-PFZ-{wp['segment']}-{obs.dataset_file}"
            all_obs.append(obs)

    if not all_obs:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "No INCOIS PFZ data retrieved for route waypoints.",
                "source_type": "REAL",
                "note": "Check /api/marine/registry for source health.",
            },
        )

    return all_obs


# ── /api/marine/ais/status ────────────────────────────────────────────────

@router.get(
    "/ais/status",
    response_model=MarineSourceStatus,
    summary="AIS Data Source Status & Limitation Report",
    description=(
        "Returns the audited status of the Automatic Identification System (AIS) feed. "
        "Explicitly documents the coastal security restriction preventing open access."
    ),
)
async def get_ais_status() -> MarineSourceStatus:
    return await ais_adapter.get_status()

