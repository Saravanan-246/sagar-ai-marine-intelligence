"""
incois_osf.py — INCOIS Ocean State Forecast Adapter
Source: https://incois.gov.in/thredds/ (official THREDDS / WMS server)
Protocol: WMS 1.1.1 GetFeatureInfo (text/xml) — lightweight point queries

CONFIRMED LIVE ENDPOINTS (verified 2026-09-10):
  Catalog:  https://incois.gov.in/thredds/catalog/osf/wave/catalog.html
  WMS Base: https://incois.gov.in/thredds/wms/osf/wave/<FILENAME>
  GetFeatureInfo parameters:
    SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo
    LAYERS=<LAYER>&QUERY_LAYERS=<LAYER>&SRS=EPSG:4326
    BBOX=<lon1,lat1,lon2,lat2>&WIDTH=100&HEIGHT=100&X=50&Y=50
    INFO_FORMAT=text/xml&TIME=<ISO8601>

CONFIRMED REAL LAYERS (from GetCapabilities 2026-09-10):
  SWH   — Significant Wave Height (m)
  SWELL — Swell Height (m)
  WP    — Wave Period (s)
  SWP   — Swell Wave Period (s)
  WD    — Wave Direction (°)    [in ww3 product]
  SWD   — Swell Direction (°)   [in ww3 product]

Coverage (coastal product):
  Lon: 64.95°E – 95.05°E
  Lat: 4.95°N  – 25.05°N
  Time: 3-hourly, 7-day rolling forecast window

IMPORTANT:
  - NO API KEY required — public THREDDS server.
  - Data labelled source_type="REAL" ONLY when HTTP 200 + valid XML.
  - Fill values (> 1e30) are reported as value=None, quality_flag="MISSING".
  - Never fallback to synthetic values on error.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple

import httpx

from app.integrations.marine.marine_types import (
    DataSourceType,
    FetchStatus,
    MarineAdapterInterface,
    MarineObservation,
    MarineSourceStatus,
)
from app.integrations.marine.normalizer import (
    merge_observations,
    parse_wms_feature_info_xml,
)

logger = logging.getLogger(__name__)


# ── Configuration ──────────────────────────────────────────────────────────

INCOIS_THREDDS_BASE   = "https://incois.gov.in/thredds"
CATALOG_URL           = f"{INCOIS_THREDDS_BASE}/catalog/osf/wave/catalog.html"
WMS_BASE              = f"{INCOIS_THREDDS_BASE}/wms/osf/wave"

# Layers to fetch for each point query
TARGET_LAYERS = ["SWH", "SWELL", "WP", "SWP"]

# BBOX half-width in degrees for GetFeatureInfo (small box around point)
_BBOX_DELTA = 1.0

# Coverage bounds (from GetCapabilities)
COVERAGE_LON_MIN = 64.95
COVERAGE_LON_MAX = 95.05
COVERAGE_LAT_MIN = 4.95
COVERAGE_LAT_MAX = 25.05

CACHE_TTL_SECONDS    = 1800   # 30 min
STALE_THRESHOLD_SECS = 3600   # 60 min — data older than this → STALE
HTTP_TIMEOUT_SECS    = 15.0
MAX_RETRIES          = 1


# ── In-memory cache ───────────────────────────────────────────────────────
# key: (lat_rounded2dp, lon_rounded2dp, layer, time_str) → (result, timestamp)
_cache: Dict[Tuple, Tuple[Optional[MarineObservation], float]] = {}

# Status tracking
_status: Dict[str, Optional[str]] = {
    "last_successful_fetch": None,
    "last_fetch_attempt": None,
    "last_error": None,
    "dataset_file": None,
}


# ── Dataset Discovery ─────────────────────────────────────────────────────

async def _discover_latest_dataset(client: httpx.AsyncClient) -> Optional[str]:
    """
    Scrape the THREDDS catalog HTML to find the most recent
    WAVES_coast_YYYYMMDD.nc filename.
    Falls back to a known recent filename if catalog is unreachable.
    """
    try:
        resp = await client.get(CATALOG_URL, timeout=HTTP_TIMEOUT_SECS)
        resp.raise_for_status()
        html = resp.text
        # Pattern: href="catalog.html?dataset=OSF4/WAVES_coast_20260905.nc"
        matches = re.findall(r'href="catalog\.html\?dataset=\S+/(WAVES_coast_\d{8}\.nc)"', html)
        if matches:
            # Sort by date (filename is YYYYMMDD), take the latest
            matches.sort(reverse=True)
            latest = matches[0]
            logger.info("INCOIS OSF: discovered latest dataset: %s", latest)
            return latest
    except Exception as exc:
        logger.warning("INCOIS OSF: catalog discovery failed: %s", exc)
    return None


# ── WMS GetFeatureInfo Fetch ───────────────────────────────────────────────

def _build_wms_url(dataset_file: str, layer: str, lat: float, lon: float, time_iso: str) -> str:
    """Build the WMS GetFeatureInfo URL for a single point query."""
    lon1 = lon - _BBOX_DELTA
    lat1 = lat - _BBOX_DELTA
    lon2 = lon + _BBOX_DELTA
    lat2 = lat + _BBOX_DELTA
    return (
        f"{WMS_BASE}/{dataset_file}"
        f"?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo"
        f"&LAYERS={layer}&QUERY_LAYERS={layer}&SRS=EPSG:4326"
        f"&BBOX={lon1:.4f},{lat1:.4f},{lon2:.4f},{lat2:.4f}"
        f"&WIDTH=100&HEIGHT=100&X=50&Y=50"
        f"&INFO_FORMAT=text/xml&TIME={time_iso}"
    )


async def _fetch_single_layer(
    client: httpx.AsyncClient,
    dataset_file: str,
    layer: str,
    lat: float,
    lon: float,
    time_iso: str,
) -> Optional[MarineObservation]:
    """Fetch one layer for one point and return a MarineObservation or None."""
    cache_key = (round(lat, 2), round(lon, 2), layer, time_iso[:13])  # hourly granularity
    cached_val, cached_ts = _cache.get(cache_key, (None, 0.0))
    if cached_val is not None and (time.monotonic() - cached_ts) < CACHE_TTL_SECONDS:
        logger.debug("INCOIS OSF cache hit: layer=%s lat=%.2f lon=%.2f", layer, lat, lon)
        return cached_val

    url = _build_wms_url(dataset_file, layer, lat, lon, time_iso)

    for attempt in range(MAX_RETRIES + 1):
        try:
            resp = await client.get(url, timeout=HTTP_TIMEOUT_SECS)
            if resp.status_code != 200:
                logger.warning(
                    "INCOIS WMS HTTP %d for layer=%s (attempt %d)",
                    resp.status_code, layer, attempt + 1
                )
                continue
            obs = parse_wms_feature_info_xml(
                raw_xml=resp.text,
                layer_name=layer,
                source_lat=lat,
                source_lon=lon,
                dataset_file=dataset_file,
                endpoint_url=url,
            )
            if obs is not None:
                _cache[cache_key] = (obs, time.monotonic())
                return obs
        except httpx.TimeoutException:
            logger.warning("INCOIS WMS timeout layer=%s attempt=%d", layer, attempt + 1)
        except httpx.RequestError as exc:
            logger.warning("INCOIS WMS request error layer=%s: %s", layer, exc)

    # Cache a None sentinel to avoid hammering on repeated failures
    _cache[cache_key] = (None, time.monotonic())
    return None


# ── Public Adapter Class ───────────────────────────────────────────────────

class IncoisOsfAdapter(MarineAdapterInterface):
    """
    INCOIS Ocean State Forecast adapter.
    Fetches Significant Wave Height, Swell, Wave Period from the
    official INCOIS THREDDS/WMS server via GetFeatureInfo.
    """

    source_name = "INCOIS"
    product_name = "Ocean State Forecast – Coastal Wave (WAVES_coast)"

    def _nearest_forecast_time(self) -> str:
        """
        Round the current UTC time DOWN to the nearest 3-hour slot
        (INCOIS OSF runs on 3-hourly cadence) and return ISO-8601 string.
        """
        now = datetime.now(timezone.utc)
        snapped_hour = (now.hour // 3) * 3
        snapped = now.replace(hour=snapped_hour, minute=0, second=0, microsecond=0)
        return snapped.isoformat().replace("+00:00", ".000Z")

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
        Fetch all available OSF parameters for a single (lat, lon) point.
        Returns a list of MarineObservation (may be empty on failure).
        Does NOT raise — all errors are logged and return [].
        """
        _status["last_fetch_attempt"] = datetime.now(timezone.utc).isoformat()

        if not self._is_in_coverage(latitude, longitude):
            logger.info(
                "INCOIS OSF: (%.2f, %.2f) outside coverage %.2f–%.2f°N, %.2f–%.2f°E",
                latitude, longitude,
                COVERAGE_LAT_MIN, COVERAGE_LAT_MAX,
                COVERAGE_LON_MIN, COVERAGE_LON_MAX,
            )
            return []

        query_time = time_iso or self._nearest_forecast_time()

        async with httpx.AsyncClient(
            headers={"User-Agent": "SagarAI/1.0 (SIH2026-26176; marine-decision-continuity)"},
            follow_redirects=True,
        ) as client:
            # Step 1: Discover latest dataset file dynamically
            dataset_file = await _discover_latest_dataset(client)
            if dataset_file is None:
                err = "INCOIS catalog discovery returned no dataset."
                logger.error(err)
                _status["last_error"] = err
                return []

            _status["dataset_file"] = dataset_file

            # Step 2: Fetch each layer concurrently
            tasks = [
                _fetch_single_layer(client, dataset_file, layer, latitude, longitude, query_time)
                for layer in TARGET_LAYERS
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        # Collect valid observations
        valid_obs: List[MarineObservation] = []
        for result in results:
            if isinstance(result, Exception):
                logger.warning("INCOIS OSF fetch task exception: %s", result)
                continue
            if result is not None:
                valid_obs.append(result)

        if not valid_obs:
            err = f"All INCOIS OSF layer fetches failed for ({latitude}, {longitude})."
            logger.error(err)
            _status["last_error"] = err
            return []

        # Step 3: Merge all layers into one consolidated observation
        merged = merge_observations(valid_obs)
        if merged is None:
            return []

        _status["last_successful_fetch"] = datetime.now(timezone.utc).isoformat()
        _status["last_error"] = None

        return [merged]

    async def get_status(self) -> MarineSourceStatus:
        """Compute current adapter health."""
        last_ok = _status.get("last_successful_fetch")
        last_err = _status.get("last_error")

        if last_ok is None:
            fetch_status = FetchStatus.UNAVAILABLE
            cache_age = None
        else:
            # Calculate age from last successful fetch
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
            dataset_file=_status.get("dataset_file"),
            coverage={
                "latitude_range": [COVERAGE_LAT_MIN, COVERAGE_LAT_MAX],
                "longitude_range": [COVERAGE_LON_MIN, COVERAGE_LON_MAX],
                "temporal_resolution": "PT3H",
                "forecast_horizon_days": 7,
                "crs": "EPSG:4326",
            },
        )


# ── Module-level singleton ────────────────────────────────────────────────
incois_osf = IncoisOsfAdapter()
