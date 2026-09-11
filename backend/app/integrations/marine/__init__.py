"""
backend/app/integrations/marine/__init__.py
"""

from app.integrations.marine.ais import ais_adapter
from app.integrations.marine.incois_osf import incois_osf
from app.integrations.marine.marine_types import (
    DataSourceType,
    FetchStatus,
    MarineAdapterInterface,
    MarineObservation,
    MarineParameter,
    MarineSourceStatus,
)
from app.integrations.marine.normalizer import (
    merge_observations,
    parse_pfz_geojson,
    parse_wms_feature_info_xml,
)
from app.integrations.marine.pfz import incois_pfz
from app.integrations.marine.registry import marine_registry

__all__ = [
    "DataSourceType",
    "FetchStatus",
    "MarineAdapterInterface",
    "MarineObservation",
    "MarineParameter",
    "MarineSourceStatus",
    "incois_osf",
    "incois_pfz",
    "ais_adapter",
    "marine_registry",
    "parse_wms_feature_info_xml",
    "parse_pfz_geojson",
    "merge_observations",
]
