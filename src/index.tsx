import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use(renderer)
app.use('/api/*', cors())

// ============================================================
// AUTH
// ============================================================
app.post('/api/auth', async (c) => {
  const { passcode } = await c.req.json()
  if (!passcode) return c.json({ ok: false, error: 'Passcode required' }, 400)
  const row = await c.env.DB.prepare(
    'SELECT id, role, label, is_active FROM access_codes WHERE passcode = ? AND is_active = 1'
  ).bind(passcode).first<{ id: number; role: string; label: string; is_active: number }>()
  if (!row) return c.json({ ok: false, error: 'Invalid passcode' }, 401)
  return c.json({ ok: true, role: row.role, label: row.label, id: row.id })
})

app.get('/api/auth/codes', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT id, role, passcode, label, is_active, created_at FROM access_codes ORDER BY role, id'
  ).all()
  return c.json(rows.results)
})

app.post('/api/auth/codes', async (c) => {
  const { role, passcode, label } = await c.req.json()
  await c.env.DB.prepare(
    'INSERT INTO access_codes (role, passcode, label) VALUES (?, ?, ?)'
  ).bind(role, passcode, label).run()
  return c.json({ ok: true })
})

app.put('/api/auth/codes/:id', async (c) => {
  const id = c.req.param('id')
  const { is_active } = await c.req.json()
  await c.env.DB.prepare('UPDATE access_codes SET is_active = ? WHERE id = ?').bind(is_active, id).run()
  return c.json({ ok: true })
})

// Dashboard aggregate
app.get('/api/dashboard', async (c) => {
  const db = c.env.DB
  const [kras, kpis, cohorts, roadmap, facilities, dailyCount, weeklyCount, monthlyCount] = await Promise.all([
    db.prepare('SELECT * FROM kras ORDER BY sort_order').all(),
    db.prepare('SELECT k.*, kr.title as kra_title FROM kpis k JOIN kras kr ON k.kra_id = kr.id ORDER BY k.kra_id, k.sort_order').all(),
    db.prepare('SELECT * FROM cohorts ORDER BY start_date').all(),
    db.prepare('SELECT * FROM roadmap_milestones ORDER BY sort_order').all(),
    db.prepare('SELECT * FROM facilities ORDER BY campus, name').all(),
    db.prepare('SELECT COUNT(*) as c FROM daily_updates').first<{c:number}>(),
    db.prepare('SELECT COUNT(*) as c FROM weekly_reports').first<{c:number}>(),
    db.prepare('SELECT COUNT(*) as c FROM monthly_reports').first<{c:number}>()
  ])
  return c.json({
    kras: kras.results, kpis: kpis.results, cohorts: cohorts.results,
    roadmap: roadmap.results.map((r:any) => ({...r, tasks: JSON.parse(r.tasks||'[]')})),
    facilities: facilities.results,
    report_counts: { daily: dailyCount?.c||0, weekly: weeklyCount?.c||0, monthly: monthlyCount?.c||0 }
  })
})

// ============================================================
// KRAs & KPIs
// ============================================================
app.get('/api/kras', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM kras ORDER BY sort_order').all()
  return c.json(rows.results)
})

app.put('/api/kras/:id', async (c) => {
  const id = c.req.param('id')
  const { title, description, weight } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE kras SET title = ?, description = ?, weight = ? WHERE id = ?'
  ).bind(title, description, weight, id).run()
  return c.json({ ok: true })
})

app.get('/api/kpis', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT kpis.*, kras.title as kra_title, kras.weight as kra_weight
     FROM kpis JOIN kras ON kpis.kra_id = kras.id ORDER BY kras.sort_order, kpis.sort_order`
  ).all()
  return c.json(rows.results)
})

app.put('/api/kpis/:id', async (c) => {
  const id = c.req.param('id')
  const { current_value, status, title, description, metric_unit, target_value } = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE kpis SET current_value = ?, status = ?, title = COALESCE(?, title),
     description = COALESCE(?, description), metric_unit = COALESCE(?, metric_unit),
     target_value = COALESCE(?, target_value), updated_at = datetime('now')
     WHERE id = ?`
  ).bind(current_value, status, title, description, metric_unit, target_value, id).run()
  return c.json({ ok: true })
})

// KPI Scorecard summary
app.get('/api/kpis/scorecard', async (c) => {
  const kpis = await c.env.DB.prepare(
    `SELECT kpis.*, kras.title as kra_title, kras.weight as kra_weight
     FROM kpis JOIN kras ON kpis.kra_id = kras.id ORDER BY kras.sort_order, kpis.sort_order`
  ).all()
  const kras = await c.env.DB.prepare('SELECT * FROM kras ORDER BY sort_order').all()

  const kraMap: Record<number, any> = {}
  for (const k of kras.results as any[]) {
    kraMap[k.id] = { ...k, kpis: [], completed: 0, total: 0, completion: 0 }
  }
  let overallCompleted = 0
  let overallTotal = 0

  for (const kpi of kpis.results as any[]) {
    if (kraMap[kpi.kra_id]) {
      kraMap[kpi.kra_id].kpis.push(kpi)
      kraMap[kpi.kra_id].total++
      overallTotal++
      if (kpi.status === 'completed') {
        kraMap[kpi.kra_id].completed++
        overallCompleted++
      }
    }
  }
  for (const k of Object.values(kraMap) as any[]) {
    k.completion = k.total > 0 ? Math.round((k.completed / k.total) * 100) : 0
  }

  return c.json({
    kras: Object.values(kraMap),
    overall_pct: overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0,
    total_kpis: overallTotal,
    completed_kpis: overallCompleted
  })
})

// ============================================================
// COHORTS & STUDENTS
// ============================================================
app.get('/api/cohorts', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM cohorts ORDER BY start_date DESC').all()
  return c.json(rows.results)
})

app.post('/api/cohorts', async (c) => {
  const { name, stage, campus, student_count, start_date, end_date, status } = await c.req.json()
  const result = await c.env.DB.prepare(
    'INSERT INTO cohorts (name, stage, campus, student_count, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(name, stage, campus, student_count, start_date, end_date, status || 'planned').run()
  return c.json({ ok: true, id: result.meta.last_row_id })
})

app.put('/api/cohorts/:id', async (c) => {
  const id = c.req.param('id')
  const { name, stage, campus, student_count, start_date, end_date, status } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE cohorts SET name=?, stage=?, campus=?, student_count=?, start_date=?, end_date=?, status=? WHERE id=?'
  ).bind(name, stage, campus, student_count, start_date, end_date, status, id).run()
  return c.json({ ok: true })
})

app.get('/api/students', async (c) => {
  const cohortId = c.req.query('cohort_id')
  let rows
  if (cohortId) {
    rows = await c.env.DB.prepare(
      `SELECT s.*, c.name as cohort_name, c.stage as cohort_stage
       FROM students s LEFT JOIN cohorts c ON s.cohort_id = c.id
       WHERE s.cohort_id = ? ORDER BY s.name`
    ).bind(cohortId).all()
  } else {
    rows = await c.env.DB.prepare(
      `SELECT s.*, c.name as cohort_name, c.stage as cohort_stage
       FROM students s LEFT JOIN cohorts c ON s.cohort_id = c.id ORDER BY s.name`
    ).all()
  }
  return c.json(rows.results)
})

app.post('/api/students', async (c) => {
  const { cohort_id, name, email, current_stage, progress_pct, certifications, is_field_immersion, status } = await c.req.json()
  const result = await c.env.DB.prepare(
    'INSERT INTO students (cohort_id, name, email, current_stage, progress_pct, certifications, is_field_immersion, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(cohort_id, name, email, current_stage || 'A', progress_pct || 0, JSON.stringify(certifications || []), is_field_immersion ? 1 : 0, status || 'active').run()
  return c.json({ ok: true, id: result.meta.last_row_id })
})

app.put('/api/students/:id', async (c) => {
  const id = c.req.param('id')
  const { name, email, current_stage, progress_pct, certifications, is_field_immersion, status } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE students SET name=?, email=?, current_stage=?, progress_pct=?, certifications=?, is_field_immersion=?, status=? WHERE id=?'
  ).bind(name, email, current_stage, progress_pct, JSON.stringify(certifications || []), is_field_immersion ? 1 : 0, status, id).run()
  return c.json({ ok: true })
})

app.delete('/api/students/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM students WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

// ============================================================
// DAILY / WEEKLY / MONTHLY REPORTS
// ============================================================
app.get('/api/daily-updates', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM daily_updates ORDER BY report_date DESC LIMIT 90').all()
  return c.json(rows.results)
})

app.post('/api/daily-updates', async (c) => {
  const b = await c.req.json()
  const r = await c.env.DB.prepare(
    'INSERT INTO daily_updates (report_date, cohort_attendance, facility_safety_issues, vendor_asset_blockers, prototype_test_status, decisions_needed) VALUES (?,?,?,?,?,?)'
  ).bind(b.report_date, b.cohort_attendance||'', b.facility_safety_issues||'', b.vendor_asset_blockers||'', b.prototype_test_status||'', b.decisions_needed||'').run()
  return c.json({ ok: true, id: r.meta.last_row_id })
})

app.get('/api/reports/daily', async (c) => {
  const date = c.req.query('date') || ''
  let rows
  if (date) {
    rows = await c.env.DB.prepare('SELECT * FROM daily_updates WHERE report_date = ? ORDER BY created_at DESC').bind(date).all()
  } else {
    rows = await c.env.DB.prepare('SELECT * FROM daily_updates ORDER BY report_date DESC LIMIT 30').all()
  }
  return c.json(rows.results)
})

app.post('/api/reports/daily', async (c) => {
  const { report_date, cohort_attendance, facility_safety_issues, vendor_asset_blockers, prototype_test_status, decisions_needed } = await c.req.json()
  await c.env.DB.prepare(
    'INSERT INTO daily_updates (report_date, cohort_attendance, facility_safety_issues, vendor_asset_blockers, prototype_test_status, decisions_needed) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(report_date, cohort_attendance, facility_safety_issues, vendor_asset_blockers, prototype_test_status, decisions_needed).run()
  return c.json({ ok: true })
})

app.get('/api/weekly-reports', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM weekly_reports ORDER BY week_start DESC LIMIT 52').all()
  return c.json(rows.results)
})

app.post('/api/weekly-reports', async (c) => {
  const b = await c.req.json()
  const r = await c.env.DB.prepare(
    'INSERT INTO weekly_reports (week_start, week_end, progress_vs_plan, utilization_dashboard, budget_burn, faculty_partner_engagement, content_outreach, risks_mitigations, asks, status) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(b.week_start, b.week_end, b.progress_vs_plan||'', b.utilization_dashboard||'', b.budget_burn||'', b.faculty_partner_engagement||'', b.content_outreach||'', b.risks_mitigations||'', b.asks||'', b.status||'draft').run()
  return c.json({ ok: true, id: r.meta.last_row_id })
})

app.get('/api/reports/weekly', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM weekly_reports ORDER BY week_start DESC LIMIT 12').all()
  return c.json(rows.results)
})

app.post('/api/reports/weekly', async (c) => {
  const r = await c.req.json()
  await c.env.DB.prepare(
    `INSERT INTO weekly_reports (week_start, week_end, progress_vs_plan, utilization_dashboard, budget_burn, faculty_partner_engagement, content_outreach, risks_mitigations, asks, status)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).bind(r.week_start, r.week_end, r.progress_vs_plan, r.utilization_dashboard, r.budget_burn, r.faculty_partner_engagement, r.content_outreach, r.risks_mitigations, r.asks, r.status || 'draft').run()
  return c.json({ ok: true })
})

app.put('/api/reports/weekly/:id', async (c) => {
  const id = c.req.param('id')
  const r = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE weekly_reports SET progress_vs_plan=?, utilization_dashboard=?, budget_burn=?, faculty_partner_engagement=?, content_outreach=?, risks_mitigations=?, asks=?, status=? WHERE id=?`
  ).bind(r.progress_vs_plan, r.utilization_dashboard, r.budget_burn, r.faculty_partner_engagement, r.content_outreach, r.risks_mitigations, r.asks, r.status, id).run()
  return c.json({ ok: true })
})

app.get('/api/monthly-reports', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM monthly_reports ORDER BY report_month DESC LIMIT 24').all()
  return c.json(rows.results)
})

app.post('/api/monthly-reports', async (c) => {
  const b = await c.req.json()
  const r = await c.env.DB.prepare(
    'INSERT INTO monthly_reports (report_month, kpi_scorecard, cohort_funnel_trend, rd_ip_service_pipeline, capex_opex_status, next_month_plan, strategic_decisions, budget_approvals, status) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(b.report_month, b.kpi_scorecard||'', b.cohort_funnel_trend||'', b.rd_ip_service_pipeline||'', b.capex_opex_status||'', b.next_month_plan||'', b.strategic_decisions||'', b.budget_approvals||'', b.status||'draft').run()
  return c.json({ ok: true, id: r.meta.last_row_id })
})

app.get('/api/reports/monthly', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM monthly_reports ORDER BY report_month DESC LIMIT 12').all()
  return c.json(rows.results)
})

app.post('/api/reports/monthly', async (c) => {
  const r = await c.req.json()
  await c.env.DB.prepare(
    `INSERT INTO monthly_reports (report_month, kpi_scorecard, cohort_funnel_trend, rd_ip_service_pipeline, capex_opex_status, next_month_plan, strategic_decisions, budget_approvals, status)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(r.report_month, r.kpi_scorecard, r.cohort_funnel_trend, r.rd_ip_service_pipeline, r.capex_opex_status, r.next_month_plan, r.strategic_decisions, r.budget_approvals, r.status || 'draft').run()
  return c.json({ ok: true })
})

app.put('/api/reports/monthly/:id', async (c) => {
  const id = c.req.param('id')
  const r = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE monthly_reports SET kpi_scorecard=?, cohort_funnel_trend=?, rd_ip_service_pipeline=?, capex_opex_status=?, next_month_plan=?, strategic_decisions=?, budget_approvals=?, status=? WHERE id=?`
  ).bind(r.kpi_scorecard, r.cohort_funnel_trend, r.rd_ip_service_pipeline, r.capex_opex_status, r.next_month_plan, r.strategic_decisions, r.budget_approvals, r.status, id).run()
  return c.json({ ok: true })
})

// ============================================================
// SAVED REPORTS (for sharing/download)
// ============================================================
app.get('/api/reports', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 50').all()
  return c.json(rows.results)
})

app.post('/api/reports/generate', async (c) => {
  const b = await c.req.json<{ title: string; report_type: string; content: string; generated_by: string }>()
  const token = 'rpt_' + Math.random().toString(36).substring(2, 10)
  const r = await c.env.DB.prepare(
    'INSERT INTO reports (title, report_type, content, generated_by, share_token) VALUES (?,?,?,?,?)'
  ).bind(b.title, b.report_type, b.content, b.generated_by||'coe_leader', token).run()
  return c.json({ ok: true, id: r.meta.last_row_id, share_token: token })
})

app.get('/api/reports/saved', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 50').all()
  return c.json(rows.results)
})

app.post('/api/reports/saved', async (c) => {
  const { title, report_type, content, generated_by, share_token } = await c.req.json()
  const token = share_token || ('rpt_' + Math.random().toString(36).substring(2, 10))
  await c.env.DB.prepare(
    'INSERT INTO reports (title, report_type, content, generated_by, share_token) VALUES (?, ?, ?, ?, ?)'
  ).bind(title, report_type, content, generated_by || 'coe_leader', token).run()
  return c.json({ ok: true, share_token: token })
})

app.get('/api/reports/shared/:token', async (c) => {
  const token = c.req.param('token')
  const row = await c.env.DB.prepare(
    'SELECT * FROM reports WHERE share_token = ?'
  ).bind(token).first()
  if (!row) return c.json({ error: 'Report not found' }, 404)
  return c.json(row)
})

app.put('/api/reports/saved/:id', async (c) => {
  const id = c.req.param('id')
  const { title, content, is_shared } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE reports SET title=?, content=?, is_shared=? WHERE id=?'
  ).bind(title, content, is_shared, id).run()
  return c.json({ ok: true })
})

// ============================================================
// FACILITIES (with 3D layout data)
// ============================================================
app.get('/api/facilities', async (c) => {
  const campus = c.req.query('campus')
  let rows
  if (campus) {
    rows = await c.env.DB.prepare('SELECT * FROM facilities WHERE campus = ? ORDER BY id').bind(campus).all()
  } else {
    rows = await c.env.DB.prepare('SELECT * FROM facilities ORDER BY campus, id').all()
  }
  return c.json(rows.results)
})

app.put('/api/facilities/:id', async (c) => {
  const id = c.req.param('id')
  const { status, x_position, y_position, width, height, description, equipment } = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE facilities SET status=?, x_position=?, y_position=?, width=?, height=?, description=COALESCE(?, description), equipment=COALESCE(?, equipment) WHERE id=?`
  ).bind(status, x_position, y_position, width, height, description, equipment, id).run()
  return c.json({ ok: true })
})

// ============================================================
// PROCUREMENT
// ============================================================
app.get('/api/procurement', async (c) => {
  const bucket = c.req.query('bucket')
  let rows
  if (bucket) {
    rows = await c.env.DB.prepare('SELECT * FROM procurement_items WHERE spend_bucket = ? ORDER BY category, item_name').bind(bucket).all()
  } else {
    rows = await c.env.DB.prepare('SELECT * FROM procurement_items ORDER BY spend_bucket, category, item_name').all()
  }
  return c.json(rows.results)
})

app.post('/api/procurement', async (c) => {
  const item = await c.req.json()
  const result = await c.env.DB.prepare(
    `INSERT INTO procurement_items (category, item_name, campus_priority, quantity_notes, spend_bucket, status, estimated_cost, actual_cost, vendor, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).bind(item.category, item.item_name, item.campus_priority, item.quantity_notes, item.spend_bucket, item.status || 'planned', item.estimated_cost, item.actual_cost, item.vendor, item.notes).run()
  return c.json({ ok: true, id: result.meta.last_row_id })
})

app.put('/api/procurement/:id', async (c) => {
  const id = c.req.param('id')
  const item = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE procurement_items SET category=?, item_name=?, campus_priority=?, quantity_notes=?, spend_bucket=?, status=?, estimated_cost=?, actual_cost=?, vendor=?, notes=? WHERE id=?`
  ).bind(item.category, item.item_name, item.campus_priority, item.quantity_notes, item.spend_bucket, item.status, item.estimated_cost, item.actual_cost, item.vendor, item.notes, id).run()
  return c.json({ ok: true })
})

app.get('/api/procurement/summary', async (c) => {
  const byBucket = await c.env.DB.prepare(
    'SELECT spend_bucket, COUNT(*) as count, SUM(COALESCE(estimated_cost,0)) as total_est FROM procurement_items GROUP BY spend_bucket'
  ).all()
  const byStatus = await c.env.DB.prepare(
    'SELECT status, COUNT(*) as count FROM procurement_items GROUP BY status'
  ).all()
  const byCategory = await c.env.DB.prepare(
    'SELECT category, COUNT(*) as count, SUM(COALESCE(estimated_cost,0)) as total_est FROM procurement_items GROUP BY category'
  ).all()
  const total = await c.env.DB.prepare('SELECT SUM(COALESCE(estimated_cost,0)) as sum FROM procurement_items').first<{ sum: number }>()
  return c.json({ by_bucket: byBucket.results, by_status: byStatus.results, by_category: byCategory.results, total_estimated: total?.sum || 0 })
})

// ============================================================
// PARTNERS
// ============================================================
app.get('/api/partners', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM partners ORDER BY type, name').all()
  return c.json(rows.results)
})

app.put('/api/partners/:id', async (c) => {
  const id = c.req.param('id')
  const { status, engagement_notes, description, contact_info } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE partners SET status=?, engagement_notes=?, description=COALESCE(?,description), contact_info=COALESCE(?,contact_info) WHERE id=?'
  ).bind(status, engagement_notes, description, contact_info, id).run()
  return c.json({ ok: true })
})

app.post('/api/partners', async (c) => {
  const { name, type, description, contact_info } = await c.req.json()
  await c.env.DB.prepare(
    'INSERT INTO partners (name, type, description, contact_info) VALUES (?,?,?,?)'
  ).bind(name, type, description, contact_info).run()
  return c.json({ ok: true })
})

// ============================================================
// ROADMAP
// ============================================================
app.get('/api/roadmap', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM roadmap_milestones ORDER BY sort_order').all()
  return c.json(rows.results)
})

app.put('/api/roadmap/:id', async (c) => {
  const id = c.req.param('id')
  const { status, tasks } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE roadmap_milestones SET status=?, tasks=? WHERE id=?'
  ).bind(status, tasks, id).run()
  return c.json({ ok: true })
})

// ============================================================
// LLM SYNTHESIS (Venture Owner only)
// ============================================================
app.post('/api/llm/synthesize', async (c) => {
  const { api_key, prompt, report_type } = await c.req.json()
  if (!api_key) return c.json({ error: 'LLM API key required — stored in Venture Owner settings' }, 400)

  // Build a rich context from all data
  const dailyRows = await c.env.DB.prepare('SELECT * FROM daily_updates ORDER BY report_date DESC LIMIT 7').all()
  const weeklyRows = await c.env.DB.prepare('SELECT * FROM weekly_reports ORDER BY week_start DESC LIMIT 2').all()
  const kpiRows = await c.env.DB.prepare(
    `SELECT kpis.*, kras.title as kra_title FROM kpis JOIN kras ON kpis.kra_id = kras.id ORDER BY kras.sort_order, kpis.sort_order`
  ).all()
  const cohortRows = await c.env.DB.prepare('SELECT * FROM cohorts ORDER BY start_date DESC').all()
  const roadmapRows = await c.env.DB.prepare('SELECT * FROM roadmap_milestones ORDER BY sort_order').all()
  const procSummary = await c.env.DB.prepare(
    'SELECT spend_bucket, COUNT(*) as c, SUM(COALESCE(estimated_cost,0)) as t FROM procurement_items GROUP BY spend_bucket'
  ).all()

  const context = {
    daily_reports: dailyRows.results,
    weekly_reports: weeklyRows.results,
    kpis: kpiRows.results,
    cohorts: cohortRows.results,
    roadmap: roadmapRows.results,
    procurement_summary: procSummary.results
  }

  const systemPrompt = `You are the SRM dROIds CoE strategic synthesis engine. You serve the Venture Owner.
Generate a concise, actionable ${report_type} synthesis based on the data provided.
Focus on: strategic decisions required, risks to flag, bottlenecks to unblock, partner opportunities, and monetization readiness.
Format in markdown. Be direct and executive-level.

Data context: ${JSON.stringify(context, null, 2)}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt || 'Generate a synthesis report.' }
        ],
        max_tokens: 2000,
        temperature: 0.5
      })
    })

    if (!response.ok) {
      const err = await response.text()
      return c.json({ error: `LLM API error: ${response.status} — ${err}` }, 502)
    }

    const data: any = await response.json()
    const synthesis = data.choices?.[0]?.message?.content || 'No synthesis generated.'
    return c.json({ synthesis, model: data.model, usage: data.usage })
  } catch (e: any) {
    return c.json({ error: `LLM call failed: ${e.message}` }, 500)
  }
})

// ============================================================
// WORKFLOW SUBMISSIONS — CoE Leader submits, Venture Owner reviews/approves
// ============================================================
app.post('/api/submissions/kpi', async (c) => {
  const { kpi_id, kra_id, current_value, previous_value, notes } = await c.req.json()
  const result = await c.env.DB.prepare(
    `INSERT INTO kpi_submissions (kpi_id, kra_id, current_value, previous_value, status, notes, submitted_by)
     VALUES (?, ?, ?, ?, 'pending_review', ?, 'coe_leader')`
  ).bind(kpi_id, kra_id, current_value, previous_value || 0, notes || '').run()
  return c.json({ ok: true, id: result.meta.last_row_id })
})

app.get('/api/submissions', async (c) => {
  const status = c.req.query('status')
  let rows
  if (status) {
    rows = await c.env.DB.prepare(
      `SELECT s.*, kpis.title as kpi_title, kpis.metric_unit, kpis.target_value,
              kras.title as kra_title
       FROM kpi_submissions s
       JOIN kpis ON s.kpi_id = kpis.id
       JOIN kras ON s.kra_id = kras.id
       WHERE s.status = ?
       ORDER BY s.created_at DESC LIMIT 100`
    ).bind(status).all()
  } else {
    rows = await c.env.DB.prepare(
      `SELECT s.*, kpis.title as kpi_title, kpis.metric_unit, kpis.target_value,
              kras.title as kra_title
       FROM kpi_submissions s
       JOIN kpis ON s.kpi_id = kpis.id
       JOIN kras ON s.kra_id = kras.id
       ORDER BY s.created_at DESC LIMIT 100`
    ).all()
  }
  return c.json(rows.results)
})

app.put('/api/submissions/:id', async (c) => {
  const id = c.req.param('id')
  const { action, current_value, reviewer_notes } = await c.req.json()
  const db = c.env.DB

  const sub = await db.prepare('SELECT * FROM kpi_submissions WHERE id = ?').bind(id).first<{
    id: number; kpi_id: number; kra_id: number; current_value: number; status: string
  }>()

  if (!sub) return c.json({ error: 'Submission not found' }, 404)

  if (action === 'approve') {
    // Update the KPI record with the submitted value
    await db.prepare(
      `UPDATE kpis SET current_value = ?, status = 'completed', updated_at = datetime('now') WHERE id = ?`
    ).bind(sub.current_value, sub.kpi_id).run()

    // Update submission status
    await db.prepare(
      `UPDATE kpi_submissions SET status = 'approved', reviewer_notes = ?,
       reviewed_by = 'venture_owner', reviewed_at = datetime('now') WHERE id = ?`
    ).bind(reviewer_notes || '', id).run()
  } else if (action === 'reject') {
    await db.prepare(
      `UPDATE kpi_submissions SET status = 'rejected', reviewer_notes = ?,
       reviewed_by = 'venture_owner', reviewed_at = datetime('now') WHERE id = ?`
    ).bind(reviewer_notes || 'Needs revision', id).run()
  } else if (action === 'edit') {
    // Venture Owner edits the submission (modifies the value before approving)
    await db.prepare(
      `UPDATE kpi_submissions SET current_value = ?, reviewer_notes = ?, status = 'pending_review'
       WHERE id = ?`
    ).bind(current_value, reviewer_notes || '', id).run()
  } else {
    return c.json({ error: 'Invalid action. Use: approve, reject, or edit' }, 400)
  }

  return c.json({ ok: true })
})

// Report submissions workflow
app.post('/api/submissions/report', async (c) => {
  const { report_type, report_id, content_json, notes } = await c.req.json()
  const result = await c.env.DB.prepare(
    `INSERT INTO report_submissions (report_type, report_id, content_json, status, notes, submitted_by)
     VALUES (?, ?, ?, 'pending_review', ?, 'coe_leader')`
  ).bind(report_type, report_id, JSON.stringify(content_json), notes || '').run()
  return c.json({ ok: true, id: result.meta.last_row_id })
})

app.get('/api/submissions/report', async (c) => {
  const status = c.req.query('status')
  let rows
  if (status) {
    rows = await c.env.DB.prepare(
      `SELECT * FROM report_submissions WHERE status = ? ORDER BY created_at DESC LIMIT 50`
    ).bind(status).all()
  } else {
    rows = await c.env.DB.prepare(
      `SELECT * FROM report_submissions ORDER BY created_at DESC LIMIT 50`
    ).all()
  }
  const results = (rows.results as any[]).map(r => ({
    ...r,
    content_json: typeof r.content_json === 'string' ? JSON.parse(r.content_json) : r.content_json
  }))
  return c.json(results)
})

app.put('/api/submissions/report/:id', async (c) => {
  const id = c.req.param('id')
  const { action, reviewer_notes } = await c.req.json()

  const sub = await c.env.DB.prepare('SELECT * FROM report_submissions WHERE id = ?').bind(id).first<{
    id: number; report_type: string; report_id: number; status: string
  }>()
  if (!sub) return c.json({ error: 'Submission not found' }, 404)

  if (action === 'approve') {
    await c.env.DB.prepare(
      `UPDATE report_submissions SET status = 'approved', reviewer_notes = ?,
       reviewed_by = 'venture_owner', reviewed_at = datetime('now') WHERE id = ?`
    ).bind(reviewer_notes || '', id).run()
    // Also update the original report status
    const table = sub.report_type === 'daily' ? 'daily_updates' :
                  sub.report_type === 'weekly' ? 'weekly_reports' : 'monthly_reports'
    await c.env.DB.prepare(`UPDATE ${table} SET status = 'approved' WHERE id = ?`).bind(sub.report_id).run()
  } else if (action === 'reject') {
    await c.env.DB.prepare(
      `UPDATE report_submissions SET status = 'rejected', reviewer_notes = ?,
       reviewed_by = 'venture_owner', reviewed_at = datetime('now') WHERE id = ?`
    ).bind(reviewer_notes || 'Needs revision', id).run()
  } else {
    return c.json({ error: 'Invalid action. Use: approve or reject' }, 400)
  }

  return c.json({ ok: true })
})

// ============================================================
// FOUNDATIONAL SETUP TRACKER (v3)
// Stage-by-stage: Planning → Design → Procurement → Deployment → Readiness
// CoE Director manages line items (Excel-like), submits sections for
// Venture Leader review; Venture Leader approves / requests changes /
// logs decisions & next-step guidance.
// ============================================================

// Full tracker tree: stages → sections (with guidelines) → line items
app.get('/api/tracker', async (c) => {
  const db = c.env.DB
  const [stages, sections, guidelines, items] = await Promise.all([
    db.prepare('SELECT * FROM setup_stages ORDER BY sort_order').all(),
    db.prepare('SELECT * FROM setup_sections ORDER BY sort_order').all(),
    db.prepare('SELECT * FROM setup_guidelines ORDER BY sort_order').all(),
    db.prepare('SELECT * FROM setup_line_items ORDER BY sort_order, id').all()
  ])
  const glBySection: Record<number, any[]> = {}
  for (const g of guidelines.results as any[]) {
    (glBySection[g.section_id] = glBySection[g.section_id] || []).push(g)
  }
  const itemsBySection: Record<number, any[]> = {}
  for (const it of items.results as any[]) {
    (itemsBySection[it.section_id] = itemsBySection[it.section_id] || []).push(it)
  }
  const sectionsByStage: Record<number, any[]> = {}
  for (const s of sections.results as any[]) {
    const secItems = itemsBySection[s.id] || []
    const total = secItems.length
    const done = secItems.filter(i => i.status === 'done').length
    const avgProgress = total > 0 ? Math.round(secItems.reduce((a, i) => a + (i.progress_pct || 0), 0) / total) : 0
    const estCost = secItems.reduce((a, i) => a + (i.estimated_cost || 0), 0)
    ;(sectionsByStage[s.stage_id] = sectionsByStage[s.stage_id] || []).push({
      ...s,
      guidelines: glBySection[s.id] || [],
      line_items: secItems,
      stats: { total, done, avg_progress: avgProgress, est_cost: estCost }
    })
  }
  const stageList = (stages.results as any[]).map(st => {
    const stageSections = sectionsByStage[st.id] || []
    const totalItems = stageSections.reduce((a, s) => a + s.stats.total, 0)
    const doneItems = stageSections.reduce((a, s) => a + s.stats.done, 0)
    const avgProgress = totalItems > 0
      ? Math.round(stageSections.reduce((a, s) => a + s.stats.avg_progress * s.stats.total, 0) / totalItems) : 0
    return {
      ...st,
      sections: stageSections,
      stats: {
        total_items: totalItems,
        done_items: doneItems,
        avg_progress: avgProgress,
        est_cost: stageSections.reduce((a, s) => a + s.stats.est_cost, 0)
      }
    }
  })
  const totalItems = stageList.reduce((a, s) => a + s.stats.total_items, 0)
  const overallProgress = totalItems > 0
    ? Math.round(stageList.reduce((a, s) => a + s.stats.avg_progress * s.stats.total_items, 0) / totalItems) : 0
  return c.json({ stages: stageList, overall_progress: overallProgress, total_items: totalItems })
})

// Bird's-eye analytics: per stage/section/priority/status/approvals
app.get('/api/tracker/analytics', async (c) => {
  const db = c.env.DB
  const [byStatus, byPriority, byStage, byReview, costByStage, pendingSubs, blockedItems] = await Promise.all([
    db.prepare('SELECT status, COUNT(*) as count FROM setup_line_items GROUP BY status').all(),
    db.prepare('SELECT priority, COUNT(*) as count FROM setup_line_items GROUP BY priority').all(),
    db.prepare(`SELECT st.id, st.name, st.sort_order,
        COUNT(li.id) as total,
        SUM(CASE WHEN li.status='done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN li.status IN ('blocked','at_risk') THEN 1 ELSE 0 END) as risk,
        SUM(COALESCE(li.estimated_cost,0)) as est_cost,
        SUM(COALESCE(li.actual_cost,0)) as actual_cost,
        COALESCE(AVG(li.progress_pct),0) as avg_progress
      FROM setup_stages st
      LEFT JOIN setup_sections s ON s.stage_id = st.id
      LEFT JOIN setup_line_items li ON li.section_id = s.id
      GROUP BY st.id ORDER BY st.sort_order`).all(),
    db.prepare('SELECT review_status, COUNT(*) as count FROM setup_line_items GROUP BY review_status').all(),
    db.prepare(`SELECT st.name as stage, SUM(COALESCE(li.estimated_cost,0)) as est, SUM(COALESCE(li.actual_cost,0)) as actual
      FROM setup_line_items li
      JOIN setup_sections s ON li.section_id = s.id
      JOIN setup_stages st ON s.stage_id = st.id
      GROUP BY st.id ORDER BY st.sort_order`).all(),
    db.prepare('SELECT COUNT(*) as c FROM setup_submissions WHERE status = \'pending_review\'').first<{c:number}>(),
    db.prepare(`SELECT li.*, s.title as section_title, st.name as stage_name
      FROM setup_line_items li
      JOIN setup_sections s ON li.section_id = s.id
      JOIN setup_stages st ON s.stage_id = st.id
      WHERE li.status IN ('blocked','at_risk') ORDER BY li.priority DESC LIMIT 20`).all()
  ])
  return c.json({
    by_status: byStatus.results, by_priority: byPriority.results,
    by_stage: byStage.results, by_review: byReview.results,
    cost_by_stage: costByStage.results,
    pending_submissions: pendingSubs?.c || 0,
    risk_items: blockedItems.results
  })
})

// ── Sections CRUD ──────────────────────────────────────────
app.post('/api/tracker/sections', async (c) => {
  const { stage_id, title, description, guideline_summary, owner_role, sort_order } = await c.req.json()
  if (!stage_id || !title) return c.json({ error: 'stage_id and title required' }, 400)
  const r = await c.env.DB.prepare(
    'INSERT INTO setup_sections (stage_id, title, description, guideline_summary, owner_role, sort_order) VALUES (?,?,?,?,?,?)'
  ).bind(stage_id, title, description || '', guideline_summary || '', owner_role || 'coe_leader', sort_order || 99).run()
  return c.json({ ok: true, id: r.meta.last_row_id })
})

app.put('/api/tracker/sections/:id', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE setup_sections SET title = COALESCE(?, title), description = COALESCE(?, description),
     guideline_summary = COALESCE(?, guideline_summary), status = COALESCE(?, status),
     sort_order = COALESCE(?, sort_order), updated_at = datetime('now') WHERE id = ?`
  ).bind(b.title ?? null, b.description ?? null, b.guideline_summary ?? null, b.status ?? null, b.sort_order ?? null, id).run()
  return c.json({ ok: true })
})

// ── Guidelines CRUD (best-practice tooltips per section) ──
app.post('/api/tracker/guidelines', async (c) => {
  const { section_id, tip, sort_order } = await c.req.json()
  if (!section_id || !tip) return c.json({ error: 'section_id and tip required' }, 400)
  const r = await c.env.DB.prepare(
    'INSERT INTO setup_guidelines (section_id, tip, sort_order) VALUES (?,?,?)'
  ).bind(section_id, tip, sort_order || 99).run()
  return c.json({ ok: true, id: r.meta.last_row_id })
})

app.delete('/api/tracker/guidelines/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM setup_guidelines WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ── Line items CRUD (Excel-like rows) ─────────────────────
app.post('/api/tracker/items', async (c) => {
  const b = await c.req.json()
  if (!b.section_id || !b.item_name) return c.json({ error: 'section_id and item_name required' }, 400)
  const r = await c.env.DB.prepare(
    `INSERT INTO setup_line_items (section_id, item_name, description, stakeholder, quantity_notes, vendor,
      priority, estimated_cost, actual_cost, progress_pct, status, action_item, due_date, notes, sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(b.section_id, b.item_name, b.description || '', b.stakeholder || '', b.quantity_notes || '',
    b.vendor || '', b.priority || 'medium', b.estimated_cost || 0, b.actual_cost || 0,
    b.progress_pct || 0, b.status || 'not_started', b.action_item || '', b.due_date || '', b.notes || '',
    b.sort_order || 99).run()
  return c.json({ ok: true, id: r.meta.last_row_id })
})

app.put('/api/tracker/items/:id', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE setup_line_items SET item_name = COALESCE(?, item_name), description = COALESCE(?, description),
     stakeholder = COALESCE(?, stakeholder), quantity_notes = COALESCE(?, quantity_notes),
     vendor = COALESCE(?, vendor), priority = COALESCE(?, priority),
     estimated_cost = COALESCE(?, estimated_cost), actual_cost = COALESCE(?, actual_cost),
     progress_pct = COALESCE(?, progress_pct), status = COALESCE(?, status),
     action_item = COALESCE(?, action_item), due_date = COALESCE(?, due_date), notes = COALESCE(?, notes),
     review_status = COALESCE(?, review_status), reviewer_notes = COALESCE(?, reviewer_notes),
     updated_at = datetime('now') WHERE id = ?`
  ).bind(b.item_name ?? null, b.description ?? null, b.stakeholder ?? null, b.quantity_notes ?? null,
    b.vendor ?? null, b.priority ?? null, b.estimated_cost ?? null, b.actual_cost ?? null,
    b.progress_pct ?? null, b.status ?? null, b.action_item ?? null, b.due_date ?? null, b.notes ?? null,
    b.review_status ?? null, b.reviewer_notes ?? null, id).run()
  return c.json({ ok: true })
})

app.delete('/api/tracker/items/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM setup_line_items WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ── Governance workflow: submit section → review ──────────
// CoE Director submits a whole section (all its items) for Venture Leader review
app.post('/api/tracker/submit', async (c) => {
  const { section_id, notes } = await c.req.json()
  if (!section_id) return c.json({ error: 'section_id required' }, 400)
  const db = c.env.DB
  const items = await db.prepare(
    'SELECT id FROM setup_line_items WHERE section_id = ?'
  ).bind(section_id).all()
  const ids = (items.results as any[]).map(i => i.id)
  if (ids.length === 0) return c.json({ error: 'No line items in this section to submit' }, 400)
  const r = await db.prepare(
    `INSERT INTO setup_submissions (section_id, line_item_ids, status, notes, submitted_by)
     VALUES (?, ?, 'pending_review', ?, 'coe_leader')`
  ).bind(section_id, JSON.stringify(ids), notes || '').run()
  // Mark items + section as submitted
  await db.prepare(
    `UPDATE setup_line_items SET review_status = 'submitted', submitted_by = 'coe_leader', updated_at = datetime('now') WHERE section_id = ?`
  ).bind(section_id).run()
  await db.prepare(
    `UPDATE setup_sections SET status = 'submitted', updated_at = datetime('now') WHERE id = ?`
  ).bind(section_id).run()
  return c.json({ ok: true, id: r.meta.last_row_id, item_count: ids.length })
})

// List submissions (filterable by status)
app.get('/api/tracker/submissions', async (c) => {
  const status = c.req.query('status')
  const base = `SELECT sub.*, s.title as section_title, st.name as stage_name
    FROM setup_submissions sub
    JOIN setup_sections s ON sub.section_id = s.id
    JOIN setup_stages st ON s.stage_id = st.id`
  const rows = status
    ? await c.env.DB.prepare(`${base} WHERE sub.status = ? ORDER BY sub.created_at DESC LIMIT 100`).bind(status).all()
    : await c.env.DB.prepare(`${base} ORDER BY sub.created_at DESC LIMIT 100`).all()
  return c.json((rows.results as any[]).map(r => ({ ...r, line_item_ids: JSON.parse(r.line_item_ids || '[]') })))
})

// Venture Leader reviews: approve / request changes (with edit instructions)
app.put('/api/tracker/submissions/:id', async (c) => {
  const id = c.req.param('id')
  const { action, reviewer_notes } = await c.req.json()
  const db = c.env.DB
  const sub = await db.prepare('SELECT * FROM setup_submissions WHERE id = ?').bind(id).first<{
    id: number; section_id: number; status: string
  }>()
  if (!sub) return c.json({ error: 'Submission not found' }, 404)

  if (action === 'approve') {
    await db.prepare(
      `UPDATE setup_submissions SET status = 'approved', reviewer_notes = ?, reviewed_by = 'venture_leader', reviewed_at = datetime('now') WHERE id = ?`
    ).bind(reviewer_notes || '', id).run()
    await db.prepare(
      `UPDATE setup_line_items SET review_status = 'approved', reviewer_notes = ?, reviewed_by = 'venture_leader', reviewed_at = datetime('now'), updated_at = datetime('now') WHERE section_id = ? AND review_status = 'submitted'`
    ).bind(reviewer_notes || '', sub.section_id).run()
    await db.prepare(
      `UPDATE setup_sections SET status = 'approved', updated_at = datetime('now') WHERE id = ?`
    ).bind(sub.section_id).run()
  } else if (action === 'request_changes') {
    await db.prepare(
      `UPDATE setup_submissions SET status = 'changes_requested', reviewer_notes = ?, reviewed_by = 'venture_leader', reviewed_at = datetime('now') WHERE id = ?`
    ).bind(reviewer_notes || 'Changes requested.', id).run()
    await db.prepare(
      `UPDATE setup_line_items SET review_status = 'changes_requested', reviewer_notes = ?, reviewed_by = 'venture_leader', reviewed_at = datetime('now'), updated_at = datetime('now') WHERE section_id = ? AND review_status = 'submitted'`
    ).bind(reviewer_notes || 'Changes requested.', sub.section_id).run()
    await db.prepare(
      `UPDATE setup_sections SET status = 'changes_requested', updated_at = datetime('now') WHERE id = ?`
    ).bind(sub.section_id).run()
  } else {
    return c.json({ error: 'Invalid action. Use: approve or request_changes' }, 400)
  }
  return c.json({ ok: true })
})

// Per-line-item review (Venture Leader approves or sends edit instruction on one row)
app.put('/api/tracker/items/:id/review', async (c) => {
  const id = c.req.param('id')
  const { action, reviewer_notes } = await c.req.json()
  if (action !== 'approve' && action !== 'request_changes') {
    return c.json({ error: 'Invalid action. Use: approve or request_changes' }, 400)
  }
  const newStatus = action === 'approve' ? 'approved' : 'changes_requested'
  await c.env.DB.prepare(
    `UPDATE setup_line_items SET review_status = ?, reviewer_notes = ?, reviewed_by = 'venture_leader',
     reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).bind(newStatus, reviewer_notes || '', id).run()
  return c.json({ ok: true })
})

// ── Decision & action log (joint decisions, next-step guidance) ──
app.get('/api/tracker/decisions', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT d.*, s.title as section_title, li.item_name
     FROM setup_decisions d
     LEFT JOIN setup_sections s ON d.section_id = s.id
     LEFT JOIN setup_line_items li ON d.line_item_id = li.id
     ORDER BY d.created_at DESC LIMIT 100`
  ).all()
  return c.json(rows.results)
})

app.post('/api/tracker/decisions', async (c) => {
  const { section_id, line_item_id, decision, next_steps, decided_by, decision_date } = await c.req.json()
  if (!decision) return c.json({ error: 'decision text required' }, 400)
  const r = await c.env.DB.prepare(
    'INSERT INTO setup_decisions (section_id, line_item_id, decision, next_steps, decided_by, decision_date) VALUES (?,?,?,?,?,?)'
  ).bind(section_id || null, line_item_id || null, decision, next_steps || '', decided_by || 'venture_leader', decision_date || new Date().toISOString().slice(0, 10)).run()
  return c.json({ ok: true, id: r.meta.last_row_id })
})

// CSV export of the full tracker (bird's-eye view)
app.get('/api/tracker/export/csv', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT st.name as stage, s.title as section, li.item_name, li.stakeholder, li.quantity_notes,
            li.vendor, li.priority, li.estimated_cost, li.actual_cost, li.progress_pct, li.status,
            li.action_item, li.due_date, li.review_status, li.notes
     FROM setup_line_items li
     JOIN setup_sections s ON li.section_id = s.id
     JOIN setup_stages st ON s.stage_id = st.id
     ORDER BY st.sort_order, s.sort_order, li.sort_order, li.id`
  ).all()
  const headers = ['stage','section','item_name','stakeholder','quantity_notes','vendor','priority','estimated_cost','actual_cost','progress_pct','status','action_item','due_date','review_status','notes']
  const csv = [headers.join(','), ...(rows.results as any[]).map(row =>
    headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
  )].join('\n')
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="foundational_setup_tracker.csv"' }
  })
})

// ============================================================
// FACILITY SPACE PLANNER (v4)
// Configure physical rooms by square footage and place equipment
// with square footprints; rendered as a 3D floor layout.
// ============================================================

app.get('/api/space/rooms', async (c) => {
  const campus = c.req.query('campus')
  let rows
  if (campus) {
    rows = await c.env.DB.prepare('SELECT * FROM space_rooms WHERE campus = ? ORDER BY sort_order, id').bind(campus).all()
  } else {
    rows = await c.env.DB.prepare('SELECT * FROM space_rooms ORDER BY campus, sort_order, id').all()
  }
  return c.json(rows.results)
})

app.post('/api/space/rooms', async (c) => {
  const b = await c.req.json()
  if (!b.name) return c.json({ error: 'name required' }, 400)
  const r = await c.env.DB.prepare(
    'INSERT INTO space_rooms (campus, name, room_type, width_ft, length_ft, notes, sort_order) VALUES (?,?,?,?,?,?,?)'
  ).bind(b.campus || 'ramapuram', b.name, b.room_type || 'lab', b.width_ft || 40, b.length_ft || 30, b.notes || '', b.sort_order || 99).run()
  return c.json({ ok: true, id: r.meta.last_row_id })
})

app.put('/api/space/rooms/:id', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE space_rooms SET campus = COALESCE(?, campus), name = COALESCE(?, name),
     room_type = COALESCE(?, room_type), width_ft = COALESCE(?, width_ft), length_ft = COALESCE(?, length_ft),
     notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ?`
  ).bind(b.campus ?? null, b.name ?? null, b.room_type ?? null, b.width_ft ?? null, b.length_ft ?? null, b.notes ?? null, id).run()
  return c.json({ ok: true })
})

app.delete('/api/space/rooms/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM space_placements WHERE room_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM space_rooms WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

app.get('/api/space/placements', async (c) => {
  const roomId = c.req.query('room_id')
  let rows
  if (roomId) {
    rows = await c.env.DB.prepare(
      `SELECT p.*, r.name as room_name, r.width_ft as room_width, r.length_ft as room_length, r.campus
       FROM space_placements p JOIN space_rooms r ON p.room_id = r.id
       WHERE p.room_id = ? ORDER BY p.sort_order, p.id`
    ).bind(roomId).all()
  } else {
    rows = await c.env.DB.prepare(
      `SELECT p.*, r.name as room_name, r.width_ft as room_width, r.length_ft as room_length, r.campus
       FROM space_placements p JOIN space_rooms r ON p.room_id = r.id
       ORDER BY p.room_id, p.sort_order, p.id`
    ).all()
  }
  return c.json(rows.results)
})

app.post('/api/space/placements', async (c) => {
  const b = await c.req.json()
  if (!b.room_id || !b.item_name) return c.json({ error: 'room_id and item_name required' }, 400)
  const r = await c.env.DB.prepare(
    `INSERT INTO space_placements (room_id, item_name, category, footprint_ft, x_ft, y_ft, height_ft, color, status, notes, sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(b.room_id, b.item_name, b.category || 'equipment', b.footprint_ft || 4, b.x_ft || 0, b.y_ft || 0,
    b.height_ft || 4, b.color || '#6366f1', b.status || 'planned', b.notes || '', b.sort_order || 99).run()
  return c.json({ ok: true, id: r.meta.last_row_id })
})

app.put('/api/space/placements/:id', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE space_placements SET item_name = COALESCE(?, item_name), category = COALESCE(?, category),
     footprint_ft = COALESCE(?, footprint_ft), x_ft = COALESCE(?, x_ft), y_ft = COALESCE(?, y_ft),
     height_ft = COALESCE(?, height_ft), color = COALESCE(?, color), status = COALESCE(?, status),
     notes = COALESCE(?, notes) WHERE id = ?`
  ).bind(b.item_name ?? null, b.category ?? null, b.footprint_ft ?? null, b.x_ft ?? null, b.y_ft ?? null,
    b.height_ft ?? null, b.color ?? null, b.status ?? null, b.notes ?? null, id).run()
  return c.json({ ok: true })
})

app.delete('/api/space/placements/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM space_placements WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ============================================================
// EMAIL SHARING (v4) — formatted HTML snapshot via Resend
// ============================================================

function escapeHtml(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
const inr = (n: number) => '₹' + (Number(n) || 0).toLocaleString('en-IN')

async function buildEmailHtml(db: D1Database, scope: string): Promise<{ subject: string; html: string }> {
  const wrap = (title: string, body: string) => `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px;">
    <div style="background:linear-gradient(135deg,#1e1b4b,#0f172a);border-radius:16px;padding:24px 28px;margin-bottom:20px;">
      <div style="color:#818cf8;font-size:22px;font-weight:800;">SRM dROIds — CoE Mission Tracker</div>
      <div style="color:#94a3b8;font-size:13px;margin-top:4px;">${escapeHtml(title)} · generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</div>
    </div>
    ${body}
    <div style="color:#475569;font-size:11px;margin-top:24px;text-align:center;">SRM dROIds Dual-Campus Drone Centre of Excellence — automated report</div>
  </div></body></html>`
  const card = (title: string, inner: string) => `<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:18px 20px;margin-bottom:14px;">
    <div style="color:#e2e8f0;font-size:15px;font-weight:700;margin-bottom:10px;">${escapeHtml(title)}</div>${inner}</div>`
  const row = (label: string, value: string, color = '#cbd5e1') =>
    `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #1e293b;"><span style="color:#94a3b8;font-size:12px;">${escapeHtml(label)}</span><span style="color:${color};font-size:12px;font-weight:600;">${escapeHtml(value)}</span></div>`

  if (scope === 'tracker' || scope === 'report') {
    const stages = await db.prepare('SELECT * FROM setup_stages ORDER BY sort_order').all()
    const items = await db.prepare(
      `SELECT li.*, s.title as section_title, st.name as stage_name, st.sort_order as so
       FROM setup_line_items li JOIN setup_sections s ON li.section_id = s.id JOIN setup_stages st ON s.stage_id = st.id
       ORDER BY st.sort_order, s.sort_order, li.sort_order, li.id`
    ).all()
    const byStage: Record<string, any[]> = {}
    for (const it of items.results as any[]) { (byStage[it.stage_name] = byStage[it.stage_name] || []).push(it) }
    let body = ''
    let totalEst = 0, totalItems = 0, doneItems = 0
    for (const st of stages.results as any[]) {
      const list = byStage[st.name] || []
      totalItems += list.length
      doneItems += list.filter(i => i.status === 'done').length
      totalEst += list.reduce((a, i) => a + (i.estimated_cost || 0), 0)
      const rowsHtml = list.map(i =>
        `<tr><td style="padding:6px 8px;color:#e2e8f0;font-size:12px;border-bottom:1px solid #334155;">${escapeHtml(i.item_name)}<div style="color:#64748b;font-size:10px;">${escapeHtml(i.section_title)}</div></td>
         <td style="padding:6px 8px;color:#94a3b8;font-size:11px;border-bottom:1px solid #334155;">${escapeHtml(i.stakeholder || '—')}</td>
         <td style="padding:6px 8px;color:#94a3b8;font-size:11px;border-bottom:1px solid #334155;">${escapeHtml(i.priority)}</td>
         <td style="padding:6px 8px;color:#94a3b8;font-size:11px;border-bottom:1px solid #334155;text-align:right;">${inr(i.estimated_cost)}</td>
         <td style="padding:6px 8px;color:#94a3b8;font-size:11px;border-bottom:1px solid #334155;text-align:center;">${i.progress_pct}%</td>
         <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #334155;color:${i.status === 'done' ? '#34d399' : i.status === 'blocked' || i.status === 'at_risk' ? '#f87171' : '#818cf8'};">${escapeHtml(i.status.replace(/_/g, ' '))}</td></tr>`
      ).join('')
      body += card(`${st.name} (${list.filter(i => i.status === 'done').length}/${list.length} done)`,
        list.length === 0 ? '<div style="color:#64748b;font-size:12px;">No line items yet.</div>' :
        `<table style="width:100%;border-collapse:collapse;"><thead><tr style="text-align:left;">
          <th style="padding:4px 8px;color:#64748b;font-size:10px;">LINE ITEM</th><th style="padding:4px 8px;color:#64748b;font-size:10px;">OWNER</th>
          <th style="padding:4px 8px;color:#64748b;font-size:10px;">PRIORITY</th><th style="padding:4px 8px;color:#64748b;font-size:10px;text-align:right;">EST.</th>
          <th style="padding:4px 8px;color:#64748b;font-size:10px;">PROG.</th><th style="padding:4px 8px;color:#64748b;font-size:10px;">STATUS</th></tr></thead>
          <tbody>${rowsHtml}</tbody></table>`)
    }
    const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0
    body = card('Setup Summary', row('Total line items', String(totalItems)) + row('Completed', `${doneItems} (${pct}%)`, '#34d399') + row('Estimated spend', inr(totalEst), '#fbbf24')) + body
    return { subject: `CoE Foundational Setup Report — ${pct}% complete`, html: wrap('Foundational Setup Tracker — Full Report', body) }
  }

  if (scope === 'kpis') {
    const kpis = await db.prepare(
      `SELECT kpis.*, kras.title as kra_title FROM kpis JOIN kras ON kpis.kra_id = kras.id ORDER BY kras.sort_order, kpis.sort_order`
    ).all()
    const byKra: Record<string, any[]> = {}
    for (const k of kpis.results as any[]) { (byKra[k.kra_title] = byKra[k.kra_title] || []).push(k) }
    let body = ''
    let done = 0, total = 0
    for (const [kra, list] of Object.entries(byKra)) {
      total += list.length
      done += list.filter(k => k.status === 'completed').length
      body += card(kra, list.map(k =>
        row(k.title, `${k.current_value ?? 0}/${k.target_value ?? '—'} ${k.metric_unit || ''} · ${k.status}`,
          k.status === 'completed' ? '#34d399' : k.status === 'at_risk' ? '#f87171' : '#cbd5e1')).join(''))
    }
    body = card('KPI Scorecard Summary', row('KPIs completed', `${done}/${total} (${total > 0 ? Math.round(done / total * 100) : 0}%)`, '#34d399')) + body
    return { subject: `CoE KPI Scorecard — ${done}/${total} completed`, html: wrap('KPI Scorecard Report', body) }
  }

  if (scope === 'procurement') {
    const items = await db.prepare('SELECT * FROM procurement_items ORDER BY spend_bucket, category, item_name').all()
    const labels: Record<number, string> = { 1: 'Must-Have Now', 2: 'Buy Once Growth Proven', 3: 'Rent/Partner First' }
    let total = 0
    const rowsHtml = (items.results as any[]).map(i => {
      total += i.estimated_cost || 0
      return `<tr><td style="padding:6px 8px;color:#e2e8f0;font-size:12px;border-bottom:1px solid #334155;">${escapeHtml(i.item_name)}</td>
        <td style="padding:6px 8px;color:#94a3b8;font-size:11px;border-bottom:1px solid #334155;">${escapeHtml(labels[i.spend_bucket] || 'Bucket ' + i.spend_bucket)}</td>
        <td style="padding:6px 8px;color:#94a3b8;font-size:11px;border-bottom:1px solid #334155;text-align:right;">${inr(i.estimated_cost)}</td>
        <td style="padding:6px 8px;color:#818cf8;font-size:11px;border-bottom:1px solid #334155;">${escapeHtml(i.status)}</td></tr>`
    }).join('')
    const body = card(`Procurement Strategy — Total Est. ${inr(total)}`,
      `<table style="width:100%;border-collapse:collapse;"><thead><tr style="text-align:left;">
       <th style="padding:4px 8px;color:#64748b;font-size:10px;">ITEM</th><th style="padding:4px 8px;color:#64748b;font-size:10px;">BUCKET</th>
       <th style="padding:4px 8px;color:#64748b;font-size:10px;text-align:right;">EST.</th><th style="padding:4px 8px;color:#64748b;font-size:10px;">STATUS</th></tr></thead>
       <tbody>${rowsHtml}</tbody></table>`)
    return { subject: `CoE Procurement Report — Est. ${inr(total)}`, html: wrap('Procurement Strategy Report', body) }
  }

  return { subject: 'CoE Report', html: wrap('CoE Report', card('Info', '<div style="color:#94a3b8;font-size:12px;">Unknown scope.</div>')) }
}

// Preview the formatted email (same HTML that would be sent)
app.get('/api/email/preview', async (c) => {
  const scope = c.req.query('scope') || 'report'
  const { html } = await buildEmailHtml(c.env.DB, scope)
  return new Response(html, { headers: { 'Content-Type': 'text/html' } })
})

// Send the formatted email via Resend
app.post('/api/email/send', async (c) => {
  const { to, scope, api_key, note } = await c.req.json()
  if (!to || !Array.isArray(to) || to.length === 0) return c.json({ error: 'Recipient email list required' }, 400)
  if (!api_key) return c.json({ error: 'Resend API key required (starts with re_)' }, 400)
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const valid = to.filter((t: string) => emailRe.test(String(t).trim()))
  if (valid.length === 0) return c.json({ error: 'No valid email addresses provided' }, 400)

  const { subject, html } = await buildEmailHtml(c.env.DB, scope || 'report')
  const noteHtml = note ? `<div style="background:#312e81;border:1px solid #4f46e5;border-radius:12px;padding:14px 16px;margin-bottom:14px;color:#c7d2fe;font-size:13px;"><strong>Note from sender:</strong> ${escapeHtml(note)}</div>` : ''
  // Splice the note just before the first data card of the email body
  const bodyHtml = note ? html.replace(/(<\/div>\s*)\n?\s*(<div style="background:#1e293b)/, `$1${noteHtml}$2`) : html

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
      body: JSON.stringify({
        from: 'SRM dROIds CoE <onboarding@resend.dev>',
        to: valid,
        subject,
        html: bodyHtml
      })
    })
    const data: any = await resp.json()
    if (!resp.ok) return c.json({ error: `Resend error: ${data.message || resp.status}` }, 502)
    return c.json({ ok: true, id: data.id, sent_to: valid })
  } catch (e: any) {
    return c.json({ error: `Email send failed: ${e.message}` }, 500)
  }
})

// ============================================================
// EXPORT / DOWNLOAD
// ============================================================
app.get('/api/export/csv/:type', async (c) => {
  const type = c.req.param('type')
  let rows: any[] = []
  let headers: string[] = []

  switch (type) {
    case 'kpis': {
      const r = await c.env.DB.prepare(
        'SELECT kpis.*, kras.title as kra_title FROM kpis JOIN kras ON kpis.kra_id = kras.id ORDER BY kras.sort_order, kpis.sort_order'
      ).all()
      rows = r.results as any[]
      headers = ['id', 'kra_title', 'title', 'metric_unit', 'target_value', 'current_value', 'status', 'description']
      break
    }
    case 'cohorts': {
      const r = await c.env.DB.prepare('SELECT * FROM cohorts').all()
      rows = r.results as any[]
      headers = ['id', 'name', 'stage', 'campus', 'student_count', 'start_date', 'end_date', 'status']
      break
    }
    case 'procurement': {
      const r = await c.env.DB.prepare('SELECT * FROM procurement_items ORDER BY spend_bucket, category').all()
      rows = r.results as any[]
      headers = ['id', 'category', 'item_name', 'campus_priority', 'spend_bucket', 'status', 'estimated_cost', 'actual_cost', 'vendor']
      break
    }
    case 'reports': {
      const r = await c.env.DB.prepare('SELECT * FROM reports ORDER BY created_at DESC').all()
      rows = r.results as any[]
      headers = ['id', 'title', 'report_type', 'content', 'generated_by', 'share_token', 'is_shared', 'created_at']
      break
    }
    default:
      return c.json({ error: 'Unknown export type' }, 400)
  }

  const csv = [headers.join(','), ...rows.map(row => headers.map(h => {
    const v = String(row[h] ?? '').replace(/"/g, '""')
    return `"${v}"`
  }).join(','))].join('\n')

  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${type}_export.csv"` }
  })
})

// ============================================================
// SERVE SPA
// ============================================================
app.use('/static/*', serveStatic({ root: './public' }))

app.get('/', (c) => {
  return c.html(SPA_HTML)
})

app.get('/login', (c) => {
  return c.html(SPA_HTML)
})

app.get('/share/:token', (c) => {
  return c.html(SPA_HTML)
})

// Catch-all for SPA routing
app.get('/*', (c) => {
  return c.html(SPA_HTML)
})

export default app

// ============================================================
// FULL SPA HTML — Single Page Application
// ============================================================
const SPA_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SRM dROIds — CoE Mission Tracker</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.2/dist/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
  <link href="/static/styles.css" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: { 50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',800:'#3730a3',900:'#312e81' },
            drone: { 50:'#f0f9ff',100:'#e0f2fe',200:'#bae6fd',300:'#7dd3fc',400:'#38bdf8',500:'#0ea5e9',600:'#0284c7',700:'#0369a1',800:'#075985',900:'#0c4a6e' }
          }
        }
      }
    }
  </script>
  <style id="srm-inline-hero">
    .hero-bg { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 30%, #0f172a 60%, #0c1929 100%); }
    .hero-bg::before {
      content: ''; position: fixed; inset: 0; z-index: 0; opacity: 0.12;
      background: radial-gradient(ellipse 80% 50% at 50% -10%, #6366f1, transparent),
                  radial-gradient(ellipse 60% 40% at 80% 80%, #06b6d4, transparent),
                  radial-gradient(ellipse 50% 60% at 20% 50%, #8b5cf6, transparent);
      pointer-events: none;
    }
    .glass-card {
      background: rgba(15,23,42,0.75); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(148,163,184,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    .glass-card:hover { border-color: rgba(99,102,241,0.3); box-shadow: 0 12px 40px rgba(99,102,241,0.15); }
    .glow-text { text-shadow: 0 0 20px rgba(99,102,241,0.5), 0 0 40px rgba(99,102,241,0.2); }
    .drone-hero-overlay {
      position: fixed; inset: 0; z-index: 0; opacity: 0.08; pointer-events: none;
      background-image: url('https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=1920&q=80');
      background-size: cover; background-position: center;
    }
    .grid-pattern { background-image: radial-gradient(rgba(99,102,241,0.1) 1px, transparent 1px); background-size: 30px 30px; }
    /* body carries BOTH classes — layer the dots over the gradient (first image wins) */
    body.hero-bg.grid-pattern {
      background-image: radial-gradient(rgba(99,102,241,0.1) 1px, transparent 1px),
                        linear-gradient(135deg, #0f172a 0%, #1e1b4b 30%, #0f172a 60%, #0c1929 100%);
      background-size: 30px 30px, cover;
      background-attachment: fixed;
    }
    .status-pending_review { background: rgba(251,191,36,0.2); color: #fbbf24; }
    .status-approved { background: rgba(52,211,153,0.2); color: #34d399; }
    .status-rejected { background: rgba(248,113,113,0.2); color: #f87171; }
    .btn-glow { box-shadow: 0 0 20px rgba(99,102,241,0.3); }
    .btn-glow:hover { box-shadow: 0 0 30px rgba(99,102,241,0.5), 0 0 60px rgba(99,102,241,0.15); }
    .toast { animation: slideIn 0.4s ease, slideOut 0.4s ease 3s forwards; }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
    @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    .float-anim { animation: float 4s ease-in-out infinite; }

    /* ── DAY / NIGHT THEME ── default is night; body.day-mode flips to light ── */
    body { transition: background-color 0.3s ease, color 0.3s ease; }
    body.day-mode.hero-bg, body.day-mode .hero-bg { background: linear-gradient(135deg, #f1f5f9 0%, #e0e7ff 30%, #f8fafc 60%, #ecfeff 100%); }
    body.day-mode.hero-bg::before { opacity: 0.14;
      background: radial-gradient(ellipse 80% 50% at 50% -10%, #818cf8, transparent),
                  radial-gradient(ellipse 60% 40% at 80% 80%, #22d3ee, transparent),
                  radial-gradient(ellipse 50% 60% at 20% 50%, #a78bfa, transparent);
    }
    body.day-mode { color: #1e293b !important; }
    body.day-mode.grid-pattern { background-image: radial-gradient(rgba(79,70,229,0.12) 1px, transparent 1px); }
    /* day-mode combined rule — dots layered over the light gradient */
    body.day-mode.hero-bg.grid-pattern {
      background-image: radial-gradient(rgba(79,70,229,0.12) 1px, transparent 1px),
                        linear-gradient(135deg, #f1f5f9 0%, #e0e7ff 30%, #f8fafc 60%, #ecfeff 100%) !important;
      background-size: 30px 30px, cover !important;
      background-attachment: fixed !important;
    }
    body.day-mode .drone-hero-overlay { opacity: 0.05; }
    body.day-mode .glass-card {
      background: rgba(255,255,255,0.82); border: 1px solid rgba(15,23,42,0.08);
      box-shadow: 0 8px 32px rgba(15,23,42,0.08);
    }
    body.day-mode .glass-card:hover { border-color: rgba(79,70,229,0.35); box-shadow: 0 12px 40px rgba(79,70,229,0.15); }
    body.day-mode .glow-text { text-shadow: 0 0 20px rgba(79,70,229,0.25); }
    /* Tailwind dark-palette overrides for day mode */
    body.day-mode .text-slate-100, body.day-mode .text-slate-200 { color: #0f172a !important; }
    body.day-mode .text-slate-300 { color: #1e293b !important; }
    body.day-mode .text-slate-400 { color: #475569 !important; }
    body.day-mode .text-slate-500 { color: #64748b !important; }
    body.day-mode .text-slate-600 { color: #94a3b8 !important; }
    body.day-mode .bg-slate-900\\/60, body.day-mode .bg-slate-900 { background-color: rgba(241,245,249,0.9) !important; }
    body.day-mode .bg-slate-800\\/60, body.day-mode .bg-slate-800\\/50, body.day-mode .bg-slate-800 { background-color: rgba(226,232,240,0.85) !important; }
    body.day-mode .bg-slate-700\\/50, body.day-mode .bg-slate-700\\/30, body.day-mode .bg-slate-700 { background-color: rgba(203,213,225,0.6) !important; }
    body.day-mode .border-slate-800, body.day-mode .border-slate-700\\/50, body.day-mode .border-slate-700\\/30,
    body.day-mode .border-slate-700, body.day-mode .border-slate-600 { border-color: rgba(15,23,42,0.12) !important; }
    body.day-mode .hover\\:bg-slate-800\\/50:hover, body.day-mode .hover\\:bg-slate-700:hover, body.day-mode .hover\\:bg-slate-600:hover { background-color: rgba(203,213,225,0.8) !important; }
    body.day-mode .hover\\:text-slate-300:hover, body.day-mode .hover\\:text-slate-200:hover { color: #0f172a !important; }
    body.day-mode input, body.day-mode textarea, body.day-mode select { color: #0f172a !important; }
    body.day-mode input::placeholder, body.day-mode textarea::placeholder { color: #94a3b8 !important; }
    body.day-mode #theme-toggle .theme-icon-moon { display: none; }
    body:not(.day-mode) #theme-toggle .theme-icon-sun { display: none; }
  </style>
</head>
<body class="hero-bg grid-pattern text-slate-100 min-h-screen font-sans antialiased">
  <div class="drone-hero-overlay"></div>
  <div id="app-root" class="relative z-10"></div>
  <div id="toast-container" class="fixed top-4 right-4 z-50 space-y-2"></div>
  <script src="/static/app.js"></script>
</body>
</html>`
