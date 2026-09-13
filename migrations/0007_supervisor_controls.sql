-- v6: security, source provenance, planner validation, and advisory lifecycle.
-- Additive migration; existing published data is preserved.

CREATE TABLE IF NOT EXISTS app_sessions (
  token TEXT PRIMARY KEY,
  access_code_id INTEGER REFERENCES access_codes(id),
  role TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_expiry ON app_sessions(expires_at);

CREATE TABLE IF NOT EXISTS security_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  metadata TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE supervisor_llm_configs ADD COLUMN token_ciphertext TEXT;
ALTER TABLE placement_specs ADD COLUMN extraction_status TEXT DEFAULT 'unprocessed';
ALTER TABLE placement_specs ADD COLUMN confidence REAL;
ALTER TABLE placement_specs ADD COLUMN verified_by TEXT;
ALTER TABLE placement_specs ADD COLUMN verified_at DATETIME;
ALTER TABLE planner_advisories ADD COLUMN assignee TEXT;
ALTER TABLE planner_advisories ADD COLUMN due_date TEXT;
ALTER TABLE planner_advisories ADD COLUMN comments TEXT DEFAULT '[]';
ALTER TABLE planner_advisories ADD COLUMN action_evidence TEXT;

CREATE TABLE IF NOT EXISTS planner_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER REFERENCES space_rooms(id),
  snapshot_json TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'supervisor',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
