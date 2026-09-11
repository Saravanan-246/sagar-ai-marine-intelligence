"""
marine_types.py — Canonical internal marine observation data contract.

All adapters (INCOIS OSF, future PFZ, AIS, etc.) MUST produce observations
that conform to MarineObservation.  The decision engine only ever consumes
this normalised type — never raw adapter payloads.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DataSourceType(str, Enum):
    REAL       = "REAL"       # Retrieved from a live official source
    SIMULATED  = "SIMULATED"  # Demo / benchmark data
    UNAVAILABLE = "UNAVAILABLE"  # Fetch failed, no data


class FetchStatus(str, Enum):
    CONNECTED   = "CONNECTED"    # Last fetch succeeded, data is fresh
    STALE       = "STALE"        # Last fetch succeeded but data is older than threshold
    UNAVAILABLE = "UNAVAILABLE"  # Source is unreachable or returned an error


class MarineParameter(BaseModel):
    """A single observed/forecast scalar parameter."""
    name: str                           # e.g. "significant_wave_height"
    display_name: str                   # e.g. "Significant Wave Height"
    value: Optional[float]              # None if missing/fill value
    unit: str                           # e.g. "m", "knots", "°C"
    quality_flag: Optional[str] = None  # e.g. "GOOD", "SUSPECT", None


class MarineObservation(BaseModel):
    """
    Normalised marine forecast / observation record.

    This is the ONLY representation the backend decision engine
    and API endpoints consume.  No adapter-specific fields leak through.
    """
    source: str                         # e.g. "INCOIS"
    source_type: DataSourceType
    product: str                        # e.g. "Ocean State Forecast – Coastal Wave"
    dataset_file: Optional[str] = None  # e.g. "WAVES_coast_20260905.nc"
    endpoint_url: str                   # Exact URL hit (for auditability)

    # Spatio-temporal provenance
    forecast_reference_time: Optional[str] = None   # Model run time if known
    valid_time: str                                  # ISO-8601 time of the values
    latitude: float                                  # Decimal degrees N
    longitude: float                                 # Decimal degrees E

    # Parameters — keyed by short name, value is MarineParameter
    parameters: Dict[str, MarineParameter] = Field(default_factory=dict)

    # Metadata
    quality: str                        # e.g. "REAL_INCOIS_OSF_WMS"
    source_record_id: Optional[str] = None
    fetched_at: str                     # ISO-8601 UTC timestamp when our server fetched


class MarineSourceStatus(BaseModel):
    """Status report for a marine data source."""
    source: str
    product: str
    status: FetchStatus
    last_successful_fetch: Optional[str] = None   # ISO-8601
    last_fetch_attempt: Optional[str] = None      # ISO-8601
    last_error: Optional[str] = None
    cache_age_seconds: Optional[float] = None
    cache_ttl_seconds: int
    dataset_file: Optional[str] = None
    coverage: Optional[Dict[str, Any]] = None     # lat/lon/time bounds from source


class MarineAdapterInterface:
    """
    Abstract base class all marine adapters must subclass.
    Ensures the decision engine has a stable interface
    regardless of which data source is active.
    """

    source_name: str = "UNKNOWN"
    product_name: str = "UNKNOWN"

    async def fetch(
        self,
        latitude: float,
        longitude: float,
        *,
        time_iso: Optional[str] = None,
    ) -> List[MarineObservation]:
        """
        Fetch observations for a single (lat, lon) point.
        Returns a list of MarineObservation (may be empty if unavailable).
        Must NEVER raise — handle all errors internally and return [].
        """
        raise NotImplementedError

    async def get_status(self) -> MarineSourceStatus:
        """Return the current health / cache status of this adapter."""
        raise NotImplementedError
