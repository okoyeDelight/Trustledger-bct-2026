-- Proposed migration 004: not applied to Neon main.
-- Append-only source integration keys, revocation evidence and incoming source events.
-- Admin/owner must approve and apply to a disposable Neon branch first.
CREATE TABLE IF NOT EXISTS tl_connector_keys (
  key_id uuid PRIMARY KEY,
  label text NOT NULL CHECK (char_length(label) BETWEEN 3 AND 80),
  key_hash text NOT NULL UNIQUE CHECK (char_length(key_hash)=64),
  key_hint text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tl_connector_key_revocations (
  key_id uuid PRIMARY KEY REFERENCES tl_connector_keys(key_id),
  revoked_by text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tl_source_feed_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_code text NOT NULL CHECK (char_length(source_code) BETWEEN 1 AND 80),
  source_event_id text NOT NULL CHECK (char_length(source_event_id) BETWEEN 1 AND 160),
  dataset text NOT NULL CHECK (dataset IN (
    'donations','facilities','power_outages','temperature_logs','transfers','units'
  )),
  facility_code text,
  observed_at text,
  payload jsonb NOT NULL,
  payload_sha256 text NOT NULL CHECK (char_length(payload_sha256)=64),
  incident_ref text UNIQUE,
  incident_category text,
  incident_severity text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_code,source_event_id)
);

CREATE INDEX IF NOT EXISTS tl_source_events_recent_idx ON tl_source_feed_events(id DESC);
CREATE INDEX IF NOT EXISTS tl_source_events_case_idx ON tl_source_feed_events(incident_ref)
  WHERE incident_ref IS NOT NULL;

-- Deliberately allow no UPDATE/DELETE on original feed events or key evidence.
GRANT SELECT,INSERT ON TABLE tl_connector_keys,tl_connector_key_revocations,
  tl_source_feed_events TO trustledger_api;
GRANT USAGE ON SEQUENCE tl_source_feed_events_id_seq TO trustledger_api;
