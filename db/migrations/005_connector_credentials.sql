-- 005: self-service connector credentials with hashed secrets and append-only revocation.
-- No plaintext connector API keys are stored in PostgreSQL.
CREATE TABLE IF NOT EXISTS tl_connector_keys (
  id uuid PRIMARY KEY,
  label text NOT NULL CHECK (char_length(label) BETWEEN 3 AND 100),
  source_system text NOT NULL CHECK (char_length(source_system) BETWEEN 2 AND 100),
  facility_code text NOT NULL CHECK (char_length(facility_code) BETWEEN 2 AND 80),
  key_prefix text NOT NULL,
  key_sha256 char(64) NOT NULL UNIQUE,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tl_connector_keys_scope_idx ON tl_connector_keys(source_system,facility_code);
CREATE TABLE IF NOT EXISTS tl_connector_key_revocations (
  key_id uuid PRIMARY KEY REFERENCES tl_connector_keys(id),
  revoked_by text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON TABLE tl_connector_keys, tl_connector_key_revocations TO trustledger_api;
