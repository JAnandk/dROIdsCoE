# SRM dROIds — CoE Mission Tracker

## Project Overview
- **Name**: SRM dROIds CoE Mission Tracker
- **Goal**: A living progress tracker for the SRM dROIds dual-campus drone innovation Centre of Excellence — not just a lab, but a fused CoE operating system for Ramapuram (design/simulation/fabrication) and Trichy (flight/field validation/RPTO).
- **Features**: Dual-role passcode-based access (CoE Leader + Venture Owner), KPI/KRA dashboard with submission/review/approve workflow, **Foundational Setup Tracker (v3)** — stage-by-stage Excel-like line-item tracker with best-practice tooltips and CoE Director → Venture Leader governance workflow, premium glassmorphism UX with drone hero imagery and floating animations, cohort pipeline tracker (Stages A→E), 3D facility warehouse layout viewer (Three.js), GSAP-animated progress tracking, procurement strategy with three-bucket spend logic, partner/vendor stack manager, Phase 1 execution roadmap, LLM-powered report synthesis (Venture Owner only, using OpenAI API key), CSV export, shareable report links, toast notifications.

## URLs
- **Production**: https://21199f17-ad08-428f-b5e4-1c18d80ee37d.vip.gensparksite.com
- **API Base**: https://21199f17-ad08-428f-b5e4-1c18d80ee37d.vip.gensparksite.com/api

## Access Passcodes
| Role | Passcode | Description |
|------|----------|-------------|
| CoE Leader | `dROIds2026!` | Full KPI/KRA dashboard, cohorts, facility, reports, roadmap |
| Venture Owner | `VentureSRM!26` | Procurement, partners, LLM synthesis, admin controls |

## Data Architecture
- **Database**: Cloudflare D1 (SQLite) — `21199f17-ad08-428f-b5e4-1c18d80ee37d-db`
- **D1 Binding**: `DB`

### Data Models (21 tables)
| Table | Purpose |
|-------|---------|
| `access_codes` | Passcode-based authentication for CoE Leader and Venture Owner roles |
| `kras` | 6 Key Result Areas from the mission document |
| `kpis` | 21 Key Performance Indicators mapped to KRAs |
| `kpi_submissions` | CoE Leader KPI updates submitted for Venture Owner review/approval (v2) |
| `report_submissions` | Daily/weekly/monthly reports submitted for Venture Owner review/approval (v2) |
| `cohorts` | Student cohort phases (Stages A→E) |
| `students` | Individual students with progression tracking |
| `daily_updates` | CoE Leader → Venture Owner daily reports |
| `weekly_reports` | Weekly progress, utilization, budget, risks |
| `monthly_reports` | Monthly KPI scorecard, strategic decisions |
| `facilities` | Campus zone layouts with 3D coordinates |
| `procurement_items` | Three-bucket spend logic procurement tracker |
| `partners` | Vendor/RPTO/training partner stack |
| `reports` | Saved reports with shareable tokens |
| `roadmap_milestones` | Phase 1 Month 0-6 execution roadmap |
| `setup_stages` | 5 foundational stages: Planning → Design → Procurement → Deployment → Readiness (v3) |
| `setup_sections` | Section headers per stage with best-practice guideline summary (v3) |
| `setup_guidelines` | Multiple best-practice tips per section, rendered as tooltips (v3) |
| `setup_line_items` | Excel-like rows: stakeholder, qty/spec, vendor, priority, est/actual cost, progress %, status, action item, notes, review state (v3) |
| `setup_submissions` | Batch section submissions CoE Director → Venture Leader for review/approve/changes-requested (v3) |
| `setup_decisions` | Decision & action log — joint decisions, next-step guidance and edit instructions (v3) |

### Seed Data
- 2 default access codes
- 6 KRAs with 21 KPIs
- 5 roadmap milestones (Month 0-1 through Month 4-6)
- 14 facility zones (7 Ramapuram + 7 Trichy)
- 11 procurement items totaling ₹4,700,000 estimated
- 7 partners/vendors (Dronobotics, Autoabode, SkyySkill Labs, Aerdroids, GATI, DroneAcharya, DigitalSky DGCA)
- **v3 Setup Tracker**: 5 stages, 16 section headers, 35 best-practice guideline tips, 10 example line items, 1 decision log entry

## User Guide

### CoE Leader View
1. Open the application URL and enter passcode `dROIds2026!`
2. **Setup Tracker** (v3): The foundational setup operations tracker. Work stage-by-stage (Planning → Design → Procurement → Deployment → Readiness). Each stage shows its objective banner; each section header (e.g., Procurement Planning, 3D Printing & Fabrication) opens an Excel-like grid where you add line items with stakeholder, qty/spec, vendor, priority, estimated/actual cost, progress %, status, action item, due date and notes. Hover the 💡 icon on any section header for best-practice guidance, or click **Tips** for the full guideline list. Update progress % and status inline in the grid. When a section is ready, click **Submit for Review** to send it to the Venture Leader; their edit instructions appear inline under the affected line items.
3. **Dashboard**: View all 6 KRAs and 21 KPIs. Click any KRA card to open the KPI editor. Use "Submit for Review" inside each KRA to send KPI updates to the Venture Owner for approval. Track submission status (pending / approved / rejected) with color-coded badges.
3. **Cohorts**: See the 5-stage pipeline (Foundation → Build → Field → R&D → Service). Add new cohorts.
4. **Facility**: Toggle between Ramapuram and Trichy campus layouts in 3D with Three.js. Drag to orbit, scroll to zoom.
5. **Reports**: Submit daily updates (attendance, safety, blockers, decisions needed). View weekly/monthly reports.
6. **Roadmap**: Track Phase 1 milestones Month 0 through Month 6. Update status inline.

### Venture Owner View
1. Open the application URL and enter passcode `VentureSRM!26`
2. **Setup Tracker** (v3): Bird's-eye governance view of the foundational setup. Tabs: **Tracker Board** (read-only grid with per-line approve ✓ / request-changes 💬 actions), **Review Queue** (pending section submissions — approve all or send back with edit instructions), **Analytics** (stage progress charts, status distribution, est-vs-actual cost by stage, governance pipeline funnel, blocked/at-risk items), and **Decision Log** (record decisions with next-step guidance, linked to a section or line item; decisions can be Venture Leader, CoE Director, or joint).
3. **Dashboard**: Monitor CoE Director's KPI performance and roadmap progress. Click "Review Pending Submissions" to jump directly to the Review tab.
4. **Review** (v2): All KPI submissions from CoE Leader in one view. Filter by status (Pending / Approved / Rejected / All). Click any submission to review: **edit** KPI values inline, **approve** to accept changes, or **reject** with reviewer notes explaining why. Report submissions are also reviewed here.
4. **Procurement**: View all items across three spend buckets. Update procurement status inline.
5. **Partners**: Manage vendor, RPTO, and training partner relationships.
6. **Reports**: View all daily/weekly/monthly reports. Export KPI data as CSV. Share reports via link.
7. **GenAI**: Enter your OpenAI API key, select report type, and generate AI-powered synthesis of all CoE data. Save synthesized reports.
8. **Admin**: Manage access passcodes — add new codes, enable/disable existing ones.

### Sharing Reports
1. Navigate to Reports → Saved Reports
2. Click "Share" on any saved report to get a link
3. Anyone with the link can view the report without authentication

## Deployment
- **Platform**: Cloudflare Workers for Platform (gsk-hosted-deploy)
- **Status**: ✅ Active
- **Tech Stack**: Hono + TypeScript + Vite + TailwindCSS + Chart.js + Three.js + GSAP + D1 SQLite
- **Last Updated**: 2026-09-13 (v5 — Collaboration Hub, Report Creator, 3D landing, interactive Space Planner)

## What's New in v5
- **Facility for supervisors** — Venture Owner nav now includes the Facility view (zones map + Space Planner), previously director-only.
- **Interactive Space Planner** — drag equipment across the floor (auto-clamped to room bounds, saves position), wheel-resize footprints on the selected item, hover quick-tips (footprint/height/position/status/notes), double-click to edit, selection ring, day/night-aware rendering at 1 unit = 1 ft.
- **Landing page facelift** — Three.js drone-lifecycle showcase: parts assemble from a scattered blueprint through 7 phases (Blueprint → Discussion → Design → Manufacture → Test → Deploy → Impact) with orbiting camera, blueprint grid, ambient particles, phase chips, and an industry impact ticker (Agriculture, Mining, Ocean/River Erosion, Forest Inventory…).
- **API Vault + Report Creator** — per-role kie.ai key vault (`api_vault_keys`, masked display, server-side only), `/api/llm/chat` proxy to `https://api.kie.ai/gemini-3-8-flash-openai/v1/chat/completions` (model `gemini-3-8-flash`), Report Creator with 6 toggleable live data sources (KPIs, setup tracker, procurement, action items, whiteboard, roadmap), directive prompt, supervisory cues (overdue/blocked items, pending submissions, pipeline warnings), and jsPDF export.
- **Collaboration Hub** — shared whiteboard (sticky notes both roles can add/drag/edit/delete, ✦AI enhance via vaulted key, PDF export of the board) + Meeting Action Tracker (Jira-lite kanban: backlog/todo/in_progress/blocked/done, priorities, owners, due dates, per-meeting filter, AI extraction of action items from pasted meeting notes).
- **PDF sharing** — export generated reports and the whiteboard as PDFs for external stakeholders.
- **Floating-panel fixes** — modals/toasts forced above 3D canvases with opaque backgrounds; canvases pinned to z-index 0.
- **Data safety** — migration 0005 is purely additive (`api_vault_keys`, `whiteboard_notes`, `meeting_action_items`); all v3/v4 data preserved.

## What's New in v4
- Dashboard visibility fixes (animateIn fallback, contrast, body CSS gradient layering), day/night theme toggle, email sharing via Resend (formatted HTML reports), Space Planner v1 (sqft rooms + square-footprint placements + 3D floor render).

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth` | No | Verify passcode and return role |
| GET | `/api/kpis/scorecard` | No | KPI scorecard with KRA grouping |
| GET | `/api/kpis` | No | All KPIs |
| PUT | `/api/kpis/:id` | No | Update KPI value/status |
| GET | `/api/cohorts` | No | All cohorts |
| POST | `/api/cohorts` | No | Create cohort |
| GET | `/api/facilities?campus=X` | No | Facility layouts by campus |
| GET | `/api/reports/daily` | No | Daily updates |
| POST | `/api/reports/daily` | No | Submit daily update |
| GET | `/api/reports/weekly` | No | Weekly reports |
| GET | `/api/reports/monthly` | No | Monthly reports |
| GET | `/api/procurement` | No | Procurement items |
| GET | `/api/procurement/summary` | No | Spend summary by bucket |
| GET | `/api/partners` | No | Partner/vendor list |
| GET | `/api/roadmap` | No | Phase 1 roadmap milestones |
| PUT | `/api/roadmap/:id` | No | Update milestone status |
| POST | `/api/llm/synthesize` | No | LLM-powered report synthesis (requires API key in body) |
| POST | `/api/reports/saved` | No | Save a report for sharing |
| GET | `/api/reports/shared/:token` | No | View shared report by token |
| GET | `/api/export/csv/:type` | No | Export data as CSV |
| GET | `/api/auth/codes` | No | List access codes (admin) |
| POST | `/api/auth/codes` | No | Create access code (admin) |
| POST | `/api/submissions/kpi` | No | Submit KPI update for Venture Owner review (v2) |
| GET | `/api/submissions` | No | List KPI submissions (`?status=pending_review\|approved\|rejected`) (v2) |
| PUT | `/api/submissions/:id` | No | Approve, reject, or edit a KPI submission (v2) |
| POST | `/api/submissions/report` | No | Submit report for Venture Owner review (v2) |
| GET | `/api/submissions/report` | No | List report submissions (v2) |
| PUT | `/api/submissions/report/:id` | No | Approve or reject a report submission (v2) |
| GET | `/api/tracker` | No | Full setup tracker tree: stages → sections (with guidelines) → line items + stats (v3) |
| GET | `/api/tracker/analytics` | No | Bird's-eye analytics: by status/priority/stage/review state, cost by stage, risk items (v3) |
| POST | `/api/tracker/sections` | No | Create a section header under a stage (v3) |
| PUT | `/api/tracker/sections/:id` | No | Update section title/description/guideline/status (v3) |
| POST | `/api/tracker/guidelines` | No | Add a best-practice tip to a section (v3) |
| DELETE | `/api/tracker/guidelines/:id` | No | Remove a best-practice tip (v3) |
| POST | `/api/tracker/items` | No | Add a line item (Excel-like row) to a section (v3) |
| PUT | `/api/tracker/items/:id` | No | Update any line item field (inline grid edits) (v3) |
| DELETE | `/api/tracker/items/:id` | No | Delete a line item (v3) |
| POST | `/api/tracker/submit` | No | Submit a whole section's line items for Venture Leader review (v3) |
| GET | `/api/tracker/submissions` | No | List setup submissions (`?status=pending_review\|approved\|changes_requested`) (v3) |
| PUT | `/api/tracker/submissions/:id` | No | Approve or request changes on a section submission (v3) |
| PUT | `/api/tracker/items/:id/review` | No | Per-line-item approve / request-changes with guidance (v3) |
| GET | `/api/tracker/decisions` | No | Decision & action log with section/line-item links (v3) |
| POST | `/api/tracker/decisions` | No | Log a decision with next-step guidance (v3) |
| GET | `/api/tracker/export/csv` | No | Export the full tracker as CSV (v3) |
