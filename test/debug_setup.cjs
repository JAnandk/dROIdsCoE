const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE: ' + String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)) });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.fill('#passcode-input', 'VentureSRM!26');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  // check setup tab exists and click it
  const hasSetup = await page.evaluate(() => !!document.querySelector('[data-view="setup"]'));
  console.log('setup tab exists:', hasSetup);
  await page.evaluate(() => document.querySelector('[data-view="setup"]')?.click());
  await page.waitForTimeout(5000);
  const dom = await page.evaluate(() => {
    const mc = document.getElementById('main-content');
    return {
      activeView: document.querySelector('.nav-tab.bg-indigo-600\\/20')?.dataset.view,
      stageColumns: !!document.getElementById('stage-columns'),
      stageColsChildren: document.querySelectorAll('#stage-columns > div').length,
      stageStepper: !!document.getElementById('stage-stepper'),
      contentSnippet: (mc?.textContent || '').replace(/\s+/g, ' ').slice(0, 200)
    };
  });
  console.log('DOM:', JSON.stringify(dom, null, 1));
  console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 6)) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
