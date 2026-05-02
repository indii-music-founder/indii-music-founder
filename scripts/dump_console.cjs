const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`PAGE LOG [${msg.type()}]: ${msg.text()}`);
  });

  page.on('pageerror', error => {
    console.log(`PAGE ERROR: ${error.message}`);
    console.log(error.stack);
  });

  try {
    await page.goto('http://127.0.0.1:4242', { waitUntil: 'networkidle', timeout: 10000 });
    console.log("Loaded app. Clicking guest login...");
    await page.waitForSelector('[data-testid="guest-login-btn"]', { timeout: 5000 });
    await page.click('[data-testid="guest-login-btn"]');
    
    // Wait for the app to load dashboard or whatever
    await page.waitForTimeout(2000);
    
    console.log("Navigating to /creative...");
    await page.goto('http://127.0.0.1:4242/creative', { waitUntil: 'networkidle', timeout: 10000 });
  } catch (e) {
    console.log("Goto timeout or error", e);
  }
  
  // wait a bit for rendering errors
  await page.waitForTimeout(2000);
  
  await browser.close();
})();
