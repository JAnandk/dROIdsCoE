const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.fill('#passcode-input', 'VentureSRM!26'); // 11 tabs — worst case
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // 1) Header: no element may extend past the nav-scroll container's visible box
  const header = await page.evaluate(() => {
    const wrap = document.querySelector('.nav-scroll').getBoundingClientRect();
    return Array.from(document.querySelectorAll('.nav-tab')).map(t => {
      const r = t.getBoundingClientRect();
      return { label: t.title, fullyVisible: r.left >= wrap.left - 1 && r.right <= wrap.right + 1, hasText: !!t.querySelector('span') };
    });
  });
  const clipped = header.filter(t => !t.fullyVisible);
  console.log('Tabs:', header.length, '| clipped:', clipped.length, '| text labels shown:', header.filter(t => t.hasText).length);
  console.log(clipped.length ? 'CLIPPED: ' + JSON.stringify(clipped.map(c => c.label)) : 'No clipping — all tabs fully within container');
  await page.screenshot({ path: 'test/v7b_header.png', clip: { x: 0, y: 0, width: 1280, height: 120 } });

  // 2) Stage cards: wait for render, then check computed opacity of each card
  await page.evaluate(() => document.querySelector('[data-view="setup"]')?.click());
  await page.waitForFunction(() => document.querySelectorAll('#stage-columns > div').length >= 5, null, { timeout: 15000 });
  await page.waitForTimeout(3000); // let stagger + fallback timers elapse
  const stages = await page.evaluate(() => Array.from(document.querySelectorAll('#stage-columns > div')).map(c => ({
    stage: c.textContent.match(/STAGE \d/)?.[0], opacity: getComputedStyle(c).opacity
  })));
  console.log('Stage cards:', JSON.stringify(stages));
  console.log('ALL VISIBLE:', stages.every(s => parseFloat(s.opacity) >= 0.95));
  await page.screenshot({ path: 'test/v7b_setup.png' });

  console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
