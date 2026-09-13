-- v5: API vault, collaborative whiteboard, meeting action tracker
-- (additive only — no existing data touched)

CREATE TABLE IF NOT EXISTS api_vault_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('coe_leader','venture_owner')),
  provider TEXT NOT NULL DEFAULT 'kie',
  label TEXT NOT NULL DEFAULT 'kie.ai Gemini',
  api_key TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT 'https://api.kie.ai/gemini-3-8-flash-openai/v1',
  model TEXT NOT NULL DEFAULT 'gemini-3-8-flash',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_role_provider ON api_vault_keys(role, provider);

CREATE TABLE IF NOT EXISTS whiteboard_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_role TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#f59e0b',
  x REAL NOT NULL DEFAULT 40,
  y REAL NOT NULL DEFAULT 40,
  w REAL NOT NULL DEFAULT 220,
  h REAL NOT NULL DEFAULT 160,
  ai_enhanced INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meeting_action_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_title TEXT NOT NULL,
  meeting_date TEXT,
  title TEXT NOT NULL,
  description TEXT,
  owner TEXT NOT NULL DEFAULT 'coe_leader',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('backlog','todo','in_progress','blocked','done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  due_date TEXT,
  section_ref TEXT,
  sort_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON meeting_action_items(status);
CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON meeting_action_items(meeting_title, meeting_date);
