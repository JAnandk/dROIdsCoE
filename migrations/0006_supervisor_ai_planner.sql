-- v5: Supervisor AI planner, durable adapter settings, and CoE bulletins.
-- Additive only: no existing records are updated or re-seeded.

CREATE TABLE IF NOT EXISTS supervisor_llm_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL UNIQUE DEFAULT 'supervisor' CHECK (role = 'supervisor'),
  provider TEXT NOT NULL DEFAULT 'openai',
  base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  api_token TEXT,
  token_budget INTEGER NOT NULL DEFAULT 2000,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS planner_advisories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER REFERENCES space_rooms(id),
  placement_id INTEGER REFERENCES space_placements(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'safety',
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  advisory TEXT NOT NULL,
  source TEXT DEFAULT 'supervisor_llm',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pushed','acknowledged','actioned')),
  created_by TEXT NOT NULL DEFAULT 'supervisor',
  acknowledged_by TEXT,
  acknowledged_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_planner_advisories_status ON planner_advisories(status);
CREATE INDEX IF NOT EXISTS idx_planner_advisories_room ON planner_advisories(room_id);

CREATE TABLE IF NOT EXISTS placement_specs (
  placement_id INTEGER PRIMARY KEY REFERENCES space_placements(id),
  source_url TEXT,
  source_type TEXT,
  extracted_details TEXT DEFAULT '{}',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- SQLite cannot add a new value to an existing CHECK constraint. Rebuild only
-- the access-code table while preserving every existing row verbatim.
CREATE TABLE IF NOT EXISTS access_codes_v5 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('coe_leader', 'venture_owner', 'supervisor')),
  passcode TEXT NOT NULL UNIQUE,
  label TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO access_codes_v5 (id, role, passcode, label, is_active, created_at)
  SELECT id, role, passcode, label, is_active, created_at FROM access_codes;
DROP TABLE access_codes;
ALTER TABLE access_codes_v5 RENAME TO access_codes;
INSERT OR IGNORE INTO access_codes (role, passcode, label) VALUES
  ('supervisor', 'SupervisorSRM!26', 'Supervisor Space Planner');
