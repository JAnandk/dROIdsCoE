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
            brand: { 50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',800:'#3730a3',900:'#312e81' }
          }
        }
      }
    }
  </script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans antialiased">
  <div id="app-root"></div>
  <script src="/static/app.js"></script>
</body>
</html>`
