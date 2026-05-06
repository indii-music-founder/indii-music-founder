const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto('https://github.com/the-walking-agency-det/indiiOS-Clean/actions/runs/25407850736/job/74523940256', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(5000);
  const content = await page.evaluate(() => document.body.innerText);
  console.log(content.substring(0, 5000));
  await browser.close();
})();
