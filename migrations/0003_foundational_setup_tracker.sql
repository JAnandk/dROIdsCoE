-- ============================================================
-- v3: Foundational Setup Operations Tracker
-- Stage-by-stage (Planning → Design → Procurement → Deployment → Readiness)
-- Excel-like line items under section headers, best-practice tooltips,
-- decision log, and CoE Director → Venture Leader governance workflow.
-- ============================================================

-- Setup stages (the stage-by-stage process)
CREATE TABLE IF NOT EXISTS setup_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','blocked','completed')),
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Section headers within each stage (e.g., Procurement Planning, Layout Design, 3D Printing)
CREATE TABLE IF NOT EXISTS setup_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id INTEGER NOT NULL REFERENCES setup_stages(id),
  title TEXT NOT NULL,
  description TEXT,
  guideline_summary TEXT,           -- short best-practice blurb shown as tooltip banner
  owner_role TEXT DEFAULT 'coe_leader',
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','submitted','under_review','approved','changes_requested','completed')),
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Multiple best-practice tips per section (rendered as tooltips / guidance list)
CREATE TABLE IF NOT EXISTS setup_guidelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES setup_sections(id),
  tip TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- Excel-like line items under each section header
CREATE TABLE IF NOT EXISTS setup_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES setup_sections(id),
  item_name TEXT NOT NULL,
  description TEXT,
  stakeholder TEXT,                 -- responsible stakeholder / owner
  quantity_notes TEXT,              -- qty / spec / sizing notes
  vendor TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  estimated_cost REAL DEFAULT 0,
  actual_cost REAL DEFAULT 0,
  progress_pct INTEGER DEFAULT 0,   -- 0..100
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','blocked','at_risk','done','deferred')),
  action_item TEXT,                 -- clear next action for this line
  due_date TEXT,
  notes TEXT,                       -- free-form notes about the line item
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft','submitted','approved','changes_requested')),
  reviewer_notes TEXT,              -- venture leader guidance / edit instructions
  submitted_by TEXT,
  reviewed_by TEXT,
  reviewed_at DATETIME,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Batch submissions of a section's line items for Venture Leader review (governance workflow)
CREATE TABLE IF NOT EXISTS setup_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES setup_sections(id),
  line_item_ids TEXT NOT NULL,      -- JSON array of line item ids in this submission
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','changes_requested')),
  notes TEXT,                       -- director's cover note
  reviewer_notes TEXT,              -- venture leader feedback / edit instructions
  submitted_by TEXT DEFAULT 'coe_leader',
  reviewed_by TEXT,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Decision / action log — joint decisions & next-step guidance from the Venture Leader
CREATE TABLE IF NOT EXISTS setup_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER REFERENCES setup_sections(id),
  line_item_id INTEGER REFERENCES setup_line_items(id),
  decision TEXT NOT NULL,
  next_steps TEXT,                  -- conditional edit instructions / action items
  decided_by TEXT NOT NULL DEFAULT 'venture_leader',
  decision_date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_setup_sections_stage ON setup_sections(stage_id);
CREATE INDEX IF NOT EXISTS idx_setup_line_items_section ON setup_line_items(section_id);
CREATE INDEX IF NOT EXISTS idx_setup_line_items_review ON setup_line_items(review_status);
CREATE INDEX IF NOT EXISTS idx_setup_submissions_status ON setup_submissions(status);
CREATE INDEX IF NOT EXISTS idx_setup_guidelines_section ON setup_guidelines(section_id);

-- ============================================================
-- SEED: 5 stages of the foundational setup process
-- ============================================================
INSERT INTO setup_stages (name, description, objective, status, sort_order) VALUES
  ('Planning', 'Scope, budget, stakeholder alignment and procurement strategy for the CoE foundational setup.', 'Agree on what must be procured, where it goes, who signs off, and the total budget envelope.', 'in_progress', 1),
  ('Design', 'Facility layout, zone identification, workflow mapping and equipment specification.', 'Produce a validated layout design for both campuses with equipment specs per zone.', 'pending', 2),
  ('Procurement', 'Vendor selection, quotations, purchase orders and delivery tracking (3D printing, drone kits, sim rigs, safety gear).', 'Secure every line item: quoted, ordered, delivered — with budget discipline across spend buckets.', 'pending', 3),
  ('Deployment', 'Installation, fit-out, commissioning and calibration of all equipment and spaces.', 'Every procured asset installed, tested and operational at its designated zone.', 'pending', 4),
  ('Readiness & Validation', 'Safety audits, SOPs, staff training and cohort-readiness sign-off.', 'CoE certified operationally ready to engage its first cohort.', 'pending', 5);

-- ============================================================
-- SEED: Section headers per stage, with guideline summaries
-- ============================================================
INSERT INTO setup_sections (stage_id, title, description, guideline_summary, sort_order) VALUES
  -- Stage 1: Planning
  (1, 'Procurement Planning', 'Master list of everything to buy — equipment, consumables, services — with budget buckets and priorities.', 'Start from cohort needs, not catalogue items. Every line must trace to a training outcome.', 1),
  (1, 'Layout & Space Identification', 'Identify and earmark physical spaces on both campuses for labs, fabrication, storage and flight ops.', 'Walk the site before you draw it. Measure twice, mark power, ventilation and network points.', 2),
  (1, 'Budget & Funding Alignment', 'Budget envelope per category, funding approvals, and contingency reserve.', 'Hold a 10–15% contingency. Separate CAPEX (assets) from OPEX (consumables, AMC) lines.', 3),
  (1, 'Stakeholder & Governance Map', 'Who approves what — purchase committee, finance, safety, and the Venture Leader sign-off chain.', 'Name a single accountable owner per line item. Ambiguous ownership is the #1 setup delay.', 4),
  -- Stage 2: Design
  (2, 'Layout Design & Zoning', 'Detailed floor plans: zone boundaries, bench layouts, workflow lanes, and safety clearances.', 'Design for dirty-to-clean flow: fabrication dust must never reach the simulation/classroom zone.', 1),
  (2, 'Equipment Specification', 'Technical specs per line item — printer build volume, drone payload class, sim GPU tier, bench power load.', 'Spec to the curriculum''s hardest use case, not the average one. Underspec now = rebuy later.', 2),
  (2, 'Utilities & Infrastructure Design', 'Power circuits, compressed air, extraction/ventilation, networking and server/rack placement.', '3D printers and laser tools need dedicated circuits. Never daisy-chain high-draw equipment.', 3),
  -- Stage 3: Procurement
  (3, '3D Printing & Fabrication', 'FDM/resin printers, filaments & resins, post-processing stations, and small fabrication tools.', 'Buy one reliable workhorse printer before exotic ones. Stock 3+ filament types; budget nozzles & beds as consumables.', 1),
  (3, 'Drone Hardware & Kits', 'Training drones, build kits, spares (frames, motors, props, batteries) and charging infrastructure.', 'Props and batteries are consumables — order 3× the fleet count. Batteries need fire-safe storage.', 2),
  (3, 'Simulation & Compute', 'Simulators, workstations, GPUs, licenses (sim software, CAD, slicing tools).', 'Prefer floating/network licenses over per-seat for CAD and sim tools — cheaper at cohort scale.', 3),
  (3, 'Safety & Facility Equipment', 'PPE, fire safety, first aid, safety netting, signage and emergency cutoffs.', 'Safety gear is Must-Have-Now (Bucket 1). No cohort starts before this section is 100% done.', 4),
  -- Stage 4: Deployment
  (4, 'Installation & Fit-Out', 'Physical installation of benches, machines, racks, signage and zone marking.', 'Install heavy equipment before furniture. Photograph every installation for the asset register.', 1),
  (4, 'Commissioning & Calibration', 'Power-on tests, printer calibration, sim validation, network throughput checks.', 'Run a first-article test per machine (e.g., a calibration print) before marking a line done.', 2),
  -- Stage 5: Readiness
  (5, 'Safety Audit & SOPs', 'Safety walk-through, SOP documents per zone, emergency drills and sign-offs.', 'Every machine needs a one-page SOP at the point of use — laminated, visible, versioned.', 1),
  (5, 'Cohort Readiness Sign-Off', 'Final checklist: equipment live, trainers trained, timetable mapped, and Venture Leader approval to launch.', 'Do a dry-run day with staff playing students. Fix what breaks before the real cohort arrives.', 2);

-- ============================================================
-- SEED: Best-practice guideline tips (tooltips) per section
-- ============================================================
INSERT INTO setup_guidelines (section_id, tip, sort_order) VALUES
  -- Procurement Planning
  (1, 'Classify every line into the three spend buckets: (1) Must-Have Now, (2) Buy Once Growth Proven, (3) Rent/Partner First.', 1),
  (1, 'Add quantity AND spec notes — "3D printer" is not procurable; "FDM printer, ≥300mm³ bed, dual extrusion" is.', 2),
  (1, 'Record estimated cost early; refine with quotations later. A wrong estimate beats no estimate.', 3),
  (1, 'Submit the section to the Venture Leader once the draft list is complete — expect edit instructions.', 4),
  -- Layout & Space Identification
  (2, 'Verify power load, floor loading and ceiling height before earmarking a space for heavy fabrication.', 1),
  (2, 'Separate noisy/dusty zones (fabrication) from clean zones (simulation, classroom) by at least a corridor.', 2),
  (2, 'Identify secure, ventilated storage for LiPo batteries and resin — both are fire risks.', 3),
  -- Budget & Funding
  (3, 'Split budget lines into CAPEX (assets) and OPEX (consumables, licenses, AMC) — they follow different approval paths.', 1),
  (3, 'Keep a 10–15% contingency line explicitly visible; hidden buffers get reallocated silently.', 2),
  -- Stakeholder & Governance
  (4, 'Map every line item to: requester → verifier → approver. Three roles, named people.', 1),
  (4, 'Define the escalation path for blocked items before you need it (e.g., >7 days blocked → Venture Leader).', 2),
  -- Layout Design & Zoning
  (5, 'Keep a 1.2m minimum clear lane between workbenches for safe movement with equipment.', 1),
  (5, 'Place the 3D print farm near extraction/ventilation; resin printers need dedicated vented enclosures.', 2),
  (5, 'Mark drone indoor test cells with netting anchor points in the layout, not as an afterthought.', 3),
  -- Equipment Specification
  (6, 'For 3D printers: specify build volume, nozzle temp range (≥300°C for engineering filaments), and enclosure needs.', 1),
  (6, 'For drone kits: match payload class and flight controller to the curriculum modules (Stage B/C needs).', 2),
  (6, 'For sim rigs: GPU tier determines sim fidelity — specify GPU model, not just "high-end PC".', 3),
  -- Utilities & Infrastructure
  (7, 'High-draw machines (printers, laser, compressor) each get a dedicated MCB circuit — never shared strips.', 1),
  (7, 'Plan network drops per zone plus Wi-Fi coverage for tablet-based SOPs and attendance.', 2),
  -- 3D Printing & Fabrication
  (8, 'Start with proven FDM workhorses; add resin (SLA) only when the curriculum demands fine detail.', 1),
  (8, 'Filament stock: PLA for training, PETG for functional parts, ABS/ASA only with ventilation. Keep dry boxes.', 2),
  (8, 'Consumables budget: nozzles, build plates, adhesives, IPA for resin post-processing — roughly 10%/year of printer cost.', 3),
  (8, 'Get at least 2 quotations per machine class; check local service support before imported brands.', 4),
  -- Drone Hardware & Kits
  (9, 'Order propellers and batteries at 3× fleet count — they are the highest-churn consumables.', 1),
  (9, 'Battery charging stations need LiPo-safe bags/cabinets and a no-overnight-charging rule.', 2),
  (9, 'Verify DGCA compliance path for any drone >250g intended for outdoor field training.', 3),
  -- Simulation & Compute
  (10, 'Floating licenses (network) usually beat per-seat licenses at cohort scale for CAD/sim tools.', 1),
  (10, 'Sim workstations: match GPU tier to the simulator''s recommended spec, add 20% headroom.', 2),
  -- Safety & Facility Equipment
  (11, 'This section gates cohort launch — treat every line as Bucket 1 (Must-Have Now).', 1),
  (11, 'Fire: CO₂/dry-powder extinguishers near fabrication and battery storage; sand bucket for LiPo events.', 2),
  (11, 'PPE per person entering fabrication: safety glasses minimum; respirators for resin/sanding work.', 3),
  -- Installation & Fit-Out
  (12, 'Sequence: electrical → heavy machines → benches → IT → signage. Never reverse.', 1),
  (12, 'Log every installed asset with photo + serial number into the register at install time.', 2),
  -- Commissioning & Calibration
  (13, 'First-article test per machine (calibration print, sim benchmark, drone hover test) before "done".', 1),
  (13, 'Record calibration results in the line notes — they become the baseline for maintenance.', 2),
  -- Safety Audit & SOPs
  (14, 'One-page SOP at each machine: startup, safe use, shutdown, emergency stop — laminated.', 1),
  (14, 'Run one emergency drill (power cutoff + evacuation) before sign-off; log the drill date.', 2),
  -- Cohort Readiness Sign-Off
  (15, 'Dry-run day: staff act as students through a full timetable. Fix breakage before launch.', 1),
  (15, 'Sign-off needs: 100% safety lines done, trainers trained, and Venture Leader approval recorded in the decision log.', 2);

-- ============================================================
-- SEED: Example line items (Excel-like rows)
-- ============================================================
INSERT INTO setup_line_items (section_id, item_name, description, stakeholder, quantity_notes, vendor, priority, estimated_cost, progress_pct, status, action_item, due_date, notes, sort_order) VALUES
  (1, '3D Printer Fleet — FDM', 'Workhorse FDM printers for prototyping curriculum', 'CoE Director', '4 units · ≥300mm³ bed · dual extrusion · enclosed', 'Autoabode (quote pending)', 'critical', 520000, 40, 'in_progress', 'Collect 2nd quotation from Dronobotics and compare service terms', '2026-08-25', 'Aligned to Stage B/C build modules. Prefer vendor with local service.', 1),
  (1, 'Filament & Consumables Stock', 'PLA/PETG/ASA initial stock + nozzles, build plates, adhesives', 'Lab Manager', '60kg PLA, 30kg PETG, 10kg ASA + consumables kit', '', 'high', 90000, 10, 'in_progress', 'Add resin + IPA budget line once SLA printer is approved', '2026-08-30', 'Budget ~10%/yr of printer cost for consumables.', 2),
  (1, 'Training Drone Kits', 'Build-and-fly kits for Stage B cohort', 'CoE Director', '15 kits + 45 spare prop sets + 30 batteries', 'SkyySkill Labs', 'critical', 750000, 25, 'in_progress', 'Confirm DGCA category for outdoor variants with Venture Leader', '2026-09-05', 'Batteries at 2× fleet; LiPo-safe charging cabinet required.', 3),
  (2, 'Ramapuram Fab-Lab Space', 'Earmark ~1,200 sq ft ground-floor space for fabrication zone', 'Facilities Head', '1,200 sq ft · ground floor · 3-phase power nearby', '', 'critical', 0, 60, 'in_progress', 'Verify floor loading certificate before machine placement', '2026-08-20', 'Adjacent corridor separates fab from sim zone.', 1),
  (2, 'Trichy Flight Ops Cell', 'Netted indoor flight test area at Trichy campus', 'Facilities Head', 'Netting anchors + 10m clear radius', '', 'high', 150000, 20, 'not_started', 'Get netting vendor survey scheduled', '2026-09-10', 'Anchors must be in layout design, not retrofitted.', 2),
  (3, 'CAPEX/OPEX Budget Split', 'Split master budget into CAPEX (assets) vs OPEX (consumables, licenses, AMC)', 'Finance Partner', 'Full budget reclassification', '', 'high', 0, 50, 'in_progress', 'Present split at next purchase committee meeting', '2026-08-18', 'Different approval paths per class.', 1),
  (5, 'Fab Zone Dust Extraction Design', 'Extraction ducting plan for sanding/fab area', 'MEP Consultant', 'Covers 6 workstations', '', 'medium', 200000, 0, 'not_started', 'Include in layout design v2 review', '2026-09-01', 'Dirty-to-clean airflow rule applies.', 1),
  (8, 'Resin (SLA) Printer Evaluation', 'Evaluate need for fine-detail resin printing for Stage D R&D', 'CoE Director', '1 unit · vented enclosure included', '', 'medium', 180000, 0, 'not_started', 'Decision pending: buy now vs defer to Bucket 2', '2026-09-15', 'Requires IPA wash station + PPE if approved.', 1),
  (11, 'Fire Safety Pack', 'CO₂/dry-powder extinguishers, sand buckets, LiPo cabinet, signage', 'Safety Officer', '8 extinguishers · 2 sand buckets · 1 LiPo cabinet', '', 'critical', 120000, 70, 'in_progress', 'Install before any battery stock arrives', '2026-08-15', 'Gates cohort launch — Bucket 1.', 1),
  (11, 'PPE Kits', 'Safety glasses, respirators, gloves for fab zone users', 'Safety Officer', '40 glasses · 10 respirators · 100 glove pairs', '', 'critical', 60000, 30, 'in_progress', 'Place PO with approved safety vendor', '2026-08-22', 'Per-person issue, replacement stock quarterly.', 2);

-- Decision log seed
INSERT INTO setup_decisions (section_id, line_item_id, decision, next_steps, decided_by, decision_date) VALUES
  (1, 1, 'FDM printer fleet approved in principle at 4 units; brand selection must wait for comparative quotation.', 'CoE Director to submit Procurement Planning section once 2nd quote is attached. Venture Leader will then final-approve the vendor line.', 'joint', '2026-08-08');
