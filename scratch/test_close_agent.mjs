import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages().find(p => p.url().includes('4242'));
  if (!page) { console.log("Page not found"); process.exit(1); }
  
  try {
    console.log("Looking for Close Chat Window button...");
    const closeBtn = await page.locator('button[aria-label="Close Chat Window"]');
    if (await closeBtn.count() > 0) {
      await closeBtn.click({ timeout: 2000 });
      console.log("Successfully clicked close button");
    } else {
      console.log("Close button not found");
    }
  } catch (err) {
    console.log("Click failed:", err.message);
  }
  process.exit(0);
})();
