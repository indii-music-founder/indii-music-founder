import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages().find(p => p.url().includes('4242'));
  if (!page) { console.log("Page not found"); process.exit(1); }
  
  // Get all console logs that are currently in the page (Playwright doesn't store past logs unless we attached before)
  // Wait, we can evaluate window.__TEST_LOGS or check if React has an error boundary mounted.
  const hasError = await page.evaluate(() => {
    return document.body.innerText.includes("Something went wrong") || !!document.querySelector('.error-boundary');
  });
  console.log("Has React error boundary:", hasError);

  // Let's check window errors
  const errs = await page.evaluate(() => {
    return window.__playwright_errors || [];
  });
  console.log("Errors:", errs);

  process.exit(0);
})();
