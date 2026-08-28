import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  try {
    await page.goto('http://localhost:4242/publicist', { waitUntil: 'networkidle', timeout: 10000 });
    console.log("Navigated");
  } catch(e) {
    console.log("Nav failed", e);
  }
  const text = await page.evaluate(() => document.body.innerText);
  console.log("PAGE TEXT:", text);
  await browser.close();
})();
