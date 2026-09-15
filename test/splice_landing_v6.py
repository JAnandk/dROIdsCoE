#!/usr/bin/env python3
"""Replace initLandingScene (lines 214..331 1-based inclusive) with the v6
narrative loop: raw materials -> exploded view -> assembly -> flight test ->
swarm ops -> command center with trainees."""
path = '/home/user/webapp/public/static/app.js'
with open(path) as f:
    lines = f.readlines()

START, END = 214, 332  # 1-based inclusive
assert 'function initLandingScene()' in lines[START - 1], lines[START - 1]
assert lines[END - 1].strip() == '}', repr(lines[END - 1])
assert 'function showLoginError' in lines[END + 1], lines[END + 1]

new_fn = r'''  function initLandingScene() {
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
        s.g.material?.opacity
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
'''

out = lines[:START - 1] + [new_fn + '\n'] + lines[END:]
with open(path, 'w') as f:
    f.writelines(out)
print('spliced OK — new line count:', len(out))
