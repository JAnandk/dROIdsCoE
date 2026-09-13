const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 180)));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 140)) });

  // 1) Landing animation intact after merge
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  const hero = await page.$('#hero-canvas-wrap canvas');
  const phase = await page.evaluate(() => document.getElementById('landing-phase-name')?.textContent);
  console.log('1. Landing canvas:', !!hero, '| phase:', phase);

  // 2) Director login — core views
  await page.fill('#passcode-input', 'dROIds2026!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  const dirTabs = await page.evaluate(() => Array.from(document.querySelectorAll('.nav-tab')).map(b => b.dataset.view));
  console.log('2. Director tabs:', JSON.stringify(dirTabs));
  const tiles = await page.evaluate(() => document.querySelectorAll('#kra-grid > div').length);
  console.log('   Dashboard KRA tiles:', tiles);

  // 3) Planner analyze modal
  await page.evaluate(() => document.querySelector('[data-view="facility"]')?.click());
  await page.waitForTimeout(1800);
  await page.click('#fac-mode-planner');
  await page.waitForTimeout(2800);
  const analyzeOk = !!(await page.$('#space-analyze'));
  console.log('3. Planner + Analyze button:', analyzeOk);

  // 4) Collab view
  await page.evaluate(() => document.querySelector('[data-view="collab"]')?.click());
  await page.waitForTimeout(1800);
  console.log('4. Whiteboard board:', !!(await page.$('#wb-board')));

  // 5) Setup tracker (Codex campus controls should be present)
  await page.evaluate(() => document.querySelector('[data-view="setup"]')?.click());
  await page.waitForTimeout(2200);
  const setupText = await page.evaluate(() => document.getElementById('main-content')?.textContent.slice(0, 300));
  console.log('5. Setup tracker renders:', !!setupText && setupText.length > 50, '| has campus hints:', /campus/i.test(setupText || ''));

  // 6) Logout -> supervisor login (Codex-seeded passcode)
  await page.click('#logout-btn');
  await page.waitForTimeout(1800);
  await page.fill('#passcode-input', 'SupervisorSRM!26');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2800);
  const supTabs = await page.evaluate(() => Array.from(document.querySelectorAll('.nav-tab')).map(b => b.dataset.view));
  console.log('6. Supervisor tabs:', JSON.stringify(supTabs));
  const supBody = await page.evaluate(() => document.getElementById('main-content')?.textContent.slice(0, 150));
  console.log('   Supervisor first view:', JSON.stringify((supBody || '').slice(0, 100)));

  // 7) Supervisor AI Advisory view
  if (supTabs.includes('supervisor-ai')) {
    await page.evaluate(() => document.querySelector('[data-view="supervisor-ai"]')?.click());
    await page.waitForTimeout(2500);
    const aiBody = await page.evaluate(() => document.getElementById('main-content')?.textContent.replace(/\s+/g, ' ').slice(0, 140));
    console.log('7. Supervisor AI view:', JSON.stringify(aiBody));
  }

  // 8) Venture owner -> report creator
  await page.click('#logout-btn');
  await page.waitForTimeout(1800);
  await page.fill('#passcode-input', 'VentureSRM!26');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('[data-view="creator"]')?.click());
  await page.waitForTimeout(2000);
  const rcOk = !!(await page.$('#rc-output'));
  const cues = await page.evaluate(() => document.getElementById('rc-cues')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 90));
  console.log('8. Report Creator:', rcOk, '| cues:', JSON.stringify(cues));

  console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 10)) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
