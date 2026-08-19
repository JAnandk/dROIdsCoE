const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));

  // Login as CoE director
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const passInput = await page.$('input[type="password"], input[name="passcode"]');
  if (passInput) {
    await passInput.fill('dROIds2026!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: 'test/v4_dashboard.png', fullPage: false });

  // Check tile visibility: computed opacity of kra-grid children
  const tileCheck = await page.evaluate(() => {
    const tiles = document.querySelectorAll('#kra-grid > div');
    return { count: tiles.length, opacities: Array.from(tiles).map(t => getComputedStyle(t).opacity) };
  });
  console.log('KRA tiles:', JSON.stringify(tileCheck));

  // Test day mode toggle
  const themeBtn = await page.$('#theme-toggle');
  console.log('Theme toggle present:', !!themeBtn);
  if (themeBtn) {
    await themeBtn.click();
    await page.waitForTimeout(800);
    const isDay = await page.evaluate(() => document.body.classList.contains('day-mode'));
    console.log('Day mode active after toggle:', isDay);
    await page.screenshot({ path: 'test/v4_dashboard_day.png', fullPage: false });
    await themeBtn.click(); // back to night
    await page.waitForTimeout(500);
  }

  // Navigate to Facility view -> Space Planner
  await page.evaluate(() => { document.querySelector('[data-view="facility"]')?.click() });
  await page.waitForTimeout(2500);
  const plannerBtn = await page.$('#fac-mode-planner');
  console.log('Planner mode button present:', !!plannerBtn);
  if (plannerBtn) {
    await plannerBtn.click();
    await page.waitForTimeout(3000);
    const spaceCanvas = await page.$('#space-3d canvas');
    console.log('Space planner 3D canvas present:', !!spaceCanvas);
    const stats = await page.evaluate(() => {
      const cards = document.querySelectorAll('#facility-body .glass-card');
      return Array.from(cards).slice(0, 4).map(c => c.textContent.trim().slice(0, 60));
    });
    console.log('Planner stat cards:', JSON.stringify(stats));
    await page.screenshot({ path: 'test/v4_space_planner.png', fullPage: false });
  }

  // Navigate to Reports -> email modal
  await page.evaluate(() => { document.querySelector('[data-view="reports"]')?.click() });
  await page.waitForTimeout(2000);
  const emailBtn = await page.$('#report-email-btn');
  console.log('Email button present in Reports:', !!emailBtn);
  if (emailBtn) {
    await emailBtn.click();
    await page.waitForTimeout(800);
    const modal = await page.$('#email-share-form');
    console.log('Email modal opened:', !!modal);
    await page.screenshot({ path: 'test/v4_email_modal.png', fullPage: false });
    await page.keyboard.press('Escape');
    await page.evaluate(() => { document.querySelector('#modal-backdrop')?.click() });
    await page.waitForTimeout(400);
  }

  // Setup tracker email button
  await page.evaluate(() => { document.querySelector('[data-view="setup"]')?.click() });
  await page.waitForTimeout(2500);
  const setupEmailBtn = await page.$('#setup-email-btn');
  console.log('Email button present in Setup Tracker:', !!setupEmailBtn);

  console.log('CONSOLE ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 8)) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
