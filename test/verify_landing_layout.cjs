const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 180)));
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);

  // Structural checks
  const layout = await page.evaluate(() => {
    const logo = document.querySelector('h1');
    const chip = document.getElementById('landing-phase-chip');
    const loops = Array.from(document.querySelectorAll('span')).some(s => s.textContent.includes('loops forever'));
    const impactCard = document.getElementById('impact-img');
    const lr = logo?.getBoundingClientRect(), cr = chip?.getBoundingClientRect();
    return {
      chipBelowLogo: cr && lr ? cr.top >= lr.bottom - 2 : null,
      chipInHeaderFlow: chip ? !chip.className.includes('absolute') : null,
      loopsForeverRemoved: !loops,
      impactCardPresent: !!impactCard,
      impactCardTopRight: impactCard ? impactCard.getBoundingClientRect().left > 1100 : null,
      impactLabel: document.getElementById('impact-ticker')?.textContent
    };
  });
  console.log('Layout checks:', JSON.stringify(layout, null, 1));
  await page.screenshot({ path: 'test/v9_landing_layout.png' });

  // Ticker cycles to a category with image (Mining) then one without (Geographical Mapping -> fallback)
  await page.waitForTimeout(5600);
  const tick2 = await page.evaluate(() => ({
    label: document.getElementById('impact-ticker')?.textContent,
    imgVisible: document.getElementById('impact-img')?.style.display !== 'none',
    fallbackShown: !document.getElementById('impact-fallback')?.classList.contains('hidden')
  }));
  console.log('Ticker state 2:', JSON.stringify(tick2));
  await page.screenshot({ path: 'test/v9_landing_impact2.png' });

  // Close the auto-opened console for a clean full-hero shot
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test/v9_landing_clean.png' });

  console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1) });
