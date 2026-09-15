const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('#passcode-input', 'VentureSRM!26'); // venture owner = 11 tabs (worst case)
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // 1) Header: no clipped tabs — every nav-tab must be fully visible within the nav-scroll container
  const headerCheck = await page.evaluate(() => {
    const wrap = document.querySelector('.nav-scroll');
    const tabs = Array.from(document.querySelectorAll('.nav-tab'));
    const clipped = tabs.filter(t => {
      const r = t.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      return r.right > wr.right + 1 || r.left < wr.left - 1;
    }).map(t => t.title || t.textContent);
    return { tabCount: tabs.length, clippedTabs: clipped, labels: tabs.map(t => t.title) };
  });
  console.log('Header tabs:', headerCheck.tabCount, '| clipped:', JSON.stringify(headerCheck.clippedTabs));
  console.log('Tab labels:', JSON.stringify(headerCheck.labels));
  await page.screenshot({ path: 'test/v7_header.png', clip: { x: 0, y: 0, width: 1280, height: 130 } });

  // 2) Setup tracker — stage cards must ALL be fully opaque
  await page.evaluate(() => document.querySelector('[data-view="setup"]')?.click());
  await page.waitForTimeout(3500);
  const stageCheck = await page.evaluate(() => {
    const cards = document.querySelectorAll('#stage-columns > div');
    return Array.from(cards).map(c => ({
      opacity: getComputedStyle(c).opacity,
      transform: getComputedStyle(c).transform,
      title: c.textContent.match(/STAGE \d/)?.[0] || '?'
    }));
  });
  console.log('Stage cards:', JSON.stringify(stageCheck));
  const allVisible = stageCheck.every(c => parseFloat(c.opacity) >= 0.95);
  console.log('ALL STAGE CARDS VISIBLE:', allVisible);
  await page.screenshot({ path: 'test/v7_setup_tracker.png' });

  console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 6)) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
