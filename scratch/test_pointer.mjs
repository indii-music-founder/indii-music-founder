import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages().find(p => p.url().includes('4242'));
  if (!page) { console.log("Page not found"); process.exit(1); }
  
  const pointerEvents = await page.evaluate(() => {
    return {
      body: window.getComputedStyle(document.body).pointerEvents,
      root: window.getComputedStyle(document.getElementById('root')).pointerEvents,
      main: window.getComputedStyle(document.querySelector('main')).pointerEvents,
    };
  });
  console.log("Pointer Events:", pointerEvents);
  process.exit(0);
})();
