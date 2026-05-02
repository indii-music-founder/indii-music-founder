import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages().find(p => p.url().includes('4242'));
  if (!page) { console.log("Page not found"); process.exit(1); }
  
  const fixedElements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.position === 'fixed' || style.position === 'absolute';
    }).map(el => ({
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      zIndex: window.getComputedStyle(el).zIndex,
      inset: window.getComputedStyle(el).inset
    }));
  });
  
  // Just filter ones that could cover the screen
  const covering = fixedElements.filter(el => el.inset === '0px' || (el.className && el.className.includes('inset-0')));
  console.log("Covering elements:", covering);
  process.exit(0);
})();
