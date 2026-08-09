// ============================================================================
// SRM dROIds — CoE Mission Tracker — Full SPA
// ============================================================================
(function () {
  'use strict'

  let state = {
    role: null, // 'coe_leader' | 'venture_owner'
    passcode: null,
    activeView: 'dashboard',
    llmApiKey: null,
    charts: {},
    threeScene: null,
    facilityCampus: 'ramapuram'
  }

  const API = axios.create({ baseURL: '/api' })
  const $ = (s) => document.querySelector(s)
  const $$ = (s) => document.querySelectorAll(s)
  const root = $('#app-root')

  // ============================================================
  // INIT
  // ============================================================
  async function init() {
    const hash = window.location.hash
    if (hash.startsWith('#share/')) {
      const token = hash.replace('#share/', '')
      return renderSharedView(token)
    }
    renderLogin()
  }

  // ============================================================
  // LOGIN SCREEN
  // ============================================================
  function renderLogin() {
    root.innerHTML = `
      <main class="min-h-screen flex items-center justify-center p-6">
        <section class="w-full max-w-md">
          <header class="text-center mb-10">
            <div class="text-6xl mb-4">🛸</div>
            <h1 class="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              SRM dROIds
            </h1>
            <p class="text-slate-400 mt-2">CoE Mission Tracker &mdash; Dual-Campus Drone Innovation</p>
          </header>
          <form id="login-form" class="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
            <div id="login-error" class="hidden bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm"></div>
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-2">Access Passcode</label>
              <input id="passcode-input" type="password" placeholder="Enter your passcode..."
                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" autofocus>
            </div>
            <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2">
              <i class="fas fa-lock-open"></i> Enter Mission Control
            </button>
            <p class="text-xs text-slate-600 text-center mt-4">
              CoE Leader: <code class="bg-slate-800 px-1.5 py-0.5 rounded">dROIds2026!</code> &nbsp;|&nbsp;
              Venture Owner: <code class="bg-slate-800 px-1.5 py-0.5 rounded">VentureSRM!26</code>
            </p>
          </form>
        </section>
      </main>`

    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const code = $('#passcode-input').value.trim()
      if (!code) return
      try {
        const { data } = await API.post('/auth', { passcode: code })
        if (data.ok) {
          state.role = data.role
          state.passcode = code
          renderApp()
        } else {
          showLoginError('Invalid passcode. Please try again.')
        }
      } catch {
        showLoginError('Invalid passcode. Please try again.')
      }
    })
  }

  function showLoginError(msg) {
    const el = $('#login-error')
    el.textContent = msg
    el.classList.remove('hidden')
    gsap.from(el, { x: -10, opacity: 0, duration: 0.3 })
  }

  // ============================================================
  // MAIN APP SHELL
  // ============================================================
  function renderApp() {
    const isVenture = state.role === 'venture_owner'
    root.innerHTML = `
      <nav id="main-nav" class="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div class="flex items-center gap-3">
            <span class="text-2xl">🛸</span>
            <span class="font-bold text-lg hidden sm:inline bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">SRM dROIds</span>
            <span class="text-xs px-2 py-0.5 rounded-full ${isVenture ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}">
              ${isVenture ? 'Venture Owner' : 'CoE Director'}
            </span>
          </div>
          <div class="flex items-center gap-1 sm:gap-2" id="nav-tabs"></div>
          <button id="logout-btn" class="text-slate-500 hover:text-slate-300 px-3 py-2 rounded-lg hover:bg-slate-800 transition text-sm">
            <i class="fas fa-sign-out-alt"></i> <span class="hidden sm:inline ml-1">Exit</span>
          </button>
        </div>
      </nav>
      <main id="main-content" class="max-w-7xl mx-auto px-4 sm:px-6 py-6"></main>`

    // Build nav tabs
    const tabs = isVenture
      ? [
          { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
          { id: 'procurement', icon: 'fa-truck', label: 'Procurement' },
          { id: 'partners', icon: 'fa-handshake', label: 'Partners' },
          { id: 'reports', icon: 'fa-file-alt', label: 'Reports' },
          { id: 'llm', icon: 'fa-robot', label: 'GenAI' },
          { id: 'admin', icon: 'fa-cog', label: 'Admin' }
        ]
      : [
          { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
          { id: 'cohorts', icon: 'fa-users', label: 'Cohorts' },
          { id: 'facility', icon: 'fa-cube', label: 'Facility' },
          { id: 'reports', icon: 'fa-file-alt', label: 'Reports' },
          { id: 'roadmap', icon: 'fa-road', label: 'Roadmap' }
        ]

    const navTabs = $('#nav-tabs')
    tabs.forEach(t => {
      const btn = document.createElement('button')
      btn.className = `nav-tab px-3 py-2 rounded-lg text-sm font-medium transition ${t.id === state.activeView ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`
      btn.innerHTML = `<i class="fas ${t.icon} mr-1"></i> <span class="hidden sm:inline">${t.label}</span>`
      btn.dataset.view = t.id
      navTabs.appendChild(btn)
    })

    document.addEventListener('click', (e) => {
      const tab = e.target.closest('.nav-tab')
      if (tab) { state.activeView = tab.dataset.view; navigateView() }
    })

    $('#logout-btn').addEventListener('click', () => {
      state.role = null; state.passcode = null; state.activeView = 'dashboard'; renderLogin()
    })

    navigateView()
  }

  function navigateView() {
    // Update nav tab active state
    $$('.nav-tab').forEach(b => {
      const isActive = b.dataset.view === state.activeView
      b.className = `nav-tab px-3 py-2 rounded-lg text-sm font-medium transition ${isActive ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`
    })

    const content = $('#main-content')
    content.innerHTML = '<div class="flex justify-center py-20"><i class="fas fa-spinner animate-spin text-2xl text-indigo-400"></i></div>'

    switch (state.activeView) {
      case 'dashboard': renderDashboard(); break
      case 'cohorts': renderCohorts(); break
      case 'facility': renderFacilityView(); break
      case 'reports': renderReportsView(); break
      case 'roadmap': renderRoadmap(); break
      case 'procurement': renderProcurement(); break
      case 'partners': renderPartners(); break
      case 'llm': renderLLMView(); break
      case 'admin': renderAdminView(); break
      default: renderDashboard()
    }
  }

  // ============================================================
  // DASHBOARD — KRAs & KPIs
  // ============================================================
  async function renderDashboard() {
    const content = $('#main-content')
    try {
      const { data: scorecard } = await API.get('/kpis/scorecard')
      const { data: daily } = await API.get('/reports/daily')
      const { data: roadmap } = await API.get('/roadmap')

      const overallColor = scorecard.overall_pct >= 70 ? 'text-emerald-400' : scorecard.overall_pct >= 40 ? 'text-amber-400' : 'text-red-400'

      content.innerHTML = `
        <section class="space-y-6">
          <!-- OVERALL SCORE -->
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xl font-bold">KPI Scorecard</h2>
                <p class="text-slate-400 text-sm">${state.role === 'venture_owner' ? 'CoE Director KRA Performance' : 'Your KRA Performance'}</p>
              </div>
              <div class="text-right">
                <div class="text-4xl font-bold ${overallColor}">${scorecard.overall_pct}%</div>
                <div class="text-xs text-slate-500">${scorecard.completed_kpis}/${scorecard.total_kpis} KPIs completed</div>
              </div>
            </div>
            <div class="mt-4 bg-slate-800 rounded-full h-3 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-1000" style="width:${scorecard.overall_pct}%"></div>
            </div>
          </div>

          <!-- KRA CARDS GRID -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="kra-grid"></div>

          <!-- CHARTS ROW -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 class="text-lg font-semibold mb-4"><i class="fas fa-chart-bar text-indigo-400 mr-2"></i>KPI Status Distribution</h3>
              <canvas id="kpi-status-chart" height="200"></canvas>
            </div>
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 class="text-lg font-semibold mb-4"><i class="fas fa-chart-line text-cyan-400 mr-2"></i>Roadmap Progress</h3>
              <canvas id="roadmap-chart" height="200"></canvas>
            </div>
          </div>

          <!-- LATEST DAILY UPDATE -->
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 class="text-lg font-semibold mb-3"><i class="fas fa-clipboard-list text-amber-400 mr-2"></i>Latest Daily Update</h3>
            ${daily.length > 0 ? `
              <div class="space-y-2 text-sm" id="latest-daily">
                <p><span class="text-slate-500">Date:</span> ${daily[0].report_date}</p>
                <p><span class="text-slate-500">Attendance:</span> ${daily[0].cohort_attendance || '—'}</p>
                <p><span class="text-slate-500">Decisions Needed:</span> ${daily[0].decisions_needed || 'None'}</p>
              </div>
            ` : '<p class="text-slate-500 text-sm">No daily updates yet.</p>'}
          </div>
        </section>`

      renderKRAGrid(scorecard.kras)
      renderKPIStatusChart(scorecard.kras)
      renderRoadmapChart(roadmap)

      // Animate
      gsap.from('#kra-grid > div', { y: 30, opacity: 0, duration: 0.5, stagger: 0.08 })
    } catch (e) {
      content.innerHTML = errorHtml('dashboard', e)
    }
  }

  function renderKRAGrid(kras) {
    const grid = $('#kra-grid')
    if (!grid) return
    kras.forEach(kra => {
      const color = kra.completion >= 70 ? 'emerald' : kra.completion >= 40 ? 'amber' : 'red'
      const card = document.createElement('div')
      card.className = 'bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition cursor-pointer'
      card.innerHTML = `
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-semibold text-sm">${kra.title}</h4>
          <span class="text-xs px-2 py-0.5 rounded-full bg-${color}-500/20 text-${color}-400">${kra.completion}%</span>
        </div>
        <p class="text-xs text-slate-500 mb-3">${kra.description || ''}</p>
        <div class="bg-slate-800 rounded-full h-1.5 overflow-hidden mb-3">
          <div class="h-full bg-${color}-500 rounded-full transition-all duration-700" style="width:${kra.completion}%"></div>
        </div>
        <div class="space-y-1.5" id="kpi-list-${kra.id}"></div>
        <div class="mt-3 text-xs text-slate-600">${kra.completed}/${kra.total} KPIs &middot; Weight: ${kra.weight}</div>`

      grid.appendChild(card)

      const list = card.querySelector(`#kpi-list-${kra.id}`)
      kra.kpis.forEach(kpi => {
        const statusColors = { completed: 'text-emerald-400', on_track: 'text-blue-400', in_progress: 'text-amber-400', at_risk: 'text-red-400', pending: 'text-slate-600' }
        const statusIcons = { completed: 'fa-check-circle', on_track: 'fa-arrow-trend-up', in_progress: 'fa-spinner', at_risk: 'fa-exclamation-triangle', pending: 'fa-circle' }
        const row = document.createElement('div')
        row.className = 'flex items-center justify-between text-xs'
        row.innerHTML = `<span class="text-slate-300 truncate mr-2">${kpi.title}</span>
          <span class="${statusColors[kpi.status] || 'text-slate-500'} flex items-center gap-1 shrink-0">
            <i class="fas ${statusIcons[kpi.status] || 'fa-circle'}"></i>
            ${kpi.current_value ?? 0}/${kpi.target_value ?? '—'} ${kpi.metric_unit || ''}
          </span>`
        list.appendChild(row)
      })

      // Click to edit KPI
      card.addEventListener('click', () => openKPIEditor(kra))
    })
  }

  async function openKPIEditor(kra) {
    const kpiRows = kra.kpis.map(k => `
      <div class="bg-slate-800 rounded-lg p-3 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">${k.title}</span>
          <select onchange="window._updateKPIStatus(${k.id}, this.value)" class="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs">
            <option value="pending" ${k.status==='pending'?'selected':''}>Pending</option>
            <option value="in_progress" ${k.status==='in_progress'?'selected':''}>In Progress</option>
            <option value="on_track" ${k.status==='on_track'?'selected':''}>On Track</option>
            <option value="at_risk" ${k.status==='at_risk'?'selected':''}>At Risk</option>
            <option value="completed" ${k.status==='completed'?'selected':''}>Completed</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <input id="kpi-val-${k.id}" type="number" value="${k.current_value || 0}" class="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs w-20">
          <span class="text-xs text-slate-500">/ ${k.target_value} ${k.metric_unit || ''}</span>
          <button onclick="window._saveKPI(${k.id})" class="ml-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1 rounded transition">Save</button>
        </div>
      </div>`).join('')

    showModal(`
      <div class="text-left">
        <h3 class="text-lg font-bold mb-1">${kra.title}</h3>
        <p class="text-sm text-slate-400 mb-4">${kra.description || ''}</p>
        <div class="space-y-2 max-h-96 overflow-y-auto">${kpiRows}</div>
      </div>`)

    window._updateKPIStatus = async (id, status) => {
      await API.put(`/kpis/${id}`, { status, current_value: 0 })
    }
    window._saveKPI = async (id) => {
      const val = document.getElementById(`kpi-val-${id}`)?.value
      await API.put(`/kpis/${id}`, { current_value: parseFloat(val) || 0, status: null })
      closeModal()
      state.activeView = 'dashboard'; navigateView()
    }
  }

  function renderKPIStatusChart(kras) {
    const ctx = document.getElementById('kpi-status-chart')
    if (!ctx) return
    const counts = { completed: 0, on_track: 0, in_progress: 0, at_risk: 0, pending: 0 }
    kras.forEach(k => k.kpis.forEach(kpi => { if (counts[kpi.status] !== undefined) counts[kpi.status]++ }))
    if (state.charts.kpiStatus) state.charts.kpiStatus.destroy()
    state.charts.kpiStatus = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'On Track', 'In Progress', 'At Risk', 'Pending'],
        datasets: [{ data: [counts.completed, counts.on_track, counts.in_progress, counts.at_risk, counts.pending], backgroundColor: ['#34d399','#60a5fa','#fbbf24','#f87171','#475569'], borderColor: '#1e293b', borderWidth: 2 }]
      },
      options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8', padding: 16, font: { size: 11 } } } } }
    })
  }

  function renderRoadmapChart(roadmap) {
    const ctx = document.getElementById('roadmap-chart')
    if (!ctx) return
    const labels = roadmap.map(r => r.month_range)
    const data = roadmap.map(r => {
      try { const tasks = JSON.parse(r.tasks); const done = r.status === 'completed' ? tasks.length : r.status === 'in_progress' ? Math.floor(tasks.length * 0.5) : 0; return { total: tasks.length, done } }
      catch { return { total: 5, done: r.status === 'completed' ? 5 : r.status === 'in_progress' ? 2 : 0 } }
    })
    if (state.charts.roadmap) state.charts.roadmap.destroy()
    state.charts.roadmap = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Completed Tasks', data: data.map(d => d.done), backgroundColor: '#818cf8', borderRadius: 4 },
          { label: 'Remaining', data: data.map(d => d.total - d.done), backgroundColor: '#334155', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, indexAxis: 'y', stacked: true,
        scales: { x: { stacked: true, grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }, y: { stacked: true, ticks: { color: '#94a3b8' } } },
        plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } }
      }
    })
  }

  // ============================================================
  // COHORTS VIEW (CoE Leader)
  // ============================================================
  async function renderCohorts() {
    const content = $('#main-content')
    try {
      const { data: cohorts } = await API.get('/cohorts')
      const { data: students } = await API.get('/students')

      content.innerHTML = `
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <div><h2 class="text-xl font-bold">Cohort Pipeline</h2><p class="text-sm text-slate-400">Student progression through Stages A→E</p></div>
            <button id="add-cohort-btn" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"><i class="fas fa-plus mr-1"></i> New Cohort</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-5 gap-3" id="stage-columns">
            ${['A','B','C','D','E'].map(stage => {
              const stageLabels = { A: 'Foundation', B: 'Build', C: 'Field/Immersion', D: 'R&D/Projects', E: 'Service/Placement' }
              const stageColors = { A: 'border-indigo-500', B: 'border-blue-500', C: 'border-cyan-500', D: 'border-amber-500', E: 'border-emerald-500' }
              const stageStudents = students.filter(s => s.current_stage === stage)
              return `<div class="bg-slate-900 border-t-2 ${stageColors[stage]} rounded-xl p-4" id="stage-${stage}">
                <h3 class="font-bold text-sm mb-1">Stage ${stage}</h3>
                <p class="text-xs text-slate-500 mb-3">${stageLabels[stage]}</p>
                <div class="space-y-1.5" id="stage-list-${stage}">${stageStudents.map(s => `
                  <div class="bg-slate-800 rounded-lg px-3 py-2 text-xs flex items-center justify-between" data-student-id="${s.id}">
                    <span>${s.name}</span>
                    <div class="w-12 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div class="h-full bg-indigo-500 rounded-full" style="width:${s.progress_pct}%"></div>
                    </div>
                  </div>`).join('')}
                  ${stageStudents.length === 0 ? '<p class="text-xs text-slate-600 italic">No students</p>' : ''}
                </div>
              </div>`
            }).join('')}
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6" id="cohorts-table-section"></div>
        </div>`

      // Cohort list table
      let cohortHTML = `<h3 class="font-semibold mb-3">All Cohorts</h3>
        <div class="overflow-x-auto"><table class="w-full text-sm">
          <thead><tr class="text-slate-500 text-left"><th class="p-2">Name</th><th class="p-2">Stage</th><th class="p-2">Campus</th><th class="p-2">Students</th><th class="p-2">Dates</th><th class="p-2">Status</th></tr></thead>
          <tbody>${cohorts.map(c => `<tr class="border-t border-slate-800 hover:bg-slate-800/50 transition">
            <td class="p-2 font-medium">${c.name}</td><td class="p-2"><span class="px-2 py-0.5 rounded text-xs bg-indigo-500/20 text-indigo-400">Stage ${c.stage}</span></td>
            <td class="p-2 text-slate-400">${c.campus}</td><td class="p-2">${c.student_count}</td>
            <td class="p-2 text-xs text-slate-500">${c.start_date || '—'} → ${c.end_date || '—'}</td>
            <td class="p-2"><span class="status-badge status-${c.status}">${c.status}</span></td>
          </tr>`).join('')}</tbody></table></div>`
      $('#cohorts-table-section').innerHTML = cohortHTML

      // Add cohort button
      $('#add-cohort-btn').addEventListener('click', () => openCohortForm())

      // Stage pipeline animation
      gsap.from('#stage-columns > div', { y: 40, opacity: 0, duration: 0.6, stagger: 0.1 })
    } catch (e) {
      content.innerHTML = errorHtml('cohorts', e)
    }
  }

  function openCohortForm(editData = null) {
    const d = editData || {}
    showModal(`
      <form id="cohort-form" class="space-y-4 text-left">
        <h3 class="text-lg font-bold">${editData ? 'Edit' : 'New'} Cohort</h3>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-400">Name</label><input name="name" value="${d.name || ''}" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1"></div>
          <div><label class="text-xs text-slate-400">Stage</label><select name="stage" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1">${['A','B','C','D','E'].map(s => `<option value="${s}" ${d.stage===s?'selected':''}>Stage ${s}</option>`).join('')}</select></div>
          <div><label class="text-xs text-slate-400">Campus</label><select name="campus" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1">${['ramapuram','trichy','both'].map(c => `<option value="${c}" ${d.campus===c?'selected':''}>${c}</option>`).join('')}</select></div>
          <div><label class="text-xs text-slate-400">Students</label><input name="student_count" type="number" value="${d.student_count || 20}" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1"></div>
          <div><label class="text-xs text-slate-400">Start</label><input name="start_date" type="date" value="${d.start_date || ''}" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1"></div>
          <div><label class="text-xs text-slate-400">End</label><input name="end_date" type="date" value="${d.end_date || ''}" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1"></div>
          <div><label class="text-xs text-slate-400">Status</label><select name="status" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1">${['planned','active','completed','paused'].map(s => `<option value="${s}" ${d.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
        </div>
        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-medium transition">Save Cohort</button>
      </form>`)

    $('#cohort-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const payload = Object.fromEntries(fd.entries())
      payload.student_count = parseInt(payload.student_count)
      if (editData.id) await API.put(`/cohorts/${editData.id}`, payload)
      else await API.post('/cohorts', payload)
      closeModal()
      state.activeView = 'cohorts'; navigateView()
    })
  }

  // ============================================================
  // FACILITY 3D VIEW (CoE Leader)
  // ============================================================
  async function renderFacilityView() {
    const content = $('#main-content')
    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div><h2 class="text-xl font-bold">Facility Layout</h2><p class="text-sm text-slate-400">3D Warehouse & Lab Layout</p></div>
          <div class="flex gap-2">
            <button id="fac-ramapuram" class="campus-toggle px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white">Ramapuram</button>
            <button id="fac-trichy" class="campus-toggle px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-400 hover:bg-slate-700">Trichy</button>
          </div>
        </div>
        <div id="three-container" class="bg-slate-900 border border-slate-800 rounded-2xl" style="height:500px;"></div>
        <div id="facility-legend" class="grid grid-cols-2 sm:grid-cols-4 gap-3"></div>
      </div>`

    document.getElementById('fac-ramapuram').addEventListener('click', () => { state.facilityCampus = 'ramapuram'; initThreeJS() })
    document.getElementById('fac-trichy').addEventListener('click', () => { state.facilityCampus = 'trichy'; initThreeJS() })
    updateCampusToggles()
    initThreeJS()
  }

  function updateCampusToggles() {
    const r = $('#fac-ramapuram'), t = $('#fac-trichy')
    if (!r || !t) return
    if (state.facilityCampus === 'ramapuram') { r.className = 'campus-toggle px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white'; t.className = 'campus-toggle px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-400 hover:bg-slate-700' }
    else { t.className = 'campus-toggle px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white'; r.className = 'campus-toggle px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-400 hover:bg-slate-700' }
  }

  async function initThreeJS() {
    const container = $('#three-container')
    if (!container) return
    container.innerHTML = ''

    const W = container.clientWidth, H = container.clientHeight
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f172a)
    scene.fog = new THREE.Fog(0x0f172a, 300, 700)

    const camera = new THREE.PerspectiveCamera(50, W / H, 10, 1000)
    camera.position.set(200, 180, 250)
    camera.lookAt(150, 0, 100)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    // Lights
    const ambient = new THREE.AmbientLight(0x404060, 1.5)
    scene.add(ambient)
    const dir = new THREE.DirectionalLight(0xffffff, 2)
    dir.position.set(100, 200, 100)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.camera.left = -300; dir.shadow.camera.right = 300
    dir.shadow.camera.top = 300; dir.shadow.camera.bottom = -300
    scene.add(dir)

    // Grid floor
    const grid = new THREE.GridHelper(400, 40, 0x1e293b, 0x0f172a)
    scene.add(grid)

    const { data: facilities } = await API.get(`/facilities?campus=${state.facilityCampus}`)

    const zoneColors = {
      showcase: 0x6366f1, learning: 0x3b82f6, workshop: 0x10b981,
      simulation: 0xf59e0b, fabrication: 0xec4899, storage: 0x6b7280,
      review: 0x8b5cf6, planning: 0x06b6d4, equipment: 0xef4444,
      flight_ops: 0xf97316, safety: 0xdc2626, data: 0x14b8a6
    }

    const labelCache = []
    facilities.forEach(f => {
      const color = zoneColors[f.zone_type] || 0x6366f1
      const geo = new THREE.BoxGeometry(f.width * 0.7, 25, f.height * 0.7)
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2, transparent: true, opacity: 0.85 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(f.x_position + f.width * 0.35, 12.5, f.y_position + f.height * 0.35)
      mesh.castShadow = true; mesh.receiveShadow = true
      mesh.userData = { facility: f }
      scene.add(mesh)

      // Edge highlight
      const edgeGeo = new THREE.EdgesGeometry(geo)
      const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })
      const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat)
      edgeLine.position.copy(mesh.position)
      scene.add(edgeLine)

      labelCache.push({ x: mesh.position.x, z: mesh.position.z, name: f.name, status: f.status, zoneType: f.zone_type })
    })

    // Legend
    const legend = $('#facility-legend')
    if (legend) {
      legend.innerHTML = labelCache.map(l => `
        <div class="bg-slate-800 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
          <span class="w-3 h-3 rounded-sm" style="background:#${zoneColors[l.zoneType]?.toString(16).padStart(6,'0') || '6366f1'}"></span>
          <span class="truncate">${l.name}</span>
          <span class="ml-auto status-badge status-${l.status}">${l.status}</span>
        </div>`).join('')
    }

    // Raycaster for hover
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    container.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / W) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / H) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(scene.children.filter(c => c.isMesh))
      scene.children.forEach(c => { if (c.isMesh && c.material.emissive) c.material.emissive.set(0x000000) })
      if (intersects.length > 0) {
        const obj = intersects[0].object
        if (obj.material.emissive) obj.material.emissive.set(0x333333)
        container.style.cursor = 'pointer'
      } else {
        container.style.cursor = 'grab'
      }
    })

    // Orbit controls (simple)
    let isDragging = false, prevX = 0, prevY = 0
    container.addEventListener('mousedown', (e) => { isDragging = true; prevX = e.clientX; prevY = e.clientY })
    window.addEventListener('mouseup', () => { isDragging = false })
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return
      const dx = e.clientX - prevX, dy = e.clientY - prevY
      camera.position.x -= dx * 0.5
      camera.position.z -= dy * 0.5
      camera.lookAt(150, 0, 100)
      prevX = e.clientX; prevY = e.clientY
    })
    container.addEventListener('wheel', (e) => {
      camera.position.y += e.deltaY * 0.2
      camera.position.y = Math.max(50, Math.min(400, camera.position.y))
      camera.lookAt(150, 0, 100)
    })

    state.threeScene = { scene, camera, renderer, container }

    function animate() {
      if (state.activeView !== 'facility') return
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    // GSAP entrance
    gsap.from(camera.position, { y: 50, duration: 1.5, ease: 'power2.out' })
  }

  // ============================================================
  // REPORTS VIEW
  // ============================================================
  async function renderReportsView() {
    const content = $('#main-content')
    try {
      const { data: daily } = await API.get('/reports/daily')
      const { data: weekly } = await API.get('/reports/weekly')
      const { data: monthly } = await API.get('/reports/monthly')
      const { data: saved } = await API.get('/reports/saved')
      const isVenture = state.role === 'venture_owner'

      content.innerHTML = `
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <div><h2 class="text-xl font-bold">Reports</h2><p class="text-sm text-slate-400">Daily / Weekly / Monthly Reporting</p></div>
            <div class="flex gap-2">
              ${!isVenture ? '<button id="new-daily-btn" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"><i class="fas fa-plus mr-1"></i> Daily Update</button>' : ''}
              <button id="export-csv-btn" class="bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition"><i class="fas fa-download mr-1"></i> Export KPI CSV</button>
            </div>
          </div>

          <!-- Tab bar for report types -->
          <div class="flex gap-1 bg-slate-900 rounded-xl p-1 w-fit" id="report-tabs">
            <button class="report-tab px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600/20 text-indigo-400" data-rt="daily">Daily</button>
            <button class="report-tab px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200" data-rt="weekly">Weekly</button>
            <button class="report-tab px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200" data-rt="monthly">Monthly</button>
            <button class="report-tab px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200" data-rt="saved">Saved Reports</button>
          </div>
          <div id="report-content-area" class="space-y-4"></div>
        </div>`

      // Initial display
      renderReportContent('daily', daily, weekly, monthly, saved, isVenture)

      // Tab switchers
      $$('.report-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          $$('.report-tab').forEach(b => { b.className = 'report-tab px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200' })
          btn.className = 'report-tab px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600/20 text-indigo-400'
          renderReportContent(btn.dataset.rt, daily, weekly, monthly, saved, isVenture)
        })
      })

      if (!isVenture) {
        $('#new-daily-btn').addEventListener('click', () => openDailyReportForm())
      }
      $('#export-csv-btn').addEventListener('click', () => downloadCSV('kpis'))

      gsap.from('#report-content-area > div', { y: 20, opacity: 0, duration: 0.4, stagger: 0.08 })
    } catch (e) {
      content.innerHTML = errorHtml('reports', e)
    }
  }

  function renderReportContent(type, daily, weekly, monthly, saved, isVenture) {
    const area = $('#report-content-area')
    if (!area) return

    switch (type) {
      case 'daily':
        area.innerHTML = daily.length === 0 ? '<p class="text-slate-500 text-sm p-4">No daily updates yet.</p>' : daily.map(d => `
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
            <div class="flex items-center justify-between"><span class="font-semibold">📅 ${d.report_date}</span><span class="text-xs text-slate-500">${d.created_at || ''}</span></div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><span class="text-slate-500">Cohort Attendance:</span> <span class="text-slate-300">${d.cohort_attendance || '—'}</span></div>
              <div><span class="text-slate-500">Facility/Safety Issues:</span> <span class="text-slate-300">${d.facility_safety_issues || 'None'}</span></div>
              <div><span class="text-slate-500">Vendor/Asset Blockers:</span> <span class="text-slate-300">${d.vendor_asset_blockers || 'None'}</span></div>
              <div><span class="text-slate-500">Prototype/Test Status:</span> <span class="text-slate-300">${d.prototype_test_status || '—'}</span></div>
            </div>
            <p><span class="text-slate-500">Decisions Needed (24h):</span> <span class="text-amber-400">${d.decisions_needed || 'None'}</span></p>
          </div>`).join('')
        break
      case 'weekly':
        area.innerHTML = weekly.length === 0 ? '<p class="text-slate-500 text-sm p-4">No weekly reports yet.</p>' : weekly.map(w => `
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
            <div class="flex items-center justify-between"><span class="font-semibold">📊 ${w.week_start} → ${w.week_end}</span><span class="status-badge status-${w.status}">${w.status}</span></div>
            <div class="text-sm space-y-1">
              <p><span class="text-slate-500">Progress vs Plan:</span> ${w.progress_vs_plan || '—'}</p>
              <p><span class="text-slate-500">Risks & Mitigations:</span> ${w.risks_mitigations || '—'}</p>
              <p><span class="text-slate-500">Asks:</span> ${w.asks || '—'}</p>
            </div>
          </div>`).join('')
        break
      case 'monthly':
        area.innerHTML = monthly.length === 0 ? '<p class="text-slate-500 text-sm p-4">No monthly reports yet.</p>' : monthly.map(m => `
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
            <div class="flex items-center justify-between"><span class="font-semibold">📈 ${m.report_month}</span><span class="status-badge status-${m.status}">${m.status}</span></div>
            <div class="text-sm space-y-1">
              <p><span class="text-slate-500">Strategic Decisions:</span> ${m.strategic_decisions || '—'}</p>
              <p><span class="text-slate-500">Budget Approvals Required:</span> ${m.budget_approvals || '—'}</p>
              <p><span class="text-slate-500">Next Month Plan:</span> ${m.next_month_plan || '—'}</p>
            </div>
          </div>`).join('')
        break
      case 'saved':
        area.innerHTML = saved.length === 0 ? '<p class="text-slate-500 text-sm p-4">No saved/generated reports yet.</p>' : saved.map(r => `
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div class="flex items-center justify-between">
              <span class="font-semibold">📄 ${r.title}</span>
              <div class="flex gap-2">
                ${r.share_token ? `<button onclick="window._copyShareLink('${r.share_token}')" class="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition"><i class="fas fa-share-alt mr-1"></i>Copy Share Link</button>` : ''}
                <button onclick="window._shareReport('${r.title}','${r.content || ''}')" class="text-xs bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded transition"><i class="fas fa-paper-plane mr-1"></i>Share</button>
              </div>
            </div>
            <p class="text-xs text-slate-500">${r.report_type} &middot; ${r.created_at || ''}</p>
            ${r.content ? `<div class="text-sm text-slate-300 bg-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">${r.content.substring(0, 800)}${r.content.length > 800 ? '...' : ''}</div>` : ''}
          </div>`).join('')
        break
    }
  }

  async function openDailyReportForm() {
    const today = dayjs().format('YYYY-MM-DD')
    showModal(`
      <form id="daily-form" class="space-y-4 text-left">
        <h3 class="text-lg font-bold">Daily Update — ${today}</h3>
        <div><label class="text-xs text-slate-400">Cohort Attendance & Activities</label><textarea name="cohort_attendance" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1" placeholder="e.g., 18/20 present, Stage B assembly workshop"></textarea></div>
        <div><label class="text-xs text-slate-400">Facility / Safety Issues</label><textarea name="facility_safety_issues" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1" placeholder="Any issues today?"></textarea></div>
        <div><label class="text-xs text-slate-400">Critical Vendor / Asset Blockers</label><textarea name="vendor_asset_blockers" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1"></textarea></div>
        <div><label class="text-xs text-slate-400">Prototype / Test Status Summary</label><textarea name="prototype_test_status" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1"></textarea></div>
        <div><label class="text-xs text-slate-400">Decisions Needed in 24 Hours <span class="text-amber-400">*</span></label><textarea name="decisions_needed" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1"></textarea></div>
        <input type="hidden" name="report_date" value="${today}">
        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-medium transition">Submit Daily Update</button>
      </form>`)

    $('#daily-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const payload = Object.fromEntries(fd.entries())
      await API.post('/reports/daily', payload)
      closeModal()
      state.activeView = 'reports'; navigateView()
    })
  }

  // ============================================================
  // ROADMAP VIEW (CoE Leader)
  // ============================================================
  async function renderRoadmap() {
    const content = $('#main-content')
    try {
      const { data: roadmap } = await API.get('/roadmap')
      content.innerHTML = `
        <div class="space-y-6">
          <div><h2 class="text-xl font-bold">Phase 1 Execution Roadmap</h2><p class="text-sm text-slate-400">Month 0 through Month 6 — Sprint-based setup program</p></div>
          <div class="relative" id="roadmap-timeline">
            <div class="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500 to-cyan-400 hidden sm:block"></div>
            <div class="space-y-6">${roadmap.map((m, i) => {
              const statusColors = { completed: 'border-emerald-500 bg-emerald-500/5', in_progress: 'border-indigo-500 bg-indigo-500/5', pending: 'border-slate-700 bg-slate-900', blocked: 'border-red-500 bg-red-500/5' }
              const statusBadge = { completed: 'bg-emerald-500/20 text-emerald-400', in_progress: 'bg-indigo-500/20 text-indigo-400', pending: 'bg-slate-700 text-slate-400', blocked: 'bg-red-500/20 text-red-400' }
              let tasks = []
              try { tasks = JSON.parse(m.tasks) } catch {}
              return `<div class="flex gap-4 sm:gap-6 ${statusColors[m.status]} border rounded-2xl p-5 sm:ml-0 ml-6 relative">
                <div class="hidden sm:flex shrink-0 w-12 h-12 rounded-full items-center justify-center ${m.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : m.status === 'in_progress' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}">
                  <i class="fas ${m.status === 'completed' ? 'fa-check' : m.status === 'in_progress' ? 'fa-spinner' : 'fa-circle'}"></i>
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <span class="font-bold">${m.month_range}</span>
                    <span class="text-xs px-2 py-0.5 rounded-full ${statusBadge[m.status]}">${m.status}</span>
                  </div>
                  <h3 class="font-semibold mb-1">${m.phase_title}</h3>
                  <p class="text-sm text-slate-400 mb-3">${m.description}</p>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    ${tasks.map(t => `<div class="text-xs text-slate-300 flex items-center gap-1.5"><i class="fas fa-circle text-[4px] text-indigo-400"></i> ${t}</div>`).join('')}
                  </div>
                  <select onchange="window._updateRoadmap(${m.id}, this.value)" class="mt-3 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs">
                    <option value="pending" ${m.status==='pending'?'selected':''}>Pending</option>
                    <option value="in_progress" ${m.status==='in_progress'?'selected':''}>In Progress</option>
                    <option value="completed" ${m.status==='completed'?'selected':''}>Completed</option>
                    <option value="blocked" ${m.status==='blocked'?'selected':''}>Blocked</option>
                  </select>
                </div>
              </div>`
            }).join('')}</div>
          </div>
        </div>`

      window._updateRoadmap = async (id, status) => {
        await API.put(`/roadmap/${id}`, { status, tasks: null })
        state.activeView = 'roadmap'; navigateView()
      }

      gsap.from('#roadmap-timeline > .space-y-6 > div', { x: -30, opacity: 0, duration: 0.5, stagger: 0.12 })
    } catch (e) {
      content.innerHTML = errorHtml('roadmap', e)
    }
  }

  // ============================================================
  // PROCUREMENT (Venture Owner)
  // ============================================================
  async function renderProcurement() {
    const content = $('#main-content')
    try {
      const { data: items } = await API.get('/procurement')
      const { data: summary } = await API.get('/procurement/summary')
      const totalEst = summary.total_estimated.toLocaleString('en-IN')

      const bucketLabels = { 1: 'Must-Have Now', 2: 'Buy Once Growth Proven', 3: 'Rent/Partner First' }

      content.innerHTML = `
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <div><h2 class="text-xl font-bold">Procurement Strategy</h2><p class="text-sm text-slate-400">Three-bucket spend logic — Total Est: ₹${totalEst}</p></div>
          </div>

          <!-- Summary cards -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4" id="bucket-summary"></div>

          <div class="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
            <table class="w-full text-sm">
              <thead><tr class="text-slate-500 text-left border-b border-slate-800"><th class="p-3">Item</th><th class="p-3">Category</th><th class="p-3">Campus</th><th class="p-3">Bucket</th><th class="p-3">Est. Cost (₹)</th><th class="p-3">Status</th><th class="p-3">Action</th></tr></thead>
              <tbody>${items.map(i => `
                <tr class="border-t border-slate-800 hover:bg-slate-800/50 transition">
                  <td class="p-3 font-medium">${i.item_name}</td>
                  <td class="p-3 text-slate-400">${i.category}</td>
                  <td class="p-3 text-slate-400">${i.campus_priority}</td>
                  <td class="p-3"><span class="px-2 py-0.5 rounded text-xs ${i.spend_bucket === 1 ? 'bg-red-500/20 text-red-400' : i.spend_bucket === 2 ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}">${bucketLabels[i.spend_bucket]}</span></td>
                  <td class="p-3">₹${(i.estimated_cost || 0).toLocaleString('en-IN')}</td>
                  <td class="p-3"><select onchange="window._updateProcStatus(${i.id}, this.value)" class="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs">
                    ${['planned','ordered','delivered','installed','deferred'].map(s => `<option value="${s}" ${i.status===s?'selected':''}>${s}</option>`).join('')}
                  </select></td>
                  <td class="p-3"><button onclick="window._editProcurement(${i.id})" class="text-indigo-400 hover:text-indigo-300 text-xs"><i class="fas fa-edit"></i></button></td>
                </tr>`).join('')}</tbody>
            </table>
          </div>
        </div>`

      // Summary cards
      const buckets = summary.by_bucket
      const bucketHTML = buckets.map(b => `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-slate-400">${bucketLabels[b.spend_bucket] || 'Bucket ' + b.spend_bucket}</h3>
          <div class="text-2xl font-bold mt-1">₹${(b.total_est || 0).toLocaleString('en-IN')}</div>
          <div class="text-xs text-slate-500 mt-1">${b.count} items</div>
        </div>`).join('')
      $('#bucket-summary').innerHTML = bucketHTML

      window._updateProcStatus = async (id, status) => {
        await API.put(`/procurement/${id}`, { status })
      }
      window._editProcurement = (id) => {
        alert('Edit procurement item #' + id + ' — inline editing')
        // Full edit modal can be added here
      }

      gsap.from('#bucket-summary > div', { y: 20, opacity: 0, duration: 0.4, stagger: 0.1 })
    } catch (e) {
      content.innerHTML = errorHtml('procurement', e)
    }
  }

  // ============================================================
  // PARTNERS (Venture Owner)
  // ============================================================
  async function renderPartners() {
    const content = $('#main-content')
    try {
      const { data: partners } = await API.get('/partners')
      const typeIcons = { vendor: 'fa-store', training_partner: 'fa-graduation-cap', rpto: 'fa-plane', industry: 'fa-industry', academic: 'fa-university', media: 'fa-newspaper', government: 'fa-landmark' }
      const typeColors = { vendor: 'text-blue-400', training_partner: 'text-emerald-400', rpto: 'text-cyan-400', industry: 'text-amber-400', academic: 'text-purple-400', media: 'text-pink-400', government: 'text-red-400' }
      const statusColors = { active: 'bg-emerald-500/20 text-emerald-400', engaged: 'bg-blue-500/20 text-blue-400', identified: 'bg-slate-700 text-slate-400', inactive: 'bg-red-500/20 text-red-400' }

      content.innerHTML = `
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <div><h2 class="text-xl font-bold">Partner & Vendor Stack</h2><p class="text-sm text-slate-400">DGCA-aware procurement and partnership network</p></div>
            <button id="add-partner-btn" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"><i class="fas fa-plus mr-1"></i> Add Partner</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${partners.map(p => `
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2">
                  <i class="fas ${typeIcons[p.type] || 'fa-handshake'} ${typeColors[p.type] || 'text-slate-400'}"></i>
                  <span class="font-semibold">${p.name}</span>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full ${statusColors[p.status]}">${p.status}</span>
              </div>
              <p class="text-sm text-slate-400 mb-2">${p.description || '—'}</p>
              ${p.contact_info ? `<p class="text-xs text-slate-500 mb-2"><i class="fas fa-address-card mr-1"></i>${p.contact_info}</p>` : ''}
              <select onchange="window._updatePartner(${p.id}, this.value)" class="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs w-full">
                ${['identified','engaged','active','inactive'].map(s => `<option value="${s}" ${p.status===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </div>`).join('')}</div>
        </div>`

      window._updatePartner = async (id, status) => {
        await API.put(`/partners/${id}`, { status, engagement_notes: null })
      }
      $('#add-partner-btn').addEventListener('click', () => openPartnerForm())

      gsap.from('#main-content .grid > div', { y: 20, opacity: 0, duration: 0.4, stagger: 0.06 })
    } catch (e) {
      content.innerHTML = errorHtml('partners', e)
    }
  }

  function openPartnerForm() {
    showModal(`
      <form id="partner-form" class="space-y-4 text-left">
        <h3 class="text-lg font-bold">Add Partner / Vendor</h3>
        <div><label class="text-xs text-slate-400">Name</label><input name="name" required class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1"></div>
        <div><label class="text-xs text-slate-400">Type</label><select name="type" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1">${['vendor','training_partner','rpto','industry','academic','media','government'].map(t => `<option value="${t}">${t}</option>`).join('')}</select></div>
        <div><label class="text-xs text-slate-400">Description</label><textarea name="description" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1"></textarea></div>
        <div><label class="text-xs text-slate-400">Contact Info</label><input name="contact_info" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1"></div>
        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-medium transition">Add Partner</button>
      </form>`)

    $('#partner-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const payload = Object.fromEntries(fd.entries())
      await API.post('/partners', payload)
      closeModal()
      state.activeView = 'partners'; navigateView()
    })
  }

  // ============================================================
  // LLM SYNTHESIS (Venture Owner only)
  // ============================================================
  async function renderLLMView() {
    const content = $('#main-content')
    content.innerHTML = `
      <div class="space-y-6">
        <div><h2 class="text-xl font-bold">GenAI Report Synthesis</h2><p class="text-sm text-slate-400">LLM-powered synthesis of all CoE data — Venture Owner Tool</p></div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div class="mb-4">
            <label class="text-sm font-medium text-slate-400">OpenAI API Key <span class="text-amber-400">(stored in session only)</span></label>
            <input id="llm-api-key" type="password" value="${state.llmApiKey || ''}" placeholder="sk-..." class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm mt-1 font-mono">
          </div>
          <div class="mb-4">
            <label class="text-sm font-medium text-slate-400">Report Type</label>
            <select id="llm-report-type" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm mt-1">
              <option value="Executive Summary">Executive Summary</option>
              <option value="Weekly Status">Weekly Status</option>
              <option value="Monthly Review">Monthly Review</option>
              <option value="Strategic Advisory">Strategic Advisory</option>
              <option value="Risk Assessment">Risk Assessment</option>
            </select>
          </div>
          <div class="mb-4">
            <label class="text-sm font-medium text-slate-400">Focus Prompt (optional)</label>
            <textarea id="llm-prompt" rows="2" placeholder="e.g., Focus on procurement bottlenecks and cohort progression risks..." class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm mt-1"></textarea>
          </div>
          <button id="llm-generate-btn" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3 rounded-lg font-medium transition flex items-center gap-2">
            <i class="fas fa-robot"></i> Generate Synthesis
          </button>
          <div id="llm-output" class="mt-6 hidden">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold"><i class="fas fa-file-alt text-indigo-400 mr-2"></i>Synthesis Output</h3>
              <button id="save-llm-report-btn" class="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded text-xs transition"><i class="fas fa-save mr-1"></i>Save as Report</button>
            </div>
            <div id="llm-content" class="bg-slate-800 rounded-lg p-4 text-sm prose prose-invert max-h-96 overflow-y-auto whitespace-pre-wrap"></div>
          </div>
        </div>
      </div>`

    $('#llm-generate-btn').addEventListener('click', async () => {
      const apiKey = $('#llm-api-key').value.trim()
      if (!apiKey) return alert('Please enter your OpenAI API key.')
      state.llmApiKey = apiKey

      const btn = $('#llm-generate-btn')
      btn.disabled = true
      btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Generating...'

      try {
        const { data } = await API.post('/llm/synthesize', {
          api_key: apiKey,
          prompt: $('#llm-prompt').value.trim(),
          report_type: $('#llm-report-type').value
        })

        const output = $('#llm-output')
        output.classList.remove('hidden')
        $('#llm-content').textContent = data.synthesis
        gsap.from(output, { y: 20, opacity: 0, duration: 0.5 })

        // Save button
        $('#save-llm-report-btn').onclick = async () => {
          await API.post('/reports/saved', {
            title: `LLM ${$('#llm-report-type').value} — ${dayjs().format('YYYY-MM-DD HH:mm')}`,
            report_type: 'llm_synthesis',
            content: data.synthesis
          })
          alert('Report saved! View in Reports → Saved Reports.')
        }
      } catch (e) {
        alert('LLM synthesis failed: ' + (e.response?.data?.error || e.message))
      }

      btn.disabled = false
      btn.innerHTML = '<i class="fas fa-robot"></i> Generate Synthesis'
    })
  }

  // ============================================================
  // ADMIN VIEW (Venture Owner)
  // ============================================================
  async function renderAdminView() {
    const content = $('#main-content')
    try {
      const { data: codes } = await API.get('/auth/codes')
      content.innerHTML = `
        <div class="space-y-6">
          <div><h2 class="text-xl font-bold">Administration</h2><p class="text-sm text-slate-400">Manage access codes, system settings</p></div>
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 class="font-semibold mb-4">Access Passcodes</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead><tr class="text-slate-500 text-left"><th class="p-2">Role</th><th class="p-2">Passcode</th><th class="p-2">Label</th><th class="p-2">Active</th><th class="p-2">Created</th></tr></thead>
                <tbody>${codes.map(c => `
                  <tr class="border-t border-slate-800">
                    <td class="p-2"><span class="px-2 py-0.5 rounded text-xs ${c.role === 'venture_owner' ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}">${c.role}</span></td>
                    <td class="p-2 font-mono text-xs">${c.passcode}</td>
                    <td class="p-2 text-slate-400">${c.label}</td>
                    <td class="p-2"><button onclick="window._toggleCode(${c.id}, ${c.is_active ? 0 : 1})" class="text-xs px-2 py-0.5 rounded ${c.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}">${c.is_active ? 'Active' : 'Disabled'}</button></td>
                    <td class="p-2 text-xs text-slate-500">${c.created_at || ''}</td>
                  </tr>`).join('')}</tbody>
              </table>
            </div>
            <button id="add-code-btn" class="mt-4 bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-lg text-sm transition"><i class="fas fa-plus mr-1"></i> New Passcode</button>
          </div>
        </div>`

      window._toggleCode = async (id, active) => {
        await API.put(`/auth/codes/${id}`, { is_active: active })
        state.activeView = 'admin'; navigateView()
      }

      $('#add-code-btn').addEventListener('click', () => {
        showModal(`
          <form id="code-form" class="space-y-4 text-left">
            <h3 class="text-lg font-bold">New Access Code</h3>
            <div><label class="text-xs text-slate-400">Role</label><select name="role" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1"><option value="coe_leader">CoE Leader</option><option value="venture_owner">Venture Owner</option></select></div>
            <div><label class="text-xs text-slate-400">Passcode</label><input name="passcode" required class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1"></div>
            <div><label class="text-xs text-slate-400">Label</label><input name="label" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm mt-1"></div>
            <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg">Create</button>
          </form>`)
        $('#code-form').addEventListener('submit', async (e) => {
          e.preventDefault()
          const fd = new FormData(e.target)
          await API.post('/auth/codes', Object.fromEntries(fd.entries()))
          closeModal()
          state.activeView = 'admin'; navigateView()
        })
      })

      gsap.from('#main-content .bg-slate-900', { y: 20, opacity: 0, duration: 0.4 })
    } catch (e) {
      content.innerHTML = errorHtml('admin', e)
    }
  }

  // ============================================================
  // SHARED REPORT VIEW
  // ============================================================
  async function renderSharedView(token) {
    root.innerHTML = '<div class="min-h-screen flex items-center justify-center"><i class="fas text-2xl text-indigo-400 fa-spinner"></i></div>'
    try {
      const { data } = await API.get(`/reports/shared/${token}`)
      if (data.error) { root.innerHTML = `<div class="min-h-screen flex items-center justify-center"><div class="text-center"><p class="text-red-400 text-xl mb-2">Report Not Found</p><p class="text-slate-500">This shared link is invalid or has expired.</p></div></div>`; return }

      root.innerHTML = `
        <main class="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8">
            <div class="flex items-center gap-3 mb-6">
              <span class="text-3xl">🛸</span>
              <div><h1 class="text-2xl font-bold">${data.title}</h1><p class="text-sm text-slate-400">SRM dROIds CoE — ${data.report_type} &middot; ${data.created_at || ''}</p></div>
            </div>
            <div class="bg-slate-800 rounded-xl p-6 whitespace-pre-wrap text-slate-300 text-sm leading-relaxed">${data.content || 'No content.'}</div>
          </div>
        </main>`
    } catch {
      root.innerHTML = '<div class="min-h-screen flex items-center justify-center"><p class="text-red-400">Failed to load shared report.</p></div>'
    }
  }

  // ============================================================
  // UTILITY: Modal
  // ============================================================
  function showModal(html) {
    const existing = $('#global-modal')
    if (existing) existing.remove()
    const modal = document.createElement('div')
    modal.id = 'global-modal'
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4'
    modal.innerHTML = `<div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="modal-backdrop"></div>
      <div class="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">${html}</div>`
    document.body.appendChild(modal)
    gsap.from(modal.querySelector('.relative'), { scale: 0.95, opacity: 0, duration: 0.25 })
    $('#modal-backdrop').addEventListener('click', closeModal)
  }

  function closeModal() {
    const modal = $('#global-modal')
    if (modal) { gsap.to(modal.querySelector('.relative'), { scale: 0.95, opacity: 0, duration: 0.15, onComplete: () => modal.remove() }) }
  }

  // ============================================================
  // UTILITY: Download CSV
  // ============================================================
  function downloadCSV(type) {
    window.open(`/api/export/csv/${type}`, '_blank')
  }

  // ============================================================
  // UTILITY: Share report
  // ============================================================
  window._shareReport = async (title, content) => {
    const { data } = await API.post('/reports/saved', { title, report_type: 'custom', content })
    const url = window.location.origin + '/#share/' + data.share_token
    await navigator.clipboard.writeText(url)
    alert('Share link copied! Anyone with this link can view the report.\n\n' + url)
  }
  window._copyShareLink = async (token) => {
    const url = window.location.origin + '/#share/' + token
    await navigator.clipboard.writeText(url)
    alert('Share link copied!\n\n' + url)
  }

  // ============================================================
  // UTILITY: Error
  // ============================================================
  function errorHtml(section, e) {
    return `<div class="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center"><p class="text-red-400">Failed to load ${section}</p><p class="text-xs text-red-500/60 mt-1">${e.message || 'Unknown error'}</p><button onclick="location.reload()" class="mt-3 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm transition">Retry</button></div>`
  }

  // ============================================================
  // BOOT
  // ============================================================
  init()

})()
