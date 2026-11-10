CREATE TABLE IF NOT EXISTS tl_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(code) BETWEEN 2 AND 80)
);
CREATE TABLE IF NOT EXISTS tl_memberships (
  facility_id uuid NOT NULL REFERENCES tl_facilities(id),
  clerk_user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('operator','reviewer','admin')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (facility_id, clerk_user_id),
  CHECK (char_length(clerk_user_id) BETWEEN 4 AND 255)
);
CREATE TABLE IF NOT EXISTS tl_data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES tl_facilities(id),
  source_code text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('temperature_csv','power_outage_csv','synthetic_api_replay','manual')),
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'configured' CHECK (status IN ('configured','disabled','error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (facility_id, source_code),
  UNIQUE (id, facility_id)
);
CREATE TABLE IF NOT EXISTS tl_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES tl_facilities(id),
  source_id uuid NOT NULL,
  original_filename text,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  imported_by text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  accepted_rows integer NOT NULL DEFAULT 0 CHECK (accepted_rows >= 0),
  rejected_rows integer NOT NULL DEFAULT 0 CHECK (rejected_rows >= 0),
  state text NOT NULL DEFAULT 'received' CHECK (state IN ('received','validated','rejected')),
  FOREIGN KEY (source_id, facility_id) REFERENCES tl_data_sources(id,facility_id),
  UNIQUE (source_id, sha256),
  UNIQUE (id,facility_id)
);
CREATE TABLE IF NOT EXISTS tl_temperature_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES tl_facilities(id),
  import_id uuid NOT NULL,
  source_row integer NOT NULL CHECK (source_row > 0),
  facility_record_code text NOT NULL,
  recorded_at timestamptz NOT NULL,
  raw_temp text NOT NULL,
  valid_temp_c numeric(6,2),
  quality_flag text NOT NULL DEFAULT 'valid' CHECK (quality_flag IN ('valid','missing','invalid','sensor_glitch')),
  ingested_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (import_id,facility_id) REFERENCES tl_imports(id,facility_id),
  UNIQUE (import_id,source_row),
  UNIQUE (id,facility_id)
);
CREATE INDEX IF NOT EXISTS tl_temperature_facility_time_idx ON tl_temperature_readings(facility_id,recorded_at DESC);
CREATE TABLE IF NOT EXISTS tl_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES tl_facilities(id),
  source_id uuid,
  origin text NOT NULL CHECK (origin IN ('automatic','staff')),
  category text NOT NULL CHECK (category IN ('temperature_excursion','monitoring_gap','sensor_anomaly','equipment_problem','other')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  source_event_key text,
  severity text NOT NULL DEFAULT 'needs_review' CHECK (severity IN ('information','needs_review','urgent')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','investigating','awaiting_review','returned','reviewed','followup','closed')),
  reported_by text,
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (source_id,facility_id) REFERENCES tl_data_sources(id,facility_id),
  UNIQUE (id,facility_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS tl_incident_event_dedupe_idx ON tl_incidents(facility_id, source_event_key) WHERE source_event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS tl_incident_queue_idx ON tl_incidents(facility_id,status,created_at DESC);
CREATE TABLE IF NOT EXISTS tl_incident_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES tl_facilities(id),
  incident_id uuid NOT NULL,
  reading_id uuid,
  import_id uuid,
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('raw_reading','gap_interval','outage_record','staff_observation','document_reference')),
  source_locator text,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (incident_id,facility_id) REFERENCES tl_incidents(id,facility_id),
  FOREIGN KEY (import_id,facility_id) REFERENCES tl_imports(id,facility_id),
  FOREIGN KEY (reading_id,facility_id) REFERENCES tl_temperature_readings(id,facility_id)
);
CREATE INDEX IF NOT EXISTS tl_evidence_incident_idx ON tl_incident_evidence(incident_id,created_at);
CREATE TABLE IF NOT EXISTS tl_incident_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  facility_id uuid NOT NULL REFERENCES tl_facilities(id),
  incident_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('created','assigned','note','investigation_submitted','review_accepted','review_returned','review_changed','followup_added','followup_updated','closed','reopened')),
  actor_clerk_user_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (incident_id,facility_id) REFERENCES tl_incidents(id,facility_id)
);
CREATE INDEX IF NOT EXISTS tl_events_incident_time_idx ON tl_incident_events(incident_id,occurred_at,id);
CREATE TABLE IF NOT EXISTS tl_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES tl_facilities(id),
  incident_id uuid NOT NULL,
  assigned_to text,
  description text NOT NULL,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (incident_id,facility_id) REFERENCES tl_incidents(id,facility_id)
);
CREATE INDEX IF NOT EXISTS tl_followups_facility_idx ON tl_followups(facility_id,status,due_at);
