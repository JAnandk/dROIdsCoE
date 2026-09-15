#!/usr/bin/env python3
"""Splice the new interactive initSpacePlanner3D into public/static/app.js,
replacing lines 1166..1316 (1-based, inclusive)."""
path = '/home/user/webapp/public/static/app.js'
with open(path) as f:
    lines = f.readlines()

START = 1166  # 1-based inclusive
END = 1316    # 1-based inclusive
assert lines[START - 1].strip().startswith('// 3D floor-layout renderer'), lines[START - 1]
assert lines[END - 1].strip() == '}', repr(lines[END - 1])
assert 'async function initThreeJS' in lines[END + 1], lines[END + 1]

new_fn = '''  // 3D floor-layout renderer (v5 interactive) — 1 world unit = 1 foot.
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
      } else ring.visible = false
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
        tip.innerHTML = `<div class="font-bold mb-0.5" style="color:${p.color}">${p.item_name}</div>
          <div class="text-slate-400">Footprint: <b class="text-slate-200">${u.fp}×${u.fp} ft</b> (${u.fp * u.fp} sq ft)</div>
          <div class="text-slate-400">Height: ${u.hgt} ft · Position: (${p.x_ft}, ${p.y_ft}) ft</div>
          <div class="capitalize ${SPACE_STATUS_COLORS[p.status] || 'text-slate-400'}">${p.status}</div>
          ${p.notes ? `<div class="text-slate-500 mt-0.5 italic">${p.notes}</div>` : ''}
          <div class="text-slate-500 mt-1 border-t border-slate-700/40 pt-1">drag = move · wheel = resize · dbl-click = edit</div>`
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
      if (selected) {
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
'''

out = lines[:START - 1] + [new_fn + '\n'] + lines[END:]
with open(path, 'w') as f:
    f.writelines(out)
print('spliced OK — new line count:', len(out))
