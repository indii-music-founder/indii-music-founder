const { chromium } = require('playwright');

(async () => {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  try {
    console.log("Navigating to Namecheap login...");
    await page.goto('https://www.namecheap.com/myaccount/login/', { waitUntil: 'networkidle' });
    
    // Check for Cloudflare/Captcha
    const title = await page.title();
    console.log("Page title: ", title);
    
    // Try to find login fields
    console.log("Entering credentials...");
    await page.waitForSelector('input[id="nc_username"]', { timeout: 10000 });
    await page.fill('input[id="nc_username"]', 'williamthewalker');
    await page.fill('input[id="nc_password"]', 'a47./g97eXF..gt');
    
    console.log("Submitting login...");
    await page.click('button[type="submit"], input[type="submit"], button.nc_login_submit');
    
    // Wait for the result of the login attempt
    console.log("Waiting for navigation/challenge...");
    await page.waitForTimeout(6000);
    
    const screenshotPath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/scratch/nc_login_result.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to ${screenshotPath}`);
    
    const currentUrl = page.url();
    console.log("Current URL after login attempt: ", currentUrl);
    
    // Dump page text to see if we hit a captcha or 2FA
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log("Page Content Snippet:\n", pageText.substring(0, 500));
    
  } catch (err) {
    console.error("Error during automation:", err);
  } finally {
    await browser.close();
  }
})();
