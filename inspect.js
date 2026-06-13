const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  try {
    await page.goto('http://localhost:4242/', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('Page loaded successfully.');
    console.log('HTML:', await page.content());
  } catch (e) {
    console.log('Navigation failed:', e);
  }
  await browser.close();
})();
