const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));

  // 1) Landing page — 3D canvas + phase chips
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);
  const heroCanvas = await page.$('#hero-canvas-wrap canvas');
  const phaseName = await page.evaluate(() => document.getElementById('landing-phase-name')?.textContent);
  console.log('Landing 3D canvas:', !!heroCanvas, '| phase:', phaseName);
  await page.screenshot({ path: 'test/v5_landing.png' });

  // 2) Login as supervisor (venture_owner) and check Facility tab
  await page.fill('#passcode-input', 'VentureSRM!26');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  const ventureTabs = await page.evaluate(() => Array.from(document.querySelectorAll('.nav-tab')).map(b => b.dataset.view));
  console.log('Supervisor tabs:', JSON.stringify(ventureTabs));
  console.log('Facility for supervisor:', ventureTabs.includes('facility'));

  // 3) Facility -> Space Planner as supervisor
  await page.evaluate(() => document.querySelector('[data-view="facility"]')?.click());
  await page.waitForTimeout(2000);
  await page.click('#fac-mode-planner');
  await page.waitForTimeout(3000);
  const plannerCanvas = await page.$('#space-3d canvas');
  console.log('Planner canvas (supervisor):', !!plannerCanvas);
  // hover quick-tip: move mouse over center of canvas
  const box = await (await page.$('#space-3d')).boundingBox();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.45, { steps: 5 });
  await page.waitForTimeout(600);
  const tipVisible = await page.evaluate(() => { const t = document.getElementById('space-tip'); return t && !t.classList.contains('hidden') ? t.textContent.slice(0, 60) : 'hidden' });
  console.log('Quick-tip on hover:', JSON.stringify(tipVisible));
  await page.screenshot({ path: 'test/v5_planner_supervisor.png' });

  // 4) Collab view
  await page.evaluate(() => document.querySelector('[data-view="collab"]')?.click());
  await page.waitForTimeout(2000);
  const wbBoard = await page.$('#wb-board');
  console.log('Whiteboard present:', !!wbBoard);
  // Add a note
  await page.click('#wb-add');
  await page.waitForTimeout(800);
  const noteCount = await page.evaluate(() => document.querySelectorAll('.wb-note').length);
  console.log('Whiteboard notes after add:', noteCount);
  await page.screenshot({ path: 'test/v5_whiteboard.png' });
  // Action items tab
  await page.click('[data-ct="actions"]');
  await page.waitForTimeout(1500);
  const kanbanCols = await page.evaluate(() => document.querySelectorAll('.ai-card, .glass-card').length);
  console.log('Action tracker rendered, cards/panels:', kanbanCols);

  // 5) Report Creator + vault modal
  await page.evaluate(() => document.querySelector('[data-view="creator"]')?.click());
  await page.waitForTimeout(2000);
  const rcOut = await page.$('#rc-output');
  console.log('Report Creator present:', !!rcOut);
  const cues = await page.evaluate(() => document.getElementById('rc-cues')?.textContent.slice(0, 80));
  console.log('Supervisory cues:', JSON.stringify(cues));
  await page.click('#rc-vault-btn');
  await page.waitForTimeout(600);
  const vaultModal = await page.$('#vault-form');
  console.log('Vault modal opens:', !!vaultModal);
  await page.screenshot({ path: 'test/v5_report_creator.png' });
  await page.evaluate(() => document.querySelector('#modal-backdrop')?.click());
  await page.waitForTimeout(400);

  // 6) Director login — collab tab present there too
  await page.click('#logout-btn');
  await page.waitForTimeout(1500);
  await page.fill('#passcode-input', 'dROIds2026!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  const dirTabs = await page.evaluate(() => Array.from(document.querySelectorAll('.nav-tab')).map(b => b.dataset.view));
  console.log('Director tabs:', JSON.stringify(dirTabs));
  console.log('Collab for director:', dirTabs.includes('collab'), '| Facility for director:', dirTabs.includes('facility'));

  console.log('CONSOLE ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 8)) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
