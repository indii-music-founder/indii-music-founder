import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages().find(p => p.url().includes('4242'));
  if (!page) { console.log("Page not found"); process.exit(1); }
  
  try {
    console.log("Attempting to click Brand Manager...");
    // find element by text
    await page.click('text="Brand Manager"', { timeout: 2000 });
    console.log("Click successful.");
  } catch (err) {
    console.log("Click failed:", err.message);
  }
  process.exit(0);
})();
