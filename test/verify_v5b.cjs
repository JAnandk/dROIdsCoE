const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('#passcode-input', 'VentureSRM!26');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2200);

  // Planner hover sweep for quick-tip
  await page.evaluate(() => document.querySelector('[data-view="facility"]')?.click());
  await page.waitForTimeout(1800);
  await page.click('#fac-mode-planner');
  await page.waitForTimeout(3000);
  const box = await (await page.$('#space-3d')).boundingBox();
  let tip = 'hidden';
  for (let fx = 0.3; fx <= 0.7 && tip === 'hidden'; fx += 0.1) {
    for (let fy = 0.3; fy <= 0.7 && tip === 'hidden'; fy += 0.1) {
      await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy, { steps: 3 });
      await page.waitForTimeout(120);
      tip = await page.evaluate(() => { const t = document.getElementById('space-tip'); return t && !t.classList.contains('hidden') ? t.textContent.replace(/\s+/g, ' ').slice(0, 90) : 'hidden' });
    }
  }
  console.log('Quick-tip after sweep:', JSON.stringify(tip));
  await page.screenshot({ path: 'test/v5b_planner_tip.png' });

  // Report Creator: source checkbox read + generate error path (no key for venture role yet)
  await page.evaluate(() => document.querySelector('[data-view="creator"]')?.click());
  await page.waitForTimeout(1800);
  const selected = await page.evaluate(() => Array.from(document.querySelectorAll('.rc-source:checked')).map(c => c.value));
  console.log('RC selected sources:', JSON.stringify(selected));
  await page.click('#rc-generate');
  await page.waitForTimeout(4000);
  const rcText = await page.evaluate(() => document.getElementById('rc-output')?.textContent.replace(/\s+/g, ' ').slice(0, 120));
  console.log('RC generate (expect needs_key msg):', JSON.stringify(rcText));
  await page.screenshot({ path: 'test/v5b_report_creator.png' });

  console.log('PAGE ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 6)) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
