const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 180)));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);

  // 1) Before auto-open: launcher visible, console hidden off-canvas
  const initial = await page.evaluate(() => ({
    launcher: !!document.getElementById('login-launcher'),
    consoleClosed: document.getElementById('login-console')?.classList.contains('translate-x-full')
  }));
  console.log('1. Initial:', JSON.stringify(initial));
  await page.screenshot({ path: 'test/v8_console_collapsed.png' });

  // 2) Auto-open fires at 1.4s
  await page.waitForTimeout(1200);
  const opened = await page.evaluate(() => !document.getElementById('login-console')?.classList.contains('translate-x-full'));
  console.log('2. Auto-opened:', opened);
  await page.screenshot({ path: 'test/v8_console_open.png' });

  // 3) Close via Esc, reopen via launcher click
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const closedAgain = await page.evaluate(() => document.getElementById('login-console')?.classList.contains('translate-x-full'));
  console.log('3. Esc closes:', closedAgain);
  await page.click('#login-launcher');
  await page.waitForTimeout(600);
  const reopened = await page.evaluate(() => !document.getElementById('login-console')?.classList.contains('translate-x-full'));
  console.log('   Launcher reopens:', reopened);

  // 4) Login flow still works through the console
  await page.fill('#passcode-input', 'dROIds2026!');
  await page.click('#login-form button[type="submit"]');
  await page.waitForTimeout(2500);
  const loggedIn = await page.evaluate(() => !!document.getElementById('nav-tabs'));
  console.log('4. Login works:', loggedIn);

  console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
