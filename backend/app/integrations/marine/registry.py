"""
registry.py — Central Marine Data Source Registry

Manages all registered marine adapters (INCOIS OSF, INCOIS PFZ, AIS, etc.),
aggregates source health and data availability, and provides unified querying
for coordinate points and corridor waypoints.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from app.integrations.marine.ais import ais_adapter
from app.integrations.marine.incois_osf import incois_osf
from app.integrations.marine.marine_types import (
    MarineAdapterInterface,
    MarineObservation,
    MarineSourceStatus,
)
from app.integrations.marine.pfz import incois_pfz

logger = logging.getLogger(__name__)


class MarineRegistry:
    """
    Central coordinator for marine environmental & operational data adapters.
    Provides uniform observation retrieval and status reporting across all sources.
    """

    def __init__(self) -> None:
        self._adapters: Dict[str, MarineAdapterInterface] = {}
        # Pre-register verified and audited adapters
        self.register("INCOIS_OSF", incois_osf)
        self.register("INCOIS_PFZ", incois_pfz)
        self.register("AIS", ais_adapter)

    def register(self, key: str, adapter: MarineAdapterInterface) -> None:
        """Register a new adapter under a unique source key."""
        self._adapters[key.upper()] = adapter
        logger.info("MarineRegistry: registered adapter '%s' (%s)", key.upper(), adapter.product_name)

    def get_adapter(self, key: str) -> Optional[MarineAdapterInterface]:
        """Lookup an adapter by key."""
        return self._adapters.get(key.upper())

    def list_sources(self) -> List[str]:
        """Return list of registered source identifiers."""
        return list(self._adapters.keys())

    async def get_all_statuses(self) -> Dict[str, MarineSourceStatus]:
        """Retrieve health and availability status from all registered sources concurrently."""
        statuses: Dict[str, MarineSourceStatus] = {}

        tasks = [
            (key, adapter.get_status())
            for key, adapter in self._adapters.items()
        ]

        results = await asyncio.gather(*(t[1] for t in tasks), return_exceptions=True)

        for (key, _), result in zip(tasks, results):
            if isinstance(result, Exception):
                logger.error("Error retrieving status for '%s': %s", key, result)
            elif isinstance(result, MarineSourceStatus):
                statuses[key] = result

        return statuses

    async def fetch_point(
        self,
        lat: float,
        lon: float,
        *,
        sources: Optional[List[str]] = None,
        time_iso: Optional[str] = None,
    ) -> List[MarineObservation]:
        """
        Fetch normalized observations across registered sources for a given point.
        Optionally filter by source keys (e.g. ["INCOIS_OSF", "INCOIS_PFZ"]).
        """
        target_keys = (
            [s.upper() for s in sources]
            if sources
            else list(self._adapters.keys())
        )

        tasks = []
        for key in target_keys:
            adapter = self._adapters.get(key)
            if adapter:
                tasks.append(adapter.fetch(lat, lon, time_iso=time_iso))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_observations: List[MarineObservation] = []
        for res in results:
            if isinstance(res, list):
                all_observations.extend(res)
            elif isinstance(res, Exception):
                logger.warning("MarineRegistry: point fetch task encountered exception: %s", res)

        return all_observations

    async def fetch_waypoints(
        self,
        waypoints: List[Dict[str, Any]],
        *,
        sources: Optional[List[str]] = None,
        time_iso: Optional[str] = None,
    ) -> List[MarineObservation]:
        """
        Batch-fetch normalized observations across waypoints.
        Each waypoint dict should have 'lat', 'lon', and optionally 'segment' or 'name'.
        """
        all_observations: List[MarineObservation] = []

        for wp in waypoints:
            lat = wp.get("lat")
            lon = wp.get("lon")
            segment = wp.get("segment", "UNKNOWN")

            if lat is None or lon is None:
                continue

            obs_list = await self.fetch_point(
                float(lat),
                float(lon),
                sources=sources,
                time_iso=time_iso,
            )

            for obs in obs_list:
                # Append segment identifier to source_record_id for route correlation
                if segment != "UNKNOWN" and obs.source_record_id:
                    obs.source_record_id = f"{obs.source_record_id}-{segment}"
                all_observations.append(obs)

        return all_observations


# ── Module singleton ────────────────────────────────────────────────────────
marine_registry = MarineRegistry()
