const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:4242/');
  console.log(await page.title());
  // Wait for React to render
  await page.waitForTimeout(2000);
  const content = await page.content();
  console.log("Found memory text?", content.toLowerCase().includes("memory"));
  await browser.close();
})();
