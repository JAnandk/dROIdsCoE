const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE: ' + String(e).slice(0, 160)));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.fill('#passcode-input', 'VentureSRM!26');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // 1) Header: icon-only tabs, none clipped
  const header = await page.evaluate(() => {
    const wrap = document.querySelector('.nav-scroll').getBoundingClientRect();
    const tabs = Array.from(document.querySelectorAll('.nav-tab'));
    return {
      count: tabs.length,
      iconOnly: tabs.every(t => !t.querySelector('span')),
      clipped: tabs.filter(t => { const r = t.getBoundingClientRect(); return r.right > wrap.right + 1 || r.left < wrap.left - 1 }).length
    };
  });
  console.log('1. Header:', JSON.stringify(header));
  await page.screenshot({ path: 'test/v7c_header.png', clip: { x: 0, y: 0, width: 1280, height: 115 } });

  // 2) Setup tracker: stepper buttons + section cards all opaque
  await page.evaluate(() => document.querySelector('[data-view="setup"]')?.click());
  await page.waitForFunction(() => document.querySelectorAll('#stage-stepper > button').length >= 5, null, { timeout: 15000 });
  await page.waitForTimeout(3200);
  const setup = await page.evaluate(() => ({
    stepperBtns: Array.from(document.querySelectorAll('#stage-stepper > button')).map(b => getComputedStyle(b).opacity),
    sectionCards: Array.from(document.querySelectorAll('#sections-area > div')).map(c => getComputedStyle(c).opacity)
  }));
  console.log('2. Setup stepper opacities:', JSON.stringify(setup.stepperBtns));
  console.log('   Section cards opacities:', JSON.stringify(setup.sectionCards.slice(0, 6)), '... total', setup.sectionCards.length);
  console.log('   ALL VISIBLE:', [...setup.stepperBtns, ...setup.sectionCards].every(o => parseFloat(o) >= 0.95));

  // 3) Cohorts: stage columns (the #stage-columns path)
  await page.click('#logout-btn'); await page.waitForTimeout(1500);
  await page.fill('#passcode-input', 'dROIds2026!');
  await page.click('button[type="submit"]'); await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('[data-view="cohorts"]')?.click());
  await page.waitForFunction(() => document.querySelectorAll('#stage-columns > div').length >= 1, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3200);
  const cohortStages = await page.evaluate(() => Array.from(document.querySelectorAll('#stage-columns > div')).map(c => getComputedStyle(c).opacity));
  console.log('3. Cohort stage-columns opacities:', JSON.stringify(cohortStages));
  console.log('   ALL VISIBLE:', cohortStages.length > 0 && cohortStages.every(o => parseFloat(o) >= 0.95));

  console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
