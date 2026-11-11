-- TrustLedger consolidated product: append-only reports, investigation notes and reviews.
-- Separate synthetic sandbox schema; NOT clinical authorization or device integration.
-- Prepared on a temporary Neon branch; apply to production only after user approval.
CREATE TABLE IF NOT EXISTS tl_staff_reports (
    report_id uuid PRIMARY KEY,
    report_ref text NOT NULL UNIQUE,
    facility_code text NOT NULL CHECK (char_length(facility_code) BETWEEN 2 AND 80),
    category text NOT NULL CHECK (category IN ('equipment_problem','monitoring_gap','temperature_excursion','sensor_anomaly','other')),
    title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 160),
    description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 3000),
    observed_at timestamptz NOT NULL,
    reported_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tl_staff_reports_time_idx ON tl_staff_reports(created_at DESC);
CREATE TABLE IF NOT EXISTS tl_investigation_notes (
    note_id uuid PRIMARY KEY,
    case_reference text NOT NULL CHECK (char_length(case_reference) BETWEEN 3 AND 80),
    actor_username text NOT NULL,
    actor_name text NOT NULL,
    actor_role text NOT NULL CHECK (actor_role IN ('facility_staff','blood_service_supervisor')),
    finding text NOT NULL CHECK (char_length(finding) BETWEEN 10 AND 2000),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tl_investigation_case_idx ON tl_investigation_notes(case_reference,created_at DESC);
CREATE TABLE IF NOT EXISTS tl_review_events (
    review_id uuid PRIMARY KEY,
    incident_id text NOT NULL CHECK (char_length(incident_id) BETWEEN 3 AND 80),
    actor_username text NOT NULL,
    actor_name text NOT NULL,
    role text NOT NULL CHECK (role = 'blood_service_supervisor'),
    decision text NOT NULL CHECK (decision IN ('accept','change','reject')),
    reason text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 1000),
    changed_assessment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    auth_method text NOT NULL DEFAULT 'preprovisioned_demo_account'
        CHECK (auth_method = 'preprovisioned_demo_account'),
    CHECK (decision <> 'change' OR (changed_assessment IS NOT NULL AND char_length(changed_assessment) > 0))
);
CREATE INDEX IF NOT EXISTS tl_review_events_case_idx ON tl_review_events(incident_id,created_at DESC);
GRANT SELECT,INSERT ON TABLE tl_staff_reports,tl_investigation_notes,tl_review_events TO trustledger_api;
