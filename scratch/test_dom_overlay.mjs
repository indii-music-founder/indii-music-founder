import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages().find(p => p.url().includes('4242'));
  if (!page) { console.log("Page not found"); process.exit(1); }
  
  const hasOverlay = await page.evaluate(() => {
    return !!document.evaluate("//h2[text()='Drop files here']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  });
  console.log("Has drag overlay?", hasOverlay);
  process.exit(0);
})();
