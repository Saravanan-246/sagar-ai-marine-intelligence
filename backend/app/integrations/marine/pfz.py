"""
pfz.py — INCOIS Potential Fishing Zone (PFZ) Adapter
Source: https://incois.gov.in/geoserver/PFZ_Automation/wfs
Protocol: OGC WFS 1.0.0 (GeoJSON) point & BBOX spatial queries

CONFIRMED LIVE ENDPOINTS (verified 2026-09-10):
  Base: https://incois.gov.in/geoserver/PFZ_Automation/wfs
  GetCapabilities:
    https://incois.gov.in/geoserver/PFZ_Automation/ows?service=WFS&version=1.0.0&request=GetCapabilities
  GetFeature:
    https://incois.gov.in/geoserver/PFZ_Automation/wfs?request=GetFeature&typeName=PFZ_Automation:pfzlines&outputFormat=application/json&srsName=EPSG:4326&bbox=<lon1,lat1,lon2,lat2,EPSG:4326>

CONFIRMED REAL LAYERS:
  PFZ_Automation:pfzlines — MultiLineString PFZ thermal/chlorophyll boundary lines
  Coverage:
    Lon: 67.15°E – 93.37°E
    Lat: 11.64°N – 23.06°N

IMPORTANT:
  - NO API KEY required — public INCOIS GeoServer OGC WFS server.
  - Data labelled source_type="REAL" ONLY when HTTP 200 + valid GeoJSON parsed.
  - Never fallback to synthetic values on error.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import httpx

from app.integrations.marine.marine_types import (
    DataSourceType,
    FetchStatus,
    MarineAdapterInterface,
    MarineObservation,
    MarineSourceStatus,
)
from app.integrations.marine.normalizer import parse_pfz_geojson

logger = logging.getLogger(__name__)


# ── Configuration ──────────────────────────────────────────────────────────

PFZ_WFS_BASE = "https://incois.gov.in/geoserver/PFZ_Automation/wfs"
LAYER_NAME = "PFZ_Automation:pfzlines"

# Coverage bounds from WFS GetCapabilities
COVERAGE_LON_MIN = 67.15
COVERAGE_LON_MAX = 93.37
COVERAGE_LAT_MIN = 11.64
COVERAGE_LAT_MAX = 23.06

# BBOX query delta in degrees (~60 NM box around point)
_BBOX_DELTA = 1.0

CACHE_TTL_SECONDS = 1800     # 30 minutes
STALE_THRESHOLD_SECS = 3600  # 60 minutes
HTTP_TIMEOUT_SECS = 15.0
MAX_RETRIES = 1


# ── In-memory cache & status tracking ──────────────────────────────────────

_cache: Dict[Tuple[float, float], Tuple[Optional[MarineObservation], float]] = {}

_status: Dict[str, Optional[str]] = {
    "last_successful_fetch": None,
    "last_fetch_attempt": None,
    "last_error": None,
    "dataset_file": LAYER_NAME,
}


def _build_pfz_wfs_url(lat: float, lon: float) -> str:
    """Build the WFS GetFeature BBOX URL in EPSG:4326."""
    minx = lon - _BBOX_DELTA
    miny = lat - _BBOX_DELTA
    maxx = lon + _BBOX_DELTA
    maxy = lat + _BBOX_DELTA
    return (
        f"{PFZ_WFS_BASE}?request=GetFeature"
        f"&typeName={LAYER_NAME}"
        f"&outputFormat=application/json"
        f"&srsName=EPSG:4326"
        f"&bbox={minx:.4f},{miny:.4f},{maxx:.4f},{maxy:.4f},EPSG:4326"
    )


class IncoisPfzAdapter(MarineAdapterInterface):
    """
    INCOIS Potential Fishing Zone (PFZ) Adapter.
    Fetches real, daily operational PFZ advisory lines from the INCOIS GeoServer WFS.
    """

    source_name = "INCOIS"
    product_name = "Potential Fishing Zone Advisory (PFZ GeoServer WFS)"

    def _is_in_coverage(self, lat: float, lon: float) -> bool:
        return (
            COVERAGE_LAT_MIN <= lat <= COVERAGE_LAT_MAX
            and COVERAGE_LON_MIN <= lon <= COVERAGE_LON_MAX
        )

    async def fetch(
        self,
        latitude: float,
        longitude: float,
        *,
        time_iso: Optional[str] = None,
    ) -> List[MarineObservation]:
        """
        Fetch PFZ lines intersecting or proximate to (lat, lon).
        Returns a list containing the normalized MarineObservation (or empty list if failed/out-of-bounds).
        Does NOT raise exceptions.
        """
        _status["last_fetch_attempt"] = datetime.now(timezone.utc).isoformat()

        if not self._is_in_coverage(latitude, longitude):
            logger.info(
                "INCOIS PFZ: (%.2f, %.2f) outside coverage %.2f–%.2f°N, %.2f–%.2f°E",
                latitude, longitude,
                COVERAGE_LAT_MIN, COVERAGE_LAT_MAX,
                COVERAGE_LON_MIN, COVERAGE_LON_MAX,
            )
            return []

        cache_key = (round(latitude, 2), round(longitude, 2))
        cached_obs, cached_ts = _cache.get(cache_key, (None, 0.0))
        if cached_obs is not None and (time.monotonic() - cached_ts) < CACHE_TTL_SECONDS:
            logger.debug("INCOIS PFZ cache hit for (%.2f, %.2f)", latitude, longitude)
            return [cached_obs]

        url = _build_pfz_wfs_url(latitude, longitude)

        async with httpx.AsyncClient(
            headers={"User-Agent": "SagarAI/1.0 (SIH2026-26176; marine-decision-continuity)"},
            follow_redirects=True,
        ) as client:
            resp_data = None
            for attempt in range(MAX_RETRIES + 1):
                try:
                    resp = await client.get(url, timeout=HTTP_TIMEOUT_SECS)
                    if resp.status_code == 200:
                        resp_data = resp.json()
                        break
                    logger.warning("INCOIS PFZ WFS HTTP %d (attempt %d)", resp.status_code, attempt + 1)
                except (httpx.TimeoutException, httpx.RequestError) as exc:
                    logger.warning("INCOIS PFZ WFS error on attempt %d: %s", attempt + 1, exc)

        if resp_data is None:
            err = f"INCOIS PFZ WFS request failed for ({latitude}, {longitude})."
            logger.error(err)
            _status["last_error"] = err
            _cache[cache_key] = (None, time.monotonic())
            return []

        obs = parse_pfz_geojson(
            raw_data=resp_data,
            source_lat=latitude,
            source_lon=longitude,
            endpoint_url=url,
            product=self.product_name,
        )

        if obs is None:
            _status["last_error"] = "Failed to parse PFZ GeoJSON response."
            return []

        _status["last_successful_fetch"] = datetime.now(timezone.utc).isoformat()
        _status["last_error"] = None
        _status["dataset_file"] = obs.dataset_file
        _cache[cache_key] = (obs, time.monotonic())

        return [obs]

    async def get_status(self) -> MarineSourceStatus:
        """Compute current PFZ adapter health status."""
        last_ok = _status.get("last_successful_fetch")
        last_err = _status.get("last_error")

        if last_ok is None:
            fetch_status = FetchStatus.UNAVAILABLE
            cache_age = None
        else:
            then = datetime.fromisoformat(last_ok)
            if then.tzinfo is None:
                then = then.replace(tzinfo=timezone.utc)
            age_secs = (datetime.now(timezone.utc) - then).total_seconds()
            cache_age = age_secs

            if age_secs > STALE_THRESHOLD_SECS:
                fetch_status = FetchStatus.STALE
            elif last_err:
                fetch_status = FetchStatus.STALE
            else:
                fetch_status = FetchStatus.CONNECTED

        return MarineSourceStatus(
            source=self.source_name,
            product=self.product_name,
            status=fetch_status,
            last_successful_fetch=last_ok,
            last_fetch_attempt=_status.get("last_fetch_attempt"),
            last_error=last_err,
            cache_age_seconds=cache_age,
            cache_ttl_seconds=CACHE_TTL_SECONDS,
            dataset_file=_status.get("dataset_file") or LAYER_NAME,
            coverage={
                "latitude_range": [COVERAGE_LAT_MIN, COVERAGE_LAT_MAX],
                "longitude_range": [COVERAGE_LON_MIN, COVERAGE_LON_MAX],
                "format": "GeoJSON via WFS 1.0.0",
                "crs": "EPSG:4326",
            },
        )


# ── Module singleton ────────────────────────────────────────────────────────
incois_pfz = IncoisPfzAdapter()
