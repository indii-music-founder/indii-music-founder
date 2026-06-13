const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
  page.on('response', response => {
    if (!response.ok()) {
      console.log('RESPONSE ERROR:', response.url(), response.status());
    }
  });

  try {
    await page.addInitScript(() => {
    localStorage.setItem('FIREBASE_E2E_MOCK', '1');
  });

  console.log('Navigating to http://127.0.0.1:4242/');
    await page.goto('http://127.0.0.1:4242/', { waitUntil: 'networkidle', timeout: 15000 });
  } catch (err) {
    console.log('GOTO ERROR:', err.message);
  }

  console.log('Done.');
  await browser.close();
})();
