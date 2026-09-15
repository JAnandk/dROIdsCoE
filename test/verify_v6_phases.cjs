const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  async function waitPhase(name, timeoutMs = 60000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const cur = await page.evaluate(() => document.getElementById('landing-phase-name')?.textContent);
      if (cur === name) return true;
      await page.waitForTimeout(400);
    }
    return false;
  }
  for (const [name, file] of [['Exploded View', 'p1_exploded'], ['Swarm Ops', 'p4_swarm'], ['Command Center', 'p5_cmd']]) {
    const hit = await waitPhase(name);
    console.log('reached', name, ':', hit);
    if (hit) { await page.waitForTimeout(1800); await page.screenshot({ path: `test/v6_${file}.png` }); }
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
