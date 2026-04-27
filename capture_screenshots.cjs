const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log('Navigating to localhost:4242...');
  await page.goto('http://localhost:4242/');
  
  await page.waitForTimeout(3000);
  
  console.log('Looking for Guest login...');
  try {
    const guestBtn = await page.getByText('Explore as Guest', { exact: false });
    if (await guestBtn.count() > 0) {
      await guestBtn.first().click({ timeout: 5000 });
      console.log('Clicked Guest login');
      await page.waitForTimeout(3000);
    }
  } catch (e) {
    console.log('No guest login button found or needed.', e.message);
  }

  const routes = [
    { route: '', filename: 'dashboard-real.png' },
    { route: 'creative', filename: 'creative-real.png' },
    { route: 'distribution', filename: 'distro-real.png' },
    { route: 'audio-analyzer', filename: 'audio-real.png' },
    { route: 'agent', filename: 'conductor-real.png' }
  ];

  for (const { route, filename } of routes) {
    const url = `http://localhost:4242/${route}`;
    console.log(`Navigating to ${url}...`);
    await page.goto(url);
    await page.waitForTimeout(5000); // Wait for animations/loading

    const outPath = path.join(__dirname, 'packages/landing/public', filename);
    await page.screenshot({ path: outPath });
    console.log(`Saved ${outPath}`);
  }

  await browser.close();
})();
