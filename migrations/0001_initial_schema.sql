-- SRM dROIds CoE Mission Tracker - Initial Schema
-- Access Codes
CREATE TABLE IF NOT EXISTS access_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('coe_leader', 'venture_owner')),
  passcode TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- KRA Categories (6 Key Result Areas from the document)
CREATE TABLE IF NOT EXISTS kras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  weight INTEGER DEFAULT 100,
  sort_order INTEGER DEFAULT 0
);

-- KPIs mapped to KRAs
CREATE TABLE IF NOT EXISTS kpis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kra_id INTEGER NOT NULL REFERENCES kras(id),
  title TEXT NOT NULL,
  description TEXT,
  metric_unit TEXT,
  target_value REAL,
  current_value REAL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','on_track','at_risk','completed')),
  sort_order INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cohort Phases
CREATE TABLE IF NOT EXISTS cohorts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('A','B','C','D','E')),
  campus TEXT NOT NULL CHECK (campus IN ('ramapuram','trichy','both')),
  student_count INTEGER DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','active','completed','paused')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Students in cohorts
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id INTEGER REFERENCES cohorts(id),
  name TEXT NOT NULL,
  email TEXT,
  current_stage TEXT DEFAULT 'A',
  progress_pct INTEGER DEFAULT 0,
  certifications TEXT DEFAULT '[]',
  is_field_immersion INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','graduated','dropped','paused')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily Updates (CoE Leader to Venture Owner)
CREATE TABLE IF NOT EXISTS daily_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  cohort_attendance TEXT,
  facility_safety_issues TEXT,
  vendor_asset_blockers TEXT,
  prototype_test_status TEXT,
  decisions_needed TEXT,
  created_by TEXT DEFAULT 'coe_leader',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Weekly Reports
CREATE TABLE IF NOT EXISTS weekly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  progress_vs_plan TEXT,
  utilization_dashboard TEXT,
  budget_burn TEXT,
  faculty_partner_engagement TEXT,
  content_outreach TEXT,
  risks_mitigations TEXT,
  asks TEXT,
  created_by TEXT DEFAULT 'coe_leader',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','reviewed','approved')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Monthly Reports
CREATE TABLE IF NOT EXISTS monthly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_month TEXT NOT NULL,
  kpi_scorecard TEXT,
  cohort_funnel_trend TEXT,
  rd_ip_service_pipeline TEXT,
  capex_opex_status TEXT,
  next_month_plan TEXT,
  strategic_decisions TEXT,
  budget_approvals TEXT,
  created_by TEXT DEFAULT 'coe_leader',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','reviewed','approved')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Facilities & Layout
CREATE TABLE IF NOT EXISTS facilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  campus TEXT NOT NULL CHECK (campus IN ('ramapuram','trichy')),
  zone_type TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','in_progress','operational','blocked')),
  equipment TEXT DEFAULT '[]',
  x_position REAL DEFAULT 0,
  y_position REAL DEFAULT 0,
  width REAL DEFAULT 100,
  height REAL DEFAULT 100,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Procurement Items
CREATE TABLE IF NOT EXISTS procurement_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  campus_priority TEXT DEFAULT 'both',
  quantity_notes TEXT,
  spend_bucket INTEGER DEFAULT 1 CHECK (spend_bucket IN (1,2,3)),
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','ordered','delivered','installed','deferred')),
  estimated_cost REAL DEFAULT 0,
  actual_cost REAL DEFAULT 0,
  vendor TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Partners & Vendors
CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('vendor','training_partner','rpto','industry','academic','media','government')),
  description TEXT,
  contact_info TEXT,
  status TEXT DEFAULT 'identified' CHECK (status IN ('identified','engaged','active','inactive')),
  engagement_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Generated Reports (for download/sharing)
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily','weekly','monthly','custom','llm_synthesis')),
  content TEXT,
  generated_by TEXT DEFAULT 'coe_leader',
  share_token TEXT,
  is_shared INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Phase 1 Execution Roadmap (Month 0-6)
CREATE TABLE IF NOT EXISTS roadmap_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_range TEXT NOT NULL,
  phase_title TEXT NOT NULL,
  description TEXT,
  tasks TEXT DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','blocked')),
  sort_order INTEGER DEFAULT 0
);

-- Seed: Default access codes
INSERT OR IGNORE INTO access_codes (role, passcode, label) VALUES
  ('coe_leader', 'dROIds2026!', 'Default CoE Leader Passcode'),
  ('venture_owner', 'VentureSRM!26', 'Default Venture Owner Passcode');

-- Seed: 6 KRAs
INSERT OR IGNORE INTO kras (id, title, description, weight, sort_order) VALUES
  (1, 'Facility Readiness', 'Benches, safety, store, simulator and flight operations uptime', 20, 1),
  (2, 'Cohort Outcomes', 'Enrollment quality, attendance, completion, progression and certificate conversion', 20, 2),
  (3, 'R&D Throughput', 'Prototypes, test cycles, faculty engagement, project documentation, IP capture', 20, 3),
  (4, 'Compliance Discipline', 'Logs, asset control, safety incidents, vendor verification, field permissions', 15, 4),
  (5, 'Brand & Outreach', 'Showcases, content cadence, partnership activation, campus pull', 15, 5),
  (6, 'Commercial Readiness', 'Service pilots, external briefs, quote pipeline, funding opportunity tracking', 10, 6);

-- Seed: KPIs for each KRA
INSERT OR IGNORE INTO kpis (id, kra_id, title, metric_unit, target_value, sort_order) VALUES
  (1, 1, 'Bench Utilization Rate', '%', 80, 1),
  (2, 1, 'Simulator Utilization Rate', '%', 75, 2),
  (3, 1, 'Safety Equipment Audit Score', '/100', 95, 3),
  (4, 1, 'Store Inventory Accuracy', '%', 98, 4),
  (5, 2, 'Cohort Fill Rate', '%', 90, 1),
  (6, 2, 'Attendance Rate', '%', 85, 2),
  (7, 2, 'Foundation-to-Build Progression', '%', 70, 3),
  (8, 2, 'Build-to-Field Progression Rate', '%', 50, 4),
  (9, 3, 'Prototype Count', 'units', 12, 1),
  (10, 3, 'Successful Test Count', 'tests', 30, 2),
  (11, 3, 'Redesign Loop Closure Time', 'days', 7, 3),
  (12, 3, 'Faculty Mentor Participation', 'faculty', 8, 4),
  (13, 4, 'Safety Incidents (Lower=Better)', 'incidents', 0, 1),
  (14, 4, 'Asset Loss Rate', '%', 1, 2),
  (15, 4, 'Vendor Verification Score', '%', 100, 3),
  (16, 5, 'Social Content Consistency', 'posts/week', 3, 1),
  (17, 5, 'Demo Event Count', 'events', 4, 2),
  (18, 5, 'Partner Meetings Held', 'meetings', 6, 3),
  (19, 6, 'Applied-Project Leads', 'leads', 4, 1),
  (20, 6, 'Active Proposals', 'proposals', 3, 2),
  (21, 6, 'External Briefs Delivered', 'briefs', 2, 3);

-- Seed: Phase 1 Roadmap
INSERT OR IGNORE INTO roadmap_milestones (month_range, phase_title, description, tasks, sort_order) VALUES
  ('Month 0-1', 'Mission Lock + Layout Finalization', 'Finalize governance, room allocation, layout drawings, vendor shortlist, cohort calendar and SRM dROIds brand narrative.',
   '["Finalize governance structure","Approve room allocation","Complete layout drawings","Shortlist vendors","Publish cohort calendar","Lock brand narrative"]', 1),
  ('Month 1-2', 'Core Procurement + Site Prep', 'Benches, safety, tools, store, simulation, basic fabrication, indoor test setup, field planning kit, secure data stack.',
   '["Order workshop benches","Install safety equipment","Setup tool stations","Configure simulation pods","Build indoor test cage","Deploy secure data stack","Setup field planning kit"]', 2),
  ('Month 2-3', 'Soft Launch + Internal Showcase', 'Pilot cohort onboarding, faculty walkthroughs, internal demos, content launch, baseline utilization dashboard.',
   '["Onboard pilot cohort","Conduct faculty walkthroughs","Run internal demos","Launch content engine","Activate utilization dashboard"]', 3),
  ('Month 3-4', 'Cohort Execution + Trichy Immersion', 'First structured foundation/build cohorts, first field immersion batch, first outdoor workflow reports.',
   '["Launch Foundation cohort","Start Build cohort","Begin Trichy immersion program","Execute outdoor workflow","Generate field reports"]', 4),
  ('Month 4-6', 'R&D / Service Readiness', 'Faculty project alignment, applied challenge briefs, partner demos, RPTO strategy checkpoint, client-use-case scouting.',
   '["Align faculty projects","Draft applied challenge briefs","Run partner demonstrations","Complete RPTO strategy checkpoint","Scout client use cases"]', 5);

-- Seed: Facilities (Ramapuram)
INSERT OR IGNORE INTO facilities (name, campus, zone_type, description, status, x_position, y_position, width, height) VALUES
  ('Entry / Showcase Zone', 'ramapuram', 'showcase', 'Demo drones, awards, screens, current projects, QR lead capture', 'planned', 0, 0, 120, 80),
  ('Learning Bay', 'ramapuram', 'learning', 'Briefings, whiteboards, cohort induction, regulations, digital modules', 'planned', 130, 0, 100, 80),
  ('Workshop Benches', 'ramapuram', 'workshop', '12-20 individual ESD-safe seats with tool discipline and shared components', 'planned', 0, 90, 230, 100),
  ('Simulation + Test Zone', 'ramapuram', 'simulation', 'Simulator pods, indoor cage, calibration, debugging and logging', 'planned', 240, 0, 120, 100),
  ('3D Printing Corner', 'ramapuram', 'fabrication', '3D printers, material cabinet, post-process table', 'planned', 240, 110, 80, 80),
  ('Store + Secure IP Core', 'ramapuram', 'storage', 'Parts room, battery safety, server/NAS, controlled documentation flow', 'planned', 320, 0, 80, 190),
  ('Review Huddle Zone', 'ramapuram', 'review', 'Standups and demo day prep area', 'planned', 0, 200, 230, 60);

-- Seed: Facilities (Trichy)
INSERT OR IGNORE INTO facilities (name, campus, zone_type, description, status, x_position, y_position, width, height) VALUES
  ('Mission Planning Room', 'trichy', 'planning', 'Pre-flight briefing room with mission planning stations', 'planned', 0, 0, 100, 80),
  ('Field Equipment Room', 'trichy', 'equipment', 'Transport cases, spares, field-ready kits', 'planned', 110, 0, 80, 80),
  ('Workshop Benches', 'trichy', 'workshop', 'Pre/post-flight maintenance benches', 'planned', 0, 90, 190, 80),
  ('Outdoor Launch Zones', 'trichy', 'flight_ops', 'Launch/recovery zones with clear safety perimeters', 'planned', 200, 0, 200, 170),
  ('Battery Charging Bay', 'trichy', 'safety', 'Charging/quarantine area separated from classrooms', 'planned', 0, 180, 100, 70),
  ('Data Processing Station', 'trichy', 'data', 'Download and processing stations for field data', 'planned', 110, 180, 90, 70),
  ('Visitor Demo Corridor', 'trichy', 'showcase', 'Partner walkthrough corridor', 'planned', 200, 180, 200, 70);

-- Seed: Procurement Items
INSERT OR IGNORE INTO procurement_items (category, item_name, campus_priority, quantity_notes, spend_bucket, status, estimated_cost) VALUES
  ('Workshop Benches', 'ESD-safe Student Tables', 'both', '1 seat per active student + 20% buffer', 1, 'planned', 250000),
  ('Electronics Tools', 'Soldering Stations + Hot-air Rework', 'both', '1 shared tool set per 4-5 students', 1, 'planned', 120000),
  ('Electronics Tools', 'Multimeters, Bench PSU, Oscilloscopes', 'both', 'Shared bench cluster', 1, 'planned', 180000),
  ('Fabrication', 'Industrial/Prosumer 3D Printers', 'ramapuram', '2-3 printers initially', 1, 'planned', 200000),
  ('Simulation', 'RPTO-aware Simulator Stations', 'both', '2-4 pods start; expandable', 1, 'planned', 350000),
  ('Indoor Test', 'Flight Cage / Enclosed Safe Test Zone', 'ramapuram', '1 good cage beats multiple poor ones', 1, 'planned', 80000),
  ('Training Drones', 'Micro Trainers + Assembly Kits', 'both', 'Designed for attrition and repeated learning', 1, 'planned', 150000),
  ('Flight Assets', 'DGCA-listed Training/Mission Drones', 'trichy', 'Buy minimal viable set, not vanity fleet', 2, 'planned', 500000),
  ('Field Operations', 'Cases, Windsock, First-Aid, Telemetry', 'trichy', '1 field kit per deployed mission team', 1, 'planned', 120000),
  ('Data and GIS', 'Processing Workstations + Software Stack', 'trichy', 'Shared high-performance cluster', 2, 'planned', 300000),
  ('Store and Safety', 'Inventory Shelves, Battery Charging/Quarantine', 'both', 'Non-negotiable', 1, 'planned', 100000);

-- Seed: Partners/Vendors
INSERT OR IGNORE INTO partners (name, type, description, status) VALUES
  ('Dronobotics / DronoSim', 'vendor', 'Indigenous simulator positioned for RPTO infrastructure readiness', 'identified'),
  ('Autoabode', 'vendor', 'Turnkey drone lab provider - hardware kits, simulator stations, 3D printing, indoor cage', 'identified'),
  ('SkyySkill Labs', 'vendor', 'AI-ready drone lab / CoE setup provider with NEP/NSQF alignment', 'identified'),
  ('Aerdroids', 'rpto', 'Claims DGCA-authorized RPTO status and small-batch training orientation', 'identified'),
  ('GATI', 'rpto', 'Claims DGCA-approved RPTO status, 5-day training structure', 'identified'),
  ('DroneAcharya', 'training_partner', 'Training, manufacturing, services and Train-the-Trainer positioning', 'identified'),
  ('DigitalSky DGCA', 'government', 'Official airspace / support touchpoint for drone operations', 'active');
