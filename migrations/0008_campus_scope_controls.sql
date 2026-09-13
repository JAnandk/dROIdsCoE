-- v7: Campus-scoped operational records.
-- Additive only: existing published rows remain available as shared/both-campus data.

ALTER TABLE kras ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));
ALTER TABLE kpis ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));
ALTER TABLE cohorts ADD COLUMN campus_locked INTEGER NOT NULL DEFAULT 1;
ALTER TABLE facilities ADD COLUMN campus_locked INTEGER NOT NULL DEFAULT 1;
ALTER TABLE students ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));
ALTER TABLE daily_updates ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));
ALTER TABLE weekly_reports ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));
ALTER TABLE monthly_reports ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));
ALTER TABLE procurement_items ADD COLUMN campus_locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE partners ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));
ALTER TABLE reports ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));
ALTER TABLE roadmap_milestones ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));

ALTER TABLE setup_stages ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));
ALTER TABLE setup_sections ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));
ALTER TABLE setup_sections ADD COLUMN campus_locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE setup_guidelines ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));
ALTER TABLE setup_line_items ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));
ALTER TABLE setup_line_items ADD COLUMN campus_locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE setup_submissions ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));
ALTER TABLE setup_decisions ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));

ALTER TABLE space_rooms ADD COLUMN campus_locked INTEGER NOT NULL DEFAULT 1;
ALTER TABLE planner_advisories ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));
ALTER TABLE planner_snapshots ADD COLUMN campus_scope TEXT NOT NULL DEFAULT 'both' CHECK (campus_scope IN ('ramapuram','trichy','both'));

CREATE INDEX IF NOT EXISTS idx_setup_items_campus_scope ON setup_line_items(campus_scope);
CREATE INDEX IF NOT EXISTS idx_reports_campus_scope ON reports(campus_scope);
CREATE INDEX IF NOT EXISTS idx_daily_updates_campus_scope ON daily_updates(campus_scope);
