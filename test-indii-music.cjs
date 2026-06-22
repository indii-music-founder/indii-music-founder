const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to https://indii.music ...');
  await page.goto('https://indii.music');

  console.log('Waiting for the page to load...');
  await page.waitForLoadState('networkidle');

  console.log('Please observe the browser to verify if the AI service connects without the App Check error.');
  
  // Wait indefinitely so the user can see it and interact
  await page.waitForTimeout(60000); // 60 seconds
  
  await browser.close();
})();
