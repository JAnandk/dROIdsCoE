// ============================================================================
// SRM dROIds — CoE Mission Tracker — Premium SPA v2
// Workflows: CoE Director submits → Venture Owner reviews/edits/approves
// Premium UX: glassmorphism, hero imagery, hidden passcodes
// ============================================================================
(function () {
  'use strict'

  let state = {
    role: null,
    passcode: null,
    activeView: 'dashboard',
    llmApiKey: null,
    charts: {},
    threeScene: null,
    facilityCampus: 'ramapuram',
    reviewFilter: 'pending_review',
    setupTab: 'tracker',
    setupStageId: 0
  }

  // Lookup cache for tracker entities (sections/items by id)
  let setupCache = { stages: [], sections: {}, items: {}, submissions: [] }

  const API = axios.create({ baseURL: '/api' })
  const $ = (s) => document.querySelector(s)
  const $$ = (s) => document.querySelectorAll(s)
  const root = $('#app-root')

  // ── TOAST ────────────────────────────────────────────────
  function toast(msg, type = 'success') {
    const container = $('#toast-container')
    const colors = { success: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
                     error: 'bg-red-500/20 border-red-500/40 text-red-300',
                     info: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' }
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' }
    const el = document.createElement('div')
    el.className = `toast ${colors[type]} border rounded-xl px-4 py-3 text-sm flex items-center gap-2 shadow-lg backdrop-blur`
    el.innerHTML = `<i class="fas ${icons[type]}"></i> ${msg}`
    container.appendChild(el)
    setTimeout(() => { if (el.parentNode) el.remove() }, 3600)
  }

  // ── INIT ─────────────────────────────────────────────────
  async function init() {
    const hash = window.location.hash
    if (hash.startsWith('#share/')) {
      const token = hash.replace('#share/', '')
      return renderSharedView(token)
    }
    renderLogin()
  }

  // ── PREMIUM LOGIN SCREEN — passcodes hidden ──────────────
  function renderLogin() {
    root.innerHTML = `
      <main class="min-h-screen flex items-center justify-center p-6 relative">
        <section class="w-full max-w-md relative z-10">
          <header class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 mb-5 float-anim">
              <i class="fas fa-drone text-3xl text-indigo-400"></i>
            </div>
            <h1 class="text-3xl font-extrabold tracking-tight">
              <span class="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent glow-text">SRM dROIds</span>
            </h1>
            <p class="text-slate-400 mt-2 text-sm max-w-xs mx-auto">Dual-Campus Drone Centre of Excellence &mdash; Mission Control</p>
            <div class="flex items-center justify-center gap-4 mt-4 text-xs text-slate-500">
              <span class="flex items-center gap-1"><i class="fas fa-map-marker-alt text-indigo-400"></i> Ramapuram</span>
              <span class="flex items-center gap-1"><i class="fas fa-map-marker-alt text-cyan-400"></i> Trichy</span>
            </div>
          </header>

          <form id="login-form" class="glass-card rounded-2xl p-8 space-y-5">
            <div id="login-error" class="hidden bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm flex items-center gap-2">
              <i class="fas fa-exclamation-triangle"></i> <span></span>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Access Passcode</label>
              <div class="relative">
                <i class="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input id="passcode-input" type="password" placeholder="Enter your secure passcode..."
                  class="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3.5 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition text-sm" autofocus>
              </div>
            </div>
            <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-3.5 px-6 rounded-xl transition btn-glow flex items-center justify-center gap-2 text-sm">
              <i class="fas fa-rocket"></i> Enter Mission Control
            </button>
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

    gsap.from('header', { y: -30, opacity: 0, duration: 0.7, ease: 'power2.out' })
    gsap.from('#login-form', { y: 20, opacity: 0, duration: 0.5, delay: 0.2, ease: 'power2.out' })
  }

  function showLoginError(msg) {
    const el = $('#login-error')
    el.querySelector('span').textContent = msg
    el.classList.remove('hidden')
    gsap.from(el, { x: -10, opacity: 0, duration: 0.3 })
  }

  // ── MAIN APP SHELL ───────────────────────────────────────
  function renderApp() {
    const isVenture = state.role === 'venture_owner'
    const badgeClass = isVenture ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'

    root.innerHTML = `
      <nav id="main-nav" class="glass-card sticky top-0 z-50 border-t-0 border-x-0 rounded-none">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 flex items-center justify-center">
              <i class="fas fa-drone text-indigo-400 text-sm"></i>
            </div>
            <span class="font-bold text-base hidden sm:inline bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">SRM dROIds</span>
            <span class="text-xs px-2.5 py-1 rounded-full font-medium ${badgeClass}">
              ${isVenture ? 'Venture Owner' : 'CoE Director'}
            </span>
          </div>
          <div class="flex items-center gap-1 sm:gap-2" id="nav-tabs"></div>
          <button id="logout-btn" class="text-slate-500 hover:text-slate-300 px-3 py-2 rounded-xl hover:bg-slate-800/50 transition text-sm border border-transparent hover:border-slate-700/50">
            <i class="fas fa-sign-out-alt"></i> <span class="hidden sm:inline ml-1">Exit</span>
          </button>
        </div>
      </nav>
      <main id="main-content" class="max-w-7xl mx-auto px-4 sm:px-6 py-8"></main>`

    // Build nav tabs
    const tabs = isVenture
      ? [
          { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
          { id: 'setup', icon: 'fa-layer-group', label: 'Setup Tracker' },
          { id: 'review', icon: 'fa-clipboard-check', label: 'Review' },
          { id: 'procurement', icon: 'fa-truck', label: 'Procurement' },
          { id: 'partners', icon: 'fa-handshake', label: 'Partners' },
          { id: 'reports', icon: 'fa-file-alt', label: 'Reports' },
          { id: 'llm', icon: 'fa-robot', label: 'GenAI' },
          { id: 'admin', icon: 'fa-cog', label: 'Admin' }
        ]
      : [
          { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
          { id: 'setup', icon: 'fa-layer-group', label: 'Setup Tracker' },
          { id: 'cohorts', icon: 'fa-users', label: 'Cohorts' },
          { id: 'facility', icon: 'fa-cube', label: 'Facility' },
          { id: 'reports', icon: 'fa-file-alt', label: 'Reports' },
          { id: 'roadmap', icon: 'fa-road', label: 'Roadmap' }
        ]

    const navTabs = $('#nav-tabs')
    tabs.forEach(t => {
      const btn = document.createElement('button')
      btn.className = `nav-tab px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${t.id === state.activeView ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'}`
      btn.innerHTML = `<i class="fas ${t.icon} mr-1.5"></i> <span class="hidden sm:inline">${t.label}</span>`
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
    gsap.from('#main-nav', { y: -60, opacity: 0, duration: 0.5, ease: 'power2.out' })
  }

  function navigateView() {
    $$('.nav-tab').forEach(b => {
      const isActive = b.dataset.view === state.activeView
      b.className = `nav-tab px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'}`
    })

    const content = $('#main-content')
    content.innerHTML = `<div class="flex justify-center py-32"><div class="flex flex-col items-center gap-3"><div class="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin"></div><p class="text-sm text-slate-500">Loading...</p></div></div>`

    switch (state.activeView) {
      case 'dashboard': renderDashboard(); break
      case 'setup': renderSetupTracker(); break
      case 'review': renderReviewView(); break
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

  // ── DASHBOARD — KRAs & KPIs + Submit for Review ──────────
  async function renderDashboard() {
    const content = $('#main-content')
    try {
      const { data: scorecard } = await API.get('/kpis/scorecard')
      const { data: daily } = await API.get('/reports/daily')
      const { data: roadmap } = await API.get('/roadmap')
      const overallColor = scorecard.overall_pct >= 70 ? 'emerald' : scorecard.overall_pct >= 40 ? 'amber' : 'red'

      const isVenture = state.role === 'venture_owner'
      // Venture owner sees read-only dashboard with review CTA
      const reviewBadge = isVenture ? `<a href="#" class="review-link inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm hover:bg-amber-500/20 transition"><i class="fas fa-clipboard-check"></i> Review Pending Submissions</a>` : ''

      content.innerHTML = `
        <section class="space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 class="text-xl font-bold">KPI Scorecard</h2>
              <p class="text-sm text-slate-400">${isVenture ? 'CoE Director KRA Performance Overview' : 'Your KRA Performance Dashboard'}</p>
            </div>
            ${reviewBadge}
          </div>

          <!-- OVERALL SCORE -->
          <div class="glass-card rounded-2xl p-6">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-semibold">Overall Completion</h3>
                <p class="text-xs text-slate-500">${scorecard.completed_kpis}/${scorecard.total_kpis} KPIs completed</p>
              </div>
              <div class="text-right">
                <div class="text-4xl font-extrabold text-${overallColor}-400">${scorecard.overall_pct}%</div>
              </div>
            </div>
            <div class="mt-4 bg-slate-800/50 rounded-full h-2.5 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-1000 progress-shimmer" style="width:${scorecard.overall_pct}%"></div>
            </div>
          </div>

          <!-- KRA CARDS GRID -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="kra-grid"></div>

          <!-- CHARTS ROW -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="glass-card rounded-2xl p-6">
              <h3 class="font-semibold mb-4"><i class="fas fa-chart-bar text-indigo-400 mr-2"></i>KPI Status Distribution</h3>
              <canvas id="kpi-status-chart" height="200"></canvas>
            </div>
            <div class="glass-card rounded-2xl p-6">
              <h3 class="font-semibold mb-4"><i class="fas fa-chart-line text-cyan-400 mr-2"></i>Roadmap Progress</h3>
              <canvas id="roadmap-chart" height="200"></canvas>
            </div>
          </div>

          <!-- LATEST DAILY UPDATE -->
          <div class="glass-card rounded-2xl p-6">
            <h3 class="font-semibold mb-3"><i class="fas fa-clipboard-list text-amber-400 mr-2"></i>Latest Daily Update</h3>
            ${daily.length > 0 ? `
              <div class="space-y-2 text-sm">
                <p><span class="text-slate-500">Date:</span> <span class="text-slate-300">${daily[0].report_date}</span></p>
                <p><span class="text-slate-500">Attendance:</span> <span class="text-slate-300">${daily[0].cohort_attendance || '—'}</span></p>
                <p><span class="text-slate-500">Decisions Needed:</span> <span class="text-amber-400">${daily[0].decisions_needed || 'None'}</span></p>
              </div>
            ` : '<p class="text-slate-500 text-sm">No daily updates yet.</p>'}
          </div>
        </section>`

      renderKRAGrid(scorecard.kras, isVenture)
      renderKPIStatusChart(scorecard.kras)
      renderRoadmapChart(roadmap)

      // Venture owner "Review" link clicks
      $$('.review-link').forEach(lnk => {
        lnk.addEventListener('click', (e) => { e.preventDefault(); state.activeView = 'review'; navigateView() })
      })

      gsap.from('#kra-grid > div', { y: 30, opacity: 0, duration: 0.5, stagger: 0.08 })
    } catch (e) {
      content.innerHTML = errorHtml('dashboard', e)
    }
  }

  function renderKRAGrid(kras, isVenture) {
    const grid = $('#kra-grid')
    if (!grid) return
    kras.forEach(kra => {
      const color = kra.completion >= 70 ? 'emerald' : kra.completion >= 40 ? 'amber' : 'red'
      const card = document.createElement('div')
      card.className = 'glass-card rounded-2xl p-5 cursor-pointer transition-all duration-200'
      card.innerHTML = `
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-semibold text-sm">${kra.title}</h4>
          <span class="text-xs px-2 py-1 rounded-full bg-${color}-500/20 text-${color}-400 border border-${color}-500/20">${kra.completion}%</span>
        </div>
        <p class="text-xs text-slate-500 mb-3">${kra.description || ''}</p>
        <div class="bg-slate-800/50 rounded-full h-1.5 overflow-hidden mb-3">
          <div class="h-full bg-${color}-500 rounded-full transition-all duration-700" style="width:${kra.completion}%"></div>
        </div>
        <div class="space-y-1.5" id="kpi-list-${kra.id}"></div>
        <div class="mt-3 text-xs text-slate-600 flex items-center justify-between">
          <span>${kra.completed}/${kra.total} KPIs &middot; Weight: ${kra.weight}</span>
          <i class="fas fa-chevron-right text-slate-600"></i>
        </div>`

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

      // Click opens KPI editor (CoE Leader = submit workflow; Venture Owner = view only)
      card.addEventListener('click', () => openKPIEditor(kra, isVenture))
    })
  }

  async function openKPIEditor(kra, isVenture) {
    const kpiRows = kra.kpis.map(k => `
      <div class="bg-slate-800/60 rounded-xl p-4 space-y-2 border border-slate-700/50">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-slate-200">${k.title}</span>
          <span class="text-xs text-slate-500">Target: ${k.target_value} ${k.metric_unit || ''}</span>
        </div>
        ${!isVenture ? `
        <div class="flex items-center gap-2">
          <input id="kpi-val-${k.id}" type="number" value="${k.current_value || 0}" step="any"
            class="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm w-24 text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition">
          <span class="text-xs text-slate-500">/ ${k.target_value} ${k.metric_unit || ''}</span>
          <select id="kpi-status-${k.id}" class="bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-xs text-slate-300">
            <option value="pending" ${k.status==='pending'?'selected':''}>Pending</option>
            <option value="in_progress" ${k.status==='in_progress'?'selected':''}>In Progress</option>
            <option value="on_track" ${k.status==='on_track'?'selected':''}>On Track</option>
            <option value="at_risk" ${k.status==='at_risk'?'selected':''}>At Risk</option>
            <option value="completed" ${k.status==='completed'?'selected':''}>Completed</option>
          </select>
          <input id="kpi-notes-${k.id}" type="text" placeholder="Note (optional)" class="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs flex-1 text-slate-300 placeholder-slate-500">
          <button id="submit-kpi-btn-${k.id}" class="shrink-0 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs px-4 py-2 rounded-lg transition font-medium btn-glow">
            <i class="fas fa-paper-plane mr-1"></i> Submit
          </button>
        </div>
        <p class="text-xs text-amber-400/70 flex items-center gap-1">
          <i class="fas fa-info-circle"></i> Submitting sends this KPI update for Venture Owner review
        </p>
        ` : `
        <div class="flex items-center gap-2 text-sm">
          <span class="text-slate-400">Current: <strong class="text-slate-200">${k.current_value ?? 0}</strong> / ${k.target_value} ${k.metric_unit || ''}</span>
          <span class="status-badge status-${k.status}">${k.status}</span>
        </div>
        `}
      </div>`).join('')

    showModal(`
      <div class="text-left">
        <h3 class="text-lg font-bold mb-1">${kra.title}</h3>
        <p class="text-sm text-slate-400 mb-4">${kra.description || ''} — ${kra.completion}% complete</p>
        <div class="space-y-2 max-h-96 overflow-y-auto">${kpiRows}</div>
        ${isVenture ? '<p class="text-xs text-slate-500 mt-4 italic"><i class="fas fa-info-circle mr-1"></i> Use the Review tab to manage KPI submissions from the CoE Director.</p>' : ''}
      </div>`)

    if (!isVenture) {
      // Wire up submit buttons for each KPI
      kra.kpis.forEach(kpi => {
        const btn = document.getElementById(`submit-kpi-btn-${kpi.id}`)
        if (!btn) return
        btn.addEventListener('click', async (e) => {
          e.stopPropagation()
          const val = document.getElementById(`kpi-val-${kpi.id}`)?.value
          const notes = document.getElementById(`kpi-notes-${kpi.id}`)?.value || ''
          if (val === undefined || val === '') { toast('Please enter a value.', 'error'); return }
          btn.disabled = true
          btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Submitting...'
          try {
            await API.post('/submissions/kpi', {
              kpi_id: kpi.id,
              kra_id: kra.id,
              current_value: parseFloat(val),
              previous_value: kpi.current_value || 0,
              notes: notes
            })
            toast('KPI update submitted for review! The Venture Owner will approve it.', 'success')
            closeModal()
            state.activeView = 'dashboard'; navigateView()
          } catch (err) {
            toast('Submission failed: ' + (err.response?.data?.error || err.message), 'error')
            btn.disabled = false
            btn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i> Submit'
          }
        })
      })
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

  // ── VENTURE OWNER REVIEW TAB ─────────────────────────────
  async function renderReviewView() {
    const content = $('#main-content')
    try {
      const { data: allSubs } = await API.get('/submissions')
      const filter = state.reviewFilter || 'pending_review'
      const subs = filter === 'all' ? allSubs : allSubs.filter(s => s.status === filter)

      content.innerHTML = `
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-bold">KPI Submissions Review</h2>
              <p class="text-sm text-slate-400">CoE Director submitted KPI updates for your review and approval</p>
            </div>
            <div class="flex gap-1 bg-slate-900/60 rounded-xl p-1 border border-slate-800">
              <button class="review-filter-btn px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter==='pending_review'?'bg-indigo-600/20 text-indigo-400':'text-slate-400 hover:text-slate-200'}" data-f="pending_review">Pending</button>
              <button class="review-filter-btn px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter==='approved'?'bg-emerald-600/20 text-emerald-400':'text-slate-400 hover:text-slate-200'}" data-f="approved">Approved</button>
              <button class="review-filter-btn px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter==='rejected'?'bg-red-600/20 text-red-400':'text-slate-400 hover:text-slate-200'}" data-f="rejected">Rejected</button>
              <button class="review-filter-btn px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter==='all'?'bg-slate-600 text-slate-200':'text-slate-400 hover:text-slate-200'}" data-f="all">All</button>
            </div>
          </div>

          <div class="space-y-3" id="review-list">
            ${subs.length === 0 ? `
              <div class="glass-card rounded-2xl p-12 text-center">
                <i class="fas fa-check-circle text-4xl text-emerald-400/40 mb-3"></i>
                <p class="text-slate-400">No ${filter === 'pending_review' ? 'pending' : filter} submissions.</p>
                <p class="text-xs text-slate-500 mt-1">All caught up!</p>
              </div>` : ''}
            ${subs.map(s => `
              <div class="glass-card rounded-2xl p-5 transition-all duration-200" id="review-card-${s.id}">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 space-y-2">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-semibold text-sm">${s.kpi_title}</span>
                      <span class="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">${s.kra_title}</span>
                      <span class="status-badge status-${s.status === 'pending_review' ? 'submitted' : s.status}">${s.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div class="grid grid-cols-3 gap-4 text-xs">
                      <div><span class="text-slate-500">New Value:</span> <span class="text-slate-200 font-medium">${s.current_value}</span> <span class="text-slate-600">${s.metric_unit || ''}</span></div>
                      <div><span class="text-slate-500">Previous:</span> <span class="text-slate-500">${s.previous_value || '—'}</span></div>
                      <div><span class="text-slate-500">Target:</span> <span class="text-slate-500">${s.target_value} ${s.metric_unit || ''}</span></div>
                    </div>
                    ${s.notes ? `<p class="text-xs text-slate-400 italic"><i class="fas fa-quote-left mr-1 text-slate-600"></i>${s.notes}</p>` : ''}
                    ${s.reviewer_notes ? `<p class="text-xs ${s.status === 'rejected' ? 'text-red-400' : 'text-emerald-400'}"><i class="fas fa-${s.status === 'rejected' ? 'times-circle' : 'check-circle'} mr-1"></i>Reviewer: ${s.reviewer_notes}</p>` : ''}
                    <p class="text-xs text-slate-600">Submitted ${s.created_at || ''}</p>
                  </div>
                  ${s.status === 'pending_review' ? `
                  <div class="flex flex-col gap-1.5 shrink-0">
                    <button class="review-approve-btn bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-600/30 text-xs px-4 py-2 rounded-lg transition font-medium" data-id="${s.id}" data-val="${s.current_value}">
                      <i class="fas fa-check mr-1"></i> Approve
                    </button>
                    <button class="review-edit-btn bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-600/30 text-xs px-4 py-2 rounded-lg transition font-medium" data-id="${s.id}" data-val="${s.current_value}">
                      <i class="fas fa-pen mr-1"></i> Edit
                    </button>
                    <button class="review-reject-btn bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 text-xs px-4 py-2 rounded-lg transition font-medium" data-id="${s.id}">
                      <i class="fas fa-times mr-1"></i> Reject
                    </button>
                  </div>` : `
                  <div class="shrink-0 text-xs text-slate-500">
                    ${s.reviewed_by ? `<p>by ${s.reviewed_by}</p>` : ''}
                    ${s.reviewed_at ? `<p>${s.reviewed_at}</p>` : ''}
                  </div>`}
                </div>
              </div>`).join('')}
          </div>
        </div>`

      // Filter buttons
      $$('.review-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.reviewFilter = btn.dataset.f
          state.activeView = 'review'; navigateView()
        })
      })

      // Approve
      $$('.review-approve-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id
          btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i>'
          try {
            await API.put(`/submissions/${id}`, { action: 'approve', reviewer_notes: 'Approved by Venture Owner.' })
            toast('KPI submission approved! The KPI has been updated.', 'success')
            state.activeView = 'review'; navigateView()
          } catch (e) { toast('Failed: ' + (e.response?.data?.error || e.message), 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-check mr-1"></i> Approve' }
        })
      })

      // Edit (Venture Owner changes the value)
      $$('.review-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id
          const currentVal = btn.dataset.val
          showModal(`
            <div class="text-left space-y-4">
              <h3 class="text-lg font-bold">Edit KPI Submission Value</h3>
              <p class="text-sm text-slate-400">Modify the submitted value before approving.</p>
              <div>
                <label class="text-xs text-slate-400">Adjusted Value</label>
                <input id="edit-val-${id}" type="number" step="any" value="${currentVal}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm mt-1 text-slate-100">
              </div>
              <div>
                <label class="text-xs text-slate-400">Review Note</label>
                <input id="edit-note-${id}" type="text" placeholder="Rationale for adjustment..." class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm mt-1 text-slate-100 placeholder-slate-500">
              </div>
              <button id="edit-confirm-${id}" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-medium transition btn-glow">
                <i class="fas fa-save mr-1"></i> Save & Submit for Re-Review
              </button>
            </div>`)
          const confirmBtn = document.getElementById(`edit-confirm-${id}`)
          confirmBtn.addEventListener('click', async () => {
            const newVal = parseFloat(document.getElementById(`edit-val-${id}`).value)
            const note = document.getElementById(`edit-note-${id}`).value
            confirmBtn.disabled = true; confirmBtn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Saving...'
            try {
              await API.put(`/submissions/${id}`, { action: 'edit', current_value: newVal, reviewer_notes: note || 'Value adjusted by Venture Owner.' })
              toast('Submission edited. It is back in pending review.', 'info')
              closeModal()
              state.activeView = 'review'; navigateView()
            } catch (e) { toast('Failed: ' + (e.response?.data?.error || e.message), 'error'); confirmBtn.disabled = false; confirmBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Save & Submit' }
          })
        })
      })

      // Reject
      $$('.review-reject-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id
          showModal(`
            <div class="text-left space-y-4">
              <h3 class="text-lg font-bold">Reject KPI Submission</h3>
              <p class="text-sm text-slate-400">Provide a reason so the CoE Director knows what to revise.</p>
              <div>
                <label class="text-xs text-slate-400">Rejection Reason</label>
                <textarea id="reject-note-${id}" rows="3" placeholder="Why is this being rejected? What needs to change?" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea>
              </div>
              <div class="flex gap-2">
                <button id="reject-cancel-${id}" class="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-lg text-sm transition">Cancel</button>
                <button id="reject-confirm-${id}" class="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 py-2.5 rounded-lg text-sm font-medium transition">
                  <i class="fas fa-times mr-1"></i> Reject
                </button>
              </div>
            </div>`)
          document.getElementById(`reject-cancel-${id}`).addEventListener('click', closeModal)
          document.getElementById(`reject-confirm-${id}`).addEventListener('click', async () => {
            const note = document.getElementById(`reject-note-${id}`).value
            const btn = document.getElementById(`reject-confirm-${id}`)
            btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i>'
            try {
              await API.put(`/submissions/${id}`, { action: 'reject', reviewer_notes: note || 'Needs revision.' })
              toast('KPI submission rejected. The CoE Director will be notified.', 'info')
              closeModal()
              state.activeView = 'review'; navigateView()
            } catch (e) { toast('Failed: ' + (e.response?.data?.error || e.message), 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-times mr-1"></i> Reject' }
          })
        })
      })

      gsap.from('#review-list > div', { y: 20, opacity: 0, duration: 0.4, stagger: 0.06 })
    } catch (e) {
      content.innerHTML = errorHtml('review', e)
    }
  }

  // ── COHORTS VIEW ─────────────────────────────────────────
  async function renderCohorts() {
    const content = $('#main-content')
    try {
      const { data: cohorts } = await API.get('/cohorts')
      const { data: students } = await API.get('/students')

      content.innerHTML = `
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <div><h2 class="text-xl font-bold">Cohort Pipeline</h2><p class="text-sm text-slate-400">Student progression through Stages A→E</p></div>
            <button id="add-cohort-btn" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition btn-glow"><i class="fas fa-plus mr-1"></i> New Cohort</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-5 gap-3" id="stage-columns">
            ${['A','B','C','D','E'].map(stage => {
              const stageLabels = { A: 'Foundation', B: 'Build', C: 'Field/Immersion', D: 'R&D/Projects', E: 'Service/Placement' }
              const stageColors = { A: 'border-indigo-500', B: 'border-blue-500', C: 'border-cyan-500', D: 'border-amber-500', E: 'border-emerald-500' }
              const stageStudents = students.filter(s => s.current_stage === stage)
              return `<div class="glass-card border-t-2 ${stageColors[stage]} rounded-xl p-4" id="stage-${stage}">
                <h3 class="font-bold text-sm mb-1">Stage ${stage}</h3>
                <p class="text-xs text-slate-500 mb-3">${stageLabels[stage]} (${stageStudents.length})</p>
                <div class="space-y-1.5" id="stage-list-${stage}">${stageStudents.map(s => `
                  <div class="bg-slate-800/60 rounded-lg px-3 py-2 text-xs flex items-center justify-between" data-student-id="${s.id}">
                    <span class="truncate mr-2">${s.name}</span>
                    <div class="w-12 bg-slate-700 rounded-full h-1.5 overflow-hidden shrink-0">
                      <div class="h-full bg-indigo-500 rounded-full" style="width:${s.progress_pct}%"></div>
                    </div>
                  </div>`).join('')}
                  ${stageStudents.length === 0 ? '<p class="text-xs text-slate-600 italic">No students</p>' : ''}
                </div>
              </div>`
            }).join('')}
          </div>
          <div class="glass-card rounded-2xl p-6" id="cohorts-table-section"></div>
        </div>`

      let cohortHTML = `<h3 class="font-semibold mb-3">All Cohorts</h3>
        <div class="overflow-x-auto"><table class="w-full text-sm">
          <thead><tr class="text-slate-500 text-left"><th class="p-3">Name</th><th class="p-3">Stage</th><th class="p-3">Campus</th><th class="p-3">Students</th><th class="p-3">Dates</th><th class="p-3">Status</th></tr></thead>
          <tbody>${cohorts.map(c => `<tr class="border-t border-slate-800/50 hover:bg-slate-800/30 transition">
            <td class="p-3 font-medium">${c.name}</td><td class="p-3"><span class="px-2 py-1 rounded-lg text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/20">Stage ${c.stage}</span></td>
            <td class="p-3 text-slate-400">${c.campus}</td><td class="p-3">${c.student_count}</td>
            <td class="p-3 text-xs text-slate-500">${c.start_date || '—'} → ${c.end_date || '—'}</td>
            <td class="p-3"><span class="status-badge status-${c.status}">${c.status}</span></td>
          </tr>`).join('')}</tbody></table></div>`
      $('#cohorts-table-section').innerHTML = cohortHTML

      $('#add-cohort-btn').addEventListener('click', () => openCohortForm())

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
          <div><label class="text-xs text-slate-400">Name</label><input name="name" value="${d.name || ''}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
          <div><label class="text-xs text-slate-400">Stage</label><select name="stage" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">${['A','B','C','D','E'].map(s => `<option value="${s}" ${d.stage===s?'selected':''}>Stage ${s}</option>`).join('')}</select></div>
          <div><label class="text-xs text-slate-400">Campus</label><select name="campus" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">${['ramapuram','trichy','both'].map(c => `<option value="${c}" ${d.campus===c?'selected':''}>${c}</option>`).join('')}</select></div>
          <div><label class="text-xs text-slate-400">Students</label><input name="student_count" type="number" value="${d.student_count || 20}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
          <div><label class="text-xs text-slate-400">Start</label><input name="start_date" type="date" value="${d.start_date || ''}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
          <div><label class="text-xs text-slate-400">End</label><input name="end_date" type="date" value="${d.end_date || ''}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
          <div><label class="text-xs text-slate-400">Status</label><select name="status" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">${['planned','active','completed','paused'].map(s => `<option value="${s}" ${d.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
        </div>
        <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-medium transition btn-glow">Save Cohort</button>
      </form>`)

    $('#cohort-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const payload = Object.fromEntries(fd.entries())
      payload.student_count = parseInt(payload.student_count)
      if (editData && editData.id) await API.put(`/cohorts/${editData.id}`, payload)
      else await API.post('/cohorts', payload)
      closeModal()
      state.activeView = 'cohorts'; navigateView()
    })
  }

  // ── FACILITY 3D VIEW ─────────────────────────────────────
  async function renderFacilityView() {
    const content = $('#main-content')
    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div><h2 class="text-xl font-bold">Facility Layout</h2><p class="text-sm text-slate-400">3D Warehouse &amp; Lab Layout</p></div>
          <div class="flex gap-1 bg-slate-900/60 rounded-xl p-1 border border-slate-800">
            <button id="fac-ramapuram" class="campus-toggle px-4 py-2 rounded-lg text-sm font-medium transition bg-indigo-600 text-white">Ramapuram</button>
            <button id="fac-trichy" class="campus-toggle px-4 py-2 rounded-lg text-sm font-medium transition text-slate-400 hover:text-slate-200">Trichy</button>
          </div>
        </div>
        <div id="three-container" class="glass-card rounded-2xl" style="height:500px;"></div>
        <div id="facility-legend" class="grid grid-cols-2 sm:grid-cols-4 gap-3"></div>
      </div>`

    document.getElementById('fac-ramapuram').addEventListener('click', () => { state.facilityCampus = 'ramapuram'; updateCampusToggles(); initThreeJS() })
    document.getElementById('fac-trichy').addEventListener('click', () => { state.facilityCampus = 'trichy'; updateCampusToggles(); initThreeJS() })
    initThreeJS()
  }

  function updateCampusToggles() {
    const r = $('#fac-ramapuram'), t = $('#fac-trichy')
    if (!r || !t) return
    if (state.facilityCampus === 'ramapuram') { r.className = 'campus-toggle px-4 py-2 rounded-lg text-sm font-medium transition bg-indigo-600 text-white'; t.className = 'campus-toggle px-4 py-2 rounded-lg text-sm font-medium transition text-slate-400 hover:text-slate-200' }
    else { t.className = 'campus-toggle px-4 py-2 rounded-lg text-sm font-medium transition bg-indigo-600 text-white'; r.className = 'campus-toggle px-4 py-2 rounded-lg text-sm font-medium transition text-slate-400 hover:text-slate-200' }
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

    const ambient = new THREE.AmbientLight(0x404060, 1.5)
    scene.add(ambient)
    const dir = new THREE.DirectionalLight(0xffffff, 2)
    dir.position.set(100, 200, 100)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.camera.left = -300; dir.shadow.camera.right = 300
    dir.shadow.camera.top = 300; dir.shadow.camera.bottom = -300
    scene.add(dir)

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

      const edgeGeo = new THREE.EdgesGeometry(geo)
      const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })
      const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat)
      edgeLine.position.copy(mesh.position)
      scene.add(edgeLine)

      labelCache.push({ x: mesh.position.x, z: mesh.position.z, name: f.name, status: f.status, zoneType: f.zone_type })
    })

    const legend = $('#facility-legend')
    if (legend) {
      legend.innerHTML = labelCache.map(l => `
        <div class="bg-slate-800/60 rounded-xl px-3 py-2 text-xs flex items-center gap-2 border border-slate-700/30">
          <span class="w-3 h-3 rounded-sm" style="background:#${zoneColors[l.zoneType]?.toString(16).padStart(6,'0') || '6366f1'}"></span>
          <span class="truncate">${l.name}</span>
          <span class="ml-auto status-badge status-${l.status}">${l.status}</span>
        </div>`).join('')
    }

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
      } else { container.style.cursor = 'grab' }
    })

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

    gsap.from(camera.position, { y: 50, duration: 1.5, ease: 'power2.out' })
  }

  // ── REPORTS VIEW ─────────────────────────────────────────
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
              ${!isVenture ? '<button id="new-daily-btn" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition btn-glow"><i class="fas fa-plus mr-1"></i> Daily Update</button>' : ''}
              <button id="export-csv-btn" class="bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition"><i class="fas fa-download mr-1"></i> Export KPI CSV</button>
            </div>
          </div>
          <div class="flex gap-1 bg-slate-900/60 rounded-xl p-1 w-fit border border-slate-800">
            <button class="report-tab px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600/20 text-indigo-400" data-rt="daily">Daily</button>
            <button class="report-tab px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200" data-rt="weekly">Weekly</button>
            <button class="report-tab px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200" data-rt="monthly">Monthly</button>
            <button class="report-tab px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200" data-rt="saved">Saved Reports</button>
          </div>
          <div id="report-content-area" class="space-y-4"></div>
        </div>`

      renderReportContent('daily', daily, weekly, monthly, saved, isVenture)

      $$('.report-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          $$('.report-tab').forEach(b => { b.className = 'report-tab px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200' })
          btn.className = 'report-tab px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600/20 text-indigo-400'
          renderReportContent(btn.dataset.rt, daily, weekly, monthly, saved, isVenture)
        })
      })

      if (!isVenture) $('#new-daily-btn').addEventListener('click', () => openDailyReportForm())
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
        area.innerHTML = daily.length === 0 ? '<div class="glass-card rounded-xl p-8 text-center"><p class="text-slate-500">No daily updates yet.</p></div>' : daily.map(d => `
          <div class="glass-card rounded-xl p-5 space-y-2">
            <div class="flex items-center justify-between"><span class="font-semibold">${d.report_date}</span><span class="text-xs text-slate-500">${d.created_at || ''}</span></div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><span class="text-slate-500">Attendance:</span> <span class="text-slate-300">${d.cohort_attendance || '—'}</span></div>
              <div><span class="text-slate-500">Safety Issues:</span> <span class="text-slate-300">${d.facility_safety_issues || 'None'}</span></div>
              <div><span class="text-slate-500">Vendor Blockers:</span> <span class="text-slate-300">${d.vendor_asset_blockers || 'None'}</span></div>
              <div><span class="text-slate-500">Prototype Status:</span> <span class="text-slate-300">${d.prototype_test_status || '—'}</span></div>
            </div>
            <p><span class="text-slate-500">Decisions Needed:</span> <span class="text-amber-400">${d.decisions_needed || 'None'}</span></p>
          </div>`).join('')
        break
      case 'weekly':
        area.innerHTML = weekly.length === 0 ? '<div class="glass-card rounded-xl p-8 text-center"><p class="text-slate-500">No weekly reports yet.</p></div>' : weekly.map(w => `
          <div class="glass-card rounded-xl p-5 space-y-2">
            <div class="flex items-center justify-between"><span class="font-semibold">${w.week_start} → ${w.week_end}</span><span class="status-badge status-${w.status}">${w.status}</span></div>
            <div class="text-sm space-y-1">
              <p><span class="text-slate-500">Progress vs Plan:</span> ${w.progress_vs_plan || '—'}</p>
              <p><span class="text-slate-500">Risks:</span> ${w.risks_mitigations || '—'}</p>
              <p><span class="text-slate-500">Asks:</span> ${w.asks || '—'}</p>
            </div>
          </div>`).join('')
        break
      case 'monthly':
        area.innerHTML = monthly.length === 0 ? '<div class="glass-card rounded-xl p-8 text-center"><p class="text-slate-500">No monthly reports yet.</p></div>' : monthly.map(m => `
          <div class="glass-card rounded-xl p-5 space-y-2">
            <div class="flex items-center justify-between"><span class="font-semibold">${m.report_month}</span><span class="status-badge status-${m.status}">${m.status}</span></div>
            <div class="text-sm space-y-1">
              <p><span class="text-slate-500">Strategic Decisions:</span> ${m.strategic_decisions || '—'}</p>
              <p><span class="text-slate-500">Budget Approvals:</span> ${m.budget_approvals || '—'}</p>
              <p><span class="text-slate-500">Next Month:</span> ${m.next_month_plan || '—'}</p>
            </div>
          </div>`).join('')
        break
      case 'saved':
        area.innerHTML = saved.length === 0 ? '<div class="glass-card rounded-xl p-8 text-center"><p class="text-slate-500">No saved reports yet.</p></div>' : saved.map(r => `
          <div class="glass-card rounded-xl p-5 space-y-3">
            <div class="flex items-center justify-between">
              <span class="font-semibold">${r.title}</span>
              <div class="flex gap-2">
                ${r.share_token ? `<button onclick="window._copyShareLink('${r.share_token}')" class="text-xs bg-slate-700/50 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition border border-slate-700"><i class="fas fa-share-alt mr-1"></i>Copy Link</button>` : ''}
                <button onclick="window._shareReport('${r.title}','${(r.content || '').replace(/'/g, "\\'").replace(/\n/g, '\\n')}')" class="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition"><i class="fas fa-paper-plane mr-1"></i>Share</button>
              </div>
            </div>
            <p class="text-xs text-slate-500">${r.report_type} &middot; ${r.created_at || ''}</p>
            ${r.content ? `<div class="text-sm text-slate-300 bg-slate-800/60 rounded-xl p-4 max-h-48 overflow-y-auto whitespace-pre-wrap border border-slate-700/30">${r.content.substring(0, 800)}${r.content.length > 800 ? '...' : ''}</div>` : ''}
          </div>`).join('')
        break
    }
  }

  async function openDailyReportForm() {
    const today = dayjs().format('YYYY-MM-DD')
    showModal(`
      <form id="daily-form" class="space-y-4 text-left">
        <h3 class="text-lg font-bold">Daily Update — ${today}</h3>
        <div><label class="text-xs text-slate-400">Cohort Attendance</label><textarea name="cohort_attendance" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500" placeholder="e.g., 18/20 present"></textarea></div>
        <div><label class="text-xs text-slate-400">Facility/Safety Issues</label><textarea name="facility_safety_issues" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea></div>
        <div><label class="text-xs text-slate-400">Vendor/Asset Blockers</label><textarea name="vendor_asset_blockers" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea></div>
        <div><label class="text-xs text-slate-400">Prototype/Test Status</label><textarea name="prototype_test_status" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea></div>
        <div><label class="text-xs text-slate-400">Decisions Needed <span class="text-amber-400">*</span></label><textarea name="decisions_needed" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea></div>
        <input type="hidden" name="report_date" value="${today}">
        <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-medium transition btn-glow">Submit Daily Update</button>
      </form>`)

    $('#daily-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      await API.post('/reports/daily', Object.fromEntries(fd.entries()))
      toast('Daily update submitted!', 'success')
      closeModal()
      state.activeView = 'reports'; navigateView()
    })
  }

  // ── ROADMAP VIEW ─────────────────────────────────────────
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
              const statusColors = { completed: 'border-emerald-500/40', in_progress: 'border-indigo-500/40', pending: 'border-slate-700/40', blocked: 'border-red-500/40' }
              const statusBadge = { completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20', in_progress: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20', pending: 'bg-slate-700/50 text-slate-400 border-slate-700/30', blocked: 'bg-red-500/20 text-red-400 border-red-500/20' }
              let tasks = []
              try { tasks = JSON.parse(m.tasks) } catch {}
              return `<div class="glass-card flex gap-4 sm:gap-6 border-l-2 ${statusColors[m.status]} rounded-2xl p-5 sm:ml-0 ml-6 relative">
                <div class="hidden sm:flex shrink-0 w-12 h-12 rounded-xl items-center justify-center ${m.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : m.status === 'in_progress' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800/50 text-slate-500 border border-slate-700/30'}">
                  <i class="fas ${m.status === 'completed' ? 'fa-check' : m.status === 'in_progress' ? 'fa-spinner' : 'fa-circle'}"></i>
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <span class="font-bold">${m.month_range}</span>
                    <span class="text-xs px-2 py-0.5 rounded-full border ${statusBadge[m.status]}">${m.status}</span>
                  </div>
                  <h3 class="font-semibold mb-1">${m.phase_title}</h3>
                  <p class="text-sm text-slate-400 mb-3">${m.description}</p>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    ${tasks.map(t => `<div class="text-xs text-slate-300 flex items-center gap-1.5"><i class="fas fa-circle text-[4px] text-indigo-400"></i> ${t}</div>`).join('')}
                  </div>
                  <select onchange="window._updateRoadmap(${m.id}, this.value)" class="mt-3 bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300">
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
        toast('Roadmap milestone updated!', 'success')
        state.activeView = 'roadmap'; navigateView()
      }

      gsap.from('#roadmap-timeline > .space-y-6 > div', { x: -30, opacity: 0, duration: 0.5, stagger: 0.12 })
    } catch (e) {
      content.innerHTML = errorHtml('roadmap', e)
    }
  }

  // ── PROCUREMENT ──────────────────────────────────────────
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
            <div><h2 class="text-xl font-bold">Procurement Strategy</h2><p class="text-sm text-slate-400">Three-bucket spend — Total Est: ₹${totalEst}</p></div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4" id="bucket-summary"></div>
          <div class="overflow-x-auto glass-card rounded-2xl">
            <table class="w-full text-sm">
              <thead><tr class="text-slate-500 text-left border-b border-slate-800/50"><th class="p-3">Item</th><th class="p-3">Category</th><th class="p-3">Campus</th><th class="p-3">Bucket</th><th class="p-3">Est. Cost (₹)</th><th class="p-3">Status</th></tr></thead>
              <tbody>${items.map(i => `
                <tr class="border-t border-slate-800/30 hover:bg-slate-800/20 transition">
                  <td class="p-3 font-medium">${i.item_name}</td>
                  <td class="p-3 text-slate-400">${i.category}</td>
                  <td class="p-3 text-slate-400">${i.campus_priority}</td>
                  <td class="p-3"><span class="px-2 py-0.5 rounded-lg text-xs border ${i.spend_bucket === 1 ? 'bg-red-500/20 text-red-400 border-red-500/20' : i.spend_bucket === 2 ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' : 'bg-blue-500/20 text-blue-400 border-blue-500/20'}">${bucketLabels[i.spend_bucket]}</span></td>
                  <td class="p-3">₹${(i.estimated_cost || 0).toLocaleString('en-IN')}</td>
                  <td class="p-3"><select onchange="window._updateProcStatus(${i.id}, this.value)" class="bg-slate-700/50 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-300">
                    ${['planned','ordered','delivered','installed','deferred'].map(s => `<option value="${s}" ${i.status===s?'selected':''}>${s}</option>`).join('')}
                  </select></td>
                </tr>`).join('')}</tbody>
            </table>
          </div>
        </div>`

      const buckets = summary.by_bucket
      const bucketHTML = buckets.map(b => `
        <div class="glass-card rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-slate-400">${bucketLabels[b.spend_bucket] || 'Bucket ' + b.spend_bucket}</h3>
          <div class="text-2xl font-bold mt-2 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">₹${(b.total_est || 0).toLocaleString('en-IN')}</div>
          <div class="text-xs text-slate-500 mt-1">${b.count} items</div>
        </div>`).join('')
      $('#bucket-summary').innerHTML = bucketHTML

      window._updateProcStatus = async (id, status) => {
        await API.put(`/procurement/${id}`, { status })
        toast('Procurement status updated.', 'success')
      }

      gsap.from('#bucket-summary > div', { y: 20, opacity: 0, duration: 0.4, stagger: 0.1 })
    } catch (e) {
      content.innerHTML = errorHtml('procurement', e)
    }
  }

  // ── PARTNERS ─────────────────────────────────────────────
  async function renderPartners() {
    const content = $('#main-content')
    try {
      const { data: partners } = await API.get('/partners')
      const typeIcons = { vendor: 'fa-store', training_partner: 'fa-graduation-cap', rpto: 'fa-plane', industry: 'fa-industry', academic: 'fa-university', media: 'fa-newspaper', government: 'fa-landmark' }
      const typeColors = { vendor: 'text-blue-400', training_partner: 'text-emerald-400', rpto: 'text-cyan-400', industry: 'text-amber-400', academic: 'text-purple-400', media: 'text-pink-400', government: 'text-red-400' }
      const statusColors = { active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20', engaged: 'bg-blue-500/20 text-blue-400 border-blue-500/20', identified: 'bg-slate-700/50 text-slate-400 border-slate-700/30', inactive: 'bg-red-500/20 text-red-400 border-red-500/20' }

      content.innerHTML = `
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <div><h2 class="text-xl font-bold">Partner & Vendor Stack</h2><p class="text-sm text-slate-400">DGCA-aware procurement network</p></div>
            <button id="add-partner-btn" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition btn-glow"><i class="fas fa-plus mr-1"></i> Add Partner</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${partners.map(p => `
            <div class="glass-card rounded-2xl p-5">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2">
                  <i class="fas ${typeIcons[p.type] || 'fa-handshake'} ${typeColors[p.type] || 'text-slate-400'}"></i>
                  <span class="font-semibold">${p.name}</span>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full border ${statusColors[p.status]}">${p.status}</span>
              </div>
              <p class="text-sm text-slate-400 mb-2">${p.description || '—'}</p>
              ${p.contact_info ? `<p class="text-xs text-slate-500 mb-2"><i class="fas fa-address-card mr-1"></i>${p.contact_info}</p>` : ''}
              <select onchange="window._updatePartner(${p.id}, this.value)" class="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-xs w-full text-slate-300">
                ${['identified','engaged','active','inactive'].map(s => `<option value="${s}" ${p.status===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </div>`).join('')}</div>
        </div>`

      window._updatePartner = async (id, status) => {
        await API.put(`/partners/${id}`, { status, engagement_notes: null })
        toast('Partner status updated.', 'success')
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
        <div><label class="text-xs text-slate-400">Name</label><input name="name" required class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
        <div><label class="text-xs text-slate-400">Type</label><select name="type" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">${['vendor','training_partner','rpto','industry','academic','media','government'].map(t => `<option value="${t}">${t}</option>`).join('')}</select></div>
        <div><label class="text-xs text-slate-400">Description</label><textarea name="description" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea></div>
        <div><label class="text-xs text-slate-400">Contact</label><input name="contact_info" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></div>
        <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-medium transition btn-glow">Add Partner</button>
      </form>`)

    $('#partner-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      await API.post('/partners', Object.fromEntries(fd.entries()))
      toast('Partner added!', 'success')
      closeModal()
      state.activeView = 'partners'; navigateView()
    })
  }

  // ── LLM SYNTHESIS ────────────────────────────────────────
  async function renderLLMView() {
    const content = $('#main-content')
    content.innerHTML = `
      <div class="space-y-6">
        <div><h2 class="text-xl font-bold">GenAI Report Synthesis</h2><p class="text-sm text-slate-400">LLM-powered strategic synthesis — Venture Owner Tool</p></div>
        <div class="glass-card rounded-2xl p-6">
          <div class="mb-4">
            <label class="text-sm font-medium text-slate-400">OpenAI API Key <span class="text-amber-400 text-xs">(session only)</span></label>
            <input id="llm-api-key" type="password" value="${state.llmApiKey || ''}" placeholder="sk-..." class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm mt-1 font-mono text-slate-100 placeholder-slate-500">
          </div>
          <div class="mb-4">
            <label class="text-sm font-medium text-slate-400">Report Type</label>
            <select id="llm-report-type" class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm mt-1 text-slate-100">
              <option value="Executive Summary">Executive Summary</option>
              <option value="Weekly Status">Weekly Status</option>
              <option value="Monthly Review">Monthly Review</option>
              <option value="Strategic Advisory">Strategic Advisory</option>
              <option value="Risk Assessment">Risk Assessment</option>
            </select>
          </div>
          <div class="mb-4">
            <label class="text-sm font-medium text-slate-400">Focus (optional)</label>
            <textarea id="llm-prompt" rows="3" placeholder="e.g., Focus on procurement bottlenecks..." class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea>
          </div>
          <button id="llm-generate-btn" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-medium transition btn-glow flex items-center gap-2">
            <i class="fas fa-robot"></i> Generate Synthesis
          </button>
          <div id="llm-output" class="mt-6 hidden">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold"><i class="fas fa-file-alt text-indigo-400 mr-2"></i>Synthesis Output</h3>
              <button id="save-llm-report-btn" class="bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition"><i class="fas fa-save mr-1"></i>Save as Report</button>
            </div>
            <div id="llm-content" class="bg-slate-800/60 rounded-xl p-5 text-sm prose prose-invert max-h-96 overflow-y-auto whitespace-pre-wrap border border-slate-700/30"></div>
          </div>
        </div>
      </div>`

    $('#llm-generate-btn').addEventListener('click', async () => {
      const apiKey = $('#llm-api-key').value.trim()
      if (!apiKey) return toast('Please enter your OpenAI API key.', 'error')
      state.llmApiKey = apiKey
      const btn = $('#llm-generate-btn')
      btn.disabled = true
      btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Generating...'
      try {
        const { data } = await API.post('/llm/synthesize', {
          api_key: apiKey, prompt: $('#llm-prompt').value.trim(), report_type: $('#llm-report-type').value
        })
        const output = $('#llm-output')
        output.classList.remove('hidden')
        $('#llm-content').textContent = data.synthesis
        gsap.from(output, { y: 20, opacity: 0, duration: 0.5 })
        $('#save-llm-report-btn').onclick = async () => {
          await API.post('/reports/saved', {
            title: `LLM ${$('#llm-report-type').value} — ${dayjs().format('YYYY-MM-DD HH:mm')}`,
            report_type: 'llm_synthesis', content: data.synthesis
          })
          toast('Report saved! View in Reports → Saved.', 'success')
        }
      } catch (e) {
        toast('LLM synthesis failed: ' + (e.response?.data?.error || e.message), 'error')
      }
      btn.disabled = false
      btn.innerHTML = '<i class="fas fa-robot"></i> Generate Synthesis'
    })
  }

  // ── ADMIN ────────────────────────────────────────────────
  async function renderAdminView() {
    const content = $('#main-content')
    try {
      const { data: codes } = await API.get('/auth/codes')
      content.innerHTML = `
        <div class="space-y-6">
          <div><h2 class="text-xl font-bold">Administration</h2><p class="text-sm text-slate-400">Manage access codes and system settings</p></div>
          <div class="glass-card rounded-2xl p-6">
            <h3 class="font-semibold mb-4">Access Passcodes</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead><tr class="text-slate-500 text-left"><th class="p-2">Role</th><th class="p-2">Passcode</th><th class="p-2">Label</th><th class="p-2">Active</th><th class="p-2">Created</th></tr></thead>
                <tbody>${codes.map(c => `
                  <tr class="border-t border-slate-800/50">
                    <td class="p-2"><span class="px-2 py-0.5 rounded-lg text-xs border ${c.role === 'venture_owner' ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20'}">${c.role}</span></td>
                    <td class="p-2 font-mono text-xs">${c.passcode}</td>
                    <td class="p-2 text-slate-400">${c.label}</td>
                    <td class="p-2"><button onclick="window._toggleCode(${c.id}, ${c.is_active ? 0 : 1})" class="text-xs px-2 py-1 rounded-lg border ${c.is_active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 'bg-red-500/20 text-red-400 border-red-500/20'}">${c.is_active ? 'Active' : 'Disabled'}</button></td>
                    <td class="p-2 text-xs text-slate-500">${c.created_at || ''}</td>
                  </tr>`).join('')}</tbody>
              </table>
            </div>
            <button id="add-code-btn" class="mt-4 bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm transition"><i class="fas fa-plus mr-1"></i> New Passcode</button>
          </div>
        </div>`

      window._toggleCode = async (id, active) => {
        await API.put(`/auth/codes/${id}`, { is_active: active })
        toast('Passcode toggled.', 'success')
        state.activeView = 'admin'; navigateView()
      }
      $('#add-code-btn').addEventListener('click', () => {
        showModal(`
          <form id="code-form" class="space-y-4 text-left">
            <h3 class="text-lg font-bold">New Access Code</h3>
            <div><label class="text-xs text-slate-400">Role</label><select name="role" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"><option value="coe_leader">CoE Leader</option><option value="venture_owner">Venture Owner</option></select></div>
            <div><label class="text-xs text-slate-400">Passcode</label><input name="passcode" required class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
            <div><label class="text-xs text-slate-400">Label</label><input name="label" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
            <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-medium transition btn-glow">Create</button>
          </form>`)
        $('#code-form').addEventListener('submit', async (e) => {
          e.preventDefault()
          const fd = new FormData(e.target)
          await API.post('/auth/codes', Object.fromEntries(fd.entries()))
          toast('New passcode created!', 'success')
          closeModal()
          state.activeView = 'admin'; navigateView()
        })
      })

      gsap.from('#main-content .glass-card', { y: 20, opacity: 0, duration: 0.4 })
    } catch (e) {
      content.innerHTML = errorHtml('admin', e)
    }
  }

  // ============================================================
  // ── FOUNDATIONAL SETUP TRACKER (v3) ───────────────────────
  // Stage-by-stage tracker: Planning → Design → Procurement →
  // Deployment → Readiness. Excel-like line items under section
  // headers, best-practice tooltips, CoE Director → Venture
  // Leader governance workflow, analytics & decision log.
  // ============================================================
  const SETUP_STATUS_COLORS = {
    not_started: 'bg-slate-700/50 text-slate-400 border-slate-700/30',
    in_progress: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20',
    blocked: 'bg-red-500/20 text-red-400 border-red-500/20',
    at_risk: 'bg-amber-500/20 text-amber-400 border-amber-500/20',
    done: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
    deferred: 'bg-slate-600/30 text-slate-500 border-slate-600/30',
    submitted: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    under_review: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
    changes_requested: 'bg-orange-500/20 text-orange-400 border-orange-500/20',
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
    pending: 'bg-slate-700/50 text-slate-400 border-slate-700/30',
    draft: 'bg-slate-700/50 text-slate-400 border-slate-700/30',
    pending_review: 'bg-amber-500/20 text-amber-400 border-amber-500/20'
  }
  const SETUP_PRIORITY_COLORS = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/20',
    high: 'bg-amber-500/20 text-amber-400 border-amber-500/20',
    medium: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    low: 'bg-slate-700/50 text-slate-400 border-slate-700/30'
  }
  const fmtINR = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN')

  async function renderSetupTracker() {
    const content = $('#main-content')
    const isVenture = state.role === 'venture_owner'
    try {
      const { data: tracker } = await API.get('/tracker')
      const { data: analytics } = await API.get('/tracker/analytics')
      const { data: submissions } = await API.get('/tracker/submissions')
      const { data: decisions } = await API.get('/tracker/decisions')

      // rebuild lookup cache
      setupCache = { stages: tracker.stages, sections: {}, items: {}, submissions, decisions, analytics }
      tracker.stages.forEach(st => st.sections.forEach(sec => {
        setupCache.sections[sec.id] = sec
        sec.line_items.forEach(it => { setupCache.items[it.id] = it })
      }))

      const tabs = [
        { id: 'tracker', icon: 'fa-table', label: 'Tracker Board' },
        ...(isVenture ? [{ id: 'reviewq', icon: 'fa-clipboard-check', label: `Review Queue (${analytics.pending_submissions})` }] : []),
        { id: 'analytics', icon: 'fa-chart-pie', label: 'Analytics' },
        { id: 'decisions', icon: 'fa-gavel', label: `Decision Log (${decisions.length})` }
      ]
      if (!isVenture && state.setupTab === 'reviewq') state.setupTab = 'tracker'

      content.innerHTML = `
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 class="text-xl font-bold">Foundational Setup Tracker</h2>
              <p class="text-sm text-slate-400">${isVenture
                ? 'Bird\'s-eye view of the CoE setup — review submissions, guide next steps, take decisions'
                : 'Build the CoE foundation line by line — planning, design, procurement, deployment, readiness'}</p>
            </div>
            <div class="flex items-center gap-2">
              <div class="text-right mr-2">
                <div class="text-xs text-slate-500">Overall Setup Progress</div>
                <div class="text-lg font-extrabold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">${tracker.overall_progress}%</div>
              </div>
              <button id="setup-export-btn" class="bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition"><i class="fas fa-download mr-1"></i> Export CSV</button>
            </div>
          </div>
          <div class="flex gap-1 bg-slate-900/60 rounded-xl p-1 w-fit border border-slate-800 flex-wrap">
            ${tabs.map(t => `<button class="setup-tab px-4 py-2 rounded-lg text-sm font-medium transition ${state.setupTab === t.id ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}" data-st="${t.id}"><i class="fas ${t.icon} mr-1.5"></i>${t.label}</button>`).join('')}
          </div>
          <div id="setup-content-area" class="space-y-4"></div>
        </div>`

      $$('.setup-tab').forEach(btn => btn.addEventListener('click', () => {
        state.setupTab = btn.dataset.st
        renderSetupTracker()
      }))
      $('#setup-export-btn').addEventListener('click', () => window.open('/api/tracker/export/csv', '_blank'))

      switch (state.setupTab) {
        case 'reviewq': renderSetupReviewQueue(isVenture); break
        case 'analytics': renderSetupAnalytics(); break
        case 'decisions': renderSetupDecisions(isVenture); break
        default: renderTrackerBoard(isVenture)
      }
    } catch (e) {
      content.innerHTML = errorHtml('setup tracker', e)
    }
  }

  // ── TRACKER BOARD — stages → sections → Excel grid ──────
  function renderTrackerBoard(isVenture) {
    const area = $('#setup-content-area')
    const stages = setupCache.stages
    if (state.setupStageId === 0 && stages.length > 0) state.setupStageId = stages[0].id
    const stage = stages.find(s => s.id === state.setupStageId) || stages[0]

    area.innerHTML = `
      <!-- STAGE STEPPER -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2" id="stage-stepper">
        ${stages.map((st, i) => {
          const active = st.id === stage.id
          const stColors = { completed: 'border-emerald-500/50', in_progress: 'border-indigo-500/50', blocked: 'border-red-500/50', pending: 'border-slate-700/50' }
          return `<button class="stage-step glass-card rounded-xl p-3 text-left border-t-2 ${stColors[st.status] || ''} ${active ? 'ring-1 ring-indigo-500/50 bg-indigo-600/10' : ''} transition hover:border-indigo-500/40" data-stage="${st.id}">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stage ${i + 1}</span>
              <span class="text-xs font-bold ${st.stats.avg_progress >= 70 ? 'text-emerald-400' : st.stats.avg_progress >= 30 ? 'text-indigo-400' : 'text-slate-500'}">${st.stats.avg_progress}%</span>
            </div>
            <div class="font-semibold text-sm mt-0.5">${st.name}</div>
            <div class="text-[10px] text-slate-500 mt-0.5">${st.stats.done_items}/${st.stats.total_items} items done · ${fmtINR(st.stats.est_cost)}</div>
            <div class="mt-2 bg-slate-800/50 rounded-full h-1 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full" style="width:${st.stats.avg_progress}%"></div>
            </div>
          </button>`
        }).join('')}
      </div>

      <!-- STAGE OBJECTIVE BANNER -->
      <div class="glass-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-start gap-4 border-l-2 border-indigo-500/50">
        <div class="flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="font-bold">${stage.name}</h3>
            <span class="text-xs px-2 py-0.5 rounded-full border ${SETUP_STATUS_COLORS[stage.status] || ''}">${stage.status.replace(/_/g, ' ')}</span>
          </div>
          <p class="text-sm text-slate-400 mt-1">${stage.description || ''}</p>
          <p class="text-xs text-cyan-400/80 mt-2 flex items-start gap-1.5"><i class="fas fa-bullseye mt-0.5"></i> <span><strong>Objective:</strong> ${stage.objective || '—'}</span></p>
        </div>
        ${!isVenture ? `<button id="add-section-btn" class="shrink-0 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition btn-glow"><i class="fas fa-plus mr-1"></i> Add Section Header</button>` : ''}
      </div>

      <!-- SECTIONS -->
      <div class="space-y-6" id="sections-area">
        ${stage.sections.length === 0 ? `<div class="glass-card rounded-2xl p-10 text-center"><p class="text-slate-500">No section headers yet in this stage.</p>${!isVenture ? '<p class="text-xs text-slate-600 mt-1">Click "Add Section Header" to create your first section (e.g., Procurement Planning).</p>' : ''}</div>` : ''}
        ${stage.sections.map(sec => sectionCardHtml(sec, isVenture)).join('')}
      </div>`

    $$('.stage-step').forEach(btn => btn.addEventListener('click', () => {
      state.setupStageId = parseInt(btn.dataset.stage)
      renderTrackerBoard(isVenture)
    }))
    const addSecBtn = $('#add-section-btn')
    if (addSecBtn) addSecBtn.addEventListener('click', () => openSectionForm(stage.id))

    wireSectionCards(isVenture)
    gsap.from('#stage-stepper > button', { y: 20, opacity: 0, duration: 0.4, stagger: 0.06 })
    gsap.from('#sections-area > div', { y: 30, opacity: 0, duration: 0.5, stagger: 0.1 })
  }

  function sectionCardHtml(sec, isVenture) {
    const s = sec.stats
    return `
    <div class="glass-card rounded-2xl overflow-hidden" id="section-${sec.id}">
      <!-- SECTION HEADER -->
      <div class="p-5 border-b border-slate-800/50 flex flex-col lg:flex-row lg:items-center gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="font-bold">${sec.title}</h3>
            <span class="text-xs px-2 py-0.5 rounded-full border ${SETUP_STATUS_COLORS[sec.status] || ''}">${sec.status.replace(/_/g, ' ')}</span>
            <!-- BEST-PRACTICE TOOLTIP -->
            ${sec.guideline_summary ? `
            <span class="relative group cursor-help">
              <i class="fas fa-lightbulb text-amber-400/80 hover:text-amber-300 transition"></i>
              <span class="absolute left-1/2 -translate-x-1/2 top-6 z-30 hidden group-hover:block w-72 bg-slate-900 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200/90 shadow-2xl normal-case font-normal">
                <span class="block text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-1"><i class="fas fa-star mr-1"></i>Best Practice</span>
                ${sec.guideline_summary}
              </span>
            </span>` : ''}
          </div>
          <p class="text-xs text-slate-500 mt-1">${sec.description || ''}</p>
        </div>
        <div class="flex items-center gap-3 shrink-0 flex-wrap">
          <div class="text-xs text-slate-500 text-right">
            <div>${s.done}/${s.total} done · ${s.avg_progress}%</div>
            <div class="text-slate-600">${fmtINR(s.est_cost)} est.</div>
          </div>
          <div class="w-20 bg-slate-800/50 rounded-full h-1.5 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full" style="width:${s.avg_progress}%"></div>
          </div>
          ${!isVenture ? `
            <button class="add-row-btn bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-600/30 text-xs px-3 py-2 rounded-lg transition font-medium" data-section="${sec.id}"><i class="fas fa-plus mr-1"></i> Add Row</button>
            <button class="tips-btn bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 text-xs px-3 py-2 rounded-lg transition" data-section="${sec.id}" title="Best-practice guidance"><i class="fas fa-lightbulb mr-1"></i> Tips (${sec.guidelines.length})</button>
            ${sec.status !== 'submitted' && sec.status !== 'approved' && s.total > 0 ? `<button class="submit-section-btn bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs px-3 py-2 rounded-lg transition font-medium" data-section="${sec.id}"><i class="fas fa-paper-plane mr-1"></i> Submit for Review</button>` : ''}
          ` : `
            <button class="tips-btn bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 text-xs px-3 py-2 rounded-lg transition" data-section="${sec.id}" title="Best-practice guidance"><i class="fas fa-lightbulb mr-1"></i> Tips (${sec.guidelines.length})</button>
            <button class="decide-btn bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-600/30 text-xs px-3 py-2 rounded-lg transition font-medium" data-section="${sec.id}"><i class="fas fa-gavel mr-1"></i> Log Decision</button>
          `}
        </div>
      </div>
      ${sec.reviewer_notes_banner || ''}
      <!-- EXCEL-LIKE GRID -->
      <div class="overflow-x-auto">
        ${sec.line_items.length === 0 ? `<p class="text-xs text-slate-600 italic p-4">No line items yet. ${!isVenture ? 'Click "Add Row" to start building this section like a spreadsheet.' : ''}</p>` : `
        <table class="w-full text-xs">
          <thead>
            <tr class="text-slate-500 text-left border-b border-slate-800/50 bg-slate-900/40">
              <th class="p-2.5 min-w-[160px]">Line Item</th>
              <th class="p-2.5">Stakeholder</th>
              <th class="p-2.5 min-w-[140px]">Qty / Spec</th>
              <th class="p-2.5">Vendor</th>
              <th class="p-2.5">Priority</th>
              <th class="p-2.5 text-right">Est. ₹</th>
              <th class="p-2.5 min-w-[110px]">Progress</th>
              <th class="p-2.5">Status</th>
              <th class="p-2.5 min-w-[160px]">Action Item</th>
              <th class="p-2.5">Due</th>
              <th class="p-2.5">Review</th>
              <th class="p-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${sec.line_items.map(it => lineItemRowHtml(it, isVenture)).join('')}
          </tbody>
        </table>`}
      </div>
    </div>`
  }

  function lineItemRowHtml(it, isVenture) {
    const reviewBadge = {
      draft: '<span class="text-[10px] px-1.5 py-0.5 rounded border bg-slate-700/50 text-slate-500 border-slate-700/30">draft</span>',
      submitted: '<span class="text-[10px] px-1.5 py-0.5 rounded border bg-amber-500/20 text-amber-400 border-amber-500/20">submitted</span>',
      approved: '<span class="text-[10px] px-1.5 py-0.5 rounded border bg-emerald-500/20 text-emerald-400 border-emerald-500/20">approved</span>',
      changes_requested: '<span class="text-[10px] px-1.5 py-0.5 rounded border bg-orange-500/20 text-orange-400 border-orange-500/20">changes req.</span>'
    }[it.review_status] || ''
    return `
      <tr class="border-t border-slate-800/30 hover:bg-slate-800/20 transition align-top" id="li-row-${it.id}">
        <td class="p-2.5">
          <div class="font-medium text-slate-200">${it.item_name}</div>
          ${it.description ? `<div class="text-[10px] text-slate-500 mt-0.5">${it.description}</div>` : ''}
          ${it.notes ? `<div class="text-[10px] text-slate-500 italic mt-0.5"><i class="fas fa-sticky-note mr-1 text-slate-600"></i>${it.notes}</div>` : ''}
        </td>
        <td class="p-2.5 text-slate-400">${it.stakeholder || '—'}</td>
        <td class="p-2.5 text-slate-400">${it.quantity_notes || '—'}</td>
        <td class="p-2.5 text-slate-400">${it.vendor || '—'}</td>
        <td class="p-2.5"><span class="px-1.5 py-0.5 rounded border text-[10px] ${SETUP_PRIORITY_COLORS[it.priority] || ''}">${it.priority}</span></td>
        <td class="p-2.5 text-right text-slate-300 whitespace-nowrap">${fmtINR(it.estimated_cost)}${it.actual_cost ? `<div class="text-[10px] text-cyan-400">act: ${fmtINR(it.actual_cost)}</div>` : ''}</td>
        <td class="p-2.5">
          ${!isVenture ? `
          <div class="flex items-center gap-1.5">
            <input type="number" min="0" max="100" value="${it.progress_pct || 0}" data-item="${it.id}"
              class="li-progress w-14 bg-slate-800/80 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-200 text-center focus:border-indigo-500 outline-none">
            <span class="text-slate-600">%</span>
          </div>` : `
          <div class="flex items-center gap-1.5">
            <div class="w-14 bg-slate-800 rounded-full h-1.5 overflow-hidden"><div class="h-full bg-indigo-500 rounded-full" style="width:${it.progress_pct || 0}%"></div></div>
            <span class="text-slate-400">${it.progress_pct || 0}%</span>
          </div>`}
        </td>
        <td class="p-2.5">
          ${!isVenture ? `
          <select data-item="${it.id}" class="li-status bg-slate-800/80 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-300 focus:border-indigo-500 outline-none">
            ${['not_started','in_progress','blocked','at_risk','done','deferred'].map(s => `<option value="${s}" ${it.status === s ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
          </select>` : `<span class="text-[10px] px-1.5 py-0.5 rounded border ${SETUP_STATUS_COLORS[it.status] || ''}">${it.status.replace(/_/g, ' ')}</span>`}
        </td>
        <td class="p-2.5">
          <div class="text-slate-300">${it.action_item || '<span class="text-slate-600">—</span>'}</div>
          ${it.reviewer_notes ? `<div class="text-[10px] text-orange-400/90 mt-1 flex items-start gap-1"><i class="fas fa-reply mt-0.5"></i><span><strong>Venture Leader:</strong> ${it.reviewer_notes}</span></div>` : ''}
        </td>
        <td class="p-2.5 text-slate-500 whitespace-nowrap">${it.due_date || '—'}</td>
        <td class="p-2.5">${reviewBadge}</td>
        <td class="p-2.5 text-right whitespace-nowrap">
          ${!isVenture ? `
            <button class="edit-item-btn text-indigo-400 hover:text-indigo-300 px-1.5 py-1 transition" data-item="${it.id}" title="Edit row"><i class="fas fa-pen"></i></button>
            <button class="del-item-btn text-slate-600 hover:text-red-400 px-1.5 py-1 transition" data-item="${it.id}" title="Delete row"><i class="fas fa-trash"></i></button>
          ` : (it.review_status === 'submitted' ? `
            <button class="li-approve-btn text-emerald-400 hover:text-emerald-300 px-1.5 py-1 transition" data-item="${it.id}" title="Approve this line"><i class="fas fa-check"></i></button>
            <button class="li-changes-btn text-orange-400 hover:text-orange-300 px-1.5 py-1 transition" data-item="${it.id}" title="Request changes / give guidance"><i class="fas fa-comment-dots"></i></button>
          ` : '')}
        </td>
      </tr>`
  }

  function wireSectionCards(isVenture) {
    // Inline progress updates (Excel-like)
    $$('.li-progress').forEach(inp => {
      inp.addEventListener('change', async () => {
        const id = inp.dataset.item
        const pct = Math.max(0, Math.min(100, parseInt(inp.value) || 0))
        inp.value = pct
        try {
          const payload = { progress_pct: pct }
          if (pct >= 100) payload.status = 'done'
          await API.put(`/tracker/items/${id}`, payload)
          toast('Progress updated.', 'success')
        } catch { toast('Update failed.', 'error') }
      })
    })
    // Inline status updates
    $$('.li-status').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = sel.dataset.item
        try {
          const payload = { status: sel.value }
          if (sel.value === 'done') payload.progress_pct = 100
          await API.put(`/tracker/items/${id}`, payload)
          toast('Status updated.', 'success')
          if (sel.value === 'done') renderSetupTracker()
        } catch { toast('Update failed.', 'error') }
      })
    })
    // Add row buttons
    $$('.add-row-btn').forEach(btn => btn.addEventListener('click', () => openLineItemForm(parseInt(btn.dataset.section))))
    // Edit row
    $$('.edit-item-btn').forEach(btn => btn.addEventListener('click', () => openLineItemForm(null, setupCache.items[btn.dataset.item])))
    // Delete row
    $$('.del-item-btn').forEach(btn => btn.addEventListener('click', () => {
      const it = setupCache.items[btn.dataset.item]
      showModal(`
        <div class="text-left space-y-4">
          <h3 class="text-lg font-bold">Delete Line Item</h3>
          <p class="text-sm text-slate-400">Remove "<strong class="text-slate-200">${it.item_name}</strong>" permanently?</p>
          <div class="flex gap-2">
            <button id="del-cancel" class="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-lg text-sm transition">Cancel</button>
            <button id="del-confirm" class="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 py-2.5 rounded-lg text-sm font-medium transition"><i class="fas fa-trash mr-1"></i> Delete</button>
          </div>
        </div>`)
      $('#del-cancel').addEventListener('click', closeModal)
      $('#del-confirm').addEventListener('click', async () => {
        await API.delete(`/tracker/items/${it.id}`)
        toast('Line item deleted.', 'info')
        closeModal(); renderSetupTracker()
      })
    }))
    // Tips modal
    $$('.tips-btn').forEach(btn => btn.addEventListener('click', () => openGuidelinesModal(parseInt(btn.dataset.section), isVenture)))
    // Submit section for review
    $$('.submit-section-btn').forEach(btn => btn.addEventListener('click', () => {
      const sec = setupCache.sections[btn.dataset.section]
      showModal(`
        <form id="submit-section-form" class="text-left space-y-4">
          <h3 class="text-lg font-bold">Submit Section for Review</h3>
          <p class="text-sm text-slate-400">All <strong class="text-slate-200">${sec.stats.total}</strong> line items under "<strong class="text-slate-200">${sec.title}</strong>" will be sent to the Venture Leader for review and approval.</p>
          <div>
            <label class="text-xs text-slate-400">Cover Note (optional)</label>
            <textarea name="notes" rows="3" placeholder="Context for the reviewer — what's ready, where you need guidance..." class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea>
          </div>
          <button type="submit" class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-2.5 rounded-lg font-medium transition"><i class="fas fa-paper-plane mr-1"></i> Submit for Venture Leader Review</button>
        </form>`)
      $('#submit-section-form').addEventListener('submit', async (e) => {
        e.preventDefault()
        const fd = new FormData(e.target)
        try {
          const { data } = await API.post('/tracker/submit', { section_id: sec.id, notes: fd.get('notes') })
          toast(`Section submitted — ${data.item_count} line items sent for review.`, 'success')
          closeModal(); renderSetupTracker()
        } catch (err) { toast(err.response?.data?.error || 'Submission failed.', 'error') }
      })
    }))
    // Venture: per-line approve / request changes
    $$('.li-approve-btn').forEach(btn => btn.addEventListener('click', async () => {
      try {
        await API.put(`/tracker/items/${btn.dataset.item}/review`, { action: 'approve', reviewer_notes: 'Line approved.' })
        toast('Line item approved.', 'success')
        renderSetupTracker()
      } catch { toast('Action failed.', 'error') }
    }))
    $$('.li-changes-btn').forEach(btn => btn.addEventListener('click', () => {
      const it = setupCache.items[btn.dataset.item]
      showModal(`
        <form id="li-changes-form" class="text-left space-y-4">
          <h3 class="text-lg font-bold">Request Changes / Guidance</h3>
          <p class="text-sm text-slate-400">Give the CoE Director edit instructions for "<strong class="text-slate-200">${it.item_name}</strong>".</p>
          <div>
            <label class="text-xs text-slate-400">Guidance / Edit Instructions</label>
            <textarea name="reviewer_notes" rows="3" required placeholder="e.g., Increase filament stock to cover 2 cohorts; get second vendor quote before approval..." class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea>
          </div>
          <button type="submit" class="w-full bg-orange-600/30 hover:bg-orange-600/50 text-orange-300 border border-orange-600/30 py-2.5 rounded-lg font-medium transition"><i class="fas fa-comment-dots mr-1"></i> Send Guidance</button>
        </form>`)
      $('#li-changes-form').addEventListener('submit', async (e) => {
        e.preventDefault()
        const fd = new FormData(e.target)
        await API.put(`/tracker/items/${it.id}/review`, { action: 'request_changes', reviewer_notes: fd.get('reviewer_notes') })
        toast('Guidance sent to the CoE Director.', 'success')
        closeModal(); renderSetupTracker()
      })
    }))
    // Venture: log decision
    $$('.decide-btn').forEach(btn => btn.addEventListener('click', () => openDecisionForm(parseInt(btn.dataset.section), isVenture)))
  }

  // ── LINE ITEM FORM (add/edit row) ────────────────────────
  function openLineItemForm(sectionId, editData = null) {
    const d = editData || {}
    const secId = editData ? editData.section_id : sectionId
    showModal(`
      <form id="li-form" class="space-y-3 text-left max-h-[70vh] overflow-y-auto pr-1">
        <h3 class="text-lg font-bold">${editData ? 'Edit' : 'New'} Line Item</h3>
        <div><label class="text-xs text-slate-400">Line Item <span class="text-red-400">*</span></label>
          <input name="item_name" required value="${d.item_name || ''}" placeholder="e.g., FDM 3D Printer Fleet" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></div>
        <div><label class="text-xs text-slate-400">Description</label>
          <input name="description" value="${d.description || ''}" placeholder="What this is for" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-400">Stakeholder</label>
            <input name="stakeholder" value="${d.stakeholder || ''}" placeholder="Owner / responsible" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></div>
          <div><label class="text-xs text-slate-400">Vendor</label>
            <input name="vendor" value="${d.vendor || ''}" placeholder="Vendor (or quote status)" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></div>
        </div>
        <div><label class="text-xs text-slate-400">Quantity / Spec Notes</label>
          <input name="quantity_notes" value="${d.quantity_notes || ''}" placeholder="e.g., 4 units · ≥300mm³ bed · dual extrusion" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></div>
        <div class="grid grid-cols-3 gap-3">
          <div><label class="text-xs text-slate-400">Priority</label>
            <select name="priority" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">${['low','medium','high','critical'].map(p => `<option value="${p}" ${d.priority === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
          <div><label class="text-xs text-slate-400">Est. Cost (₹)</label>
            <input name="estimated_cost" type="number" step="any" value="${d.estimated_cost || 0}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
          <div><label class="text-xs text-slate-400">Actual Cost (₹)</label>
            <input name="actual_cost" type="number" step="any" value="${d.actual_cost || 0}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div><label class="text-xs text-slate-400">Progress %</label>
            <input name="progress_pct" type="number" min="0" max="100" value="${d.progress_pct || 0}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
          <div><label class="text-xs text-slate-400">Status</label>
            <select name="status" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">${['not_started','in_progress','blocked','at_risk','done','deferred'].map(s => `<option value="${s}" ${d.status === s ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}</select></div>
          <div><label class="text-xs text-slate-400">Due Date</label>
            <input name="due_date" type="date" value="${d.due_date || ''}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
        </div>
        <div><label class="text-xs text-slate-400">Action Item (next step)</label>
          <input name="action_item" value="${d.action_item || ''}" placeholder="e.g., Collect 2nd quotation and compare service terms" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></div>
        <div><label class="text-xs text-slate-400">Notes</label>
          <textarea name="notes" rows="2" placeholder="Free-form notes about this line item..." class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500">${d.notes || ''}</textarea></div>
        <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-medium transition btn-glow"><i class="fas fa-save mr-1"></i> ${editData ? 'Save Changes' : 'Add Line Item'}</button>
      </form>`)

    $('#li-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const payload = Object.fromEntries(fd.entries())
      payload.estimated_cost = parseFloat(payload.estimated_cost) || 0
      payload.actual_cost = parseFloat(payload.actual_cost) || 0
      payload.progress_pct = Math.max(0, Math.min(100, parseInt(payload.progress_pct) || 0))
      try {
        if (editData) {
          await API.put(`/tracker/items/${editData.id}`, payload)
          toast('Line item updated.', 'success')
        } else {
          payload.section_id = secId
          await API.post('/tracker/items', payload)
          toast('Line item added.', 'success')
        }
        closeModal(); renderSetupTracker()
      } catch (err) { toast(err.response?.data?.error || 'Save failed.', 'error') }
    })
  }

  // ── SECTION FORM (new section header) ────────────────────
  function openSectionForm(stageId) {
    showModal(`
      <form id="section-form" class="space-y-3 text-left">
        <h3 class="text-lg font-bold">New Section Header</h3>
        <p class="text-xs text-slate-500">Sections group line items under a stage (e.g., "Procurement Planning" under Planning).</p>
        <div><label class="text-xs text-slate-400">Section Title <span class="text-red-400">*</span></label>
          <input name="title" required placeholder="e.g., Layout Design & Zoning" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></div>
        <div><label class="text-xs text-slate-400">Description</label>
          <textarea name="description" rows="2" placeholder="What this section covers..." class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea></div>
        <div><label class="text-xs text-slate-400">Best-Practice Summary (tooltip)</label>
          <textarea name="guideline_summary" rows="2" placeholder="One-line best-practice guidance shown as a tooltip on this section header..." class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea></div>
        <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-medium transition btn-glow"><i class="fas fa-plus mr-1"></i> Create Section</button>
      </form>`)
    $('#section-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      try {
        await API.post('/tracker/sections', { stage_id: stageId, ...Object.fromEntries(fd.entries()) })
        toast('Section header created.', 'success')
        closeModal(); renderSetupTracker()
      } catch (err) { toast(err.response?.data?.error || 'Save failed.', 'error') }
    })
  }

  // ── GUIDELINES MODAL (best-practice tips) ────────────────
  function openGuidelinesModal(sectionId, isVenture) {
    const sec = setupCache.sections[sectionId]
    showModal(`
      <div class="text-left space-y-4">
        <div>
          <h3 class="text-lg font-bold flex items-center gap-2"><i class="fas fa-lightbulb text-amber-400"></i> Best-Practice Guidance</h3>
          <p class="text-xs text-slate-500 mt-0.5">${sec.title}</p>
        </div>
        ${sec.guideline_summary ? `<div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-200/90">${sec.guideline_summary}</div>` : ''}
        <div class="space-y-2 max-h-64 overflow-y-auto">
          ${sec.guidelines.length === 0 ? '<p class="text-xs text-slate-600 italic">No tips yet.</p>' : sec.guidelines.map(g => `
            <div class="flex items-start gap-2 bg-slate-800/60 rounded-xl px-3 py-2.5 text-xs text-slate-300 border border-slate-700/30">
              <i class="fas fa-check-circle text-emerald-400/70 mt-0.5 shrink-0"></i>
              <span class="flex-1">${g.tip}</span>
              ${!isVenture ? `<button class="del-tip-btn text-slate-600 hover:text-red-400 shrink-0 transition" data-tip="${g.id}"><i class="fas fa-times"></i></button>` : ''}
            </div>`).join('')}
        </div>
        ${!isVenture ? `
        <form id="tip-form" class="flex gap-2">
          <input name="tip" required placeholder="Add a best-practice tip..." class="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500">
          <button type="submit" class="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-600/30 px-4 py-2 rounded-lg text-sm font-medium transition shrink-0"><i class="fas fa-plus"></i></button>
        </form>` : ''}
      </div>`)
    if (!isVenture) {
      $('#tip-form').addEventListener('submit', async (e) => {
        e.preventDefault()
        const fd = new FormData(e.target)
        await API.post('/tracker/guidelines', { section_id: sectionId, tip: fd.get('tip') })
        toast('Tip added.', 'success')
        closeModal(); renderSetupTracker()
      })
      $$('.del-tip-btn').forEach(btn => btn.addEventListener('click', async () => {
        await API.delete(`/tracker/guidelines/${btn.dataset.tip}`)
        closeModal(); renderSetupTracker()
      }))
    }
  }

  // ── REVIEW QUEUE (Venture Leader) ────────────────────────
  function renderSetupReviewQueue(isVenture) {
    const area = $('#setup-content-area')
    const subs = setupCache.submissions
    const pending = subs.filter(s => s.status === 'pending_review')
    const past = subs.filter(s => s.status !== 'pending_review')

    area.innerHTML = `
      <div class="glass-card rounded-2xl p-5 border-l-2 border-amber-500/50">
        <h3 class="font-bold mb-1"><i class="fas fa-inbox text-amber-400 mr-2"></i>Pending Submissions (${pending.length})</h3>
        <p class="text-xs text-slate-500">Sections submitted by the CoE Director — approve to accept, or request changes with edit instructions.</p>
      </div>
      ${pending.length === 0 ? `<div class="glass-card rounded-2xl p-10 text-center"><i class="fas fa-check-circle text-4xl text-emerald-400/40 mb-3"></i><p class="text-slate-400">No pending setup submissions.</p></div>` : ''}
      ${pending.map(sub => {
        const sec = setupCache.sections[sub.section_id]
        return `
        <div class="glass-card rounded-2xl p-5 space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-semibold">${sub.section_title}</span>
                <span class="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">${sub.stage_name}</span>
                <span class="text-xs px-2 py-0.5 rounded-full border ${SETUP_STATUS_COLORS.pending_review}">${sub.status.replace(/_/g, ' ')}</span>
              </div>
              <p class="text-xs text-slate-500 mt-1">${sub.line_item_ids.length} line items · submitted ${sub.created_at || ''}</p>
              ${sub.notes ? `<p class="text-xs text-slate-400 italic mt-1"><i class="fas fa-quote-left mr-1 text-slate-600"></i>${sub.notes}</p>` : ''}
            </div>
            <div class="flex gap-2 shrink-0">
              <button class="open-section-btn bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 text-xs px-3 py-2 rounded-lg transition" data-section="${sub.section_id}"><i class="fas fa-eye mr-1"></i> View Items</button>
              <button class="sub-approve-btn bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-600/30 text-xs px-3 py-2 rounded-lg transition font-medium" data-sub="${sub.id}"><i class="fas fa-check mr-1"></i> Approve All</button>
              <button class="sub-changes-btn bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 border border-orange-600/30 text-xs px-3 py-2 rounded-lg transition font-medium" data-sub="${sub.id}"><i class="fas fa-comment-dots mr-1"></i> Request Changes</button>
            </div>
          </div>
          ${sec ? `<div class="bg-slate-900/40 rounded-xl overflow-hidden border border-slate-800/50">
            <table class="w-full text-xs">
              <thead><tr class="text-slate-500 text-left border-b border-slate-800/50"><th class="p-2">Line Item</th><th class="p-2">Priority</th><th class="p-2 text-right">Est. ₹</th><th class="p-2">Progress</th><th class="p-2">Action Item</th></tr></thead>
              <tbody>${sec.line_items.map(it => `<tr class="border-t border-slate-800/30"><td class="p-2 text-slate-300">${it.item_name}</td><td class="p-2"><span class="px-1.5 py-0.5 rounded border text-[10px] ${SETUP_PRIORITY_COLORS[it.priority] || ''}">${it.priority}</span></td><td class="p-2 text-right text-slate-400">${fmtINR(it.estimated_cost)}</td><td class="p-2 text-slate-400">${it.progress_pct}%</td><td class="p-2 text-slate-500">${it.action_item || '—'}</td></tr>`).join('')}</tbody>
            </table>
          </div>` : ''}
        </div>`
      }).join('')}
      ${past.length > 0 ? `
      <div class="glass-card rounded-2xl p-5">
        <h3 class="font-semibold mb-3 text-sm text-slate-400">Review History</h3>
        <div class="space-y-2">${past.slice(0, 10).map(sub => `
          <div class="flex items-center justify-between text-xs bg-slate-800/40 rounded-xl px-3 py-2.5 border border-slate-800/40">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-slate-300 font-medium">${sub.section_title}</span>
              <span class="px-2 py-0.5 rounded-full border ${SETUP_STATUS_COLORS[sub.status] || ''}">${sub.status.replace(/_/g, ' ')}</span>
            </div>
            <span class="text-slate-600">${sub.reviewed_at || sub.created_at || ''}</span>
          </div>
          ${sub.reviewer_notes ? `<p class="text-[10px] text-slate-500 pl-3 -mt-1"><i class="fas fa-reply mr-1"></i>${sub.reviewer_notes}</p>` : ''}`).join('')}
        </div>
      </div>` : ''}`

    $$('.open-section-btn').forEach(btn => btn.addEventListener('click', () => {
      const sec = setupCache.sections[btn.dataset.section]
      if (sec) { state.setupStageId = sec.stage_id; state.setupTab = 'tracker'; renderSetupTracker() }
    }))
    $$('.sub-approve-btn').forEach(btn => btn.addEventListener('click', () => {
      const sub = setupCache.submissions.find(s => s.id == btn.dataset.sub)
      showModal(`
        <form id="sub-approve-form" class="text-left space-y-4">
          <h3 class="text-lg font-bold">Approve Section Submission</h3>
          <p class="text-sm text-slate-400">All ${sub.line_item_ids.length} line items in "<strong class="text-slate-200">${sub.section_title}</strong>" will be marked approved.</p>
          <div><label class="text-xs text-slate-400">Approval Note (optional)</label>
            <textarea name="reviewer_notes" rows="2" placeholder="e.g., Approved — proceed to vendor PO stage..." class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea></div>
          <button type="submit" class="w-full bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-600/30 py-2.5 rounded-lg font-medium transition"><i class="fas fa-check mr-1"></i> Approve Section</button>
        </form>`)
      $('#sub-approve-form').addEventListener('submit', async (e) => {
        e.preventDefault()
        const fd = new FormData(e.target)
        await API.put(`/tracker/submissions/${sub.id}`, { action: 'approve', reviewer_notes: fd.get('reviewer_notes') })
        toast('Section approved.', 'success')
        closeModal(); renderSetupTracker()
      })
    }))
    $$('.sub-changes-btn').forEach(btn => btn.addEventListener('click', () => {
      const sub = setupCache.submissions.find(s => s.id == btn.dataset.sub)
      showModal(`
        <form id="sub-changes-form" class="text-left space-y-4">
          <h3 class="text-lg font-bold">Request Changes</h3>
          <p class="text-sm text-slate-400">Send "<strong class="text-slate-200">${sub.section_title}</strong>" back to the CoE Director with edit instructions.</p>
          <div><label class="text-xs text-slate-400">Edit Instructions / Guidance <span class="text-red-400">*</span></label>
            <textarea name="reviewer_notes" rows="4" required placeholder="e.g., Reclassify the SLA printer to Bucket 2 (defer), increase filament quantities for 2 cohorts, add LiPo cabinet to the safety section, then resubmit..." class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea></div>
          <button type="submit" class="w-full bg-orange-600/30 hover:bg-orange-600/50 text-orange-300 border border-orange-600/30 py-2.5 rounded-lg font-medium transition"><i class="fas fa-comment-dots mr-1"></i> Send Back with Instructions</button>
        </form>`)
      $('#sub-changes-form').addEventListener('submit', async (e) => {
        e.preventDefault()
        const fd = new FormData(e.target)
        await API.put(`/tracker/submissions/${sub.id}`, { action: 'request_changes', reviewer_notes: fd.get('reviewer_notes') })
        toast('Sent back with edit instructions.', 'info')
        closeModal(); renderSetupTracker()
      })
    }))
  }

  // ── SETUP ANALYTICS (bird's-eye view) ────────────────────
  function renderSetupAnalytics() {
    const area = $('#setup-content-area')
    const a = setupCache.analytics
    const statusMap = {}
    a.by_status.forEach(r => { statusMap[r.status] = r.count })
    const reviewMap = {}
    a.by_review.forEach(r => { reviewMap[r.review_status] = r.count })
    const totalItems = Object.values(statusMap).reduce((x, y) => x + y, 0)
    const doneItems = statusMap.done || 0
    const riskItems = (statusMap.blocked || 0) + (statusMap.at_risk || 0)
    const approvedItems = reviewMap.approved || 0
    const totalEst = a.cost_by_stage.reduce((x, r) => x + (r.est || 0), 0)
    const totalActual = a.cost_by_stage.reduce((x, r) => x + (r.actual || 0), 0)

    area.innerHTML = `
      <!-- KPI STRIP -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3" id="analytics-strip">
        ${[
          { label: 'Total Line Items', value: totalItems, icon: 'fa-list', color: 'text-indigo-400' },
          { label: 'Completed', value: doneItems, icon: 'fa-check-circle', color: 'text-emerald-400' },
          { label: 'Blocked / At Risk', value: riskItems, icon: 'fa-exclamation-triangle', color: 'text-red-400' },
          { label: 'Leader-Approved', value: approvedItems, icon: 'fa-stamp', color: 'text-cyan-400' },
          { label: 'Est. vs Actual', value: `${fmtINR(totalEst)}`, sub: `actual ${fmtINR(totalActual)}`, icon: 'fa-indian-rupee-sign', color: 'text-amber-400' }
        ].map(k => `
          <div class="glass-card rounded-2xl p-4">
            <div class="flex items-center gap-2 text-xs text-slate-500"><i class="fas ${k.icon} ${k.color}"></i>${k.label}</div>
            <div class="text-xl font-extrabold mt-1.5 ${k.color}">${k.value}</div>
            ${k.sub ? `<div class="text-[10px] text-slate-500 mt-0.5">${k.sub}</div>` : ''}
          </div>`).join('')}
      </div>

      <!-- CHARTS -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="glass-card rounded-2xl p-6">
          <h3 class="font-semibold mb-4"><i class="fas fa-chart-bar text-indigo-400 mr-2"></i>Stage Progress — % of items done</h3>
          <canvas id="setup-stage-chart" height="220"></canvas>
        </div>
        <div class="glass-card rounded-2xl p-6">
          <h3 class="font-semibold mb-4"><i class="fas fa-chart-pie text-cyan-400 mr-2"></i>Line Item Status Distribution</h3>
          <canvas id="setup-status-chart" height="220"></canvas>
        </div>
        <div class="glass-card rounded-2xl p-6">
          <h3 class="font-semibold mb-4"><i class="fas fa-coins text-amber-400 mr-2"></i>Estimated Cost by Stage</h3>
          <canvas id="setup-cost-chart" height="220"></canvas>
        </div>
        <div class="glass-card rounded-2xl p-6">
          <h3 class="font-semibold mb-4"><i class="fas fa-clipboard-check text-emerald-400 mr-2"></i>Governance Pipeline</h3>
          <div class="space-y-3">
            ${['draft','submitted','approved','changes_requested'].map(r => {
              const cnt = reviewMap[r] || 0
              const pct = totalItems > 0 ? Math.round((cnt / totalItems) * 100) : 0
              const labels = { draft: 'Draft (not yet submitted)', submitted: 'Submitted — awaiting review', approved: 'Approved by Venture Leader', changes_requested: 'Changes requested' }
              const barColors = { draft: 'bg-slate-600', submitted: 'bg-amber-500', approved: 'bg-emerald-500', changes_requested: 'bg-orange-500' }
              return `<div>
                <div class="flex justify-between text-xs mb-1"><span class="text-slate-400">${labels[r]}</span><span class="text-slate-300 font-medium">${cnt} (${pct}%)</span></div>
                <div class="bg-slate-800/50 rounded-full h-2 overflow-hidden"><div class="h-full ${barColors[r]} rounded-full transition-all duration-700" style="width:${pct}%"></div></div>
              </div>`
            }).join('')}
          </div>
        </div>
      </div>

      <!-- RISK ITEMS TABLE -->
      <div class="glass-card rounded-2xl overflow-hidden">
        <div class="p-5 border-b border-slate-800/50">
          <h3 class="font-semibold"><i class="fas fa-exclamation-triangle text-red-400 mr-2"></i>Blocked & At-Risk Line Items (${a.risk_items.length})</h3>
          <p class="text-xs text-slate-500 mt-0.5">Items needing immediate attention or a joint decision</p>
        </div>
        ${a.risk_items.length === 0 ? '<p class="text-xs text-slate-600 italic p-5">No blocked or at-risk items. Setup is flowing.</p>' : `
        <div class="overflow-x-auto"><table class="w-full text-xs">
          <thead><tr class="text-slate-500 text-left border-b border-slate-800/50 bg-slate-900/40"><th class="p-2.5">Line Item</th><th class="p-2.5">Section</th><th class="p-2.5">Stage</th><th class="p-2.5">Priority</th><th class="p-2.5">Status</th><th class="p-2.5">Action Item</th></tr></thead>
          <tbody>${a.risk_items.map(it => `
            <tr class="border-t border-slate-800/30 hover:bg-slate-800/20">
              <td class="p-2.5 font-medium text-slate-200">${it.item_name}</td>
              <td class="p-2.5 text-slate-400">${it.section_title}</td>
              <td class="p-2.5 text-slate-500">${it.stage_name}</td>
              <td class="p-2.5"><span class="px-1.5 py-0.5 rounded border text-[10px] ${SETUP_PRIORITY_COLORS[it.priority] || ''}">${it.priority}</span></td>
              <td class="p-2.5"><span class="px-1.5 py-0.5 rounded border text-[10px] ${SETUP_STATUS_COLORS[it.status] || ''}">${it.status.replace(/_/g, ' ')}</span></td>
              <td class="p-2.5 text-slate-400">${it.action_item || '—'}</td>
            </tr>`).join('')}
          </tbody></table></div>`}
      </div>`

    // Stage progress chart
    const ctx1 = document.getElementById('setup-stage-chart')
    if (ctx1) {
      if (state.charts.setupStage) state.charts.setupStage.destroy()
      state.charts.setupStage = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: a.by_stage.map(s => s.name),
          datasets: [{
            label: '% items done',
            data: a.by_stage.map(s => s.total > 0 ? Math.round((s.done / s.total) * 100) : 0),
            backgroundColor: ['#818cf8', '#60a5fa', '#f59e0b', '#06b6d4', '#34d399'],
            borderRadius: 6
          }]
        },
        options: { responsive: true, scales: { y: { max: 100, grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8' } } }, plugins: { legend: { display: false } } }
      })
    }
    // Status doughnut
    const ctx2 = document.getElementById('setup-status-chart')
    if (ctx2) {
      if (state.charts.setupStatus) state.charts.setupStatus.destroy()
      const order = ['done', 'in_progress', 'blocked', 'at_risk', 'not_started', 'deferred']
      state.charts.setupStatus = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: order.map(s => s.replace(/_/g, ' ')),
          datasets: [{ data: order.map(s => statusMap[s] || 0), backgroundColor: ['#34d399', '#818cf8', '#f87171', '#fbbf24', '#475569', '#64748b'], borderColor: '#1e293b', borderWidth: 2 }]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8', padding: 12, font: { size: 11 } } } } }
      })
    }
    // Cost by stage
    const ctx3 = document.getElementById('setup-cost-chart')
    if (ctx3) {
      if (state.charts.setupCost) state.charts.setupCost.destroy()
      state.charts.setupCost = new Chart(ctx3, {
        type: 'bar',
        data: {
          labels: a.cost_by_stage.map(s => s.stage),
          datasets: [
            { label: 'Estimated ₹', data: a.cost_by_stage.map(s => s.est || 0), backgroundColor: '#818cf8', borderRadius: 4 },
            { label: 'Actual ₹', data: a.cost_by_stage.map(s => s.actual || 0), backgroundColor: '#06b6d4', borderRadius: 4 }
          ]
        },
        options: { responsive: true, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8' } }, y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } } }, plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } } }
      })
    }
    gsap.from('#analytics-strip > div', { y: 20, opacity: 0, duration: 0.4, stagger: 0.06 })
  }

  // ── DECISION LOG ─────────────────────────────────────────
  function renderSetupDecisions(isVenture) {
    const area = $('#setup-content-area')
    const decisions = setupCache.decisions || []
    const whoColors = { venture_leader: 'bg-amber-500/20 text-amber-400 border-amber-500/20', coe_leader: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20', joint: 'bg-purple-500/20 text-purple-400 border-purple-500/20' }
    const whoLabels = { venture_leader: 'Venture Leader', coe_leader: 'CoE Director', joint: 'Joint Decision' }

    area.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="glass-card rounded-2xl p-5 flex-1 border-l-2 border-purple-500/50">
          <h3 class="font-bold mb-1"><i class="fas fa-gavel text-purple-400 mr-2"></i>Decision & Action Log</h3>
          <p class="text-xs text-slate-500">Joint decisions and next-step guidance — every decision links back to the section or line item it affects, so action items stay clear.</p>
        </div>
        <button id="add-decision-btn" class="shrink-0 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition btn-glow"><i class="fas fa-plus mr-1"></i> Log Decision</button>
      </div>
      <div class="space-y-3" id="decision-list">
        ${decisions.length === 0 ? `<div class="glass-card rounded-2xl p-10 text-center"><i class="fas fa-gavel text-4xl text-slate-700 mb-3"></i><p class="text-slate-400">No decisions logged yet.</p></div>` : decisions.map(d => `
          <div class="glass-card rounded-2xl p-5 space-y-2 border-l-2 ${d.decided_by === 'venture_leader' ? 'border-amber-500/50' : d.decided_by === 'joint' ? 'border-purple-500/50' : 'border-indigo-500/50'}">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs px-2 py-0.5 rounded-full border ${whoColors[d.decided_by] || ''}">${whoLabels[d.decided_by] || d.decided_by}</span>
                ${d.section_title ? `<span class="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400"><i class="fas fa-folder mr-1"></i>${d.section_title}</span>` : ''}
                ${d.item_name ? `<span class="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300"><i class="fas fa-tag mr-1"></i>${d.item_name}</span>` : '<span class="text-[10px] text-slate-600">General</span>'}
              </div>
              <span class="text-xs text-slate-600">${d.decision_date || d.created_at || ''}</span>
            </div>
            <p class="text-sm text-slate-200">${d.decision}</p>
            ${d.next_steps ? `<div class="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-xs text-cyan-200/90 flex items-start gap-2"><i class="fas fa-arrow-right mt-0.5 shrink-0"></i><span><strong>Next steps:</strong> ${d.next_steps}</span></div>` : ''}
          </div>`).join('')}
      </div>`

    $('#add-decision-btn').addEventListener('click', () => openDecisionForm(null, isVenture))
    gsap.from('#decision-list > div', { y: 20, opacity: 0, duration: 0.4, stagger: 0.06 })
  }

  function openDecisionForm(sectionId, isVenture) {
    const sections = Object.values(setupCache.sections)
    showModal(`
      <form id="decision-form" class="space-y-3 text-left">
        <h3 class="text-lg font-bold">Log a Decision</h3>
        <p class="text-xs text-slate-500">Record a decision and the conditional next steps / edit instructions that follow from it.</p>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-400">Decided By</label>
            <select name="decided_by" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">
              <option value="venture_leader" ${isVenture ? 'selected' : ''}>Venture Leader</option>
              <option value="coe_leader" ${!isVenture ? 'selected' : ''}>CoE Director</option>
              <option value="joint">Joint</option>
            </select></div>
          <div><label class="text-xs text-slate-400">Date</label>
            <input name="decision_date" type="date" value="${dayjs().format('YYYY-MM-DD')}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
        </div>
        <div><label class="text-xs text-slate-400">Related Section (optional)</label>
          <select name="section_id" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">
            <option value="">— General / none —</option>
            ${sections.map(s => `<option value="${s.id}" ${sectionId === s.id ? 'selected' : ''}>${s.title}</option>`).join('')}
          </select></div>
        <div><label class="text-xs text-slate-400">Decision <span class="text-red-400">*</span></label>
          <textarea name="decision" rows="3" required placeholder="e.g., FDM printer fleet approved at 4 units; SLA printer deferred to Bucket 2..." class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea></div>
        <div><label class="text-xs text-slate-400">Next Steps / Edit Instructions</label>
          <textarea name="next_steps" rows="3" placeholder="e.g., CoE Director to attach 2nd quotation, then resubmit Procurement Planning section..." class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500"></textarea></div>
        <button type="submit" class="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-2.5 rounded-lg font-medium transition btn-glow"><i class="fas fa-gavel mr-1"></i> Log Decision</button>
      </form>`)
    $('#decision-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const payload = Object.fromEntries(fd.entries())
      payload.section_id = payload.section_id ? parseInt(payload.section_id) : null
      try {
        await API.post('/tracker/decisions', payload)
        toast('Decision logged.', 'success')
        closeModal(); renderSetupTracker()
      } catch (err) { toast(err.response?.data?.error || 'Save failed.', 'error') }
    })
  }

  // ── SHARED REPORT VIEW ───────────────────────────────────
  async function renderSharedView(token) {
    root.innerHTML = '<div class="min-h-screen flex items-center justify-center"><div class="flex flex-col items-center gap-3"><div class="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin"></div><p class="text-sm text-slate-500">Loading shared report...</p></div></div>'
    try {
      const { data } = await API.get(`/reports/shared/${token}`)
      if (data.error) { root.innerHTML = `<div class="min-h-screen flex items-center justify-center"><div class="glass-card rounded-2xl p-10 text-center"><p class="text-red-400 text-xl mb-2">Report Not Found</p><p class="text-slate-500">This shared link is invalid or has expired.</p></div></div>`; return }
      root.innerHTML = `
        <main class="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div class="glass-card rounded-2xl p-8">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 flex items-center justify-center border border-indigo-500/20">
                <i class="fas fa-drone text-indigo-400"></i>
              </div>
              <div><h1 class="text-2xl font-bold">${data.title}</h1><p class="text-sm text-slate-400">SRM dROIds CoE — ${data.report_type} &middot; ${data.created_at || ''}</p></div>
            </div>
            <div class="bg-slate-800/60 rounded-xl p-6 whitespace-pre-wrap text-slate-300 text-sm leading-relaxed border border-slate-700/30">${data.content || 'No content.'}</div>
          </div>
        </main>`
    } catch {
      root.innerHTML = '<div class="min-h-screen flex items-center justify-center"><div class="glass-card rounded-2xl p-10 text-center"><p class="text-red-400 text-xl mb-2">Error</p><p class="text-slate-500">Failed to load shared report.</p></div></div>'
    }
  }

  // ── MODAL ────────────────────────────────────────────────
  function showModal(html) {
    const existing = $('#global-modal')
    if (existing) existing.remove()
    const modal = document.createElement('div')
    modal.id = 'global-modal'
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4'
    modal.innerHTML = `<div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="modal-backdrop"></div>
      <div class="relative glass-card border-slate-700/50 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">${html}</div>`
    document.body.appendChild(modal)
    gsap.from(modal.querySelector('.relative'), { scale: 0.95, opacity: 0, duration: 0.25 })
    $('#modal-backdrop').addEventListener('click', closeModal)
  }

  function closeModal() {
    const modal = $('#global-modal')
    if (modal) { gsap.to(modal.querySelector('.relative'), { scale: 0.95, opacity: 0, duration: 0.15, onComplete: () => modal.remove() }) }
  }

  // ── DOWNLOAD CSV ─────────────────────────────────────────
  function downloadCSV(type) {
    window.open(`/api/export/csv/${type}`, '_blank')
  }

  // ── SHARE REPORT ─────────────────────────────────────────
  window._shareReport = async (title, content) => {
    const { data } = await API.post('/reports/saved', { title, report_type: 'custom', content })
    const url = window.location.origin + '/#share/' + data.share_token
    await navigator.clipboard.writeText(url)
    toast('Share link copied! Anyone can view this report.', 'success')
  }
  window._copyShareLink = async (token) => {
    const url = window.location.origin + '/#share/' + token
    await navigator.clipboard.writeText(url)
    toast('Share link copied!', 'success')
  }

  // ── ERROR ────────────────────────────────────────────────
  function errorHtml(section, e) {
    return `<div class="glass-card border-red-500/30 rounded-2xl p-8 text-center"><i class="fas fa-exclamation-triangle text-2xl text-red-400/60 mb-3"></i><p class="text-red-400">Failed to load ${section}</p><p class="text-xs text-red-500/60 mt-1">${e.message || 'Unknown error'}</p><button onclick="location.reload()" class="mt-4 bg-slate-700/50 hover:bg-slate-600 border border-slate-700 px-4 py-2 rounded-xl text-sm transition">Retry</button></div>`
  }

  // ── BOOT ─────────────────────────────────────────────────
  init()
})()
