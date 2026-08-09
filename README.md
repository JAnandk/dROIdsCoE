# SRM dROIds — CoE Mission Tracker

**Live Deployment**: [https://61702bf7-566e-4626-811a-a241bf8e6f5b.vip.gensparksite.com](https://61702bf7-566e-4626-811a-a241bf8e6f5b.vip.gensparksite.com)

## Project Overview

A living application for the **SRM dROIds dual-campus drone Centre of Excellence** — serving as the progress tracker, KPI dashboard, reporting system, and governance platform for both the CoE Director and Venture Owner.

Built from the 17-page SRM dROIds CoE Mission PDF covering: dual-campus operating model (Ramapuram + Trichy), student cohort pipeline (Stages A→E), procurement strategy, facility layouts, DGCA compliance, IP security, partner stack, and Phase 1 execution roadmap.

## Completed Features

### 🔐 Passcode-Based Authentication
- Dual-role access: CoE Leader (`dROIds2026!`) and Venture Owner (`VentureSRM!26`)
- Session-scoped role-based UI with secure passcode verification
- Admin panel for managing access codes (Venture Owner only)
- Shared report links with token-based access

### 📊 KPI/KRA Dashboard (CoE Leader + Venture Owner)
- 6 Key Result Areas with 21 KPIs mapped directly from the mission document
- Interactive KPI cards with inline editing
- KRA completion percentages with color-coded progress bars
- Doughnut chart for KPI status distribution
- Horizontal bar chart for roadmap milestone progress
- GSAP-animated dashboard elements

### 👥 Cohort Pipeline (CoE Leader)
- 5-stage pipeline visualization (Foundation → Build → Field/Immersion → R&D → Service)
- Student progression tracking with drag-and-drop-like stage columns
- Cohort CRUD with form modal
- Student management with certification tracking

### 🏭 3D Facility Layout (CoE Leader)
- Three.js interactive 3D warehouse/lab layouts for both campuses
- Ramapuram: 7 zones (Showcase, Learning, Workshop, Simulation, 3D Printing, Store, Review)
- Trichy: 7 zones (Planning, Equipment, Workshop, Launch Zones, Battery Bay, Data, Demo Corridor)
- Mouse drag to orbit, scroll to zoom, hover highlighting
- Color-coded zone legend

### 📝 Reports System (CoE Leader + Venture Owner)
- **Daily Updates**: Cohort attendance, facility/safety issues, vendor blockers, decisions needed
- **Weekly Reports**: Progress vs plan, utilization, budget burn, risks, asks
- **Monthly Reports**: KPI scorecard, cohort funnel, R&D pipeline, capex/opex, strategic decisions
- CSV export for KPIs, cohorts, procurement, and saved reports
- Shareable report links with unique tokens

### 💰 Procurement Strategy (Venture Owner)
- Three-bucket spend logic: Must-Have Now → Buy-once Growth Proven → Rent/Partner First
- 11 seeded procurement items across all categories
- Summary cards with estimated costs per bucket
- Inline status updates (planned → ordered → delivered → installed)

### 🤝 Partner Stack (Venture Owner)
- 7 seeded partners/vendors (Dronobotics, Autoabode, SkyySkill, Aerdroids, GATI, DroneAcharya, DigitalSky)
- Partner status tracking (identified → engaged → active)
- Add new partners via form modal

### 🗺️ Phase 1 Roadmap (CoE Leader)
- 5 milestones from Month 0-6 with detailed task lists
- Timeline visualization with status management
- GSAP-animated milestone entries

### 🤖 GenAI Report Synthesis (Venture Owner)
- LLM-powered synthesis using OpenAI API (key managed in Venture Owner section only)
- Pulls data from all KPIs, reports, cohorts, roadmap, and procurement
- Generates executive summaries, weekly status, monthly reviews, strategic advisories, risk assessments
- Save synthesized reports for sharing

### ⚙️ Admin Panel (Venture Owner)
- Manage access passcodes (create, enable/disable)
- View all authentication codes with timestamps
- Works alongside the admin-level route controls

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth` | Verify passcode, return role |
| GET | `/api/auth/codes` | List access codes (admin) |
| POST | `/api/auth/codes` | Create access code |
| PUT | `/api/auth/codes/:id` | Toggle code active/inactive |
| GET | `/api/kpis/scorecard` | KPI scorecard with KRA grouping |
| GET | `/api/kpis` | All KPIs |
| PUT | `/api/kpis/:id` | Update KPI value/status |
| GET | `/api/kras` | All KRAs |
| GET | `/api/cohorts` | All cohorts |
| POST | `/api/cohorts` | Create cohort |
| PUT | `/api/cohorts/:id` | Update cohort |
| GET | `/api/students` | Students (optional `?cohort_id=`) |
| POST | `/api/students` | Add student |
| PUT | `/api/students/:id` | Update student |
| DELETE | `/api/students/:id` | Remove student |
| GET/POST | `/api/reports/daily` | Daily updates |
| GET/POST/PUT | `/api/reports/weekly` | Weekly reports |
| GET/POST/PUT | `/api/reports/monthly` | Monthly reports |
| GET/POST/PUT | `/api/reports/saved` | Saved/generated reports |
| GET | `/api/reports/shared/:token` | Shared report view |
| GET | `/api/facilities` | Facilities (`?campus=`) |
| PUT | `/api/facilities/:id` | Update facility status/position |
| GET/POST/PUT | `/api/procurement` | Procurement items |
| GET | `/api/procurement/summary` | Procurement dashboard data |
| GET/POST/PUT | `/api/partners` | Partner management |
| GET/PUT | `/api/roadmap` | Roadmap milestones |
| POST | `/api/llm/synthesize` | LLM synthesis (requires API key) |
| GET | `/api/export/csv/:type` | CSV export |

## Data Architecture

### Storage
- **Cloudflare D1** (SQLite): 14 tables for persistent data
- Database: `61702bf7-566e-4626-811a-a241bf8e6f5b-db`

### Tables
- `access_codes` — Passcode-based authentication
- `kras` — 6 Key Result Areas
- `kpis` — 21 Key Performance Indicators
- `cohorts` — Student cohort groups
- `students` — Individual student tracking
- `daily_updates` — Daily CoE Leader reports
- `weekly_reports` — Weekly progress reports
- `monthly_reports` — Monthly strategic reports
- `reports` — Saved/shareable reports
- `facilities` — Campus zone layouts (14 zones)
- `procurement_items` — Procurement tracking (11 items)
- `partners` — Vendor/partner network (7 partners)
- `roadmap_milestones` — Phase 1 execution (5 milestones)

## Technology Stack

- **Backend**: Hono v4 (TypeScript) on Cloudflare Workers
- **Frontend**: Vanilla JS SPA with Tailwind CSS (CDN)
- **3D**: Three.js for facility layout visualization
- **Animation**: GSAP for UI transitions and progress trackers
- **Charts**: Chart.js for KPI and roadmap charts
- **Database**: Cloudflare D1 (SQLite)
- **Deployment**: Genspark Hosted Cloudflare Platform
- **LLM Integration**: OpenAI API (Venture Owner only)

## User Guide

### CoE Leader Quick Start
1. Open the app and enter passcode: `dROIds2026!`
2. **Dashboard** — View KPI scorecard, update KPI values
3. **Cohorts** — Track student pipeline through 5 stages
4. **Facility** — Explore 3D warehouse layouts for both campuses
5. **Reports** — Submit daily updates, weekly/monthly reports
6. **Roadmap** — Track Phase 1 milestone progress

### Venture Owner Quick Start
1. Open the app and enter passcode: `VentureSRM!26`
2. **Dashboard** — Strategic KPI overview
3. **Procurement** — Manage three-bucket spend strategy
4. **Partners** — Track vendor/partner engagement
5. **Reports** — Review daily/weekly/monthly updates from CoE Director
6. **GenAI** — Set OpenAI API key, generate strategic syntheses
7. **Admin** — Manage access passcodes

### Sharing Reports
- Save any report via the Reports section
- Click "Share" to generate a unique link
- Anyone with the link can view the report (no login required)

## Deployment Status

- ✅ **Deployed**: Workers for Platform
- ✅ **D1 Database**: 14 tables seeded with mission data
- ✅ **Assets**: Static files served via Cloudflare CDN

## Access Codes

| Role | Passcode | Status |
|------|----------|--------|
| CoE Leader | `dROIds2026!` | Active |
| Venture Owner | `VentureSRM!26` | Active |
