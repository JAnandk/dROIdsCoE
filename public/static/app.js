// ============================================================================
// SRM dROIds — CoE Mission Tracker — Premium SPA v2
// Workflows: CoE Director submits → Venture Owner reviews/edits/approves
// Premium UX: glassmorphism, hero imagery, hidden passcodes
// ============================================================================
(function () {
  'use strict'

  let state = {
    role: null,
    session: null,
    passcode: null,
    activeView: 'dashboard',
    emailApiKey: null,
    charts: {},
    threeScene: null,
    facilityCampus: 'ramapuram',
    reviewFilter: 'pending_review',
    setupTab: 'tracker',
    setupStageId: 0,
    theme: localStorage.getItem('srm_theme') || 'night',
    campusScope: localStorage.getItem('srm_campus_scope') || 'both',
    campusLocked: localStorage.getItem('srm_campus_locked') === 'true',
    spaceRoomId: 0,
    facilityMode: 'zones', // 'zones' (existing facility map) | 'planner' (sqft space planner)
    collabTab: 'board'
  }

  // ── DAY / NIGHT THEME ────────────────────────────────────
  function applyTheme() {
    document.body.classList.toggle('day-mode', state.theme === 'day')
    const iconSun = document.querySelector('#theme-toggle .theme-icon-sun')
    const iconMoon = document.querySelector('#theme-toggle .theme-icon-moon')
    if (iconSun) iconSun.style.display = state.theme === 'day' ? 'none' : ''
    if (iconMoon) iconMoon.style.display = state.theme === 'day' ? '' : 'none'
  }
  function toggleTheme() {
    state.theme = state.theme === 'day' ? 'night' : 'day'
    localStorage.setItem('srm_theme', state.theme)
    applyTheme()
    // Re-render 3D views so scene colors follow the theme
    if (state.activeView === 'facility') renderFacilityView()
  }
  window._toggleTheme = toggleTheme

  function campusLabel(scope) { return scope === 'ramapuram' ? 'Ramapuram' : scope === 'trichy' ? 'Trichy' : 'All campuses' }
  function setCampusScope(scope) {
    if (state.campusLocked && scope !== state.campusScope) return toast('Campus scope is locked. Unlock it to switch sites.', 'error')
    state.campusScope = scope
    localStorage.setItem('srm_campus_scope', scope)
    state.facilityCampus = scope === 'trichy' ? 'trichy' : 'ramapuram'
    if ($('#campus-scope-bar')) renderApp()
  }
  function toggleCampusLock() {
    state.campusLocked = !state.campusLocked
    localStorage.setItem('srm_campus_locked', String(state.campusLocked))
    updateCampusScopeUI()
  }
  function updateCampusScopeUI() {
    $$('.campus-scope-btn').forEach(b => {
      const active = b.dataset.scope === state.campusScope
      b.className = `campus-scope-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition ${active ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`
    })
    const lock = $('#campus-lock-toggle')
    if (lock) { lock.innerHTML = `<i class="fas ${state.campusLocked ? 'fa-lock' : 'fa-lock-open'} mr-1"></i>${state.campusLocked ? 'Locked' : 'Unlocked'}`; lock.className = `px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${state.campusLocked ? 'bg-amber-500/15 text-amber-300 border-amber-400/30' : 'text-slate-400 border-slate-700 hover:text-slate-200'}` }
  }
  // Apply persisted theme on boot (before first paint of views)
  if (state.theme === 'day') document.body.classList.add('day-mode')

  // Lookup cache for tracker entities (sections/items by id)
  let setupCache = { stages: [], sections: {}, items: {}, submissions: [] }

  const API = axios.create({ baseURL: '/api' })
  API.interceptors.request.use(config => { if (state.session) config.headers['x-srm-session'] = state.session; return config })
  const $ = (s) => document.querySelector(s)
  const $$ = (s) => document.querySelectorAll(s)
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
  const root = $('#app-root')

  // ── SAFE ANIMATION — never leaves elements invisible ────
  // gsap.from() can leave elements stuck at opacity:0 if GSAP
  // fails to load or the animation is interrupted. This helper
  // guarantees a visible end-state with a hard fallback timer.
  function animateIn(selector, vars = {}) {
    const els = typeof selector === 'string' ? $$(selector) : [selector]
    if (!els || els.length === 0) return
    if (!window.gsap) return // CSS default state is visible — fine
    try {
      gsap.from(selector, { duration: 0.5, ...vars })
      // Hard fallback: force final visible state after animation window
      const dur = ((vars.duration || 0.5) + (vars.stagger ? vars.stagger * els.length : 0)) * 1000 + 400
      setTimeout(() => {
        els.forEach(el => {
          if (!el || !el.style) return
          const op = parseFloat(getComputedStyle(el).opacity)
          if (op < 0.95) { el.style.opacity = '1'; el.style.transform = 'none' }
        })
      }, Math.min(dur, 3000))
    } catch (e) { /* CSS default state is visible — fine */ }
  }

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

  // ── LANDING / LOGIN — 3D drone-lifecycle showcase (v5) ───
  const LANDING_PHASES = ['Raw Materials', 'Exploded View', 'Assembly', 'Flight Test', 'Swarm Ops', 'Command Center']
  const LANDING_IMPACTS = [
    { label: 'Precision Agriculture', img: 'https://sspark.genspark.ai/i/kmbmQ9YGKbWx2HXV?width=2560' },
    { label: 'Mining Surveys', img: 'https://sspark.genspark.ai/i/0Io4w8zP8ahNIguE?width=2560' },
    { label: 'Ocean & River Erosion Studies', img: 'https://sspark.genspark.ai/i/ZitMV8l18uhYZqr2?width=2560' },
    { label: 'Forest Inventory', img: 'https://sspark.genspark.ai/i/NevnnepGnJlYbYrq?width=2560' },
    { label: 'Geographical Mapping', img: null },
    { label: 'Disaster Response', img: null }
  ]

  function renderLogin() {
    root.innerHTML = `
      <main class="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        <div id="hero-canvas-wrap"></div>
        <div class="scan-line"></div>
        <div class="absolute top-0 left-0 right-0 z-10 pointer-events-none">
          <div class="max-w-7xl mx-auto px-6 pt-10 flex items-start justify-between gap-6">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                <span class="text-[10px] tracking-[0.3em] uppercase text-cyan-400/80 font-semibold">Deep-Tech Mission Control</span>
              </div>
              <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight leading-none">
                <span class="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent glow-text">SRM dROIds</span>
              </h1>
              <p class="text-slate-400 mt-2 text-xs sm:text-sm">Dual-Campus Drone Centre of Excellence — from blueprint to real-world impact</p>
              <div id="landing-phase-chip" class="hud-chip rounded-xl px-4 py-2 flex items-center gap-3 mt-4 w-fit max-w-[260px]">
                <i class="fas fa-drafting-compass text-indigo-400"></i>
                <div class="flex-1">
                  <div class="text-[10px] uppercase tracking-widest text-slate-500">Build Lifecycle</div>
                  <div id="landing-phase-name" class="text-sm font-bold text-slate-100">Raw Materials</div>
                </div>
                <div id="landing-phase-idx" class="text-[10px] text-slate-500 font-mono">01/06</div>
              </div>
            </div>
            <div class="hidden md:flex flex-col items-end gap-3">
              <div class="flex items-center gap-2 text-[10px] text-slate-500">
                <span class="hud-chip rounded-lg px-2.5 py-1.5"><i class="fas fa-map-marker-alt text-indigo-400 mr-1"></i>Ramapuram</span>
                <span class="hud-chip rounded-lg px-2.5 py-1.5"><i class="fas fa-map-marker-alt text-cyan-400 mr-1"></i>Trichy</span>
              </div>
              <div class="w-56 hud-chip rounded-2xl p-3 shadow-xl">
                <div class="text-[9px] uppercase tracking-[0.25em] text-slate-500 mb-2 flex items-center gap-1.5">
                  <i class="fas fa-earth-asia text-cyan-400"></i> Field Impact
                </div>
                <div class="relative h-28 rounded-xl overflow-hidden bg-slate-900/60 border border-slate-700/40">
                  <img id="impact-img" src="${LANDING_IMPACTS[0].img}" alt="${LANDING_IMPACTS[0].label}" class="w-full h-full object-cover" style="transition:opacity .3s">
                  <div id="impact-fallback" class="hidden absolute inset-0 items-center justify-center bg-gradient-to-br from-indigo-900/70 to-cyan-900/50" style="transition:opacity .3s"><i class="fas fa-satellite text-cyan-400/70 text-2xl"></i></div>
                </div>
                <div id="impact-ticker" class="text-xs text-cyan-300 font-medium mt-2 leading-snug" style="transition:opacity .3s">${LANDING_IMPACTS[0].label}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Collapsed login console — docked right edge, hero stays fully visible -->
        <button id="login-launcher" class="fixed right-0 top-1/2 -translate-y-1/2 z-30 hud-chip border-r-0 rounded-l-2xl pl-3 pr-4 py-5 flex flex-col items-center gap-2 hover:pl-5 transition-all duration-300 group" title="Open login console">
          <i class="fas fa-user-astronaut text-cyan-400 text-lg group-hover:scale-110 transition-transform"></i>
          <span class="text-[10px] font-bold tracking-[0.2em] text-slate-300" style="writing-mode:vertical-rl;">LOGIN</span>
          <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
        </button>

        <!-- Slide-out login console panel -->
        <aside id="login-console" class="fixed right-0 top-0 bottom-0 z-40 w-full max-w-[340px] translate-x-full pointer-events-none transition-transform duration-300 ease-out">
          <div class="h-full glass-card border-r-0 rounded-none rounded-l-3xl p-6 sm:p-8 flex flex-col justify-center shadow-2xl">
            <div class="flex items-center justify-between mb-6">
              <div>
                <div class="text-[10px] uppercase tracking-[0.25em] text-cyan-400/80 font-semibold mb-1">Mission Console</div>
                <h2 class="text-lg font-bold text-slate-100">Operator Login</h2>
              </div>
              <button id="login-console-close" class="text-slate-500 hover:text-slate-200 w-8 h-8 rounded-lg hover:bg-slate-800/60 transition flex items-center justify-center" title="Close console">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <form id="login-form" class="space-y-5">
              <div id="login-error" class="hidden bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm flex items-center gap-2">
                <i class="fas fa-exclamation-triangle"></i> <span></span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Access Passcode</label>
                <div class="relative">
                  <i class="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                  <input id="passcode-input" type="password" placeholder="Enter your secure passcode..."
                    class="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3.5 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition text-sm">
                </div>
              </div>
              <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-3.5 px-6 rounded-xl transition btn-glow flex items-center justify-center gap-2 text-sm">
                <i class="fas fa-rocket"></i> Enter Mission Control
              </button>
              <p class="text-center text-[11px] text-slate-500">Role-based access — Director / Venture / Supervisor</p>
            </form>
          </div>
        </aside>

        <div class="absolute bottom-0 left-0 right-0 z-10 pointer-events-none pb-6">
          <div class="max-w-7xl mx-auto px-6">
            <div class="flex items-center gap-1.5 justify-center flex-wrap">
              ${LANDING_PHASES.map((p, i) => `<span class="phase-chip hud-chip rounded-lg px-3 py-1.5 text-[11px] font-medium text-slate-400" data-phase="${i}">${p}</span>`).join('')}
            </div>
          </div>
        </div>
      </main>`

    initLandingScene()
    startLandingTicker()

    // Side console: launcher opens, close button / Esc closes
    const consolePanel = $('#login-console')
    const launcher = $('#login-launcher')
    const openConsole = () => {
      consolePanel.classList.remove('translate-x-full')
      consolePanel.classList.remove('pointer-events-none')
      launcher.style.opacity = '0'
      launcher.style.pointerEvents = 'none'
      setTimeout(() => $('#passcode-input')?.focus(), 320)
    }
    const closeConsole = () => {
      consolePanel.classList.add('translate-x-full')
      consolePanel.classList.add('pointer-events-none')
      launcher.style.opacity = '1'
      launcher.style.pointerEvents = ''
    }
    launcher.addEventListener('click', openConsole)
    $('#login-console-close').addEventListener('click', closeConsole)
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !consolePanel.classList.contains('translate-x-full')) closeConsole() })
    // Console stays collapsed until the user opens it — the hero animation stays fully visible

    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const code = $('#passcode-input').value.trim()
      if (!code) return
      try {
        const { data } = await API.post('/auth', { passcode: code })
        if (data.ok) {
          state.role = data.role
          state.session = data.session
          state.passcode = code
          renderApp()
        } else {
          showLoginError('Invalid passcode. Please try again.')
        }
      } catch {
        showLoginError('Invalid passcode. Please try again.')
      }
    })

    animateIn('#login-form', { y: 20, opacity: 0, duration: 0.5, delay: 0.2 })
    animateIn('#landing-phase-chip', { x: -20, opacity: 0, duration: 0.5 })
    animateIn('.phase-chip', { y: 16, opacity: 0, duration: 0.4, stagger: 0.05, delay: 0.3 })
  }

  // ── LANDING 3D SCENE — drone assembling from blueprint ───
  let landingTimer = null
  function startLandingTicker() {
    let i = 0
    if (landingTimer) clearInterval(landingTimer)
    landingTimer = setInterval(() => {
      const el = document.getElementById('impact-ticker')
      if (!el) { clearInterval(landingTimer); return }
      i = (i + 1) % LANDING_IMPACTS.length
      const item = LANDING_IMPACTS[i]
      el.style.opacity = '0'
      const img = document.getElementById('impact-img')
      const fb = document.getElementById('impact-fallback')
      if (img) img.style.opacity = '0'
      if (fb) fb.style.opacity = '0'
      setTimeout(() => {
        const t = document.getElementById('impact-ticker')
        if (!t) return
        t.textContent = item.label
        t.style.opacity = '1'
        const im = document.getElementById('impact-img')
        const fl = document.getElementById('impact-fallback')
        if (item.img && im) {
          im.src = item.img
          im.style.display = ''
          im.style.opacity = '1'
          if (fl) { fl.classList.add('hidden'); fl.classList.remove('flex') }
        } else if (im && fl) {
          im.style.display = 'none'
          fl.classList.remove('hidden')
          fl.classList.add('flex')
          fl.style.opacity = '1'
        }
      }, 300)
    }, 2600)
  }

  function initLandingScene() {
    const wrap = document.getElementById('hero-canvas-wrap')
    if (!wrap || !window.THREE) return
    const W = wrap.clientWidth, H = wrap.clientHeight
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x060a14)
    scene.fog = new THREE.Fog(0x060a14, 40, 110)
    const camera = new THREE.PerspectiveCamera(46, W / H, 0.1, 220)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    wrap.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0x4c5a8a, 1.2))
    const key = new THREE.DirectionalLight(0x88aaff, 2.0); key.position.set(10, 16, 8); scene.add(key)
    const rim = new THREE.PointLight(0x22d3ee, 50, 90); rim.position.set(-12, 8, -10); scene.add(rim)
    const warm = new THREE.PointLight(0xf59e0b, 30, 60); warm.position.set(12, 5, 10); scene.add(warm)

    // Blueprint floor grid + outer glow rings
    scene.add(new THREE.GridHelper(72, 72, 0x1d2a4d, 0x0e1730))
    for (let r = 6; r <= 30; r += 8) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.12, 72),
        new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.14, side: THREE.DoubleSide }))
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; scene.add(ring)
    }

    // Ambient particles
    const pGeo = new THREE.BufferGeometry()
    const pCount = 300, pArr = new Float32Array(pCount * 3)
    for (let i = 0; i < pCount; i++) { pArr[i * 3] = (Math.random() - 0.5) * 80; pArr[i * 3 + 1] = Math.random() * 30; pArr[i * 3 + 2] = (Math.random() - 0.5) * 80 }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3))
    const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x6366f1, size: 0.09, transparent: true, opacity: 0.5 }))
    scene.add(particles)

    // ── Drone parts with 3 pose targets: raw / exploded / assembled ──
    const drone = new THREE.Group(); scene.add(drone)
    const parts = []
    const carbon = 0x1f2430, accent = 0x6366f1, metal = 0x8b93a8, rawWood = 0x8a6a3f, rawSpool = 0x64748b
    function addPart(geo, color, assembled, exploded, raw, ry = 0) {
      const g = new THREE.Group()
      const solid = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6, transparent: true, opacity: 0 }))
      if (ry) solid.rotation.y = ry
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 }))
      if (ry) wire.rotation.y = ry
      // raw-material proxy: crate/spool shown only in phase 0
      const rawMesh = new THREE.Mesh(
        Math.random() > 0.5 ? new THREE.BoxGeometry(1.1, 0.8, 0.9) : new THREE.CylinderGeometry(0.45, 0.45, 0.9, 12),
        new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? rawWood : rawSpool, roughness: 0.85, metalness: 0.1, transparent: true, opacity: 1 }))
      g.add(solid); g.add(wire); g.add(rawMesh)
      g.position.copy(raw)
      g.userData = { assembled, exploded, raw, solid, wire, rawMesh, spin: false }
      drone.add(g); parts.push(g)
      return g
    }
    const A = (x, y, z) => new THREE.Vector3(x, y, z)
    const scatterRaw = (i) => A(Math.cos(i * 1.26) * (9 + (i % 3) * 2.2), 0.5, Math.sin(i * 1.26) * (9 + (i % 3) * 2.2))
    const explodedSpread = (x, y, z, i) => A(x * 1.9, y + 1.2 + (i % 4) * 0.9, z * 1.9)

    const defs = [
      [new THREE.BoxGeometry(6, 0.22, 0.5), carbon, A(0, 2, 0), Math.PI / 4],
      [new THREE.BoxGeometry(6, 0.22, 0.5), carbon, A(0, 2, 0), -Math.PI / 4],
      [new THREE.BoxGeometry(1.7, 0.75, 1.7), accent, A(0, 2.45, 0), 0],
      [new THREE.CylinderGeometry(0.26, 0.3, 0.55, 14), metal, A(1.9, 2.25, 1.9), 0],
      [new THREE.CylinderGeometry(0.26, 0.3, 0.55, 14), metal, A(1.9, 2.25, -1.9), 0],
      [new THREE.CylinderGeometry(0.26, 0.3, 0.55, 14), metal, A(-1.9, 2.25, 1.9), 0],
      [new THREE.CylinderGeometry(0.26, 0.3, 0.55, 14), metal, A(-1.9, 2.25, -1.9), 0],
      [new THREE.BoxGeometry(2.3, 0.045, 0.2), 0x22d3ee, A(1.9, 2.62, 1.9), 0],
      [new THREE.BoxGeometry(2.3, 0.045, 0.2), 0x22d3ee, A(1.9, 2.62, -1.9), 0],
      [new THREE.BoxGeometry(2.3, 0.045, 0.2), 0x22d3ee, A(-1.9, 2.62, 1.9), 0],
      [new THREE.BoxGeometry(2.3, 0.045, 0.2), 0x22d3ee, A(-1.9, 2.62, -1.9), 0],
      [new THREE.SphereGeometry(0.36, 16, 12), 0x0ea5e9, A(0, 1.6, 0.55), 0],
      [new THREE.BoxGeometry(1.05, 0.42, 1.45), 0xf59e0b, A(0, 3.02, 0), 0],
      [new THREE.BoxGeometry(0.12, 0.7, 1.9), metal, A(0.62, 1.35, 0), 0],
      [new THREE.BoxGeometry(0.12, 0.7, 1.9), metal, A(-0.62, 1.35, 0), 0]
    ]
    const props = []
    defs.forEach(([geo, color, asm, ry], i) => {
      const p = addPart(geo, color, asm, explodedSpread(asm.x, asm.y, asm.z, i), scatterRaw(i), ry)
      if (i >= 7 && i <= 10) { p.userData.spin = true; props.push(p) }
    })

    // Exploded-view connector lines (shown during phase 1)
    const connMat = new THREE.LineDashedMaterial({ color: 0x22d3ee, transparent: true, opacity: 0, dashSize: 0.35, gapSize: 0.22 })
    const connectors = parts.map(p => {
      const geo = new THREE.BufferGeometry().setFromPoints([A(0, 0, 0), A(0, 0, 0)])
      const line = new THREE.Line(geo, connMat)
      line.computeLineDistances()
      scene.add(line)
      return { line, part: p }
    })

    // ── Swarm (5 mini drones) — hidden until phase 4 ──
    const swarm = new THREE.Group(); scene.add(swarm)
    const swarmDrones = []
    for (let i = 0; i < 5; i++) {
      const d = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, metalness: 0.5 }))
      const pr = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.12), new THREE.MeshBasicMaterial({ color: 0x22d3ee }))
      const pr2 = pr.clone(); pr2.rotation.y = Math.PI / 2
      pr.position.y = 0.22; pr2.position.y = 0.22
      d.add(body); d.add(pr); d.add(pr2)
      d.visible = false
      swarm.add(d)
      swarmDrones.push({ g: d, props: [pr, pr2], phaseOff: i * 1.26 })
    }

    // ── Command center (consoles + trainees) — hidden until phase 5 ──
    const commandCenter = new THREE.Group(); scene.add(commandCenter)
    commandCenter.position.set(0, 0, -14)
    const consoles = []
    for (let i = -1; i <= 1; i++) {
      const desk = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 1.1), new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.5, metalness: 0.4 }))
      desk.position.set(i * 4.2, 0.5, 0)
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1), new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.9 }))
      screen.position.set(i * 4.2, 1.85, -0.35)
      // trainee: body + head
      const bodyT = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.05, 10), new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.7 }))
      bodyT.position.set(i * 4.2, 1.15, 1.35)
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd9b08c, roughness: 0.8 }))
      head.position.set(i * 4.2, 1.95, 1.35)
      commandCenter.add(desk); commandCenter.add(screen); commandCenter.add(bodyT); commandCenter.add(head)
      consoles.push(screen)
    }
    const ccWall = new THREE.Mesh(new THREE.PlaneGeometry(13.5, 4.6), new THREE.MeshBasicMaterial({ color: 0x101a33, transparent: true, opacity: 0.85, side: THREE.DoubleSide }))
    ccWall.position.set(0, 2.4, -0.9)
    commandCenter.add(ccWall)
    const ccTitle = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.9), new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.65, side: THREE.DoubleSide }))
    ccTitle.position.set(0, 4.3, -0.85)
    commandCenter.add(ccTitle)
    commandCenter.visible = false

    // ── Phase machine ──
    // 0 Raw Materials | 1 Exploded View | 2 Assembly | 3 Flight Test | 4 Swarm Ops | 5 Command Center
    let phase = 0, phaseClock = 0
    const PHASE_SECS = 4.2
    const ease = (k) => 1 - Math.pow(1 - k, 3)

    function syncPhaseDom() {
      const name = document.getElementById('landing-phase-name')
      const idx = document.getElementById('landing-phase-idx')
      if (name) name.textContent = LANDING_PHASES[phase]
      if (idx) idx.textContent = String(phase + 1).padStart(2, '0') + '/06'
      document.querySelectorAll('.phase-chip').forEach(c => {
        const active = Number(c.dataset.phase) === phase
        c.classList.toggle('text-cyan-300', active)
        c.classList.toggle('border-cyan-400/60', active)
        c.classList.toggle('text-slate-400', !active)
      })
    }
    syncPhaseDom()

    const clock = new THREE.Clock()
    let camAngle = 0.7
    const vTmp = new THREE.Vector3()

    function animate() {
      if (!document.body.contains(renderer.domElement)) { renderer.dispose(); return }
      requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)
      const t = clock.elapsedTime
      phaseClock += dt
      if (phaseClock > PHASE_SECS) { phaseClock = 0; phase = (phase + 1) % 6; syncPhaseDom() }
      const k = ease(Math.min(1, phaseClock / 1.1)) * 0.085 + 0.018

      parts.forEach((p, i) => {
        const u = p.userData
        let goal = u.raw
        if (phase === 1) goal = u.exploded
        else if (phase >= 2) goal = u.assembled
        p.position.lerp(goal, k)
        if (phase === 0) { p.position.y = u.raw.y + Math.sin(t * 1.2 + i) * 0.05; p.rotation.y += 0.004 }
        if (phase === 1) p.rotation.y += 0.006
        if (phase >= 2) p.rotation.y *= 0.94
        // material visibility: raw crate -> wireframe -> solid
        const rawOp = phase === 0 ? 1 : 0
        const wireOp = phase === 1 ? 0.95 : (phase === 0 ? 0.25 : 0.06)
        const solidOp = phase >= 2 ? 1 : 0.03
        u.rawMesh.material.opacity += (rawOp - u.rawMesh.material.opacity) * 0.09
        u.wire.material.opacity += (wireOp - u.wire.material.opacity) * 0.09
        u.solid.material.opacity += (solidOp - u.solid.material.opacity) * 0.09
        if (u.spin) p.rotation.y += phase >= 3 ? 0.6 : 0.02
      })

      // dashed connectors during exploded view
      connMat.opacity += ((phase === 1 ? 0.55 : 0) - connMat.opacity) * 0.1
      if (connMat.opacity > 0.02) connectors.forEach(({ line, part }) => {
        line.geometry.setFromPoints([part.position.clone(), part.userData.assembled.clone()])
        line.computeLineDistances()
      })

      // drone group motion per phase
      if (phase === 3) { drone.position.set(0, 1.3 + Math.sin(t * 2.4) * 0.45, 0); drone.rotation.y = Math.sin(t * 0.7) * 0.2 }
      else if (phase === 4) { const a = t * 0.5; drone.position.set(Math.cos(a) * 6.5, 4.6, Math.sin(a) * 6.5); drone.rotation.y = -a }
      else if (phase === 5) { const a = t * 0.32; drone.position.set(Math.cos(a) * 5, 6.2, Math.sin(a) * 5); drone.rotation.y = -a }
      else { drone.position.lerp(vTmp.set(0, 0, 0), 0.06); drone.rotation.y *= 0.95 }

      // swarm formation flight (phase 4+)
      swarmDrones.forEach((s, i) => {
        s.g.visible = phase >= 4
        if (!s.g.visible) return
        const a = t * 0.5 + s.phaseOff
        const radius = 6.5 + Math.sin(t + i) * 0.4
        const tx = Math.cos(a) * radius, tz = Math.sin(a) * radius
        const ty = 4.6 + Math.sin(t * 1.6 + s.phaseOff) * 0.35 + (i - 2) * 0.28
        s.g.position.lerp(vTmp.set(tx, ty, tz), 0.12)
        s.g.rotation.y = -a
        s.props.forEach(pr => pr.rotation.y += 0.7)
      })

      // command center reveal (phase 5)
      commandCenter.visible = phase === 5
      if (commandCenter.visible) {
        commandCenter.scale.y += (1 - commandCenter.scale.y) * 0.07
        commandCenter.position.y = -0.01
        consoles.forEach((s, i) => { s.material.opacity = 0.65 + Math.sin(t * 3 + i * 2) * 0.3 })
      } else commandCenter.scale.y = 0.01

      // camera: slow orbit, slightly higher during swarm/command phases
      camAngle += dt * (phase === 4 ? 0.2 : 0.1)
      const camR = phase >= 4 ? 19 : 15.5
      const camY = phase === 5 ? 9.5 : phase === 4 ? 9 : 7.5
      const lookZ = phase === 5 ? -5 : 0
      camera.position.set(Math.cos(camAngle) * camR, camY + Math.sin(t * 0.3) * 0.4, Math.sin(camAngle) * camR + lookZ)
      camera.lookAt(0, 2.8, lookZ)
      particles.rotation.y = t * 0.01
      renderer.render(scene, camera)
    }
    animate()

    window.addEventListener('resize', () => {
      if (!document.body.contains(renderer.domElement)) return
      const w2 = wrap.clientWidth, h2 = wrap.clientHeight
      camera.aspect = w2 / h2; camera.updateProjectionMatrix(); renderer.setSize(w2, h2)
    })
  }


  function showLoginError(msg) {
    const el = $('#login-error')
    el.querySelector('span').textContent = msg
    el.classList.remove('hidden')
    animateIn(el, { x: -10, opacity: 0, duration: 0.3 })
  }

  // ── MAIN APP SHELL ───────────────────────────────────────
  function renderApp() {
    const isVenture = state.role === 'venture_owner'
    const isSupervisor = state.role === 'supervisor'
    const badgeClass = isVenture ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : isSupervisor ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'

    root.innerHTML = `
      <nav id="main-nav" class="glass-card sticky top-0 z-50 border-t-0 border-x-0 rounded-none">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 flex items-center justify-center">
              <i class="fas fa-drone text-indigo-400 text-sm"></i>
            </div>
            <span class="font-bold text-base hidden sm:inline bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">SRM dROIds</span>
            <span class="text-xs px-2.5 py-1 rounded-full font-medium ${badgeClass}">
              ${isVenture ? 'Venture Owner' : isSupervisor ? 'Supervisor' : 'CoE Leader'}
            </span>
          </div>
          <div class="nav-scroll flex-1 min-w-0 mx-2 sm:mx-4"><div class="flex items-center justify-start lg:justify-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar pb-0.5" id="nav-tabs"></div></div>
          <div class="flex items-center gap-1">
            <button id="theme-toggle" title="Toggle day / night mode" class="text-slate-500 hover:text-amber-300 px-3 py-2 rounded-xl hover:bg-slate-800/50 transition text-sm border border-transparent hover:border-slate-700/50">
              <i class="fas fa-sun theme-icon-sun"></i><i class="fas fa-moon theme-icon-moon"></i>
            </button>
            <button id="logout-btn" class="text-slate-500 hover:text-slate-300 px-3 py-2 rounded-xl hover:bg-slate-800/50 transition text-sm border border-transparent hover:border-slate-700/50">
              <i class="fas fa-sign-out-alt"></i> <span class="hidden sm:inline ml-1">Exit</span>
            </button>
          </div>
        </div>
      </nav>
      <div id="campus-scope-bar" class="scope-bar sticky top-16 z-40 border-b border-slate-800/70">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center gap-2">
          <span class="text-[10px] uppercase tracking-[.16em] text-slate-500 mr-1"><i class="fas fa-layer-group mr-1 text-cyan-400"></i>Data scope</span>
          <button class="campus-scope-btn" data-scope="ramapuram">Ramapuram</button><button class="campus-scope-btn" data-scope="trichy">Trichy</button><button class="campus-scope-btn" data-scope="both">All campuses</button>
          <button id="campus-lock-toggle" class="ml-auto" title="Lock the active campus scope"></button>
          <span class="scope-hint hidden md:inline text-[10px] text-slate-500">New records inherit this scope</span>
        </div>
      </div>
      <main id="main-content" class="max-w-7xl mx-auto px-4 sm:px-6 py-8"></main>`

    // Build nav tabs
    const tabs = isSupervisor
      ? [
          { id: 'dashboard', icon: 'fa-chart-pie', label: 'Overview' },
          { id: 'facility', icon: 'fa-building', label: 'Facility' },
          { id: 'supervisor-ai', icon: 'fa-shield-alt', label: 'AI Advisory' },
          { id: 'bulletins', icon: 'fa-bullhorn', label: 'Bulletins' }
        ]
      : isVenture
      ? [
          { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
          { id: 'setup', icon: 'fa-layer-group', label: 'Setup' },
          { id: 'facility', icon: 'fa-cube', label: 'Facility' },
          { id: 'creator', icon: 'fa-file-signature', label: 'Report Creator' },
          { id: 'collab', icon: 'fa-object-group', label: 'Collab' },
          { id: 'review', icon: 'fa-clipboard-check', label: 'Review' },
          { id: 'procurement', icon: 'fa-truck', label: 'Procure' },
          { id: 'partners', icon: 'fa-handshake', label: 'Partners' },
          { id: 'llm', icon: 'fa-robot', label: 'GenAI' },
          { id: 'admin', icon: 'fa-cog', label: 'Admin' }
        ]
      : [
          { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
          { id: 'setup', icon: 'fa-layer-group', label: 'Setup Tracker' },
          { id: 'cohorts', icon: 'fa-users', label: 'Cohorts' },
          { id: 'facility', icon: 'fa-cube', label: 'Facility' },
          { id: 'bulletins', icon: 'fa-bullhorn', label: 'AI Bulletins' },
          { id: 'collab', icon: 'fa-object-group', label: 'Collab' },
          { id: 'roadmap', icon: 'fa-road', label: 'Roadmap' }
        ]

    const navTabs = $('#nav-tabs')
    // Labels only when few tabs fit comfortably (supervisor); otherwise icon-only + tooltip
    const showLabels = tabs.length <= 6
    tabs.forEach(t => {
      const btn = document.createElement('button')
      btn.className = `nav-tab shrink-0 ${showLabels ? 'px-3' : 'px-2.5'} py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${t.id === state.activeView ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'}`
      btn.title = t.label
      btn.innerHTML = `<i class="fas ${t.icon}"></i>${showLabels ? `<span class="hidden sm:inline ml-1.5">${t.label}</span>` : ''}`
      btn.dataset.view = t.id
      navTabs.appendChild(btn)
    })

    navTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.nav-tab')
      if (tab) { state.activeView = tab.dataset.view; navigateView() }
    })
    $$('.campus-scope-btn').forEach(b => b.addEventListener('click', () => setCampusScope(b.dataset.scope)))
    $('#campus-lock-toggle').addEventListener('click', toggleCampusLock)

    $('#logout-btn').addEventListener('click', () => {
      state.role = null; state.session = null; state.passcode = null; state.activeView = 'dashboard'; renderLogin()
    })
    $('#theme-toggle').addEventListener('click', toggleTheme)
    applyTheme()
    updateCampusScopeUI()

    navigateView()
    animateIn('#main-nav', { y: -20, opacity: 0, duration: 0.5, ease: 'power2.out' })
  }

  function navigateView() {
    $$('.nav-tab').forEach(b => {
      const isActive = b.dataset.view === state.activeView
      b.className = `nav-tab shrink-0 px-2.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${isActive ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'}`
    })

    const content = $('#main-content')
    content.innerHTML = `<div class="flex justify-center py-32"><div class="flex flex-col items-center gap-3"><div class="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin"></div><p class="text-sm text-slate-500">Loading...</p></div></div>`

    switch (state.activeView) {
      case 'dashboard': renderDashboard(); break
      case 'setup': renderSetupTracker(); break
      case 'collab': renderCollabView(); break
      case 'creator': renderReportCreator(); break
      case 'review': renderReviewView(); break
      case 'cohorts': renderCohorts(); break
      case 'facility': renderFacilityView(); break
      case 'roadmap': renderRoadmap(); break
      case 'procurement': renderProcurement(); break
      case 'partners': renderPartners(); break
      case 'llm': renderLLMView(); break
      case 'supervisor-ai': renderSupervisorAIView(); break
      case 'bulletins': renderBulletinsView(); break
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

      animateIn('#kra-grid > div', { y: 30, opacity: 0, stagger: 0.08 })
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
        <div class="mt-3 text-xs text-slate-500 flex items-center justify-between">
          <span>${kra.completed}/${kra.total} KPIs &middot; Weight: ${kra.weight}</span>
          <i class="fas fa-chevron-right text-slate-600"></i>
        </div>`

      grid.appendChild(card)

      const list = card.querySelector(`#kpi-list-${kra.id}`)
      kra.kpis.forEach(kpi => {
        const statusColors = { completed: 'text-emerald-400', on_track: 'text-blue-400', in_progress: 'text-amber-400', at_risk: 'text-red-400', pending: 'text-slate-400' }
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

      animateIn('#review-list > div', { y: 20, opacity: 0, duration: 0.4, stagger: 0.06 })
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

      animateIn('#stage-columns > div', { y: 40, opacity: 0, duration: 0.6, stagger: 0.1 })
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

  // ── FACILITY 3D VIEW (Zones map + sqft Space Planner) ────
  async function renderFacilityView() {
    const content = $('#main-content')
    const isPlanner = state.facilityMode === 'planner'
    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><h2 class="text-xl font-bold">Facility Layout</h2><p class="text-sm text-slate-400">${isPlanner ? 'Space Planner — configure rooms by sq-ft and place equipment footprints in 3D' : '3D Warehouse &amp; Lab Layout'}</p></div>
          <div class="flex items-center gap-2">
            <div class="flex gap-1 bg-slate-900/60 rounded-xl p-1 border border-slate-800">
              <button id="fac-mode-zones" class="px-4 py-2 rounded-lg text-sm font-medium transition ${!isPlanner ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}"><i class="fas fa-cube mr-1"></i>Zones</button>
              <button id="fac-mode-planner" class="px-4 py-2 rounded-lg text-sm font-medium transition ${isPlanner ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}"><i class="fas fa-drafting-compass mr-1"></i>Space Planner</button>
            </div>
            ${!isPlanner ? `<div class="flex gap-1 bg-slate-900/60 rounded-xl p-1 border border-slate-800">
              <button id="fac-ramapuram" class="campus-toggle px-4 py-2 rounded-lg text-sm font-medium transition bg-indigo-600 text-white">Ramapuram</button>
              <button id="fac-trichy" class="campus-toggle px-3 py-2 rounded-lg text-sm font-medium transition text-slate-400 hover:text-slate-200">Trichy</button>
              <button id="fac-both" class="campus-toggle px-3 py-2 rounded-lg text-sm font-medium transition text-slate-400 hover:text-slate-200">All</button>
            </div>` : ''}
          </div>
        </div>
        <div id="facility-body"></div>
      </div>`

    $('#fac-mode-zones').addEventListener('click', () => { state.facilityMode = 'zones'; renderFacilityView() })
    $('#fac-mode-planner').addEventListener('click', () => { state.facilityMode = 'planner'; renderFacilityView() })

    if (isPlanner) { renderSpacePlanner(); return }

    $('#facility-body').innerHTML = `
      <div class="space-y-4">
        <div id="three-container" class="glass-card rounded-2xl" style="height:500px;"></div>
        <div id="facility-legend" class="grid grid-cols-2 sm:grid-cols-4 gap-3"></div>
      </div>`
    document.getElementById('fac-ramapuram').addEventListener('click', () => { if (state.campusLocked && state.campusScope !== 'ramapuram') return toast('Campus scope is locked. Unlock it to switch sites.', 'error'); state.facilityCampus = 'ramapuram'; state.campusScope = 'ramapuram'; localStorage.setItem('srm_campus_scope', 'ramapuram'); updateCampusScopeUI(); updateCampusToggles(); initThreeJS() })
    document.getElementById('fac-trichy').addEventListener('click', () => { if (state.campusLocked && state.campusScope !== 'trichy') return toast('Campus scope is locked. Unlock it to switch sites.', 'error'); state.facilityCampus = 'trichy'; state.campusScope = 'trichy'; localStorage.setItem('srm_campus_scope', 'trichy'); updateCampusScopeUI(); updateCampusToggles(); initThreeJS() })
    document.getElementById('fac-both').addEventListener('click', () => { state.campusScope = 'both'; localStorage.setItem('srm_campus_scope', 'both'); updateCampusToggles(); renderFacilityView() })
    updateCampusToggles()
    initThreeJS()
  }

  function updateCampusToggles() {
    const r = $('#fac-ramapuram'), t = $('#fac-trichy')
    if (!r || !t) return
    const b = $('#fac-both'); const active = 'campus-toggle px-3 py-2 rounded-lg text-sm font-medium transition bg-indigo-600 text-white'; const idle = 'campus-toggle px-3 py-2 rounded-lg text-sm font-medium transition text-slate-400 hover:text-slate-200'
    r.className = state.campusScope === 'ramapuram' || (state.campusScope === 'both' && state.facilityCampus === 'ramapuram') ? active : idle
    t.className = state.campusScope === 'trichy' || (state.campusScope === 'both' && state.facilityCampus === 'trichy') ? active : idle
    if (b) b.className = state.campusScope === 'both' ? active : idle
  }

  // ── SPACE PLANNER — sqft room config + 3D footprint layout ──
  const SPACE_STATUS_COLORS = { planned: 'text-amber-400', ordered: 'text-sky-400', installed: 'text-indigo-400', operational: 'text-emerald-400' }
  const SPACE_CATEGORY_COLORS = { equipment: '#6366f1', machinery: '#ef4444', printer_3d: '#10b981', workbench: '#f59e0b', storage: '#8b5cf6', safety: '#dc2626', power: '#0ea5e9', test_area: '#f97316', furniture: '#64748b' }

  async function renderSpacePlanner() {
    const body = $('#facility-body')
    if (!body) return
    try {
      const roomQuery = state.campusScope === 'both' ? '' : `?campus=${state.campusScope}`
      const { data: rooms } = await API.get(`/space/rooms${roomQuery}`)
      if (!state.spaceRoomId || !rooms.find(r => r.id === state.spaceRoomId)) {
        state.spaceRoomId = rooms.length ? rooms[0].id : 0
      }
      const room = rooms.find(r => r.id === state.spaceRoomId)
      let placements = []
      if (room) {
        const res = await API.get(`/space/placements?room_id=${room.id}`)
        placements = res.data
      }
      const sqft = room ? room.width_ft * room.length_ft : 0
      const usedSqft = placements.reduce((s, p) => s + (p.footprint_ft * p.footprint_ft), 0)
      const freeSqft = Math.max(0, sqft - usedSqft)
      const pctUsed = sqft > 0 ? Math.min(100, Math.round(usedSqft / sqft * 100)) : 0

      body.innerHTML = `
        <div class="space-y-4">
          <div class="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <div class="flex items-center gap-2 flex-wrap">
              <select id="space-room-select" class="bg-slate-700/50 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 min-w-[220px]">
                ${rooms.map(r => `<option value="${r.id}" ${r.id === state.spaceRoomId ? 'selected' : ''}>${r.name} · ${r.width_ft}×${r.length_ft} ft (${r.campus})</option>`).join('')}
              </select>
              <button id="space-add-room" class="bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-3 py-2 rounded-xl text-sm transition"><i class="fas fa-plus mr-1"></i>Room</button>
              ${room ? `<button id="space-edit-room" class="bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-3 py-2 rounded-xl text-sm transition"><i class="fas fa-cog mr-1"></i>Configure</button>` : ''}
            </div>
            ${room ? `<div class="flex gap-2">
              <button id="space-analyze" class="bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 px-4 py-2 rounded-xl text-sm font-medium transition"><i class="fas fa-brain mr-1"></i>Analyze Layout</button>
              <button id="space-add-placement" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition btn-glow"><i class="fas fa-plus mr-1"></i>Place Equipment</button>
            </div>` : ''}
          </div>

          ${room ? `
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="glass-card rounded-xl p-4"><div class="text-xs text-slate-500">Room Area</div><div class="text-lg font-extrabold">${sqft.toLocaleString()} sq ft</div><div class="text-xs text-slate-500">${room.width_ft} ft × ${room.length_ft} ft</div></div>
            <div class="glass-card rounded-xl p-4"><div class="text-xs text-slate-500">Allocated Footprint</div><div class="text-lg font-extrabold text-indigo-400">${usedSqft.toLocaleString()} sq ft</div><div class="text-xs text-slate-500">${placements.length} item${placements.length === 1 ? '' : 's'}</div></div>
            <div class="glass-card rounded-xl p-4"><div class="text-xs text-slate-500">Free Floor Area</div><div class="text-lg font-extrabold text-emerald-400">${freeSqft.toLocaleString()} sq ft</div><div class="text-xs text-slate-500">${100 - pctUsed}% available</div></div>
            <div class="glass-card rounded-xl p-4"><div class="text-xs text-slate-500 mb-1">Floor Utilization</div><div class="w-full bg-slate-700/50 rounded-full h-2.5 mt-2"><div class="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" style="width:${pctUsed}%"></div></div><div class="text-xs text-slate-400 mt-1.5">${pctUsed}% used</div></div>
          </div>
          <div id="space-3d" class="glass-card rounded-2xl relative" style="height:520px;">
            <div class="absolute top-3 left-3 z-10 text-xs text-slate-400 bg-slate-900/60 rounded-lg px-3 py-1.5 border border-slate-700/50 pointer-events-none"><i class="fas fa-arrows-alt mr-1"></i>Drag item = move · wheel = zoom (over selected item = resize) · drag empty = orbit · dbl-click = edit</div>
          </div>
          <div class="glass-card rounded-2xl p-4 overflow-x-auto">
            <div class="flex items-center justify-between mb-3"><h3 class="font-semibold text-sm"><i class="fas fa-list mr-1.5 text-indigo-400"></i>Placements in ${room.name}</h3><span class="text-xs text-slate-500">footprint = square side in ft</span></div>
            <table class="w-full text-sm min-w-[720px]">
              <thead><tr class="text-xs text-slate-500 border-b border-slate-700/50">
                <th class="text-left py-2 pr-3">Item</th><th class="text-left py-2 pr-3">Category</th><th class="text-right py-2 pr-3">Footprint</th><th class="text-right py-2 pr-3">Position (x,y ft)</th><th class="text-right py-2 pr-3">Height</th><th class="text-left py-2 pr-3">Status</th><th class="text-right py-2">Actions</th>
              </tr></thead>
              <tbody>${placements.length === 0 ? '<tr><td colspan="7" class="text-center text-slate-500 py-6">No equipment placed yet — click “Place Equipment”.</td></tr>' : placements.map(p => `
                <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
                  <td class="py-2.5 pr-3"><span class="inline-block w-3 h-3 rounded-sm mr-2 align-middle" style="background:${p.color}"></span><span class="font-medium">${p.item_name}</span>${p.notes ? `<div class="text-[11px] text-slate-500 ml-5">${p.notes}</div>` : ''}</td>
                  <td class="py-2.5 pr-3 text-slate-400 capitalize">${(p.category || '').replace(/_/g, ' ')}</td>
                  <td class="py-2.5 pr-3 text-right">${p.footprint_ft}×${p.footprint_ft} ft <span class="text-slate-500">(${p.footprint_ft * p.footprint_ft} sf)</span></td>
                  <td class="py-2.5 pr-3 text-right text-slate-400">${p.x_ft}, ${p.y_ft}</td>
                  <td class="py-2.5 pr-3 text-right text-slate-400">${p.height_ft} ft</td>
                  <td class="py-2.5 pr-3 capitalize ${SPACE_STATUS_COLORS[p.status] || 'text-slate-400'}">${p.status}</td>
                  <td class="py-2.5 text-right whitespace-nowrap">
                    <button class="space-edit-p text-xs bg-slate-700/50 hover:bg-slate-600 border border-slate-700 px-2.5 py-1 rounded-lg transition mr-1" data-id="${p.id}"><i class="fas fa-pen"></i></button>
                    <button class="space-del-p text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-2.5 py-1 rounded-lg transition" data-id="${p.id}"><i class="fas fa-trash"></i></button>
                  </td>
                </tr>`).join('')}</tbody>
            </table>
          </div>` : `
          <div class="glass-card rounded-2xl p-10 text-center">
            <i class="fas fa-drafting-compass text-3xl text-indigo-400/60 mb-3"></i>
            <p class="text-slate-300 font-medium mb-1">No rooms configured yet</p>
            <p class="text-sm text-slate-500 mb-4">Create a room with its width × length in feet, then place equipment with square footprints.</p>
            <button id="space-add-room-empty" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition btn-glow"><i class="fas fa-plus mr-1"></i>Create First Room</button>
          </div>`}
        </div>`

      $('#space-room-select')?.addEventListener('change', (e) => { state.spaceRoomId = Number(e.target.value); renderSpacePlanner() })
      $('#space-add-room')?.addEventListener('click', () => openRoomForm())
      $('#space-add-room-empty')?.addEventListener('click', () => openRoomForm())
      $('#space-edit-room')?.addEventListener('click', () => openRoomForm(room))
      $('#space-add-placement')?.addEventListener('click', () => openPlacementForm(room))
      $('#space-analyze')?.addEventListener('click', () => openSpatialAnalysis(room))
      $$('.space-edit-p').forEach(b => b.addEventListener('click', () => openPlacementForm(room, placements.find(p => p.id === Number(b.dataset.id)))))
      $$('.space-del-p').forEach(b => b.addEventListener('click', async () => {
        const p = placements.find(x => x.id === Number(b.dataset.id))
        if (!confirm(`Remove "${p?.item_name}" from the layout?`)) return
        await API.delete(`/space/placements/${b.dataset.id}`)
        toast('Placement removed', 'success')
        renderSpacePlanner()
      }))

      if (room) initSpacePlanner3D(room, placements)
    } catch (e) {
      body.innerHTML = errorHtml('space planner', e)
    }
  }

  function openRoomForm(room) {
    showModal(`
      <form id="room-form" class="space-y-4 text-left">
        <h3 class="text-lg font-bold"><i class="fas fa-door-open text-indigo-400 mr-2"></i>${room ? 'Configure Room' : 'New Room'}</h3>
        <div><label class="text-xs text-slate-400">Room Name <span class="text-amber-400">*</span></label><input name="name" required value="${room?.name || ''}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100" placeholder="e.g., Fabrication Lab A"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-400">Campus</label><select name="campus" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">
            <option value="ramapuram" ${room?.campus === 'ramapuram' ? 'selected' : ''}>Ramapuram</option>
            <option value="trichy" ${room?.campus === 'trichy' ? 'selected' : ''}>Trichy</option>
          </select></div>
          <div><label class="text-xs text-slate-400">Room Type</label><select name="room_type" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">
            ${['lab', 'fabrication', 'flight_ops', 'workshop', 'storage', 'classroom', 'office'].map(t => `<option value="${t}" ${room?.room_type === t ? 'selected' : ''}>${t.replace(/_/g, ' ')}</option>`).join('')}
          </select></div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div><label class="text-xs text-slate-400">Width (ft)</label><input name="width_ft" type="number" min="5" max="500" step="0.5" required value="${room?.width_ft || 40}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
          <div><label class="text-xs text-slate-400">Length (ft)</label><input name="length_ft" type="number" min="5" max="500" step="0.5" required value="${room?.length_ft || 30}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
          <div><label class="text-xs text-slate-400">Area</label><div id="room-sqft" class="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm mt-1 text-indigo-400 font-semibold">${room ? (room.width_ft * room.length_ft).toLocaleString() : '1,200'} sq ft</div></div>
        </div>
        <div><label class="text-xs text-slate-400">Notes</label><textarea name="notes" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">${room?.notes || ''}</textarea></div>
        <div class="flex gap-2">
          <button type="submit" class="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-medium transition btn-glow">${room ? 'Save Room' : 'Create Room'}</button>
          ${room ? '<button type="button" id="room-delete-btn" class="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-lg text-sm transition"><i class="fas fa-trash"></i></button>' : ''}
        </div>
      </form>`)
    const form = $('#room-form')
    const syncSqft = () => { $('#room-sqft').textContent = (Number(form.width_ft.value || 0) * Number(form.length_ft.value || 0)).toLocaleString() + ' sq ft' }
    form.width_ft.addEventListener('input', syncSqft)
    form.length_ft.addEventListener('input', syncSqft)
    $('#room-delete-btn')?.addEventListener('click', async () => {
      if (!confirm(`Delete room "${room.name}" and all its placements?`)) return
      await API.delete(`/space/rooms/${room.id}`)
      state.spaceRoomId = 0
      toast('Room deleted', 'success')
      closeModal(); renderSpacePlanner()
    })
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(form)
      const payload = { name: fd.get('name'), campus: fd.get('campus'), room_type: fd.get('room_type'), width_ft: Number(fd.get('width_ft')), length_ft: Number(fd.get('length_ft')), notes: fd.get('notes') }
      if (room) { await API.put(`/space/rooms/${room.id}`, payload); toast('Room updated', 'success') }
      else { const { data } = await API.post('/space/rooms', payload); state.spaceRoomId = data.id; toast('Room created', 'success') }
      closeModal(); renderSpacePlanner()
    })
  }

  function openPlacementForm(room, p) {
    if (!room) return
    const catOpts = Object.keys(SPACE_CATEGORY_COLORS)
    showModal(`
      <form id="placement-form" class="space-y-4 text-left">
        <h3 class="text-lg font-bold"><i class="fas fa-th-large text-indigo-400 mr-2"></i>${p ? 'Edit Placement' : 'Place Equipment'} <span class="text-xs text-slate-500 font-normal">in ${room.name} (${room.width_ft}×${room.length_ft} ft)</span></h3>
        <div><label class="text-xs text-slate-400">Item Name <span class="text-amber-400">*</span></label><input name="item_name" required value="${p?.item_name || ''}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100" placeholder="e.g., Lathe Machine"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-400">Category</label><select name="category" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">
            ${catOpts.map(c => `<option value="${c}" ${p?.category === c ? 'selected' : ''}>${c.replace(/_/g, ' ')}</option>`).join('')}
          </select></div>
          <div><label class="text-xs text-slate-400">Status</label><select name="status" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">
            ${['planned', 'ordered', 'installed', 'operational'].map(s => `<option value="${s}" ${p?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-400">Square Footprint — side (ft)</label><input name="footprint_ft" type="number" min="0.5" max="${Math.min(room.width_ft, room.length_ft)}" step="0.5" required value="${p?.footprint_ft || 4}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"><p class="text-[11px] text-slate-500 mt-0.5" id="fp-hint"></p></div>
          <div><label class="text-xs text-slate-400">Height (ft)</label><input name="height_ft" type="number" min="0.5" max="30" step="0.5" required value="${p?.height_ft || 4}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-400">X position (ft from left)</label><input name="x_ft" type="number" min="0" max="${room.width_ft}" step="0.5" required value="${p?.x_ft ?? 2}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
          <div><label class="text-xs text-slate-400">Y position (ft from top)</label><input name="y_ft" type="number" min="0" max="${room.length_ft}" step="0.5" required value="${p?.y_ft ?? 2}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
        </div>
        <div><label class="text-xs text-slate-400">Color</label><input name="color" type="color" value="${p?.color || SPACE_CATEGORY_COLORS[p?.category] || '#6366f1'}" class="w-full h-10 bg-slate-700 border border-slate-600 rounded-lg px-1 py-1 mt-1"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-400">Specs URL / PDF / image URL</label><input name="source_url" type="url" value="${p?.source_url || ''}" placeholder="https://…" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
          <div><label class="text-xs text-slate-400">Source type</label><select name="source_type" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"><option value="url">Product page</option><option value="pdf">PDF spec</option><option value="image">Image</option></select></div>
        </div>
        <p class="text-[11px] text-slate-500">The source is retained with this placement. The Supervisor AI can use it as reference context and marks extracted details as advisory until verified.</p>
        ${state.role === 'supervisor' && p?.id ? '<button type="button" id="extract-specs" class="w-full text-xs px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300"><i class="fas fa-file-search mr-1"></i>Extract product details from source</button>' : ''}
        <div><label class="text-xs text-slate-400">Notes</label><textarea name="notes" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">${p?.notes || ''}</textarea></div>
        <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-medium transition btn-glow">${p ? 'Save Placement' : 'Add to Layout'}</button>
      </form>`)
    const form = $('#placement-form')
    const fpHint = () => { const f = Number(form.footprint_ft.value || 0); $('#fp-hint').textContent = `= ${f}×${f} ft · ${(f * f).toLocaleString()} sq ft of floor` }
    form.footprint_ft.addEventListener('input', fpHint); fpHint()
    form.category.addEventListener('change', () => { if (!p) form.color.value = SPACE_CATEGORY_COLORS[form.category.value] || '#6366f1' })
    $('#extract-specs')?.addEventListener('click', async () => { const source = form.source_url.value.trim(); if (!source) return toast('Add a source URL first', 'error'); try { await API.post('/supervisor/specs/extract', { placement_id: p.id, source_url: source, source_type: form.source_type.value }); toast('Specs extracted and saved as unverified metadata', 'success'); closeModal(); renderSpacePlanner() } catch (e) { toast(e.response?.data?.error || e.message, 'error') } })
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(form)
      const fp = Number(fd.get('footprint_ft'))
      let x = Number(fd.get('x_ft')), y = Number(fd.get('y_ft'))
      // clamp so the footprint stays inside the room
      x = Math.max(0, Math.min(room.width_ft - fp, x))
      y = Math.max(0, Math.min(room.length_ft - fp, y))
      const payload = { room_id: room.id, item_name: fd.get('item_name'), category: fd.get('category'), status: fd.get('status'), footprint_ft: fp, height_ft: Number(fd.get('height_ft')), x_ft: x, y_ft: y, color: fd.get('color'), notes: fd.get('notes'), source_url: fd.get('source_url'), source_type: fd.get('source_type') }
      if (p) { await API.put(`/space/placements/${p.id}`, payload); toast('Placement updated', 'success') }
      else { await API.post('/space/placements', payload); toast('Equipment placed in layout', 'success') }
      closeModal(); renderSpacePlanner()
    })
  }

  // ── SPATIAL COPILOT — layout analysis + guideline recommendations ──
  async function openSpatialAnalysis(room) {
    if (!room) return
    const SEV_COLORS = { critical: 'bg-red-500/15 text-red-400 border-red-500/30', high: 'bg-amber-500/15 text-amber-400 border-amber-500/30', medium: 'bg-sky-500/15 text-sky-400 border-sky-500/30' }
    showModal(`
      <div class="space-y-4 text-left">
        <h3 class="text-lg font-bold"><i class="fas fa-brain text-cyan-400 mr-2"></i>Spatial Copilot — ${room.name}</h3>
        <div id="spatial-body" class="space-y-3">
          <div class="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center"><div class="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin"></div>Computing layout metrics &amp; asking the LLM copilot…</div>
        </div>
      </div>`)
    const body = $('#spatial-body')
    try {
      const { data } = await API.post('/space/analyze', { room_id: room.id, role: state.role })
      const m = data.metrics
      body.innerHTML = `
        <div class="grid grid-cols-3 gap-2">
          <div class="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-center"><div class="text-xs text-slate-500">Utilization</div><div class="text-lg font-extrabold ${m.utilization_pct > 55 ? 'text-red-400' : 'text-emerald-400'}">${m.utilization_pct}%</div></div>
          <div class="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-center"><div class="text-xs text-slate-500">Items</div><div class="text-lg font-extrabold">${m.items}</div></div>
          <div class="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-center"><div class="text-xs text-slate-500">Issues</div><div class="text-lg font-extrabold ${data.issues.length ? 'text-amber-400' : 'text-emerald-400'}">${data.issues.length}</div></div>
        </div>
        ${data.issues.length ? `<div class="space-y-1.5">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Detected Issues</div>
          ${data.issues.map(i => `<div class="border rounded-lg px-3 py-2 text-xs ${SEV_COLORS[i.severity] || SEV_COLORS.medium}"><span class="font-bold uppercase mr-1.5">${i.severity}</span>${i.text}</div>`).join('')}
        </div>` : '<div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg px-3 py-2 text-xs"><i class="fas fa-check-circle mr-1"></i>No overlaps or clearance violations detected.</div>'}
        ${m.pair_clearances.length ? `<details class="text-xs"><summary class="text-slate-500 cursor-pointer hover:text-slate-300">Pairwise clearances (${m.pair_clearances.length})</summary><div class="mt-1.5 max-h-32 overflow-y-auto space-y-1 bg-slate-800/40 rounded-lg p-2">${m.pair_clearances.map(p => `<div class="flex justify-between text-slate-400"><span>${p.a} ↔ ${p.b}</span><span class="${p.overlap ? 'text-red-400 font-bold' : p.clearance_ft < 3 ? 'text-amber-400' : ''}">${p.overlap ? 'OVERLAP' : p.clearance_ft + ' ft'}</span></div>`).join('')}</div></details>` : ''}
        <div class="border-t border-slate-700/40 pt-3">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2"><i class="fas fa-wand-magic-sparkles text-indigo-400 mr-1"></i>Copilot Recommendations ${data.llm_used ? '' : '<span class="normal-case font-normal text-slate-500">(add a kie.ai key in Report Creator → API Vault to enable)</span>'}</div>
          <div class="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 text-sm text-slate-200 whitespace-pre-wrap max-h-64 overflow-y-auto">${data.ai || 'LLM copilot unavailable — metrics above are computed locally. Store an API key in the vault to get guideline recommendations and repositioning suggestions.'}</div>
        </div>`
    } catch (e) {
      body.innerHTML = `<p class="text-red-400 text-sm">${e.response?.data?.error || e.message}</p>`
    }
  }

  // 3D floor-layout renderer (v5 interactive) — 1 world unit = 1 foot.
  // Interactions: left-drag an item = move (clamped inside room), wheel over a
  // selected item = resize footprint, drag empty space = orbit, hover = quick-tip,
  // double-click = edit form. Day/night aware.
  function initSpacePlanner3D(room, placements) {
    const container = $('#space-3d')
    if (!container || !window.THREE) return
    container.querySelectorAll('canvas').forEach(c => c.remove())
    $('#space-tip')?.remove()

    const isDay = state.theme === 'day'
    const W = container.clientWidth, H = container.clientHeight
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(isDay ? 0xe8edf5 : 0x0b1220)
    scene.fog = new THREE.Fog(isDay ? 0xe8edf5 : 0x0b1220, max2(room.width_ft, room.length_ft) * 2.4, max2(room.width_ft, room.length_ft) * 6)

    function max2(a, b) { return Math.max(a, b) }
    const maxDim = Math.max(room.width_ft, room.length_ft)
    const cx = room.width_ft / 2, cz = room.length_ft / 2
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.5, 2000)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(isDay ? 0xffffff : 0x8090b0, isDay ? 0.95 : 0.75))
    const dir = new THREE.DirectionalLight(0xffffff, isDay ? 1.7 : 1.25)
    dir.position.set(cx + 40, maxDim * 1.5, cz + 30)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.camera.left = -maxDim; dir.shadow.camera.right = maxDim
    dir.shadow.camera.top = maxDim; dir.shadow.camera.bottom = -maxDim
    scene.add(dir)
    const rim = new THREE.PointLight(0x6366f1, maxDim * 2.2, maxDim * 5)
    rim.position.set(-maxDim * 0.5, maxDim * 0.8, -maxDim * 0.5)
    scene.add(rim)

    // Floor slab + perimeter walls + feet grid
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(room.width_ft, room.length_ft),
      new THREE.MeshStandardMaterial({ color: isDay ? 0xf1f5f9 : 0x1a2338, roughness: 0.92, metalness: 0.04 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(cx, 0, cz)
    floor.receiveShadow = true
    scene.add(floor)

    const wallMat = new THREE.MeshStandardMaterial({ color: isDay ? 0xcbd5e1 : 0x2a3550, transparent: true, opacity: 0.32, roughness: 0.8 })
    const wallH = 8
    const mkWall = (w, d, x, z) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat)
      wall.position.set(x, wallH / 2, z); scene.add(wall)
    }
    mkWall(room.width_ft, 0.4, cx, 0); mkWall(room.width_ft, 0.4, cx, room.length_ft)
    mkWall(0.4, room.length_ft, 0, cz); mkWall(0.4, room.length_ft, room.width_ft, cz)

    const gridStep = 5
    const grid = new THREE.GridHelper(maxDim, Math.round(maxDim / gridStep), isDay ? 0x94a3b8 : 0x3b4a75, isDay ? 0xd7dee9 : 0x1c2740)
    grid.position.set(cx, 0.02, cz)
    scene.add(grid)

    // Quick-tip overlay
    const tip = document.createElement('div')
    tip.id = 'space-tip'
    tip.className = 'absolute z-20 pointer-events-none hidden px-3 py-2 rounded-xl text-xs shadow-xl border'
    tip.style.cssText = `background:${isDay ? 'rgba(255,255,255,0.96)' : 'rgba(8,12,24,0.94)'};border-color:${isDay ? 'rgba(79,70,229,0.35)' : 'rgba(99,102,241,0.45)'};backdrop-filter:blur(6px);max-width:240px;`
    container.appendChild(tip)

    // Selection HUD — always shows what is selected so wheel-resize is never a surprise
    const selChip = document.createElement('div')
    selChip.id = 'space-sel-chip'
    selChip.className = 'absolute z-20 hidden px-3 py-2 rounded-xl text-xs shadow-xl border'
    selChip.style.cssText = `bottom:12px;left:12px;background:${isDay ? 'rgba(255,255,255,0.96)' : 'rgba(8,12,24,0.94)'};border-color:rgba(34,211,238,0.5);backdrop-filter:blur(6px);`
    container.appendChild(selChip)

    // Equipment meshes
    const meshes = []
    const items = []
    placements.forEach(p => {
      const fp = Number(p.footprint_ft) || 1
      const hgt = Number(p.height_ft) || 3
      const geo = new THREE.BoxGeometry(fp, hgt, fp)
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(p.color || '#6366f1'),
        roughness: 0.4, metalness: 0.2, transparent: true, opacity: 0.92,
        emissive: new THREE.Color(p.color || '#6366f1'), emissiveIntensity: 0
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(Number(p.x_ft) + fp / 2, hgt / 2, Number(p.y_ft) + fp / 2)
      mesh.castShadow = true; mesh.receiveShadow = true
      mesh.userData = { placement: { ...p }, fp, hgt }
      scene.add(mesh)
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: isDay ? 0x0f172a : 0xffffff, transparent: true, opacity: 0.3 }))
      edges.position.copy(mesh.position)
      scene.add(edges)
      mesh.userData.edges = edges
      meshes.push(mesh)
      items.push(p)

      const cv = document.createElement('canvas')
      cv.width = 512; cv.height = 128
      const ctx = cv.getContext('2d')
      ctx.fillStyle = isDay ? 'rgba(255,255,255,0.92)' : 'rgba(10,15,30,0.88)'
      ctx.strokeStyle = p.color || '#6366f1'
      ctx.lineWidth = 4
      ctx.beginPath(); ctx.roundRect(6, 6, 500, 116, 18); ctx.fill(); ctx.stroke()
      ctx.fillStyle = isDay ? '#0f172a' : '#e2e8f0'
      ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(p.item_name, 256, 58, 470)
      ctx.fillStyle = isDay ? '#64748b' : '#94a3b8'
      ctx.font = '30px sans-serif'
      ctx.fillText(`${fp}×${fp} ft · ${p.status}`, 256, 100)
      const tex = new THREE.CanvasTexture(cv)
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
      sprite.scale.set(fp * 1.6, fp * 0.4, 1)
      sprite.position.set(mesh.position.x, hgt + Math.max(1.6, fp * 0.28), mesh.position.z)
      scene.add(sprite)
      mesh.userData.sprite = sprite
    })

    function rebuildMeshGeometry(mesh) {
      const u = mesh.userData
      const geo = new THREE.BoxGeometry(u.fp, u.hgt, u.fp)
      mesh.geometry.dispose(); mesh.geometry = geo
      mesh.userData.edges.geometry.dispose()
      mesh.userData.edges.geometry = new THREE.EdgesGeometry(geo)
    }
    function syncMeshTransform(mesh) {
      const u = mesh.userData
      mesh.position.set(u.placement.x_ft + u.fp / 2, u.hgt / 2, u.placement.y_ft + u.fp / 2)
      mesh.userData.edges.position.copy(mesh.position)
      mesh.userData.sprite.position.set(mesh.position.x, u.hgt + Math.max(1.6, u.fp * 0.28), mesh.position.z)
    }

    // Selection ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.08, 48),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85, side: THREE.DoubleSide }))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.05
    ring.visible = false
    scene.add(ring)
    let selected = null
    function select(mesh) {
      selected = mesh
      if (mesh) {
        const u = mesh.userData
        ring.scale.set(u.fp * 0.85, u.fp * 0.85, 1)
        ring.position.set(mesh.position.x, 0.05, mesh.position.z)
        ring.visible = true
        selChip.classList.remove('hidden')
        selChip.innerHTML = `<span class="font-semibold" style="color:${u.placement.color}">${u.placement.item_name}</span> <span class="text-slate-400">· ${u.fp}×${u.fp} ft · wheel over it = resize · click empty space to deselect</span>`
      } else {
        ring.visible = false
        selChip.classList.add('hidden')
      }
    }

    // Raycast helpers
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const planeHit = new THREE.Vector3()
    function setMouse(e) {
      const rect = container.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / W) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / H) * 2 + 1
    }
    function rayItems(e) {
      setMouse(e)
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(meshes)
      return hits.length ? hits[0].object : null
    }
    function rayFloor(e) {
      setMouse(e)
      raycaster.setFromCamera(mouse, camera)
      return raycaster.ray.intersectPlane(floorPlane, planeHit) ? planeHit.clone() : null
    }
    const clampInRoom = (p, fp) => ({
      x: Math.max(0, Math.min(room.width_ft - fp, p.x)),
      y: Math.max(0, Math.min(room.length_ft - fp, p.y))
    })

    // ── Interaction state machine ──
    let mode = 'idle' // idle | orbiting | moving
    let prevX = 0, prevY = 0
    let angle = 0.55, camY = maxDim * 0.95
    let radius = maxDim * 1.15
    let moveGrab = null, moveOffset = { x: 0, z: 0 }, moved = false, downAt = null
    function placeCamera() {
      camera.position.set(cx + radius * Math.cos(angle), camY, cz + radius * Math.sin(angle))
      camera.lookAt(cx, 0, cz)
    }
    placeCamera()

    container.addEventListener('mousedown', (e) => {
      downAt = { x: e.clientX, y: e.clientY }
      const hit = rayItems(e)
      if (hit) {
        mode = 'moving'; moved = false; moveGrab = hit; select(hit)
        const fp = hit.userData.fp
        const floorPt = rayFloor(e)
        if (floorPt) moveOffset = { x: floorPt.x - hit.userData.placement.x_ft, z: floorPt.z - hit.userData.placement.y_ft }
        container.style.cursor = 'grabbing'
        tip.classList.add('hidden')
      } else {
        mode = 'orbiting'; select(null)
      }
      prevX = e.clientX; prevY = e.clientY
    })
    window.addEventListener('mouseup', async () => {
      if (mode === 'moving' && moveGrab && moved) {
        const u = moveGrab.userData
        try {
          await API.put(`/space/placements/${u.placement.id}`, { x_ft: Math.round(u.placement.x_ft * 2) / 2, y_ft: Math.round(u.placement.y_ft * 2) / 2 })
          toast(`${u.placement.item_name} moved to (${u.placement.x_ft}, ${u.placement.y_ft}) ft`, 'success')
          const row = document.querySelector(`.space-edit-p[data-id="${u.placement.id}"]`)?.closest('tr')
          if (row) {
            const cells = row.querySelectorAll('td')
            if (cells[3]) cells[3].textContent = `${u.placement.x_ft}, ${u.placement.y_ft}`
          }
        } catch { toast('Move failed to save', 'error') }
      }
      mode = 'idle'; moveGrab = null
      container.style.cursor = 'grab'
    })
    window.addEventListener('mousemove', (e) => {
      if (state.activeView !== 'facility' || state.facilityMode !== 'planner') return
      if (mode === 'moving' && moveGrab) {
        const floorPt = rayFloor(e)
        if (floorPt) {
          const fp = moveGrab.userData.fp
          const nx = floorPt.x - moveOffset.x, ny = floorPt.z - moveOffset.z
          const clamped = clampInRoom({ x: nx, y: ny }, fp)
          moveGrab.userData.placement.x_ft = Math.round(clamped.x * 2) / 2
          moveGrab.userData.placement.y_ft = Math.round(clamped.y * 2) / 2
          syncMeshTransform(moveGrab)
          select(moveGrab)
          moved = true
        }
        return
      }
      if (mode === 'orbiting' && downAt) {
        const dx = e.clientX - prevX, dy = e.clientY - prevY
        if (Math.hypot(dx, dy) > 2) moved = true
        angle -= dx * 0.008
        camY = Math.max(maxDim * 0.2, Math.min(maxDim * 2.2, camY + dy * 0.25))
        placeCamera()
        prevX = e.clientX; prevY = e.clientY
        tip.classList.add('hidden')
        return
      }
      // Hover quick-tip
      const hit = rayItems(e)
      meshes.forEach(m => { m.material.emissiveIntensity = m === hit ? 0.25 : 0 })
      if (hit) {
        const p = hit.userData.placement, u = hit.userData
        let specs = {}
        try { specs = JSON.parse(p.extracted_details || '{}') } catch (_) {}
        const specRows = Object.entries(specs).slice(0, 3).map(([k, v]) => `<div class="text-slate-400"><span class="text-slate-500">${k}:</span> ${v}</div>`).join('')
        tip.innerHTML = `<div class="font-bold mb-0.5" style="color:${p.color}">${p.item_name}</div>
          <div class="text-slate-400">Footprint: <b class="text-slate-200">${u.fp}×${u.fp} ft</b> (${u.fp * u.fp} sq ft)</div>
          <div class="text-slate-400">Height: ${u.hgt} ft · Position: (${p.x_ft}, ${p.y_ft}) ft</div>
          <div class="capitalize ${SPACE_STATUS_COLORS[p.status] || 'text-slate-400'}">${p.status}</div>
          ${p.notes ? `<div class="text-slate-500 mt-0.5 italic">${p.notes}</div>` : ''}
          ${p.source_url ? `<div class="mt-0.5 text-indigo-300 truncate">Source: ${p.source_url}</div>` : ''}
          ${specRows ? `<div class="mt-1 border-t border-slate-700/40 pt-1">${specRows}</div>` : ''}
          <div class="text-slate-500 mt-1 border-t border-slate-700/40 pt-1">drag = move · hover + wheel = resize · wheel elsewhere = zoom · dbl-click = edit</div>`
        const rect = container.getBoundingClientRect()
        tip.style.left = Math.min(e.clientX - rect.left + 14, W - 250) + 'px'
        tip.style.top = Math.max(8, e.clientY - rect.top - 10) + 'px'
        tip.classList.remove('hidden')
        container.style.cursor = 'move'
      } else {
        tip.classList.add('hidden')
        container.style.cursor = 'grab'
      }
    })
    container.addEventListener('mouseleave', () => tip.classList.add('hidden'))
    container.addEventListener('dblclick', (e) => {
      const hit = rayItems(e)
      if (hit) openPlacementForm(room, hit.userData.placement)
    })
    container.addEventListener('wheel', async (e) => {
      e.preventDefault()
      // Resize ONLY when the cursor is directly over the selected item — otherwise
      // wheel always zooms the camera. This prevents accidental footprint shrinkage
      // right after a move (the Test Cage 12ft -> 1.5ft bug on production).
      const overSelected = selected && rayItems(e) === selected
      if (selected && overSelected) {
        const u = selected.userData
        const delta = e.deltaY < 0 ? 0.5 : -0.5
        const minDim = Math.min(room.width_ft, room.length_ft)
        const newFp = Math.max(1, Math.min(minDim, Math.round((u.fp + delta) * 2) / 2))
        if (newFp === u.fp) return
        u.fp = newFp
        u.placement.footprint_ft = newFp
        const clamped = clampInRoom(u.placement, newFp)
        u.placement.x_ft = clamped.x; u.placement.y_ft = clamped.y
        rebuildMeshGeometry(selected)
        syncMeshTransform(selected)
        select(selected)
        try {
          await API.put(`/space/placements/${u.placement.id}`, { footprint_ft: newFp, x_ft: clamped.x, y_ft: clamped.y })
          const row = document.querySelector(`.space-edit-p[data-id="${u.placement.id}"]`)?.closest('tr')
          if (row) {
            const cells = row.querySelectorAll('td')
            if (cells[2]) cells[2].innerHTML = `${newFp}×${newFp} ft <span class="text-slate-500">(${newFp * newFp} sf)</span>`
          }
          toast(`${u.placement.item_name} footprint → ${newFp}×${newFp} ft`, 'info')
        } catch { toast('Resize failed to save', 'error') }
      } else {
        radius = Math.max(maxDim * 0.45, Math.min(maxDim * 3, radius + e.deltaY * 0.08))
        placeCamera()
      }
    }, { passive: false })

    function animate() {
      if (state.activeView !== 'facility' || state.facilityMode !== 'planner') { renderer.dispose(); return }
      if (!document.body.contains(renderer.domElement)) return
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()
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

      animateIn('#roadmap-timeline > .space-y-6 > div', { x: -30, opacity: 0, duration: 0.5, stagger: 0.12 })
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

      animateIn('#bucket-summary > div', { y: 20, opacity: 0, duration: 0.4, stagger: 0.1 })
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

      animateIn('#main-content .grid > div', { y: 20, opacity: 0, duration: 0.4, stagger: 0.06 })
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
  async function renderSupervisorAIView() {
    const content = $('#main-content')
    const [{ data: vaultKeys }, { data: rooms }] = await Promise.all([API.get('/vault/keys'), API.get('/space/rooms')])
    const activeKey = vaultKeys.find(k => k.is_active)
    content.innerHTML = `<div class="space-y-6"><div class="flex items-start justify-between gap-3"><div><h2 class="text-xl font-bold">Supervisor AI Advisory</h2><p class="text-sm text-slate-400">Review the current plan through safety, operability, and human-workflow lenses. Outputs require qualified review.</p></div><button id="sup-report" class="text-xs px-3 py-2 rounded-lg bg-slate-700/60 border border-slate-700 text-slate-300"><i class="fas fa-file-export mr-1"></i>Generate report</button></div><div class="grid lg:grid-cols-[1fr_1.2fr] gap-5"><div class="glass-card rounded-2xl p-5 space-y-4"><div class="flex items-center justify-between"><h3 class="font-semibold"><i class="fas fa-vault text-cyan-400 mr-2"></i>Unified API Vault</h3><span class="text-[11px] text-cyan-300">Shared</span></div><p class="text-xs text-slate-500">Supervisor AI runs on the same vaulted kie.ai key as Report Creator, GenAI, Spatial Copilot and Whiteboard AI. The key is server-side only and never returned after save.</p><div class="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-xs">${activeKey ? `<span class="text-emerald-400"><i class="fas fa-check-circle mr-1"></i>Vault key active</span> <span class="font-mono text-slate-500">${activeKey.key_preview}</span><span class="text-slate-600"> · ${activeKey.model}</span>` : '<span class="text-amber-400"><i class="fas fa-exclamation-triangle mr-1"></i>No key in vault — analyses will return metrics-only guidance.</span>'}</div><button id="sup-vault" class="w-full bg-slate-700/60 hover:bg-slate-600 border border-slate-700 text-slate-200 py-2.5 rounded-xl text-sm"><i class="fas fa-key mr-1"></i>Open API Vault</button><p class="text-[11px] text-slate-500">Max output tokens default to 2000 per call; advisories are advisory-only and require qualified review.</p></div><div class="glass-card rounded-2xl p-5 space-y-4"><h3 class="font-semibold"><i class="fas fa-search-plus text-indigo-400 mr-2"></i>Analyze a plan</h3><select id="sup-room" class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"><option value="">All room context</option>${rooms.map(r => `<option value="${r.id}">${r.name} · ${r.campus}</option>`).join('')}</select><textarea id="sup-prompt" rows="4" placeholder="Ask about chimney/exhaust, pathways, ergonomics, clearance, power, fire access, or another concern…" class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"></textarea><input id="sup-source" placeholder="Optional product specs URL, PDF, or image URL" class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"><button id="sup-analyze" class="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white py-2.5 rounded-xl text-sm font-medium btn-glow"><i class="fas fa-robot mr-2"></i>Run supervisor review</button><div id="sup-results" class="space-y-3"></div></div></div></div>`
    $('#sup-report').onclick = async () => { const { data } = await API.post('/supervisor/advisories/report'); if (data.share_token) { const url = window.location.origin + '/#share/' + data.share_token; await navigator.clipboard.writeText(url); toast('Advisory report generated — shareable link copied!', 'success') } else toast('Report generated', 'success') }
    const validateButton = document.createElement('button'); validateButton.className = 'w-full text-xs px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300'; validateButton.innerHTML = '<i class="fas fa-ruler-combined mr-1"></i>Run placement & safety checks'; $('#sup-analyze').parentNode.insertBefore(validateButton, $('#sup-analyze')); validateButton.onclick = async () => { if (!$('#sup-room').value) return toast('Select a room first', 'error'); const { data } = await API.post('/supervisor/planner/validate', { room_id: $('#sup-room').value }); $('#sup-results').innerHTML = (data.findings || []).map(f => `<div class="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"><div class="flex justify-between"><span class="font-medium text-sm">${f.title}</span><span class="text-[10px] uppercase text-amber-300">${f.severity}</span></div><p class="text-xs text-slate-300 mt-2">${f.advisory}</p></div>`).join('') || '<p class="text-sm text-emerald-400">No rule-based conflicts found. Verify against site measurements and manufacturer instructions.</p>'; toast(`${data.findings?.length || 0} planner findings recorded`, 'info') }
    $('#sup-vault').onclick = () => openApiVaultModal(vaultKeys)
    $('#sup-analyze').onclick = async () => { const btn = $('#sup-analyze'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner animate-spin mr-2"></i>Reviewing…'; try { const { data } = await API.post('/supervisor/advisories/analyze', { room_id: $('#sup-room').value || null, prompt: $('#sup-prompt').value, source_material: $('#sup-source').value }); const results = $('#sup-results'); results.innerHTML = (data.advisories || []).map((a, i) => `<div class="rounded-xl border ${a.severity === 'critical' || a.severity === 'high' ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700/70 bg-slate-800/40'} p-3"><div class="flex items-center justify-between"><span class="font-medium text-sm">${a.title}</span><span class="text-[10px] uppercase tracking-wider text-amber-300">${a.severity}</span></div><p class="text-xs text-slate-300 mt-2">${a.advisory}</p><button class="sup-push mt-3 text-xs px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300" data-id="${data.ids?.[i] || ''}">Push to CoE bulletin</button></div>`).join('') || '<p class="text-sm text-slate-500">No advisory returned.</p>'; $$('.sup-push').forEach(b => b.onclick = async () => { await API.post(`/supervisor/advisories/${b.dataset.id}/push`); b.textContent = 'Pushed to CoE bulletin'; b.disabled = true; toast('Advisory pushed to CoE leader', 'success') }) } catch (e) { toast(e.response?.data?.error || e.message, 'error') } btn.disabled = false; btn.innerHTML = '<i class="fas fa-robot mr-2"></i>Run supervisor review' }
  }

  // Lightweight landing scene: a calm orbital network that reinforces the CoE theme
  // without blocking the login form or requiring any additional asset.
  function initLanding3D() {
    const container = $('#landing-3d')
    if (!container || !window.THREE) return
    try {
    const W = container.clientWidth || window.innerWidth
    const H = container.clientHeight || window.innerHeight
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100)
    camera.position.set(0, 1.2, 7.5)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
    renderer.setSize(W, H)
    container.appendChild(renderer.domElement)
    scene.add(new THREE.AmbientLight(0x8da2ff, 1.4))
    const key = new THREE.PointLight(0x38bdf8, 8, 16); key.position.set(2, 3, 4); scene.add(key)
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 2), new THREE.MeshBasicMaterial({ color: 0x6366f1, wireframe: true, transparent: true, opacity: 0.55 }))
    scene.add(core)
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 32), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.12 }))
    scene.add(glow)
    const orbitMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25 })
    ;[[2.0, 0.18], [2.7, -0.24], [3.35, 0.38]].forEach(([r, tilt]) => {
      const pts = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.32, Math.sin(a) * r)) }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), orbitMat); line.rotation.x = tilt; scene.add(line)
    })
    const nodes = new THREE.Group()
    for (let i = 0; i < 42; i++) { const a = Math.random() * Math.PI * 2, r = 2.2 + Math.random() * 2.8; const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018 + Math.random() * 0.025, 8, 8), new THREE.MeshBasicMaterial({ color: i % 3 ? 0x818cf8 : 0x67e8f9 })); dot.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 2.2, Math.sin(a) * r); nodes.add(dot) }
    scene.add(nodes)
    const tick = () => { if (!document.getElementById('landing-3d')) return; requestAnimationFrame(tick); core.rotation.x += 0.002; core.rotation.y += 0.004; nodes.rotation.y -= 0.0015; renderer.render(scene, camera) }
    tick()
    window.addEventListener('resize', () => { if (!document.getElementById('landing-3d')) return; const w = container.clientWidth, h = container.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h) }, { passive: true })
    } catch (e) { container.innerHTML = ''; container.classList.add('landing-3d-fallback') }
  }

  async function renderBulletinsView() {
    const content = $('#main-content'); const { data: bulletins } = await API.get('/supervisor/bulletins')
    content.innerHTML = `<div class="space-y-6"><div><h2 class="text-xl font-bold">AI Bulletins</h2><p class="text-sm text-slate-400">Supervisor advisories pushed for CoE leader acknowledgement.</p></div><div class="space-y-3">${bulletins.length ? bulletins.map(a => `<div class="glass-card rounded-2xl p-5"><div class="flex items-start justify-between gap-3"><div><span class="text-[10px] uppercase tracking-wider text-amber-300">${a.severity} · ${a.category}</span><h3 class="font-semibold mt-1">${a.title}</h3><p class="text-sm text-slate-300 mt-2">${a.advisory}</p><p class="text-xs text-slate-500 mt-3">${a.room_name || 'All rooms'}${a.item_name ? ` · ${a.item_name}` : ''}</p></div><div class="text-right">${a.status === 'acknowledged' || a.status === 'actioned' ? '<span class="text-xs text-emerald-400"><i class="fas fa-check mr-1"></i>Acknowledged</span>' : `<button class="ack-bulletin text-xs px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300" data-id="${a.id}">Acknowledge</button>`}</div></div></div>`).join('') : '<div class="glass-card rounded-2xl p-10 text-center text-slate-500">No pushed advisories yet.</div>'}</div></div>`
    bulletins.forEach((a, i) => { const card = $$('.glass-card')[i]; if (!card) return; const controls = document.createElement('div'); controls.className = 'mt-4 pt-3 border-t border-slate-800 grid sm:grid-cols-3 gap-2'; controls.innerHTML = `<select class="bulletin-status bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"><option value="acknowledged">Acknowledged</option><option value="actioned">Actioned</option></select><input class="bulletin-assignee bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200" placeholder="Action owner"><input class="bulletin-due bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200" type="date"><input class="bulletin-comment sm:col-span-2 bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200" placeholder="Add action note"><button class="bulletin-save text-xs rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">Save action</button>`; card.appendChild(controls); controls.querySelector('.bulletin-save').onclick = async () => { await API.put(`/supervisor/advisories/${a.id}`, { status: controls.querySelector('.bulletin-status').value, assignee: controls.querySelector('.bulletin-assignee').value, due_date: controls.querySelector('.bulletin-due').value, comment: controls.querySelector('.bulletin-comment').value }); toast('Advisory lifecycle updated', 'success'); renderBulletinsView() } })
    $$('.ack-bulletin').forEach(b => b.onclick = async () => { await API.put(`/supervisor/bulletins/${b.dataset.id}/acknowledge`, { acknowledged_by: 'coe_leader' }); toast('Bulletin acknowledged', 'success'); renderBulletinsView() })
  }

  async function renderLLMView() {
    const content = $('#main-content')
    const { data: keys } = await API.get('/vault/keys')
    const activeKey = keys.find(k => k.is_active)
    content.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><h2 class="text-xl font-bold">GenAI Report Synthesis</h2><p class="text-sm text-slate-400">LLM-powered strategic synthesis — Venture Owner Tool</p></div>
          <div class="flex items-center gap-2 text-xs">
            <span class="hud-chip rounded-lg px-3 py-1.5 flex items-center gap-2">
              <i class="fas fa-key ${activeKey ? 'text-emerald-400' : 'text-amber-400'}"></i>
              <span>${activeKey ? `Vault key active <span class="font-mono text-slate-500">${activeKey.key_preview}</span> · ${activeKey.model}` : 'No API key in vault'}</span>
            </span>
            <button id="llm-vault-btn" class="bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-3 py-2 rounded-xl text-sm transition"><i class="fas fa-vault mr-1"></i>API Vault</button>
          </div>
        </div>
        <div class="glass-card rounded-2xl p-6">
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
          <p class="text-[11px] text-slate-500 mt-3"><i class="fas fa-info-circle mr-1"></i>Uses the unified API Vault key (kie.ai Gemini) server-side — the key never touches the page.</p>
          <div id="llm-output" class="mt-6 hidden">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold"><i class="fas fa-file-alt text-indigo-400 mr-2"></i>Synthesis Output</h3>
              <div class="flex gap-2">
                <button id="llm-pdf-btn" class="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white px-3 py-1.5 rounded-lg text-xs transition font-medium"><i class="fas fa-file-pdf mr-1"></i>Export PDF</button>
                <button id="save-llm-report-btn" class="bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition"><i class="fas fa-save mr-1"></i>Save as Report</button>
              </div>
            </div>
            <div id="llm-content" class="bg-slate-800/60 rounded-xl p-5 text-sm prose prose-invert max-h-96 overflow-y-auto whitespace-pre-wrap border border-slate-700/30"></div>
          </div>
        </div>
      </div>`

    $('#llm-vault-btn').addEventListener('click', () => openApiVaultModal(keys))
    $('#llm-generate-btn').addEventListener('click', async () => {
      const btn = $('#llm-generate-btn')
      btn.disabled = true
      btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Generating...'
      try {
        const { data } = await API.post('/llm/synthesize', {
          prompt: $('#llm-prompt').value.trim(), report_type: $('#llm-report-type').value
        })
        const output = $('#llm-output')
        output.classList.remove('hidden')
        $('#llm-content').textContent = data.synthesis
        animateIn(output, { y: 20, opacity: 0, duration: 0.5 })
        $('#save-llm-report-btn').onclick = async () => {
          await API.post('/reports/saved', {
            title: `LLM ${$('#llm-report-type').value} — ${dayjs().format('YYYY-MM-DD HH:mm')}`,
            report_type: 'llm_synthesis', content: data.synthesis
          })
          toast('Report saved!', 'success')
        }
        $('#llm-pdf-btn').onclick = () => {
          const { jsPDF } = window.jspdf
          if (!jsPDF) return toast('PDF library not loaded', 'error')
          const doc = new jsPDF()
          doc.setFontSize(15); doc.setTextColor(79, 70, 229)
          doc.text(doc.splitTextToSize(`GenAI Synthesis — ${$('#llm-report-type').value}`, 180), 14, 18)
          doc.setFontSize(9); doc.setTextColor(110)
          doc.text(`SRM dROIds CoE · ${dayjs().format('DD MMM YYYY HH:mm')} · via kie.ai Gemini`, 14, 25)
          doc.setDrawColor(79, 70, 229); doc.line(14, 28, 196, 28)
          doc.setFontSize(10); doc.setTextColor(30)
          let y = 35
          doc.splitTextToSize($('#llm-content').textContent, 180).forEach(line => {
            if (y > 282) { doc.addPage(); y = 18 }
            doc.text(line, 14, y); y += 5.2
          })
          doc.save(`genai-synthesis-${dayjs().format('YYYY-MM-DD')}.pdf`)
          toast('PDF downloaded', 'success')
        }
      } catch (e) {
        const msg = e.response?.data?.error || e.message
        toast('LLM synthesis failed: ' + msg, 'error')
        if (e.response?.data?.needs_key) toast('Add a key in the API Vault (top-right) first', 'info')
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

      animateIn('#main-content .glass-card', { y: 20, opacity: 0, duration: 0.4 })
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
      const trackerScope = state.campusScope === 'both' ? '' : `?campus=${state.campusScope}`
      const { data: tracker } = await API.get(`/tracker${trackerScope}`)
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
              <h2 class="text-xl font-bold">${campusLabel(state.campusScope)} Setup Tracker</h2>
              <p class="text-sm text-slate-400">${isVenture
                ? 'Bird\'s-eye view of the CoE setup — review submissions, guide next steps, take decisions'
                : 'Build the CoE foundation line by line — planning, design, procurement, deployment, readiness'}</p>
            </div>
            <div class="flex items-center gap-2">
              <div class="text-right mr-2">
                <div class="text-xs text-slate-500">Overall Setup Progress</div>
                <div class="text-lg font-extrabold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">${tracker.overall_progress}%</div>
              </div>
              <button id="setup-email-btn" class="bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition"><i class="fas fa-envelope mr-1"></i> Email</button>
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
      $('#setup-email-btn').addEventListener('click', () => openEmailShareModal('tracker'))

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
    animateIn('#stage-stepper > button', { y: 20, opacity: 0, duration: 0.4, stagger: 0.06 })
    animateIn('#sections-area > div', { y: 30, opacity: 0, duration: 0.5, stagger: 0.1 })
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
          <div class="mt-1 flex items-center gap-1.5"><span class="scope-chip"><i class="fas fa-${it.campus_scope === 'trichy' ? 'location-dot' : 'layer-group'} mr-1"></i>${campusLabel(it.campus_scope)}</span>${it.campus_locked ? '<span class="scope-lock"><i class="fas fa-lock mr-1"></i>locked</span>' : ''}</div>
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
        <div class="scope-editor rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
          <div class="flex items-center justify-between gap-3"><div><div class="text-xs font-semibold text-cyan-300">Campus ownership</div><div class="text-[11px] text-slate-500 mt-0.5">Every line item must be attributable to a site.</div></div><i class="fas fa-shield-halved text-cyan-400"></i></div>
          <div class="grid grid-cols-[1fr_auto] gap-2 mt-2"><select name="campus_scope" ${d.campus_locked ? 'disabled' : ''} class="bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200"><option value="ramapuram" ${(d.campus_scope || state.campusScope) === 'ramapuram' ? 'selected' : ''}>Ramapuram</option><option value="trichy" ${(d.campus_scope || state.campusScope) === 'trichy' ? 'selected' : ''}>Trichy</option><option value="both" ${(d.campus_scope || state.campusScope) === 'both' ? 'selected' : ''}>Both campuses</option></select><label class="flex items-center gap-1.5 text-xs text-slate-400"><input name="campus_locked" type="checkbox" value="1" ${d.campus_locked ? 'checked' : ''}> Lock</label></div>
        </div>
        <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-medium transition btn-glow"><i class="fas fa-save mr-1"></i> ${editData ? 'Save Changes' : 'Add Line Item'}</button>
      </form>`)

    $('#li-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const payload = Object.fromEntries(fd.entries())
      payload.campus_scope = payload.campus_scope || d.campus_scope || state.campusScope
      payload.campus_locked = fd.get('campus_locked') ? true : false
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
        <div class="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3"><select name="campus_scope" class="bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200"><option value="ramapuram" ${state.campusScope === 'ramapuram' ? 'selected' : ''}>Ramapuram</option><option value="trichy" ${state.campusScope === 'trichy' ? 'selected' : ''}>Trichy</option><option value="both" ${state.campusScope === 'both' ? 'selected' : ''}>Both campuses</option></select><label class="flex items-center gap-1.5 text-xs text-slate-400"><input name="campus_locked" type="checkbox" value="1" ${state.campusLocked ? 'checked' : ''}> Lock</label></div>
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
    animateIn('#analytics-strip > div', { y: 20, opacity: 0, duration: 0.4, stagger: 0.06 })
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
    animateIn('#decision-list > div', { y: 20, opacity: 0, duration: 0.4, stagger: 0.06 })
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

  // ── COLLAB VIEW (v5) — shared whiteboard + meeting action tracker ──
  const WB_COLORS = ['#f59e0b', '#6366f1', '#10b981', '#ef4444', '#0ea5e9', '#ec4899']
  const AI_STATUS_COLORS = { backlog: 'text-slate-400', todo: 'text-amber-400', in_progress: 'text-sky-400', blocked: 'text-red-400', done: 'text-emerald-400' }
  const AI_PRIORITY_COLORS = { low: 'bg-slate-700/50 text-slate-400', medium: 'bg-indigo-500/20 text-indigo-400', high: 'bg-amber-500/20 text-amber-400', urgent: 'bg-red-500/20 text-red-400' }

  async function renderCollabView() {
    const content = $('#main-content')
    try {
      content.innerHTML = `
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div><h2 class="text-xl font-bold">Collaboration Hub</h2><p class="text-sm text-slate-400">Shared whiteboard &amp; meeting action tracker — visible to both CoE Director and Venture Owner</p></div>
            <div class="flex gap-2">
              <button id="collab-pdf-btn" class="bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition"><i class="fas fa-file-pdf mr-1"></i>Export Board PDF</button>
            </div>
          </div>
          <div class="flex gap-1 bg-slate-900/60 rounded-xl p-1 w-fit border border-slate-800">
            <button class="collab-tab px-4 py-2 rounded-lg text-sm font-medium transition ${state.collabTab === 'board' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}" data-ct="board"><i class="fas fa-object-group mr-1.5"></i>Whiteboard</button>
            <button class="collab-tab px-4 py-2 rounded-lg text-sm font-medium transition ${state.collabTab === 'actions' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}" data-ct="actions"><i class="fas fa-list-check mr-1.5"></i>Action Items</button>
          </div>
          <div id="collab-content-area"></div>
        </div>`
      $$('.collab-tab').forEach(b => b.addEventListener('click', () => { state.collabTab = b.dataset.ct; renderCollabView() }))
      $('#collab-pdf-btn').addEventListener('click', () => exportWhiteboardPdf())
      if (state.collabTab === 'actions') renderActionItems()
      else renderWhiteboard()
    } catch (e) { content.innerHTML = errorHtml('collaboration hub', e) }
  }

  // ── WHITEBOARD — shared sticky-note board with AI enhance ──
  async function renderWhiteboard() {
    const area = $('#collab-content-area')
    const { data: notes } = await API.get('/whiteboard/notes')
    area.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center gap-2 flex-wrap">
          <button id="wb-add" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition btn-glow"><i class="fas fa-plus mr-1"></i>Add Note</button>
          <div class="flex gap-1 items-center">${WB_COLORS.map(c => `<span class="wb-color w-6 h-6 rounded-lg cursor-pointer border-2 border-transparent hover:scale-110 transition" data-color="${c}" style="background:${c}"></span>`).join('')}</div>
          <span class="text-xs text-slate-500 ml-auto"><i class="fas fa-arrows-alt mr-1"></i>Drag notes to arrange · double-click to edit · <i class="fas fa-wand-magic-sparkles"></i> = AI enhance</span>
        </div>
        <div id="wb-board" class="glass-card rounded-2xl relative overflow-hidden" style="height:560px;">
          <div class="absolute inset-0 grid-pattern opacity-40"></div>
          ${notes.length === 0 ? '<div class="absolute inset-0 flex items-center justify-center pointer-events-none"><div class="text-center"><i class="fas fa-chalkboard text-4xl text-indigo-400/40 mb-3"></i><p class="text-slate-400 font-medium">Shared whiteboard is empty</p><p class="text-xs text-slate-500 mt-1">Add a note — both roles see the same board in real time on refresh.</p></div></div>' : ''}
        </div>
      </div>`

    const board = $('#wb-board')
    let activeColor = WB_COLORS[0]
    $$('.wb-color').forEach(s => s.addEventListener('click', () => {
      activeColor = s.dataset.color
      $$('.wb-color').forEach(x => x.classList.remove('border-white'))
      s.classList.add('border-white')
    }))

    notes.forEach(n => board.appendChild(buildNoteEl(n)))

    $('#wb-add').addEventListener('click', async () => {
      const { data } = await API.post('/whiteboard/notes', {
        author_role: state.role, text: 'New note…', color: activeColor,
        x: 40 + Math.random() * 120, y: 40 + Math.random() * 100
      })
      board.appendChild(buildNoteEl({ id: data.id, author_role: state.role, text: 'New note…', color: activeColor, x: 60, y: 60, w: 220, h: 160, ai_enhanced: 0 }))
      toast('Note added — drag it into place', 'success')
    })

    function buildNoteEl(n) {
      const el = document.createElement('div')
      el.className = 'wb-note'
      el.style.cssText = `left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;background:${n.color}22;border:1px solid ${n.color}66;`
      el.innerHTML = `
        <div class="flex items-center justify-between px-2.5 py-1.5 border-b" style="border-color:${n.color}44;background:${n.color}18;">
          <span class="text-[10px] font-semibold uppercase tracking-wider" style="color:${n.color}">${n.author_role === 'venture_owner' ? 'Venture' : 'CoE'}${n.ai_enhanced ? ' · ✦AI' : ''}</span>
          <div class="flex gap-1">
            <button class="wb-ai text-[10px] px-1.5 py-0.5 rounded hover:bg-white/10 transition" title="Enhance with AI"><i class="fas fa-wand-magic-sparkles" style="color:${n.color}"></i></button>
            <button class="wb-del text-[10px] px-1.5 py-0.5 rounded hover:bg-white/10 transition" title="Delete"><i class="fas fa-times text-slate-500"></i></button>
          </div>
        </div>
        <div class="wb-text flex-1 px-2.5 py-2 text-xs text-slate-200 overflow-y-auto whitespace-pre-wrap" contenteditable="false">${n.text}</div>`
      // drag
      el.addEventListener('mousedown', (e) => {
        if (e.target.closest('button') || el.querySelector('[contenteditable="true"]')) return
        const sx = e.clientX - n.x, sy = e.clientY - n.y
        const move = (ev) => {
          n.x = Math.max(0, Math.min(board.clientWidth - n.w, ev.clientX - sx))
          n.y = Math.max(0, Math.min(board.clientHeight - n.h, ev.clientY - sy))
          el.style.left = n.x + 'px'; el.style.top = n.y + 'px'
        }
        const up = async () => {
          window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
          await API.put(`/whiteboard/notes/${n.id}`, { x: Math.round(n.x), y: Math.round(n.y) })
        }
        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
      })
      // edit on dblclick
      const txt = el.querySelector('.wb-text')
      el.addEventListener('dblclick', () => {
        txt.contentEditable = 'true'; txt.focus()
        txt.addEventListener('blur', async () => {
          txt.contentEditable = 'false'
          if (txt.textContent !== n.text) { n.text = txt.textContent; await API.put(`/whiteboard/notes/${n.id}`, { text: n.text }) ; toast('Note saved', 'success') }
        }, { once: true })
      })
      // AI enhance
      el.querySelector('.wb-ai').addEventListener('click', async () => {
        const btn = el.querySelector('.wb-ai')
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'
        try {
          const { data } = await API.post('/llm/chat', {
            role: state.role,
            messages: [
              { role: 'system', content: 'You are a CoE setup copilot. Rewrite the whiteboard note into a crisp, structured action note (≤5 bullet points or a 2-line summary). Keep it concrete for a drone Centre of Excellence build-out.' },
              { role: 'user', content: n.text }
            ]
          })
          if (data.ok) {
            n.text = data.content; txt.textContent = data.content
            await API.put(`/whiteboard/notes/${n.id}`, { text: n.text, ai_enhanced: 1 })
            toast('Note enhanced by AI', 'success')
            renderWhiteboard()
          } else toast(data.error || 'AI enhance failed', 'error')
        } catch (err) { toast(err.response?.data?.error || 'AI enhance failed — check API vault key', 'error') }
        btn.innerHTML = `<i class="fas fa-wand-magic-sparkles" style="color:${n.color}"></i>`
      })
      // delete
      el.querySelector('.wb-del').addEventListener('click', async () => {
        await API.delete(`/whiteboard/notes/${n.id}`); el.remove(); toast('Note removed', 'success')
      })
      return el
    }
  }

  function exportWhiteboardPdf() {
    const { jsPDF } = window.jspdf
    if (!jsPDF) return toast('PDF library not loaded', 'error')
    API.get('/whiteboard/notes').then(({ data: notes }) => {
      const doc = new jsPDF()
      doc.setFontSize(18); doc.setTextColor(99, 102, 241)
      doc.text('SRM dROIds CoE — Shared Whiteboard', 14, 20)
      doc.setFontSize(10); doc.setTextColor(100)
      doc.text(`Exported ${dayjs().format('DD MMM YYYY HH:mm')} · ${notes.length} notes`, 14, 28)
      let y = 40
      notes.forEach((n, i) => {
        if (y > 270) { doc.addPage(); y = 20 }
        doc.setDrawColor(99, 102, 241); doc.setFillColor(245, 246, 255)
        doc.roundedRect(14, y, 180, 30, 2, 2, 'FD')
        doc.setFontSize(9); doc.setTextColor(120)
        doc.text(`${n.author_role === 'venture_owner' ? 'Venture Owner' : 'CoE Director'}${n.ai_enhanced ? ' · AI-enhanced' : ''}`, 18, y + 6)
        doc.setFontSize(10); doc.setTextColor(30)
        doc.text(doc.splitTextToSize(n.text, 172), 18, y + 13)
        y += 38
      })
      doc.save(`whiteboard-${dayjs().format('YYYY-MM-DD')}.pdf`)
      toast('Whiteboard exported as PDF', 'success')
    })
  }

  // ── MEETING ACTION TRACKER — Jira-lite for CoE setup ────
  async function renderActionItems() {
    const area = $('#collab-content-area')
    const { data } = await API.get('/action-items')
    const cols = ['todo', 'in_progress', 'blocked', 'done']
    area.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center gap-2 flex-wrap">
          <button id="ai-add" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition btn-glow"><i class="fas fa-plus mr-1"></i>Log Action Item</button>
          <button id="ai-extract" class="bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm transition"><i class="fas fa-wand-magic-sparkles mr-1"></i>Extract from Meeting Notes (AI)</button>
          ${data.meetings.length ? `<select id="ai-meeting-filter" class="bg-slate-700/50 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200"><option value="">All meetings</option>${data.meetings.map(m => `<option value="${m.meeting_title}">${m.meeting_title}${m.meeting_date ? ' · ' + m.meeting_date : ''}</option>`).join('')}</select>` : ''}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          ${cols.map(c => `
            <div class="glass-card rounded-xl p-3 min-h-[200px]">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold uppercase tracking-wider ${AI_STATUS_COLORS[c]}">${c.replace(/_/g, ' ')}</span>
                <span class="text-xs text-slate-500">${data.items.filter(i => i.status === c).length}</span>
              </div>
              <div class="space-y-2">
                ${data.items.filter(i => i.status === c).map(i => `
                  <div class="bg-slate-800/60 border border-slate-700/40 rounded-lg p-2.5 text-xs hover:border-indigo-500/40 transition cursor-pointer ai-card" data-id="${i.id}">
                    <div class="flex items-start justify-between gap-1 mb-1">
                      <span class="font-semibold text-slate-200 flex-1">${i.title}</span>
                      <span class="px-1.5 py-0.5 rounded ${AI_PRIORITY_COLORS[i.priority]}">${i.priority}</span>
                    </div>
                    ${i.description ? `<p class="text-slate-500 mb-1 line-clamp-2">${i.description}</p>` : ''}
                    <div class="flex items-center justify-between text-slate-500">
                      <span><i class="fas fa-user mr-0.5"></i>${i.owner === 'venture_owner' ? 'Venture' : 'CoE'}</span>
                      ${i.due_date ? `<span><i class="fas fa-calendar mr-0.5"></i>${i.due_date}</span>` : ''}
                    </div>
                    <div class="text-slate-600 mt-0.5 italic">${i.meeting_title}</div>
                  </div>`).join('') || '<p class="text-slate-600 text-xs text-center py-4">No items</p>'}
              </div>
            </div>`).join('')}
        </div>
      </div>`

    $('#ai-add').addEventListener('click', () => openActionItemForm())
    $('#ai-meeting-filter')?.addEventListener('change', (e) => {
      const sel = e.target.value
      $$('.ai-card').forEach(card => {
        const item = data.items.find(i => i.id === Number(card.dataset.id))
        card.style.display = (!sel || item?.meeting_title === sel) ? '' : 'none'
      })
    })
    $('#ai-extract').addEventListener('click', openActionExtractModal)
    $$('.ai-card').forEach(card => card.addEventListener('click', () => openActionItemForm(data.items.find(i => i.id === Number(card.dataset.id)))))
  }

  function openActionItemForm(item) {
    showModal(`
      <form id="ai-form" class="space-y-4 text-left">
        <h3 class="text-lg font-bold"><i class="fas fa-list-check text-indigo-400 mr-2"></i>${item ? 'Edit Action Item' : 'Log Action Item'}</h3>
        <div><label class="text-xs text-slate-400">Title <span class="text-amber-400">*</span></label><input name="title" required value="${item?.title || ''}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100" placeholder="e.g., Confirm 3-phase power for fabrication lab"></div>
        <div><label class="text-xs text-slate-400">Description</label><textarea name="description" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">${item?.description || ''}</textarea></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-400">Meeting <span class="text-amber-400">*</span></label><input name="meeting_title" required value="${item?.meeting_title || ''}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100" placeholder="e.g., Weekly Setup Sync"></div>
          <div><label class="text-xs text-slate-400">Meeting Date</label><input name="meeting_date" type="date" value="${item?.meeting_date || dayjs().format('YYYY-MM-DD')}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div><label class="text-xs text-slate-400">Owner</label><select name="owner" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">
            <option value="coe_leader" ${item?.owner === 'coe_leader' ? 'selected' : ''}>CoE Director</option>
            <option value="venture_owner" ${item?.owner === 'venture_owner' ? 'selected' : ''}>Venture Owner</option>
          </select></div>
          <div><label class="text-xs text-slate-400">Priority</label><select name="priority" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">
            ${['low', 'medium', 'high', 'urgent'].map(p => `<option value="${p}" ${item?.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select></div>
          <div><label class="text-xs text-slate-400">Due Date</label><input name="due_date" type="date" value="${item?.due_date || ''}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100"></div>
        </div>
        <div><label class="text-xs text-slate-400">Status</label><select name="status" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">
          ${['backlog', 'todo', 'in_progress', 'blocked', 'done'].map(s => `<option value="${s}" ${item?.status === s ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
        </select></div>
        <div class="flex gap-2">
          <button type="submit" class="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-medium transition btn-glow">${item ? 'Save' : 'Add Item'}</button>
          ${item ? '<button type="button" id="ai-del" class="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-lg text-sm transition"><i class="fas fa-trash"></i></button>' : ''}
        </div>
      </form>`)
    const form = $('#ai-form')
    $('#ai-del')?.addEventListener('click', async () => {
      if (!confirm('Delete this action item?')) return
      await API.delete(`/action-items/${item.id}`); toast('Deleted', 'success'); closeModal(); renderActionItems()
    })
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(form)
      const payload = { title: fd.get('title'), description: fd.get('description'), meeting_title: fd.get('meeting_title'), meeting_date: fd.get('meeting_date'), owner: fd.get('owner'), priority: fd.get('priority'), due_date: fd.get('due_date'), status: fd.get('status'), created_by: state.role }
      if (item) { await API.put(`/action-items/${item.id}`, payload); toast('Updated', 'success') }
      else { await API.post('/action-items', payload); toast('Action item logged', 'success') }
      closeModal(); renderActionItems()
    })
  }

  function openActionExtractModal() {
    showModal(`
      <form id="ai-extract-form" class="space-y-4 text-left">
        <h3 class="text-lg font-bold"><i class="fas fa-wand-magic-sparkles text-indigo-400 mr-2"></i>Extract Action Items from Meeting Notes</h3>
        <div><label class="text-xs text-slate-400">Meeting Title <span class="text-amber-400">*</span></label><input name="meeting_title" required class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100" placeholder="e.g., Steering Committee — 12 Sep"></div>
        <div><label class="text-xs text-slate-400">Paste raw meeting notes / transcript</label><textarea name="notes" rows="8" required class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100" placeholder="Paste the discussion here — the AI will pull out concrete action items with owners and priorities…"></textarea></div>
        <div id="ai-extract-status" class="hidden text-sm rounded-lg px-3 py-2"></div>
        <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-medium transition btn-glow"><i class="fas fa-magic mr-1"></i>Extract &amp; Create Items</button>
      </form>`)
    $('#ai-extract-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const status = $('#ai-extract-status')
      status.className = 'text-sm rounded-lg px-3 py-2 bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
      status.textContent = 'AI is reading your notes…'
      try {
        const { data } = await API.post('/llm/chat', {
          role: state.role,
          messages: [
            { role: 'system', content: 'Extract action items from the meeting notes. Return ONLY a JSON array, no markdown, each item: {"title": string, "description": string, "owner": "coe_leader"|"venture_owner", "priority": "low"|"medium"|"high"|"urgent", "due_date": "YYYY-MM-DD"|null}. Max 8 items.' },
            { role: 'user', content: String(fd.get('notes')) }
          ]
        })
        if (!data.ok) throw new Error(data.error || 'LLM failed')
        let items = []
        try { items = JSON.parse(data.content.replace(/```json|```/g, '').trim()) } catch { throw new Error('Could not parse AI output — try shorter notes') }
        for (const it of items.slice(0, 8)) {
          await API.post('/action-items', { ...it, meeting_title: fd.get('meeting_title'), meeting_date: dayjs().format('YYYY-MM-DD'), created_by: state.role })
        }
        status.className = 'text-sm rounded-lg px-3 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
        status.textContent = `Created ${items.length} action item(s)`
        setTimeout(() => { closeModal(); renderActionItems() }, 900)
      } catch (err) {
        status.className = 'text-sm rounded-lg px-3 py-2 bg-red-500/15 text-red-400 border border-red-500/30'
        status.textContent = err.response?.data?.error || err.message
      }
    })
  }

  // ── REPORT CREATOR (v5) — kie.ai copilot + PDF export ────
  const RC_SOURCES = [
    { id: 'kpis', label: 'KPI Scorecard', icon: 'fa-chart-line' },
    { id: 'tracker', label: 'Setup Tracker (stages & line items)', icon: 'fa-layer-group' },
    { id: 'procurement', label: 'Procurement Pipeline', icon: 'fa-truck' },
    { id: 'actions', label: 'Meeting Action Items', icon: 'fa-list-check' },
    { id: 'whiteboard', label: 'Whiteboard Notes', icon: 'fa-object-group' },
    { id: 'roadmap', label: 'Roadmap Milestones', icon: 'fa-road' }
  ]

  async function renderReportCreator() {
    const content = $('#main-content')
    try {
      const { data: keys } = await API.get('/vault/keys')
      const myKey = keys.find(k => k.is_active) // unified vault — any active key powers all LLM features
      content.innerHTML = `
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div><h2 class="text-xl font-bold">Report Creator</h2><p class="text-sm text-slate-400">AI-assisted reporting — ingest any live data, get supervisory cues, export as PDF</p></div>
            <div class="flex items-center gap-2 text-xs">
              <span class="hud-chip rounded-lg px-3 py-1.5 flex items-center gap-2">
                <i class="fas fa-key ${myKey ? 'text-emerald-400' : 'text-amber-400'}"></i>
                <span>${myKey ? `Vault key active <span class="font-mono text-slate-500">${myKey.key_preview}</span>` : 'No API key in vault'}</span>
              </span>
              <button id="rc-vault-btn" class="bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-3 py-2 rounded-xl text-sm transition"><i class="fas fa-vault mr-1"></i>API Vault</button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div class="lg:col-span-2 space-y-4">
              <div class="glass-card rounded-2xl p-5 space-y-3">
                <h3 class="font-semibold text-sm"><i class="fas fa-database mr-1.5 text-indigo-400"></i>1 · Ingest Data Sources</h3>
                ${RC_SOURCES.map(s => `
                  <label class="flex items-center gap-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 rounded-xl px-3 py-2.5 cursor-pointer transition">
                    <input type="checkbox" class="rc-source accent-indigo-500" value="${s.id}" ${['kpis', 'tracker', 'actions'].includes(s.id) ? 'checked' : ''}>
                    <i class="fas ${s.icon} text-indigo-400 text-xs"></i>
                    <span class="text-sm">${s.label}</span>
                  </label>`).join('')}
              </div>
              <div class="glass-card rounded-2xl p-5 space-y-3">
                <h3 class="font-semibold text-sm"><i class="fas fa-pen mr-1.5 text-indigo-400"></i>2 · Directive</h3>
                <input id="rc-title" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100" placeholder="Report title" value="CoE Operations Report — ${dayjs().format('DD MMM YYYY')}">
                <textarea id="rc-prompt" rows="4" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100" placeholder="What should the report focus on? e.g., Summarize setup progress, flag procurement risks, list follow-ups for the steering committee…"></textarea>
                <button id="rc-generate" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-xl font-medium transition btn-glow"><i class="fas fa-wand-magic-sparkles mr-1"></i>3 · Generate with AI</button>
                <p class="text-[11px] text-slate-500"><i class="fas fa-info-circle mr-1"></i>Uses your vaulted kie.ai key (Gemini) server-side. The key never touches the page.</p>
              </div>
            </div>

            <div class="lg:col-span-3 space-y-4">
              <div class="glass-card rounded-2xl p-5 min-h-[420px] flex flex-col">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="font-semibold text-sm"><i class="fas fa-file-lines mr-1.5 text-cyan-400"></i>Draft Report</h3>
                  <div class="flex gap-2">
                    <button id="rc-copy" class="text-xs bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition"><i class="fas fa-copy mr-1"></i>Copy</button>
                    <button id="rc-pdf" class="text-xs bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white px-3 py-1.5 rounded-lg transition font-medium"><i class="fas fa-file-pdf mr-1"></i>Export PDF</button>
                  </div>
                </div>
                <div id="rc-output" class="flex-1 bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 text-sm text-slate-200 whitespace-pre-wrap overflow-y-auto" style="max-height:480px;">Your generated report will appear here. Select sources, add a directive, then Generate.</div>
              </div>
              <div class="glass-card rounded-2xl p-5">
                <h3 class="font-semibold text-sm mb-3"><i class="fas fa-gauge-high mr-1.5 text-amber-400"></i>Supervisory Cues <span class="text-xs text-slate-500 font-normal">— operational radar from live data</span></h3>
                <div id="rc-cues" class="space-y-2 text-sm"><p class="text-slate-500 text-xs">Generate a report to compute cues, or click refresh.</p></div>
                <button id="rc-cues-refresh" class="mt-3 text-xs bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition"><i class="fas fa-rotate mr-1"></i>Refresh Cues</button>
              </div>
            </div>
          </div>
        </div>`

      $('#rc-vault-btn').addEventListener('click', () => openApiVaultModal(keys))
      $('#rc-generate').addEventListener('click', generateAiReport)
      $('#rc-cues-refresh').addEventListener('click', loadSupervisoryCues)
      $('#rc-copy').addEventListener('click', async () => {
        await navigator.clipboard.writeText($('#rc-output').textContent)
        toast('Report copied to clipboard', 'success')
      })
      $('#rc-pdf').addEventListener('click', () => exportReportPdf())
      loadSupervisoryCues()
    } catch (e) { content.innerHTML = errorHtml('report creator', e) }
  }

  function openApiVaultModal(keys) {
    const myKey = keys.find(k => k.is_active) // unified vault — single key powers every LLM feature
    const roleLabel = state.role === 'venture_owner' ? 'Venture Owner' : state.role === 'supervisor' ? 'Supervisor' : 'CoE Director'
    showModal(`
      <form id="vault-form" class="space-y-4 text-left">
        <h3 class="text-lg font-bold"><i class="fas fa-vault text-indigo-400 mr-2"></i>API Vault — Unified LLM Key</h3>
        <div class="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-xs space-y-1">
          <p><span class="text-slate-500">Provider:</span> <span class="text-slate-200">kie.ai (OpenAI-compatible)</span></p>
          <p><span class="text-slate-500">Endpoint:</span> <span class="text-slate-200 font-mono text-[11px]">https://api.kie.ai/gemini-3-8-flash-openai/v1/chat/completions</span></p>
          <p><span class="text-slate-500">Model:</span> <span class="text-slate-200">gemini-3-8-flash</span></p>
          <p class="text-slate-500">Powers: <span class="text-cyan-300">Report Creator · GenAI Synthesis · Spatial Copilot · Supervisor AI · Whiteboard AI</span></p>
          ${myKey ? `<p><span class="text-slate-500">Active key:</span> <span class="text-emerald-400 font-mono">${myKey.key_preview}</span> <span class="text-slate-600">(updated ${myKey.updated_at})</span></p>` : '<p class="text-amber-400">No key stored yet — save one below.</p>'}
        </div>
        <div>
          <label class="text-xs text-slate-400">${myKey ? 'Replace API Key' : 'API Key'} <span class="text-amber-400">*</span> <span class="text-slate-500">(saved for ${roleLabel})</span></label>
          <input name="api_key" type="password" required class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100" placeholder="Paste your kie.ai API key">
          <p class="text-[11px] text-slate-500 mt-1"><i class="fas fa-lock mr-1"></i>Stored server-side in the vault table, shown only masked. Get a key at kie.ai.</p>
        </div>
        <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-medium transition btn-glow"><i class="fas fa-save mr-1"></i>Save to Vault</button>
      </form>`)
    $('#vault-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const api_key = new FormData(e.target).get('api_key')
      await API.post('/vault/keys', { role: state.role, api_key })
      toast('API key stored in vault', 'success')
      closeModal(); renderReportCreator()
    })
  }

  async function gatherReportContext(selected) {
    const parts = []
    if (selected.includes('kpis')) {
      const { data } = await API.get('/kpis/scorecard')
      parts.push('KPI SCORECARD:\n' + JSON.stringify(data).slice(0, 4000))
    }
    if (selected.includes('tracker')) {
      const { data } = await API.get('/tracker/analytics')
      parts.push('SETUP TRACKER ANALYTICS:\n' + JSON.stringify(data).slice(0, 4000))
    }
    if (selected.includes('procurement')) {
      const { data } = await API.get('/procurement')
      parts.push('PROCUREMENT:\n' + JSON.stringify(data).slice(0, 3000))
    }
    if (selected.includes('actions')) {
      const { data } = await API.get('/action-items')
      parts.push('MEETING ACTION ITEMS:\n' + JSON.stringify(data.items).slice(0, 3000))
    }
    if (selected.includes('whiteboard')) {
      const { data } = await API.get('/whiteboard/notes')
      parts.push('WHITEBOARD NOTES:\n' + data.map(n => `- [${n.author_role}] ${n.text}`).join('\n').slice(0, 3000))
    }
    if (selected.includes('roadmap')) {
      const { data } = await API.get('/roadmap')
      parts.push('ROADMAP:\n' + JSON.stringify(data).slice(0, 2500))
    }
    return parts.join('\n\n')
  }

  async function generateAiReport() {
    const out = $('#rc-output')
    const selected = Array.from($$('.rc-source:checked')).map(c => c.value)
    if (!selected.length) return toast('Select at least one data source', 'error')
    out.innerHTML = '<div class="flex items-center gap-2 text-slate-400"><div class="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin"></div>Ingesting data &amp; generating with Gemini (kie.ai)…</div>'
    try {
      const context = await gatherReportContext(selected)
      const directive = $('#rc-prompt').value.trim() || 'Produce a concise, executive-grade operations report.'
      const { data } = await API.post('/llm/chat', {
        role: state.role,
        temperature: 0.4,
        messages: [
          { role: 'system', content: 'You are the supervisory copilot for SRM dROIds, a dual-campus drone Centre of Excellence. Write a structured report with clear sections: Executive Summary, Progress Highlights, Risks & Blockers, Follow-ups Required (with suggested owner: CoE Director or Venture Owner), and Next-Step Recommendations. Be specific — cite numbers from the data. Use plain text with section headers in CAPS.' },
          { role: 'user', content: `DIRECTIVE: ${directive}\n\nLIVE DATA:\n${context}` }
        ]
      })
      if (!data.ok) throw new Error(data.error || 'Generation failed')
      out.textContent = data.content
      toast('Report generated', 'success')
      loadSupervisoryCues()
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      out.innerHTML = `<p class="text-red-400">${msg}</p>${(err.response?.data?.needs_key) ? '<p class="text-slate-500 text-xs mt-2">Open the API Vault (top-right) and save your kie.ai key first.</p>' : ''}`
    }
  }

  async function loadSupervisoryCues() {
    const box = $('#rc-cues')
    if (!box) return
    try {
      const [trackerRes, actionsRes, procRes] = await Promise.all([
        API.get('/tracker/analytics').catch(() => ({ data: null })),
        API.get('/action-items').catch(() => ({ data: { items: [] } })),
        API.get('/procurement').catch(() => ({ data: [] }))
      ])
      const cues = []
      const items = actionsRes.data?.items || []
      const overdue = items.filter(i => i.due_date && i.due_date < dayjs().format('YYYY-MM-DD') && i.status !== 'done')
      const blocked = items.filter(i => i.status === 'blocked')
      if (overdue.length) cues.push({ icon: 'fa-clock', color: 'text-red-400', text: `${overdue.length} action item(s) overdue — follow up with owners today.` })
      if (blocked.length) cues.push({ icon: 'fa-ban', color: 'text-red-400', text: `${blocked.length} blocked item(s): ${blocked.slice(0, 2).map(b => b.title).join('; ')}` })
      const an = trackerRes.data
      if (an) {
        if (an.pending_submissions > 0) cues.push({ icon: 'fa-clipboard-check', color: 'text-amber-400', text: `${an.pending_submissions} setup submission(s) awaiting review.` })
        if (typeof an.overall_progress === 'number') cues.push({ icon: 'fa-chart-line', color: 'text-indigo-400', text: `Overall setup progress at ${an.overall_progress}% — pace check against the roadmap.` })
      }
      const proc = procRes.data || []
      const pendingProc = proc.filter(p => ['requested', 'pending', 'approved'].includes(p.status))
      if (pendingProc.length) cues.push({ icon: 'fa-truck', color: 'text-sky-400', text: `${pendingProc.length} procurement item(s) in pipeline — check vendor ETAs.` })
      if (!cues.length) cues.push({ icon: 'fa-circle-check', color: 'text-emerald-400', text: 'No red flags detected in live data. Keep the cadence.' })
      box.innerHTML = cues.map(c => `
        <div class="flex items-start gap-2.5 bg-slate-800/50 border border-slate-700/40 rounded-xl px-3 py-2.5">
          <i class="fas ${c.icon} ${c.color} mt-0.5"></i><span class="text-slate-300 text-xs leading-relaxed">${c.text}</span>
        </div>`).join('')
    } catch { box.innerHTML = '<p class="text-slate-500 text-xs">Cues unavailable right now.</p>' }
  }

  function exportReportPdf() {
    const { jsPDF } = window.jspdf
    if (!jsPDF) return toast('PDF library not loaded', 'error')
    const text = $('#rc-output')?.textContent || ''
    if (!text || text.startsWith('Your generated report')) return toast('Generate a report first', 'error')
    const doc = new jsPDF()
    const title = $('#rc-title')?.value || 'CoE Operations Report'
    doc.setFontSize(16); doc.setTextColor(79, 70, 229)
    doc.text(doc.splitTextToSize(title, 180), 14, 18)
    doc.setFontSize(9); doc.setTextColor(110)
    doc.text(`SRM dROIds CoE · Generated by ${state.role === 'venture_owner' ? 'Venture Owner' : 'CoE Director'} · ${dayjs().format('DD MMM YYYY HH:mm')} · via kie.ai Gemini`, 14, 26)
    doc.setDrawColor(79, 70, 229); doc.line(14, 29, 196, 29)
    doc.setFontSize(10); doc.setTextColor(30)
    const lines = doc.splitTextToSize(text, 180)
    let y = 36
    lines.forEach(line => {
      if (y > 282) { doc.addPage(); y = 18 }
      doc.text(line, 14, y); y += 5.2
    })
    doc.save(`${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60)}.pdf`)
    toast('PDF downloaded', 'success')
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

  // ── EMAIL SHARE — send formatted report via Resend ───────
  function openEmailShareModal(defaultScope = 'report') {
    const scopes = [
      { id: 'tracker', label: 'Full Setup Report (stages, sections, line items)' },
      { id: 'report', label: 'KPI Scorecard & Setup Summary' },
      { id: 'kpis', label: 'KPI Scorecard Only' },
      { id: 'procurement', label: 'Procurement Pipeline' }
    ]
    showModal(`
      <form id="email-share-form" class="space-y-4 text-left">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold"><i class="fas fa-envelope text-indigo-400 mr-2"></i>Share via Email</h3>
          <button type="button" id="email-preview-btn" class="text-xs bg-slate-700/50 hover:bg-slate-600 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition"><i class="fas fa-eye mr-1"></i>Preview</button>
        </div>
        <div>
          <label class="text-xs text-slate-400">Recipients <span class="text-amber-400">*</span> <span class="text-slate-500">(comma or newline separated)</span></label>
          <textarea name="to" rows="2" required class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500" placeholder="director@srm.edu, venture@srm.edu"></textarea>
        </div>
        <div>
          <label class="text-xs text-slate-400">Report Content</label>
          <select name="scope" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100">
            ${scopes.map(s => `<option value="${s.id}" ${s.id === defaultScope ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-slate-400">Note to include <span class="text-slate-500">(optional)</span></label>
          <textarea name="note" rows="2" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500" placeholder="e.g., Please review before Friday's steering call"></textarea>
        </div>
        <div>
          <label class="text-xs text-slate-400">Resend API Key <span class="text-amber-400">*</span> <span class="text-slate-500">(session only, never stored)</span></label>
          <input name="api_key" type="password" required value="${state.emailApiKey || ''}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1 text-slate-100 placeholder-slate-500" placeholder="re_...">
          <p class="text-[11px] text-slate-500 mt-1"><i class="fas fa-info-circle mr-1"></i>Free-tier Resend (<code>onboarding@resend.dev</code> sender) only delivers to the email address that owns the API key. Verify a domain at resend.com to send to anyone.</p>
        </div>
        <div id="email-share-status" class="hidden text-sm rounded-lg px-3 py-2"></div>
        <button type="submit" id="email-send-btn" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-medium transition btn-glow"><i class="fas fa-paper-plane mr-1"></i>Send Formatted Report</button>
      </form>`)

    const form = $('#email-share-form')
    $('#email-preview-btn').addEventListener('click', () => {
      window.open(`/api/email/preview?scope=${form.scope.value}`, '_blank')
    })
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(form)
      const to = String(fd.get('to') || '').split(/[,\n]+/).map(s => s.trim()).filter(Boolean)
      const scope = fd.get('scope')
      const note = fd.get('note')
      const api_key = String(fd.get('api_key') || '').trim()
      state.emailApiKey = api_key // session-only memory
      const status = $('#email-share-status')
      const btn = $('#email-send-btn')
      btn.disabled = true
      btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Sending...'
      try {
        const { data } = await API.post('/email/send', { to, scope, note, api_key })
        status.className = 'text-sm rounded-lg px-3 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
        status.textContent = `Sent to ${data.sent_to.join(', ')}`
        toast('Email sent successfully!', 'success')
        setTimeout(closeModal, 1200)
      } catch (err) {
        const msg = err.response?.data?.error || err.message
        status.className = 'text-sm rounded-lg px-3 py-2 bg-red-500/15 text-red-400 border border-red-500/30'
        status.textContent = msg
        btn.disabled = false
        btn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i>Send Formatted Report'
      }
    })
  }
  window._openEmailShare = openEmailShareModal

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
