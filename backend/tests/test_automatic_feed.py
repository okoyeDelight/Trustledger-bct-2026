"""Regression checks for source-feed identity, duplicate safety and replay."""
import csv
import sqlite3
from pathlib import Path

import pytest
from fastapi import HTTPException
from app import automatic_feed as feed


@pytest.fixture()
def store(tmp_path, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.delenv("TRUSTLEDGER_REQUIRE_DATABASE", raising=False)
    path = tmp_path / "feed.sqlite3"

    def connect():
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        return conn

    return connect


def test_key_created_once_can_authenticate_and_be_revoked(store):
    token = feed.generate_key("Synthetic bank connector", "reviewer", store)
    assert token["key"].startswith("tlb_")
    assert "key" not in feed.list_keys(store)[0]
    connector = feed.authenticate_key("Bearer " + token["key"], store)
    assert str(connector["key_id"]) == token["key_id"]
    with pytest.raises(HTTPException) as error:
        feed.authenticate_key("Bearer tlb_invalid", store)
    assert error.value.status_code == 401
    feed.revoke_key(token["key_id"], "reviewer", store)
    assert feed.list_keys(store)[0]["revoked"]
    with pytest.raises(HTTPException) as error:
        feed.authenticate_key("Bearer " + token["key"], store)
    assert error.value.status_code == 401


def test_exact_retry_dedupes_but_modified_same_id_fails(store):
    first = {"facility_id": "HSP-024", "recorded_at": "2026-10-01T12:00:00Z", "temp_c": "7.9"}
    recorded = feed.ingest("partner-a", "logger:42", "temperature_logs", first, store)
    assert recorded["recorded"] and recorded["incident_ref"].startswith("SRC-")
    again = feed.ingest("partner-a", "logger:42", "temperature_logs", first, store)
    assert again["duplicate"] and not again["recorded"]
    with pytest.raises(HTTPException) as error:
        feed.ingest("partner-a", "logger:42", "temperature_logs",
                    {**first, "temp_c": "9.8"}, store)
    assert error.value.status_code == 409
    assert len(feed.feed_events(store)) == 1
    incoming = feed.source_incidents(store)
    assert len(incoming) == 1
    assert incoming[0]["incident_id"] == recorded["incident_ref"]


def test_sentinels_are_not_valid_temperatures(store):
    for i, value in enumerate(["-99.0", "99.9", "0.0"]):
        feed.ingest("bank", str(i), "temperature_logs", {
            "facility_id": "HSP-002", "recorded_at": "2026-10-02T00:00:00Z",
            "temp_c": value,
        }, store)
    cases = feed.source_incidents(store)
    assert len(cases) == 3
    assert all(case["direction"] == "sensor_anomaly" for case in cases)


def test_every_dataset_can_enter_feed_but_normal_rows_do_not_create_cases(store):
    for dataset in feed.DATASET_FILES:
        feed.ingest("bank", dataset, dataset,
                    {"facility_id": "HSP-001", "sample": "synthetic", "temp_c": "4.2", "backup_power_engaged": "true", "coolbox_max_temp_c": "4.2"}, store)
    assert len(feed.feed_events(store)) == len(feed.DATASET_FILES)
    assert feed.source_incidents(store) == []


def test_replay_moves_one_original_row_per_tick_without_manual_send(tmp_path, store):
    for dataset, filename in feed.DATASET_FILES.items():
        with (tmp_path / filename).open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=["facility_id", "recorded_at", "temp_c"])
            writer.writeheader()
            writer.writerow({"facility_id": "HSP-024", "recorded_at": "2026-10-02T00:00:00Z",
                             "temp_c": "7.9" if dataset == "temperature_logs" else "4.2"})
    queue = feed.demo_sequence(tmp_path)
    assert set(item["dataset"] for item in queue) == set(feed.DATASET_FILES)
    for _ in queue:
        result = feed.demo_next(tmp_path, store)
        assert not result["completed"]
    assert feed.demo_next(tmp_path, store)["completed"]
    assert len(feed.feed_events(store)) == len(queue)
    assert len(feed.source_incidents(store)) == 1


def test_unavailable_data_does_not_get_invented(tmp_path, store):
    assert feed.demo_sequence(tmp_path) == []
    with pytest.raises(HTTPException) as error:
        feed.demo_next(tmp_path, store)
    assert error.value.status_code == 503
