-- Workflow Submission Tables for Review/Edit/Approve Cycle

CREATE TABLE IF NOT EXISTS kpi_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kpi_id INTEGER NOT NULL REFERENCES kpis(id),
  kra_id INTEGER NOT NULL REFERENCES kras(id),
  current_value REAL NOT NULL,
  previous_value REAL,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','reviewed','approved','rejected','edited')),
  notes TEXT,
  reviewer_notes TEXT,
  submitted_by TEXT DEFAULT 'coe_leader',
  reviewed_by TEXT,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily','weekly','monthly')),
  report_id INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','reviewed','approved','rejected','edited')),
  notes TEXT,
  reviewer_notes TEXT,
  submitted_by TEXT DEFAULT 'coe_leader',
  reviewed_by TEXT,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpi_submissions_status ON kpi_submissions(status);
CREATE INDEX IF NOT EXISTS idx_report_submissions_status ON report_submissions(status);
CREATE INDEX IF NOT EXISTS idx_kpi_submissions_kpi_id ON kpi_submissions(kpi_id);
