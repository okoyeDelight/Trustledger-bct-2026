-- 004: durable, append-only source observations for connector MVP.
-- Real observation storage. No production clinical claims. Apply only after approval.
CREATE TABLE IF NOT EXISTS tl_connector_observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_system text NOT NULL CHECK (char_length(source_system) BETWEEN 2 AND 100),
  source_event_id text NOT NULL CHECK (char_length(source_event_id) BETWEEN 3 AND 100),
  facility_id text NOT NULL CHECK (char_length(facility_id) BETWEEN 2 AND 80),
  observed_at timestamptz NOT NULL,
  temperature_c numeric(7,2) NOT NULL CHECK (temperature_c BETWEEN -50 AND 80),
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_event_id)
);
CREATE INDEX IF NOT EXISTS tl_connector_observations_source_time_idx
ON tl_connector_observations(source_system, facility_id, observed_at, id);
GRANT SELECT, INSERT ON TABLE tl_connector_observations TO trustledger_api;
GRANT USAGE ON SEQUENCE tl_connector_observations_id_seq TO trustledger_api;
