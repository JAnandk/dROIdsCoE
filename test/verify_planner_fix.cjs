const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 180)));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.fill('#passcode-input', 'dROIds2026!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('[data-view="facility"]')?.click());
  await page.waitForTimeout(1800);
  await page.click('#fac-mode-planner');
  await page.waitForTimeout(3200);

  // Find the Lathe Machine mesh on screen by sweeping (it's the biggest item, 6x6 ft at x4,y4)
  const box = await (await page.$('#space-3d')).boundingBox();
  let lathePos = null;
  for (let fx = 0.25; fx <= 0.75 && !lathePos; fx += 0.05) {
    for (let fy = 0.25; fy <= 0.75 && !lathePos; fy += 0.05) {
      await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
      await page.waitForTimeout(60);
      const tipText = await page.evaluate(() => { const t = document.getElementById('space-tip'); return t && !t.classList.contains('hidden') ? t.textContent : '' });
      if (tipText.includes('Lathe')) lathePos = { x: box.x + box.width * fx, y: box.y + box.height * fy };
    }
  }
  console.log('Lathe Machine found at screen pos:', JSON.stringify(lathePos));
  if (!lathePos) { console.log('FATAL: could not locate lathe'); process.exit(1) }

  // Record footprint before
  const fpBefore = await page.evaluate(() => fetch('/api/space/placements?room_id=1').then(r => r.json()).then(rows => rows.find(p => p.item_name === 'Lathe Machine')?.footprint_ft));
  console.log('Footprint BEFORE drag+zoom:', fpBefore);

  // 1) Drag the lathe to a new position (move it)
  await page.mouse.move(lathePos.x, lathePos.y);
  await page.mouse.down();
  await page.mouse.move(lathePos.x + 120, lathePos.y + 80, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const posAfterDrag = await page.evaluate(() => fetch('/api/space/placements?room_id=1').then(r => r.json()).then(rows => { const p = rows.find(p => p.item_name === 'Lathe Machine'); return p ? { x: p.x_ft, y: p.y_ft } : null }));
  console.log('Position after drag:', JSON.stringify(posAfterDrag), '(was x4,y4)');
  const selChip = await page.evaluate(() => { const c = document.getElementById('space-sel-chip'); return c && !c.classList.contains('hidden') ? c.textContent.replace(/\s+/g, ' ').slice(0, 80) : 'HIDDEN' });
  console.log('Selection HUD chip:', JSON.stringify(selChip));

  // 2) THE BUG SCENARIO: wheel scroll AWAY from the item (user trying to zoom)
  //    with the item still selected — must zoom, NOT resize
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.2); // far corner, away from item
  await page.mouse.wheel(0, -400); // scroll up (would shrink under old code)
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(900);
  const fpAfterZoom = await page.evaluate(() => fetch('/api/space/placements?room_id=1').then(r => r.json()).then(rows => rows.find(p => p.item_name === 'Lathe Machine')?.footprint_ft));
  console.log('Footprint after zoom-away (must equal', fpBefore + '):', fpAfterZoom, fpAfterZoom === fpBefore ? 'PASS' : 'FAIL — BUG PERSISTS');

  // 3) Wheel directly OVER the selected item — should resize
  await page.mouse.move(lathePos.x + 120, lathePos.y + 80); // where we dragged it
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, -240); // shrink by 0.5 x2 = 1 ft (if cursor over item)
  await page.waitForTimeout(900);
  const fpAfterResize = await page.evaluate(() => fetch('/api/space/placements?room_id=1').then(r => r.json()).then(rows => rows.find(p => p.item_name === 'Lathe Machine')?.footprint_ft));
  console.log('Footprint after wheel-over-item (resize expected):', fpAfterResize);

  // 4) Count rendered meshes vs DB rows (all 9 room-1 items must exist)
  const meshCount = await page.evaluate(() => document.querySelectorAll('#space-3d canvas').length);
  const dbCount = await page.evaluate(() => fetch('/api/space/placements?room_id=1').then(r => r.json()).then(r => r.length));
  console.log('Canvas present:', meshCount === 1, '| DB items in room 1:', dbCount);

  // restore lathe to original for cleanliness
  await page.evaluate(() => fetch('/api/space/placements/1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x_ft: 4, y_ft: 4, footprint_ft: 6 }) }));

  console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
