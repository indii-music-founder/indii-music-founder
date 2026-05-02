import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages().find(p => p.url().includes('4242'));
  if (!page) { console.log("Page not found"); process.exit(1); }
  
  // Find the topmost element in the center of the screen
  const evalResult = await page.evaluate(() => {
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    if (!el) return null;
    return {
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      outerHTML: el.cloneNode(false).outerHTML
    };
  });
  console.log("Center point:", JSON.stringify(evalResult, null, 2));
  
  // Find the topmost element over the sidebar
  const evalResultSidebar = await page.evaluate(() => {
    const el = document.elementFromPoint(50, window.innerHeight / 2);
    if (!el) return null;
    return {
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      outerHTML: el.cloneNode(false).outerHTML
    };
  });
  console.log("Sidebar point:", JSON.stringify(evalResultSidebar, null, 2));

  process.exit(0);
})();
