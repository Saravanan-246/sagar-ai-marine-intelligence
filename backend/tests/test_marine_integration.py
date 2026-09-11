"""
tests/test_marine_integration.py

Unit tests for the INCOIS OSF marine integration layer.
Tests cover:
  1. Successful XML normalization → MarineObservation
  2. Missing/fill value handling
  3. Stale data detection via MarineSourceStatus
  4. Unavailable source (empty result list)
  5. Coverage bounds enforcement
  6. Merge of multiple layer observations

Run with:
  .venv\\Scripts\\pytest tests/ -v
"""

import time
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.integrations.marine.marine_types import (
    DataSourceType,
    FetchStatus,
    MarineObservation,
    MarineSourceStatus,
)
from app.integrations.marine.normalizer import (
    parse_wms_feature_info_xml,
    merge_observations,
)
from app.integrations.marine import marine_types


# ── Fixtures / helpers ─────────────────────────────────────────────────────

SAMPLE_SWH_XML = """<FeatureInfoResponse>
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
</FeatureInfoResponse>"""

SAMPLE_SWELL_XML = """<FeatureInfoResponse>
    <longitude>73.01</longitude>
    <latitude>14.99</latitude>
    <Feature>
        <layer>SWELL</layer>
        <FeatureInfo>
            <id>SWELL</id>
            <time>2026-09-10T15:00:00.000Z</time>
            <value>0.9823</value>
        </FeatureInfo>
    </Feature>
</FeatureInfoResponse>"""

FILL_VALUE_XML = """<FeatureInfoResponse>
    <longitude>73.01</longitude>
    <latitude>14.99</latitude>
    <Feature>
        <layer>SWH</layer>
        <FeatureInfo>
            <id>SWH</id>
            <time>2026-09-10T15:00:00.000Z</time>
            <value>9.96920996838687E36</value>
        </FeatureInfo>
    </Feature>
</FeatureInfoResponse>"""

MALFORMED_XML = "this is not xml <<<"

EMPTY_FEATURE_XML = """<FeatureInfoResponse>
    <longitude>73.01</longitude>
    <latitude>14.99</latitude>
</FeatureInfoResponse>"""


# ══════════════════════════════════════════════════════════════════════════
# 1. Successful normalization
# ══════════════════════════════════════════════════════════════════════════

class TestSuccessfulNormalization:

    def test_parse_swh_returns_observation(self):
        obs = parse_wms_feature_info_xml(
            SAMPLE_SWH_XML, "SWH", 15.0, 73.0,
            dataset_file="WAVES_coast_20260905.nc",
            endpoint_url="http://incois.gov.in/thredds/wms/...",
        )
        assert obs is not None, "Expected a MarineObservation, got None"
        assert obs.source == "INCOIS"
        assert obs.source_type == DataSourceType.REAL
        assert "significant_wave_height" in obs.parameters
        param = obs.parameters["significant_wave_height"]
        assert param.value == pytest.approx(1.6213181018829346, rel=1e-4)
        assert param.unit == "m"
        assert param.quality_flag == "GOOD"

    def test_parse_snaps_lat_lon_from_xml(self):
        obs = parse_wms_feature_info_xml(
            SAMPLE_SWH_XML, "SWH", 15.0, 73.0,
            dataset_file="WAVES_coast_20260905.nc",
            endpoint_url="http://test/",
        )
        # Returned grid-snapped values from XML
        assert obs.latitude == pytest.approx(14.99, abs=0.01)
        assert obs.longitude == pytest.approx(73.01, abs=0.01)

    def test_parse_valid_time_extracted(self):
        obs = parse_wms_feature_info_xml(
            SAMPLE_SWH_XML, "SWH", 15.0, 73.0,
            dataset_file="WAVES_coast_20260905.nc",
            endpoint_url="http://test/",
        )
        assert obs.valid_time == "2026-09-10T15:00:00.000Z"

    def test_parse_swell_layer(self):
        obs = parse_wms_feature_info_xml(
            SAMPLE_SWELL_XML, "SWELL", 15.0, 73.0,
            dataset_file="WAVES_coast_20260905.nc",
            endpoint_url="http://test/",
        )
        assert obs is not None
        assert "swell_height" in obs.parameters
        assert obs.parameters["swell_height"].value == pytest.approx(0.9823, rel=1e-3)

    def test_dataset_file_preserved(self):
        obs = parse_wms_feature_info_xml(
            SAMPLE_SWH_XML, "SWH", 15.0, 73.0,
            dataset_file="WAVES_coast_20260905.nc",
            endpoint_url="http://test/",
        )
        assert obs.dataset_file == "WAVES_coast_20260905.nc"


# ══════════════════════════════════════════════════════════════════════════
# 2. Missing value / fill value handling
# ══════════════════════════════════════════════════════════════════════════

class TestMissingValueHandling:

    def test_fill_value_reported_as_none(self):
        obs = parse_wms_feature_info_xml(
            FILL_VALUE_XML, "SWH", 15.0, 73.0,
            dataset_file="WAVES_coast_20260905.nc",
            endpoint_url="http://test/",
        )
        # Fill values should produce value=None, not crash
        assert obs is not None
        swh = obs.parameters.get("significant_wave_height")
        assert swh is not None
        assert swh.value is None
        assert swh.quality_flag == "MISSING"

    def test_malformed_xml_returns_none(self):
        obs = parse_wms_feature_info_xml(
            MALFORMED_XML, "SWH", 15.0, 73.0,
            dataset_file="WAVES_coast_20260905.nc",
            endpoint_url="http://test/",
        )
        assert obs is None

    def test_empty_feature_xml_returns_none(self):
        obs = parse_wms_feature_info_xml(
            EMPTY_FEATURE_XML, "SWH", 15.0, 73.0,
            dataset_file="WAVES_coast_20260905.nc",
            endpoint_url="http://test/",
        )
        assert obs is None

    def test_empty_string_returns_none(self):
        obs = parse_wms_feature_info_xml(
            "", "SWH", 15.0, 73.0,
            dataset_file="WAVES_coast_20260905.nc",
            endpoint_url="http://test/",
        )
        assert obs is None


# ══════════════════════════════════════════════════════════════════════════
# 3. Stale data detection
# ══════════════════════════════════════════════════════════════════════════

class TestStaleDataDetection:

    @pytest.mark.asyncio
    async def test_status_is_unavailable_before_any_fetch(self):
        """Before any fetch attempt the adapter should report UNAVAILABLE."""
        from app.integrations.marine import incois_osf as mod

        # Temporarily reset status
        original = mod._status.copy()
        mod._status.update({
            "last_successful_fetch": None,
            "last_fetch_attempt": None,
            "last_error": None,
            "dataset_file": None,
        })
        try:
            adapter = mod.IncoisOsfAdapter()
            status = await adapter.get_status()
            assert status.status == FetchStatus.UNAVAILABLE
        finally:
            mod._status.update(original)

    @pytest.mark.asyncio
    async def test_status_is_stale_after_old_fetch(self):
        from app.integrations.marine import incois_osf as mod

        original = mod._status.copy()
        # Simulate a fetch that happened 2 hours ago
        two_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        mod._status.update({
            "last_successful_fetch": two_hours_ago,
            "last_fetch_attempt": two_hours_ago,
            "last_error": None,
            "dataset_file": "WAVES_coast_20260905.nc",
        })
        try:
            adapter = mod.IncoisOsfAdapter()
            status = await adapter.get_status()
            assert status.status == FetchStatus.STALE
            assert status.cache_age_seconds > 3600
        finally:
            mod._status.update(original)

    @pytest.mark.asyncio
    async def test_status_is_connected_after_recent_fetch(self):
        from app.integrations.marine import incois_osf as mod

        original = mod._status.copy()
        now = datetime.now(timezone.utc).isoformat()
        mod._status.update({
            "last_successful_fetch": now,
            "last_fetch_attempt": now,
            "last_error": None,
            "dataset_file": "WAVES_coast_20260905.nc",
        })
        try:
            adapter = mod.IncoisOsfAdapter()
            status = await adapter.get_status()
            assert status.status == FetchStatus.CONNECTED
        finally:
            mod._status.update(original)


# ══════════════════════════════════════════════════════════════════════════
# 4. Unavailable source
# ══════════════════════════════════════════════════════════════════════════

class TestUnavailableSource:

    @pytest.mark.asyncio
    async def test_fetch_returns_empty_when_catalog_fails(self):
        """If catalog discovery fails, fetch() returns [] without raising."""
        import httpx
        from app.integrations.marine.incois_osf import IncoisOsfAdapter

        adapter = IncoisOsfAdapter()

        async def mock_get(*args, **kwargs):
            raise httpx.ConnectError("Connection refused")

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            result = await adapter.fetch(15.0, 73.0)

        assert result == []

    @pytest.mark.asyncio
    async def test_fetch_returns_empty_on_500_error(self):
        """If catalog returns HTTP 500, fetch() returns []."""
        import httpx
        from app.integrations.marine.incois_osf import IncoisOsfAdapter

        adapter = IncoisOsfAdapter()

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server Error", request=MagicMock(), response=mock_response
        )

        with patch("httpx.AsyncClient.get", return_value=mock_response):
            result = await adapter.fetch(15.0, 73.0)

        assert result == []

    @pytest.mark.asyncio
    async def test_fetch_returns_empty_outside_coverage(self):
        """Points outside INCOIS coverage bounds return [] immediately."""
        from app.integrations.marine.incois_osf import IncoisOsfAdapter

        adapter = IncoisOsfAdapter()
        # Tokyo — outside Indian Ocean coverage
        result = await adapter.fetch(35.68, 139.69)
        assert result == []


# ══════════════════════════════════════════════════════════════════════════
# 5. Observation merging
# ══════════════════════════════════════════════════════════════════════════

class TestObservationMerging:

    def _make_obs(self, param_key: str, value: float) -> MarineObservation:
        from app.integrations.marine.marine_types import MarineParameter
        return MarineObservation(
            source="INCOIS",
            source_type=DataSourceType.REAL,
            product="OSF Test",
            dataset_file="test.nc",
            endpoint_url="http://test/",
            valid_time="2026-09-10T15:00:00.000Z",
            latitude=15.0,
            longitude=73.0,
            parameters={
                param_key: MarineParameter(
                    name=param_key,
                    display_name=param_key.upper(),
                    value=value,
                    unit="m",
                )
            },
            quality="REAL_TEST",
            fetched_at=datetime.now(timezone.utc).isoformat(),
        )

    def test_merge_combines_parameters(self):
        obs1 = self._make_obs("significant_wave_height", 1.62)
        obs2 = self._make_obs("swell_height", 0.98)
        merged = merge_observations([obs1, obs2])
        assert merged is not None
        assert "significant_wave_height" in merged.parameters
        assert "swell_height" in merged.parameters

    def test_merge_single_returns_as_is(self):
        obs = self._make_obs("significant_wave_height", 1.62)
        merged = merge_observations([obs])
        assert merged is not None
        assert len(merged.parameters) == 1

    def test_merge_empty_returns_none(self):
        assert merge_observations([]) is None


# ══════════════════════════════════════════════════════════════════════════
# 6. PFZ GeoJSON Normalization
# ══════════════════════════════════════════════════════════════════════════

SAMPLE_PFZ_GEOJSON = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "id": "pfzlines.2",
            "geometry": {
                "type": "MultiLineString",
                "coordinates": [
                    [
                        [74.16378, 14.62253],
                        [74.16303, 14.61829],
                        [74.16862, 14.59232],
                    ]
                ]
            },
            "properties": {
                "Category": "sst",
                "State_Name": "KARNATAKA",
                "Julian_day": "253",
                "Year": 2026,
                "UID": "2026253002",
                "Length": 18.60,
            }
        }
    ]
}

EMPTY_PFZ_GEOJSON = {
    "type": "FeatureCollection",
    "features": []
}


class TestPfzNormalization:

    def test_parse_pfz_extracts_proximity_and_detection(self):
        from app.integrations.marine.normalizer import parse_pfz_geojson

        # Query near 14.60°N, 74.16°E (~1 NM away from the line)
        obs = parse_pfz_geojson(
            SAMPLE_PFZ_GEOJSON,
            source_lat=14.60,
            source_lon=74.16,
            endpoint_url="https://incois.gov.in/geoserver/PFZ_Automation/wfs?...",
        )
        assert obs is not None
        assert obs.source == "INCOIS"
        assert obs.source_type == DataSourceType.REAL
        assert "pfz_detected" in obs.parameters
        assert obs.parameters["pfz_detected"].value == 1.0
        assert "pfz_proximity_distance_nm" in obs.parameters
        dist = obs.parameters["pfz_proximity_distance_nm"].value
        assert dist is not None
        assert dist < 10.0  # Very close to line
        assert "pfz_line_length_km" in obs.parameters
        assert obs.parameters["pfz_line_length_km"].value == pytest.approx(18.60, rel=1e-2)

    def test_parse_pfz_far_away_flags_not_detected(self):
        from app.integrations.marine.normalizer import parse_pfz_geojson

        # Query far away: 20.0°N, 70.0°E (>300 NM)
        obs = parse_pfz_geojson(
            SAMPLE_PFZ_GEOJSON,
            source_lat=20.0,
            source_lon=70.0,
            endpoint_url="https://incois.gov.in/geoserver/PFZ_Automation/wfs?...",
            max_proximity_nm=60.0,
        )
        assert obs is not None
        assert obs.parameters["pfz_detected"].value == 0.0
        assert obs.parameters["pfz_proximity_distance_nm"].value > 60.0

    def test_parse_pfz_empty_features(self):
        from app.integrations.marine.normalizer import parse_pfz_geojson

        obs = parse_pfz_geojson(
            EMPTY_PFZ_GEOJSON,
            source_lat=15.0,
            source_lon=73.0,
            endpoint_url="https://incois.gov.in/geoserver/PFZ_Automation/wfs?...",
        )
        assert obs is not None
        assert obs.source_type == DataSourceType.REAL
        assert obs.parameters["pfz_detected"].value == 0.0
        assert obs.parameters["pfz_proximity_distance_nm"].value is None
        assert obs.parameters["pfz_proximity_distance_nm"].quality_flag == "NONE_IN_BBOX"

    def test_parse_pfz_invalid_data_returns_none(self):
        from app.integrations.marine.normalizer import parse_pfz_geojson

        assert parse_pfz_geojson("invalid json string", 15.0, 73.0, "http://test") is None
        assert parse_pfz_geojson(12345, 15.0, 73.0, "http://test") is None


# ══════════════════════════════════════════════════════════════════════════
# 7. PFZ Adapter Tests
# ══════════════════════════════════════════════════════════════════════════

class TestPfzAdapter:

    @pytest.mark.asyncio
    async def test_pfz_outside_coverage_returns_empty(self):
        from app.integrations.marine.pfz import IncoisPfzAdapter

        adapter = IncoisPfzAdapter()
        # Bay of Bengal far east / Andaman outside coastal bounds
        result = await adapter.fetch(5.0, 60.0)
        assert result == []

    @pytest.mark.asyncio
    async def test_pfz_fetch_returns_empty_on_connection_error(self):
        import httpx
        from app.integrations.marine.pfz import IncoisPfzAdapter

        adapter = IncoisPfzAdapter()

        async def mock_get(*args, **kwargs):
            raise httpx.ConnectError("Connection refused")

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            result = await adapter.fetch(14.62, 74.16)

        assert result == []

    @pytest.mark.asyncio
    async def test_pfz_status_unavailable_initially(self):
        from app.integrations.marine import pfz as mod

        orig = mod._status.copy()
        mod._status.update({
            "last_successful_fetch": None,
            "last_fetch_attempt": None,
            "last_error": None,
        })
        try:
            adapter = mod.IncoisPfzAdapter()
            st = await adapter.get_status()
            assert st.status == FetchStatus.UNAVAILABLE
        finally:
            mod._status.update(orig)


# ══════════════════════════════════════════════════════════════════════════
# 8. AIS Adapter Tests (Audited Limitation)
# ══════════════════════════════════════════════════════════════════════════

class TestAisAdapter:

    @pytest.mark.asyncio
    async def test_ais_always_reports_unavailable(self):
        from app.integrations.marine.ais import ais_adapter

        status = await ais_adapter.get_status()
        assert status.status == FetchStatus.UNAVAILABLE
        assert status.source == "AIS"
        assert "restricted" in status.last_error.lower()

    @pytest.mark.asyncio
    async def test_ais_fetch_always_returns_empty_list(self):
        from app.integrations.marine.ais import ais_adapter

        obs = await ais_adapter.fetch(18.95, 72.85)
        assert obs == []


# ══════════════════════════════════════════════════════════════════════════
# 9. Marine Registry Tests
# ══════════════════════════════════════════════════════════════════════════

class TestMarineRegistry:

    def test_registry_has_expected_sources(self):
        from app.integrations.marine.registry import marine_registry

        sources = marine_registry.list_sources()
        assert "INCOIS_OSF" in sources
        assert "INCOIS_PFZ" in sources
        assert "AIS" in sources

    @pytest.mark.asyncio
    async def test_registry_get_all_statuses(self):
        from app.integrations.marine.registry import marine_registry

        statuses = await marine_registry.get_all_statuses()
        assert "INCOIS_OSF" in statuses
        assert "INCOIS_PFZ" in statuses
        assert "AIS" in statuses
        assert statuses["AIS"].status == FetchStatus.UNAVAILABLE

    @pytest.mark.asyncio
    async def test_registry_fetch_point_aggregates_sources(self):
        from app.integrations.marine.registry import MarineRegistry
        from app.integrations.marine.marine_types import MarineAdapterInterface, MarineObservation, DataSourceType

        # Create a mock adapter
        class MockAdapter(MarineAdapterInterface):
            source_name = "MOCK"
            product_name = "Mock Product"

            async def fetch(self, lat, lon, *, time_iso=None):
                return [
                    MarineObservation(
                        source="MOCK",
                        source_type=DataSourceType.SIMULATED,
                        product="Mock",
                        endpoint_url="http://mock",
                        valid_time="2026-09-10T12:00:00Z",
                        latitude=lat,
                        longitude=lon,
                        quality="TEST",
                        fetched_at="2026-09-10T12:00:00Z",
                    )
                ]

            async def get_status(self):
                return MarineSourceStatus(
                    source="MOCK",
                    product="Mock",
                    status=FetchStatus.CONNECTED,
                    cache_ttl_seconds=60,
                )

        reg = MarineRegistry()
        reg.register("MOCK", MockAdapter())
        obs = await reg.fetch_point(15.0, 73.0, sources=["MOCK"])
        assert len(obs) == 1
        assert obs[0].source == "MOCK"


