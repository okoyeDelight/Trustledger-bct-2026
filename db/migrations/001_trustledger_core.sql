-- TrustLedger 2026 · Step 2 foundation
-- PostgreSQL 16+ / Neon. Synthetic hackathon data only.
-- Apply to a NEW TrustLedger database, never the StandPilot database.
-- Human roles are provisioned server-side; no self-service admin bootstrap.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  clerk_org_id text NOT NULL UNIQUE CHECK (clerk_org_id ~ '^org_[A-Za-z0-9]+$'),
  time_zone text NOT NULL DEFAULT 'Africa/Nairobi',
  synthetic_only boolean NOT NULL DEFAULT true CHECK (synthetic_only = true),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facility_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  clerk_user_id text NOT NULL CHECK (clerk_user_id ~ '^user_[A-Za-z0-9]+$'),
  role text NOT NULL CHECK (role IN ('operator','reviewer','admin')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (facility_id, clerk_user_id)
);
CREATE INDEX IF NOT EXISTS facility_memberships_by_user ON facility_memberships(clerk_user_id, active);

CREATE TABLE IF NOT EXISTS data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 2 AND 160),
  kind text NOT NULL CHECK (kind IN ('temperature_csv','power_outage_csv','synthetic_api_replay')),
  external_reference text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,facility_id)
);
CREATE INDEX IF NOT EXISTS data_sources_by_facility ON data_sources(facility_id);

CREATE TABLE IF NOT EXISTS source_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL,
  original_filename text NOT NULL,
  original_sha256 text NOT NULL CHECK (original_sha256 ~ '^[0-9a-f]{64}$'),
  imported_by_clerk_user_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  rows_received integer NOT NULL DEFAULT 0 CHECK (rows_received >= 0),
  rows_accepted integer NOT NULL DEFAULT 0 CHECK (rows_accepted >= 0),
  rows_flagged integer NOT NULL DEFAULT 0 CHECK (rows_flagged >= 0),
  rows_rejected integer NOT NULL DEFAULT 0 CHECK (rows_rejected >= 0),
  import_status text NOT NULL DEFAULT 'received'
    CHECK (import_status IN ('received','validating','completed','failed')),
  error_summary text,
  FOREIGN KEY (source_id,facility_id) REFERENCES data_sources(id,facility_id),
  UNIQUE (source_id,original_sha256),
  UNIQUE (id,facility_id)
);
CREATE INDEX IF NOT EXISTS source_imports_latest ON source_imports(facility_id,received_at DESC);

CREATE TABLE IF NOT EXISTS source_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  import_id uuid NOT NULL,
  source_id uuid NOT NULL,
  source_row_number integer NOT NULL CHECK (source_row_number > 0),
  source_record_key text,
  recorded_at timestamptz,
  facility_external_id text,
  raw_fields jsonb NOT NULL CHECK (jsonb_typeof(raw_fields) = 'object'),
  normalized_temp_c numeric(7,2),
  quality_flag text NOT NULL DEFAULT 'unvalidated'
    CHECK (quality_flag IN ('unvalidated','valid','missing_required','sensor_sentinel','invalid_timestamp','other_anomaly')),
  recorded_in_source_timezone text NOT NULL DEFAULT 'Africa/Nairobi',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (import_id,facility_id) REFERENCES source_imports(id,facility_id),
  FOREIGN KEY (source_id,facility_id) REFERENCES data_sources(id,facility_id),
  UNIQUE (import_id,source_row_number),
  UNIQUE (id,facility_id)
);
CREATE INDEX IF NOT EXISTS source_readings_timeline ON source_readings(facility_id,recorded_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  source_id uuid,
  origin text NOT NULL CHECK (origin IN ('automated','staff')),
  kind text NOT NULL CHECK (kind IN ('monitoring_gap','temperature_excursion','sensor_anomaly','staff_report','other')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 180),
  summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','investigating','awaiting_review','returned','action_required','closed')),
  created_by_clerk_user_id text,
  assigned_to_clerk_user_id text,
  dedupe_key text,
  occurred_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  FOREIGN KEY (source_id,facility_id) REFERENCES data_sources(id,facility_id),
  UNIQUE (id,facility_id),
  UNIQUE (facility_id,dedupe_key),
  CHECK ((origin = 'staff' AND created_by_clerk_user_id IS NOT NULL)
     OR (origin = 'automated' AND source_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS incidents_queue ON incidents(facility_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS incident_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  incident_id uuid NOT NULL,
  reading_id uuid,
  import_id uuid,
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('source_reading','source_outage','staff_note','file_reference','missing_interval')),
  provenance_label text NOT NULL,
  original_reference text,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence_snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (incident_id,facility_id) REFERENCES incidents(id,facility_id),
  FOREIGN KEY (reading_id,facility_id) REFERENCES source_readings(id,facility_id),
  FOREIGN KEY (import_id,facility_id) REFERENCES source_imports(id,facility_id)
);
CREATE INDEX IF NOT EXISTS incident_evidence_by_incident ON incident_evidence(incident_id,created_at);

CREATE TABLE IF NOT EXISTS incident_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  incident_id uuid NOT NULL,
  actor_clerk_user_id text,
  actor_role text CHECK (actor_role IN ('operator','reviewer','admin','system')),
  event_type text NOT NULL CHECK (event_type IN ('created','assigned','note_added','investigation_submitted','review_accepted','review_returned','review_changed','followup_added','followup_updated','closed','reopened')),
  old_status text,
  new_status text,
  note text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (incident_id,facility_id) REFERENCES incidents(id,facility_id)
);
CREATE INDEX IF NOT EXISTS incident_events_timeline ON incident_events(incident_id,occurred_at,id);

CREATE OR REPLACE FUNCTION deny_incident_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Incident events are append-only';
END;
$$;
DROP TRIGGER IF EXISTS incident_events_append_only ON incident_events;
CREATE TRIGGER incident_events_append_only
  BEFORE UPDATE OR DELETE ON incident_events
  FOR EACH ROW EXECUTE FUNCTION deny_incident_event_mutation();

CREATE TABLE IF NOT EXISTS incident_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  incident_id uuid NOT NULL,
  task text NOT NULL CHECK (length(trim(task)) BETWEEN 3 AND 400),
  assignee_clerk_user_id text,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (incident_id,facility_id) REFERENCES incidents(id,facility_id)
);
CREATE INDEX IF NOT EXISTS followups_by_incident ON incident_followups(incident_id,status);

COMMENT ON TABLE source_readings IS 'Original organizer-synthetic source rows and separately validated values; never replace raw_fields.';
COMMENT ON TABLE incident_events IS 'Server-written append-only case timeline; owner-level DB actions and backups require separate operational controls.';
