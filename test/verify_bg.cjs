const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  const passInput = await page.$('input[type="password"], input[name="passcode"]');
  if (passInput) { await passInput.fill('dROIds2026!'); await page.click('button[type="submit"]'); await page.waitForTimeout(2500); }

  const bgNight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor + ' | imgs:' + getComputedStyle(document.body).backgroundImage.split('),').length);
  console.log('NIGHT body bg:', bgNight);
  await page.screenshot({ path: 'test/v4b_dashboard_night.png' });

  await page.click('#theme-toggle'); await page.waitForTimeout(800);
  const bgDay = await page.evaluate(() => getComputedStyle(document.body).backgroundColor + ' | imgs:' + getComputedStyle(document.body).backgroundImage.split('),').length);
  console.log('DAY body bg:', bgDay);
  await page.screenshot({ path: 'test/v4b_dashboard_day.png' });

  // Space planner in day mode
  await page.evaluate(() => document.querySelector('[data-view="facility"]')?.click());
  await page.waitForTimeout(2000);
  await page.click('#fac-mode-planner'); await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test/v4b_planner_day.png' });
  // back to night, planner again
  await page.click('#theme-toggle'); await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test/v4b_planner_night.png' });

  // Email modal in night mode
  await page.evaluate(() => document.querySelector('[data-view="reports"]')?.click());
  await page.waitForTimeout(2000);
  await page.click('#report-email-btn'); await page.waitForTimeout(700);
  await page.screenshot({ path: 'test/v4b_email_modal.png' });
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
