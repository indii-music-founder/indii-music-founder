import { chromium } from 'playwright';
import fs from 'fs';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages().find(p => p.url().includes('4242'));
  if (!page) { console.log("Page not found"); process.exit(1); }
  
  // Dump the current active element, just in case
  const activeEl = await page.evaluate(() => document.activeElement ? document.activeElement.tagName : null);
  console.log("Active element:", activeEl);

  // Check if there's any element intercepting clicks globally
  // by listening to window click and seeing who the target is
  await page.evaluate(() => {
    window.__lastClickTarget = null;
    document.addEventListener('click', e => {
      window.__lastClickTarget = { tagName: e.target.tagName, className: e.target.className };
    }, true);
  });
  
  await page.mouse.click(50, 400); // click sidebar
  const clickedTarget = await page.evaluate(() => window.__lastClickTarget);
  console.log("Mouse click target at (50, 400):", clickedTarget);
  
  process.exit(0);
})();
