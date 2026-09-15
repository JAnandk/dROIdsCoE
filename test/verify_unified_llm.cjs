const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 180)));

  // Venture owner (has both creator + GenAI tabs)
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape'); // close auto-opened login console
  await page.click('#login-launcher'); await page.waitForTimeout(500);
  await page.fill('#passcode-input', 'VentureSRM!26');
  await page.click('#login-form button[type="submit"]');
  await page.waitForTimeout(2500);

  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('.nav-tab')).map(b => b.dataset.view));
  console.log('Venture tabs:', JSON.stringify(tabs));
  console.log('Reports tab removed:', !tabs.includes('reports'), '| creator:', tabs.includes('creator'), '| llm:', tabs.includes('llm'));

  // Report Creator — should show the active key chip
  await page.evaluate(() => document.querySelector('[data-view="creator"]')?.click());
  await page.waitForTimeout(2000);
  const rcChip = await page.evaluate(() => document.querySelector('#main-content')?.textContent.match(/Vault key active|No API key in vault/)?.[0]);
  console.log('Report Creator key status:', JSON.stringify(rcChip));
  await page.screenshot({ path: 'test/v10_report_creator.png' });

  // GenAI view — no key input, vault chip instead
  await page.evaluate(() => document.querySelector('[data-view="llm"]')?.click());
  await page.waitForTimeout(1800);
  const genai = await page.evaluate(() => ({
    keyInputPresent: !!document.getElementById('llm-api-key'),
    vaultBtn: !!document.getElementById('llm-vault-btn'),
    chipText: document.querySelector('#main-content')?.textContent.match(/Vault key active[^·]*/)?.[0]?.slice(0, 40)
  }));
  console.log('GenAI view:', JSON.stringify(genai));
  await page.screenshot({ path: 'test/v10_genai.png' });

  // Director — reports tab gone, collab present (console is collapsed after logout → open launcher first)
  await page.click('#logout-btn'); await page.waitForTimeout(1500);
  await page.click('#login-launcher'); await page.waitForTimeout(600);
  await page.fill('#passcode-input', 'dROIds2026!');
  await page.click('#login-form button[type="submit"]'); await page.waitForTimeout(2500);
  const dirTabs = await page.evaluate(() => Array.from(document.querySelectorAll('.nav-tab')).map(b => b.dataset.view));
  console.log('Director tabs:', JSON.stringify(dirTabs), '| reports removed:', !dirTabs.includes('reports'));

  // Supervisor — reports tab gone, unified vault panel in AI advisory
  await page.click('#logout-btn'); await page.waitForTimeout(1500);
  await page.click('#login-launcher'); await page.waitForTimeout(600);
  await page.fill('#passcode-input', 'SupervisorSRM!26');
  await page.click('#login-form button[type="submit"]'); await page.waitForTimeout(2500);
  const supTabs = await page.evaluate(() => Array.from(document.querySelectorAll('.nav-tab')).map(b => b.dataset.view));
  console.log('Supervisor tabs:', JSON.stringify(supTabs), '| reports removed:', !supTabs.includes('reports'));
  await page.evaluate(() => document.querySelector('[data-view="supervisor-ai"]')?.click());
  await page.waitForTimeout(2000);
  const supPanel = await page.evaluate(() => ({
    vaultPanel: !!document.getElementById('sup-vault'),
    oldAdapterGone: !document.getElementById('sup-token'),
    statusText: document.querySelector('#main-content')?.textContent.match(/Vault key active|No key in vault/)?.[0]
  }));
  console.log('Supervisor AI view:', JSON.stringify(supPanel));
  await page.screenshot({ path: 'test/v10_supervisor_ai.png' });

  console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 6)) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
