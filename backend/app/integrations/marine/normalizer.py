"""
normalizer.py — Parses raw INCOIS WMS GetFeatureInfo XML responses
and normalises them into MarineObservation objects.

All parsing lives here, isolated from the HTTP fetch logic in incois_osf.py.
"""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from app.integrations.marine.marine_types import (
    DataSourceType,
    MarineObservation,
    MarineParameter,
)

logger = logging.getLogger(__name__)


# ── Parameter Registry ─────────────────────────────────────────────────────
# Maps WMS layer name → (normalised key, display name, unit)
_PARAM_META: Dict[str, Tuple[str, str, str]] = {
    "SWH":   ("significant_wave_height", "Significant Wave Height",  "m"),
    "SWELL": ("swell_height",             "Swell Height",              "m"),
    "WP":    ("wave_period",              "Wave Period",               "s"),
    "SWP":   ("swell_wave_period",        "Swell Wave Period",         "s"),
    "WD":    ("wave_direction",           "Wave Direction",            "°"),
    "SWD":   ("swell_direction",          "Swell Direction",           "°"),
    "UWND":  ("wind_u_component",         "Wind U-Component",          "m/s"),
    "VWND":  ("wind_v_component",         "Wind V-Component",          "m/s"),
    "WNDSPD":("wind_speed",               "Wind Speed",                "m/s"),
    "WNDDIR":("wind_direction",           "Wind Direction",            "°"),
    "SST":   ("sea_surface_temperature",  "Sea Surface Temperature",   "°C"),
    "CUR_U": ("current_u_component",      "Surface Current U",         "m/s"),
    "CUR_V": ("current_v_component",      "Surface Current V",         "m/s"),
}

# NetCDF fill value (9.96921e+36 in WW3 / INCOIS)
_FILL_VALUE_THRESHOLD = 1e30


def parse_wms_feature_info_xml(
    raw_xml: str,
    layer_name: str,
    source_lat: float,
    source_lon: float,
    dataset_file: str,
    endpoint_url: str,
    product: str = "Ocean State Forecast – Coastal Wave",
) -> Optional[MarineObservation]:
    """
    Parse a single WMS GetFeatureInfo XML response into a MarineObservation.

    Expected XML structure (ncWMS2 / edal-java):
    <FeatureInfoResponse>
        <longitude>73.01</longitude>
        <latitude>14.99</latitude>
        <Feature>
            <layer>SWH</layer>
            <FeatureInfo>
                <id>SWH</id>
                <time>2026-09-10T15:00:00.000Z</time>
                <value>1.6213181018829346</value>
            </FeatureInfo>
        </Feature>
    </FeatureInfoResponse>
    """
    fetched_at = datetime.now(timezone.utc).isoformat()

    try:
        root = ET.fromstring(raw_xml.strip())
    except ET.ParseError as exc:
        logger.warning("WMS XML parse error for layer %s: %s", layer_name, exc)
        return None

    # Extract returned lat/lon (may differ slightly from query — snap to grid)
    try:
        ret_lon = float(root.findtext("longitude") or source_lon)
        ret_lat = float(root.findtext("latitude") or source_lat)
    except ValueError:
        ret_lon, ret_lat = source_lon, source_lat

    # Walk Feature / FeatureInfo elements
    parameters: Dict[str, MarineParameter] = {}
    valid_time: Optional[str] = None

    for feature in root.findall("Feature"):
        for fi in feature.findall("FeatureInfo"):
            layer_id = fi.findtext("id") or layer_name
            time_str = fi.findtext("time")
            value_str = fi.findtext("value")

            if valid_time is None and time_str:
                valid_time = time_str

            if value_str is None:
                continue

            try:
                value = float(value_str)
            except ValueError:
                continue

            # Check for fill value
            if abs(value) >= _FILL_VALUE_THRESHOLD:
                logger.debug("Fill value detected for %s at (%.2f, %.2f) — skipping.", layer_id, ret_lat, ret_lon)
                value = None

            norm_key, display_name, unit = _PARAM_META.get(
                layer_id.upper(), (layer_id.lower(), layer_id, "?")
            )

            parameters[norm_key] = MarineParameter(
                name=norm_key,
                display_name=display_name,
                value=value,
                unit=unit,
                quality_flag="GOOD" if value is not None else "MISSING",
            )

    if not parameters:
        logger.debug("No parameter data extracted from XML for layer %s.", layer_name)
        return None

    return MarineObservation(
        source="INCOIS",
        source_type=DataSourceType.REAL,
        product=product,
        dataset_file=dataset_file,
        endpoint_url=endpoint_url,
        valid_time=valid_time or fetched_at,
        latitude=ret_lat,
        longitude=ret_lon,
        parameters=parameters,
        quality="REAL_INCOIS_OSF_WMS_GEFEATUREINFO",
        source_record_id=f"INCOIS-OSF-{dataset_file}-{layer_name}",
        fetched_at=fetched_at,
    )


def merge_observations(obs_list: List[MarineObservation]) -> Optional[MarineObservation]:
    """
    Merge multiple single-parameter observations (same point, same time)
    into one consolidated MarineObservation.
    """
    if not obs_list:
        return None

    base = obs_list[0]
    merged_params: Dict[str, MarineParameter] = {}

    for obs in obs_list:
        merged_params.update(obs.parameters)

    return MarineObservation(
        source=base.source,
        source_type=base.source_type,
        product=base.product,
        dataset_file=base.dataset_file,
        endpoint_url=base.endpoint_url,
        valid_time=base.valid_time,
        latitude=base.latitude,
        longitude=base.longitude,
        parameters=merged_params,
        quality=base.quality,
        source_record_id=base.source_record_id,
        fetched_at=base.fetched_at,
    )


# ── PFZ GeoJSON Normalizer ──────────────────────────────────────────────────

def _approx_dist_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Planar distance approximation in nautical miles."""
    import math
    d_lat = (lat2 - lat1) * 60.0
    cos_lat = math.cos(math.radians((lat1 + lat2) / 2))
    d_lon = (lon2 - lon1) * 60.0 * cos_lat
    return math.sqrt(d_lat ** 2 + d_lon ** 2)


def parse_pfz_geojson(
    raw_data: str | dict,
    source_lat: float,
    source_lon: float,
    endpoint_url: str,
    max_proximity_nm: float = 60.0,
    product: str = "Potential Fishing Zone (PFZ GeoServer WFS)",
) -> Optional[MarineObservation]:
    """
    Parse an INCOIS GeoServer WFS GeoJSON response into a normalized MarineObservation.

    Extracts features from PFZ_Automation:pfzlines, calculates minimum distance to
    the queried point, and populates pfz_detected, pfz_proximity_distance_nm,
    and pfz_line_length_km parameters.
    """
    import json

    fetched_at = datetime.now(timezone.utc).isoformat()

    if isinstance(raw_data, str):
        try:
            data = json.loads(raw_data.strip())
        except Exception as exc:
            logger.warning("Failed to parse PFZ GeoJSON: %s", exc)
            return None
    elif isinstance(raw_data, dict):
        data = raw_data
    else:
        return None

    features = data.get("features", [])
    parameters: Dict[str, MarineParameter] = {}

    if not features:
        # Valid fetch from official endpoint, but no PFZ lines in this BBOX
        parameters["pfz_detected"] = MarineParameter(
            name="pfz_detected",
            display_name="Potential Fishing Zone Detected",
            value=0.0,
            unit="flag",
            quality_flag="GOOD",
        )
        parameters["pfz_proximity_distance_nm"] = MarineParameter(
            name="pfz_proximity_distance_nm",
            display_name="Distance to Nearest PFZ Line",
            value=None,
            unit="nm",
            quality_flag="NONE_IN_BBOX",
        )
        return MarineObservation(
            source="INCOIS",
            source_type=DataSourceType.REAL,
            product=product,
            dataset_file="PFZ_Automation:pfzlines",
            endpoint_url=endpoint_url,
            valid_time=fetched_at,
            latitude=source_lat,
            longitude=source_lon,
            parameters=parameters,
            quality="REAL_INCOIS_PFZ_GEOSERVER_WFS",
            source_record_id=None,
            fetched_at=fetched_at,
        )

    # Find closest feature and minimum distance
    closest_feature = None
    min_dist_nm = float("inf")

    for feat in features:
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates", [])
        geom_type = geom.get("type", "")

        # Normalize point list from LineString or MultiLineString
        pt_list = []
        if geom_type == "LineString":
            pt_list = coords
        elif geom_type == "MultiLineString":
            for line in coords:
                pt_list.extend(line)

        for pt in pt_list:
            if len(pt) >= 2:
                pt_lon, pt_lat = float(pt[0]), float(pt[1])
                dist = _approx_dist_nm(source_lat, source_lon, pt_lat, pt_lon)
                if dist < min_dist_nm:
                    min_dist_nm = dist
                    closest_feature = feat

    props = (closest_feature.get("properties") or {}) if closest_feature else {}
    feat_id = closest_feature.get("id") if closest_feature else None
    reported_length = props.get("Length") or props.get("Shape_Leng")

    # Compute valid_time from Julian day and Year if available
    valid_time = fetched_at
    julian_day = props.get("Julian_day")
    year = props.get("Year")
    if julian_day and year:
        try:
            dt = datetime.strptime(f"{year}-{int(julian_day):03d}", "%Y-%j").replace(tzinfo=timezone.utc)
            valid_time = dt.isoformat()
        except Exception:
            valid_time = fetched_at

    is_detected = 1.0 if min_dist_nm <= max_proximity_nm else 0.0

    parameters["pfz_detected"] = MarineParameter(
        name="pfz_detected",
        display_name="Potential Fishing Zone Detected",
        value=is_detected,
        unit="flag",
        quality_flag="GOOD",
    )
    parameters["pfz_proximity_distance_nm"] = MarineParameter(
        name="pfz_proximity_distance_nm",
        display_name="Distance to Nearest PFZ Line",
        value=round(min_dist_nm, 2) if min_dist_nm != float("inf") else None,
        unit="nm",
        quality_flag="GOOD" if min_dist_nm != float("inf") else "MISSING",
    )

    if reported_length is not None:
        try:
            length_val = round(float(reported_length), 2)
            parameters["pfz_line_length_km"] = MarineParameter(
                name="pfz_line_length_km",
                display_name="PFZ Feature Length",
                value=length_val,
                unit="km",
                quality_flag="GOOD",
            )
        except (ValueError, TypeError):
            pass

    dataset_identifier = f"PFZ_{year}_Day{julian_day}" if julian_day and year else "PFZ_Automation:pfzlines"

    return MarineObservation(
        source="INCOIS",
        source_type=DataSourceType.REAL,
        product=product,
        dataset_file=dataset_identifier,
        endpoint_url=endpoint_url,
        valid_time=valid_time,
        latitude=source_lat,
        longitude=source_lon,
        parameters=parameters,
        quality="REAL_INCOIS_PFZ_GEOSERVER_WFS",
        source_record_id=feat_id or (f"PFZ-{dataset_identifier}"),
        fetched_at=fetched_at,
    )

