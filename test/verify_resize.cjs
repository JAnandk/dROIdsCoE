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

  async function findItem(name) {
    const box = await (await page.$('#space-3d')).boundingBox();
    for (let fx = 0.2; fx <= 0.8; fx += 0.04) {
      for (let fy = 0.2; fy <= 0.8; fy += 0.04) {
        const px = box.x + box.width * fx, py = box.y + box.height * fy;
        await page.mouse.move(px, py);
        await page.waitForTimeout(50);
        const tip = await page.evaluate(() => { const t = document.getElementById('space-tip'); return t && !t.classList.contains('hidden') ? t.textContent : '' });
        if (tip.includes(name)) return { x: px, y: py };
      }
    }
    return null;
  }

  const pos = await findItem('Lathe');
  console.log('Lathe located:', JSON.stringify(pos));
  if (!pos) { console.log('FATAL: not found'); process.exit(1) }

  // Select it (mousedown on item without drag), then wheel directly over it
  await page.mouse.move(pos.x, pos.y);
  await page.mouse.down(); await page.mouse.up(); // click-select (no drag)
  await page.waitForTimeout(400);
  const chip = await page.evaluate(() => { const c = document.getElementById('space-sel-chip'); return c && !c.classList.contains('hidden') ? 'SHOWN' : 'HIDDEN' });
  console.log('Selection chip after click:', chip);

  await page.mouse.move(pos.x, pos.y);
  await page.mouse.wheel(0, 240); // scroll down = grow footprint by 1 ft (2 ticks of 0.5)
  await page.waitForTimeout(1000);
  const fpAfter = await page.evaluate(() => fetch('/api/space/placements?room_id=1').then(r => r.json()).then(rows => rows.find(p => p.item_name === 'Lathe Machine')?.footprint_ft));
  console.log('Footprint after wheel-over-item:', fpAfter, fpAfter === 7 ? 'PASS (6->7)' : fpAfter === 6 ? 'UNCHANGED (still 6)' : 'OTHER: ' + fpAfter);

  // restore
  await page.evaluate(() => fetch('/api/space/placements/1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ footprint_ft: 6, x_ft: 4, y_ft: 4 }) }));
  console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
