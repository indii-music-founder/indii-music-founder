import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages().find(p => p.url().includes('4242'));
  if (!page) { console.log("Page not found"); process.exit(1); }
  
  // click the sidebar link for Dashboard or Brand Manager
  // First, log the current URL
  console.log("Current URL:", page.url());
  
  // evaluate and click on an element in the sidebar
  await page.evaluate(() => {
    // try to find the "Dashboard" or "Brand Manager" link
    const links = Array.from(document.querySelectorAll('a, button, div'));
    const brandManager = links.find(el => el.textContent === 'Brand Manager');
    if (brandManager) {
      console.log("Found Brand Manager, clicking...");
      brandManager.click();
    } else {
      console.log("Could not find Brand Manager");
    }
  });
  
  // wait a moment
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log("New URL:", page.url());

  process.exit(0);
})();
