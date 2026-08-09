# SRM dROIds — CoE Mission Tracker

## Project Overview
- **Name**: SRM dROIds CoE Mission Tracker
- **Goal**: A living progress tracker for the SRM dROIds dual-campus drone innovation Centre of Excellence — not just a lab, but a fused CoE operating system for Ramapuram (design/simulation/fabrication) and Trichy (flight/field validation/RPTO).
- **Features**: Dual-role passcode-based access (CoE Leader + Venture Owner), KPI/KRA dashboard with submission/review/approve workflow, premium glassmorphism UX with drone hero imagery and floating animations, cohort pipeline tracker (Stages A→E), 3D facility warehouse layout viewer (Three.js), GSAP-animated progress tracking, procurement strategy with three-bucket spend logic, partner/vendor stack manager, Phase 1 execution roadmap, LLM-powered report synthesis (Venture Owner only, using OpenAI API key), CSV export, shareable report links, toast notifications.

## URLs
- **Production**: https://61702bf7-566e-4626-811a-a241bf8e6f5b.vip.gensparksite.com
- **API Base**: https://61702bf7-566e-4626-811a-a241bf8e6f5b.vip.gensparksite.com/api

## Access Passcodes
| Role | Passcode | Description |
|------|----------|-------------|
| CoE Leader | `dROIds2026!` | Full KPI/KRA dashboard, cohorts, facility, reports, roadmap |
| Venture Owner | `VentureSRM!26` | Procurement, partners, LLM synthesis, admin controls |

## Data Architecture
- **Database**: Cloudflare D1 (SQLite) — `61702bf7-566e-4626-811a-a241bf8e6f5b-db`
- **D1 Binding**: `DB`

### Data Models (16 tables)
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

### Seed Data
- 2 default access codes
- 6 KRAs with 21 KPIs
- 5 roadmap milestones (Month 0-1 through Month 4-6)
- 14 facility zones (7 Ramapuram + 7 Trichy)
- 11 procurement items totaling ₹4,700,000 estimated
- 7 partners/vendors (Dronobotics, Autoabode, SkyySkill Labs, Aerdroids, GATI, DroneAcharya, DigitalSky DGCA)

## User Guide

### CoE Leader View
1. Open the application URL and enter passcode `dROIds2026!`
2. **Dashboard**: View all 6 KRAs and 21 KPIs. Click any KRA card to open the KPI editor. Use "Submit for Review" inside each KRA to send KPI updates to the Venture Owner for approval. Track submission status (pending / approved / rejected) with color-coded badges.
3. **Cohorts**: See the 5-stage pipeline (Foundation → Build → Field → R&D → Service). Add new cohorts.
4. **Facility**: Toggle between Ramapuram and Trichy campus layouts in 3D with Three.js. Drag to orbit, scroll to zoom.
5. **Reports**: Submit daily updates (attendance, safety, blockers, decisions needed). View weekly/monthly reports.
6. **Roadmap**: Track Phase 1 milestones Month 0 through Month 6. Update status inline.

### Venture Owner View
1. Open the application URL and enter passcode `VentureSRM!26`
2. **Dashboard**: Monitor CoE Director's KPI performance and roadmap progress. Click "Review Pending Submissions" to jump directly to the Review tab.
3. **Review** (v2): All KPI submissions from CoE Leader in one view. Filter by status (Pending / Approved / Rejected / All). Click any submission to review: **edit** KPI values inline, **approve** to accept changes, or **reject** with reviewer notes explaining why. Report submissions are also reviewed here.
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
- **Last Updated**: 2026-08-09 (v2 — submission/review/approve workflow + premium glassmorphism UX)

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
