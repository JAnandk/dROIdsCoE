const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));

  // Landing animation — capture 3 loop phases
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  console.log('phase @2s:', await page.evaluate(() => document.getElementById('landing-phase-name')?.textContent));
  await page.screenshot({ path: 'test/v6_landing_p0.png' });
  await page.waitForTimeout(4500);
  console.log('phase @6.5s:', await page.evaluate(() => document.getElementById('landing-phase-name')?.textContent));
  await page.screenshot({ path: 'test/v6_landing_p1.png' });
  await page.waitForTimeout(8800);
  console.log('phase @15s:', await page.evaluate(() => document.getElementById('landing-phase-name')?.textContent));
  await page.screenshot({ path: 'test/v6_landing_p3.png' });
  await page.waitForTimeout(4600);
  console.log('phase @20s:', await page.evaluate(() => document.getElementById('landing-phase-name')?.textContent));
  await page.screenshot({ path: 'test/v6_landing_p4.png' });
  await page.waitForTimeout(4400);
  console.log('phase @24.5s:', await page.evaluate(() => document.getElementById('landing-phase-name')?.textContent));
  await page.screenshot({ path: 'test/v6_landing_p5.png' });

  // Login as director -> planner -> Analyze Layout modal
  await page.fill('#passcode-input', 'dROIds2026!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2200);
  await page.evaluate(() => document.querySelector('[data-view="facility"]')?.click());
  await page.waitForTimeout(1800);
  await page.click('#fac-mode-planner');
  await page.waitForTimeout(3000);
  const analyzeBtn = await page.$('#space-analyze');
  console.log('Analyze Layout button:', !!analyzeBtn);
  if (analyzeBtn) {
    await analyzeBtn.click();
    await page.waitForTimeout(5000); // LLM call may be slow/fail gracefully
    const body = await page.evaluate(() => document.getElementById('spatial-body')?.textContent.replace(/\s+/g, ' ').slice(0, 220));
    console.log('Spatial modal:', JSON.stringify(body));
    await page.screenshot({ path: 'test/v6_spatial_modal.png' });
  }
  console.log('PAGE ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 6)) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
