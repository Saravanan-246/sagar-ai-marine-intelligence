"""
ais.py — Automatic Identification System (AIS) Adapter Interface & Limitation Reporter

AUDITED SOURCE VERIFICATION REPORT (2026-09-10):
  Target Source: Directorate General of Lighthouses and Lightships (DGLL) / Indian National AIS (NAIS)
  Verification Result: UNAVAILABLE
  Exact Technical & Regulatory Limitation:
    1. The Indian National AIS (NAIS) network operated by DGLL is a closed government infrastructure
       restricted to authorized maritime security agencies (Indian Navy, Indian Coast Guard, DG Shipping).
    2. No public, keyless, unauthenticated machine-readable REST API endpoint exists for general public
       or open developer access.
    3. Third-party commercial aggregators (MarineTraffic, VesselFinder, AISStream) require authenticated
       proprietary API keys or persistent WebSocket streaming subscriptions.

INVARIANT ENFORCEMENT:
  Per Sagar AI system integrity constraints:
  - Do NOT invent fake API endpoints.
  - Do NOT generate synthetic/fabricated vessel positions.
  - Expose explicit status: UNAVAILABLE with full provenance explanation.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.integrations.marine.marine_types import (
    DataSourceType,
    FetchStatus,
    MarineAdapterInterface,
    MarineObservation,
    MarineSourceStatus,
)

logger = logging.getLogger(__name__)

LIMITATION_REASON = (
    "Official Indian DGLL National AIS data is restricted for coastal security. "
    "No public, unauthenticated machine-readable REST API endpoint is available. "
    "Sagar AI does not inject synthetic vessel data."
)


class AisAdapter(MarineAdapterInterface):
    """
    AIS Adapter stub strictly adhering to the UNAVAILABLE data contract.
    Ensures the decision engine recognizes vessel traffic data as unavailable
    without crashing or faking real vessel observations.
    """

    source_name = "AIS"
    product_name = "National Automatic Identification System (DGLL NAIS)"

    async def fetch(
        self,
        latitude: float,
        longitude: float,
        *,
        time_iso: Optional[str] = None,
    ) -> List[MarineObservation]:
        """
        AIS data is UNAVAILABLE from public keyless sources.
        Returns empty list ([]). Never generates synthetic vessel tracks.
        """
        logger.info(
            "AIS fetch requested for (%.2f, %.2f) — reporting UNAVAILABLE (coastal security restriction)",
            latitude, longitude,
        )
        return []

    async def get_status(self) -> MarineSourceStatus:
        """Return explicit UNAVAILABLE status with detailed limitation rationale."""
        return MarineSourceStatus(
            source=self.source_name,
            product=self.product_name,
            status=FetchStatus.UNAVAILABLE,
            last_successful_fetch=None,
            last_fetch_attempt=datetime.now(timezone.utc).isoformat(),
            last_error=LIMITATION_REASON,
            cache_age_seconds=None,
            cache_ttl_seconds=0,
            dataset_file=None,
            coverage={
                "status": "RESTRICTED",
                "authority": "Directorate General of Lighthouses and Lightships (DGLL), India",
                "policy": "National coastal security restriction. Public unauthenticated API not provided.",
            },
        )


# ── Module singleton ────────────────────────────────────────────────────────
ais_adapter = AisAdapter()
