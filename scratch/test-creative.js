const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('pageerror', error => {
    console.error('PAGE ERROR:', error.message);
    console.error(error.stack);
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('CONSOLE ERROR:', msg.text());
    }
  });

  await page.goto('http://127.0.0.1:4242/creative', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await browser.close();
})();
