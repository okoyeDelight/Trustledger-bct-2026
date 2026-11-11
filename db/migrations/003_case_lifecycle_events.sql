CREATE TABLE IF NOT EXISTS tl_case_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 case_reference text NOT NULL CHECK (char_length(case_reference) BETWEEN 3 AND 80),
 event_kind text NOT NULL CHECK (event_kind IN (
   'investigation_submitted','review_accepted','review_returned','review_rejected',
   'followup_created','followup_completed','case_closed','case_reopened'
 )),
 actor_username text NOT NULL,
 actor_name text NOT NULL,
 actor_role text NOT NULL CHECK (actor_role IN ('facility_staff','blood_service_supervisor')),
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tl_case_events_case_idx ON tl_case_events(case_reference,id);
GRANT SELECT,INSERT ON TABLE tl_case_events TO trustledger_api;
GRANT USAGE ON SEQUENCE tl_case_events_id_seq TO trustledger_api;
