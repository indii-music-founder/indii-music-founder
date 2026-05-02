import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages().find(p => p.url().includes('4242'));
  if (!page) { console.log("Page not found"); process.exit(1); }
  
  const dialogs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).filter(el => {
      const zIndex = window.getComputedStyle(el).zIndex;
      return zIndex !== 'auto' && parseInt(zIndex) > 100 && el.tagName !== 'svg' && el.tagName !== 'path';
    }).map(el => ({
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      zIndex: window.getComputedStyle(el).zIndex,
      rect: el.getBoundingClientRect()
    }));
  });
  console.log("High z-index elements:", dialogs);
  process.exit(0);
})();
