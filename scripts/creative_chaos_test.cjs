const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let errorCount = 0;
  let clickCount = 0;
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[PAGE ERROR LOG]: ${msg.text()}`);
      errorCount++;
    }
  });

  page.on('pageerror', error => {
    console.log(`[PAGE UNCAUGHT EXCEPTION]: ${error.message}`);
    errorCount++;
  });

  console.log("Navigating to http://127.0.0.1:4242...");
  await page.goto('http://127.0.0.1:4242', { waitUntil: 'networkidle', timeout: 15000 });
  
  try {
    console.log("Logging in as guest...");
    await page.waitForSelector('[data-testid="guest-login-btn"]', { timeout: 5000 });
    await page.click('[data-testid="guest-login-btn"]');
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log("No guest login needed or timeout.");
  }

  console.log("Navigating to /creative...");
  await page.goto('http://127.0.0.1:4242/creative', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);

  const testPrompts = [
    "A neon cyberpunk city in the rain",
    "A photorealistic portrait of an astronaut",
    "Abstract geometric shapes",
    "A cute cat wearing sunglasses",
    "A dark fantasy castle on a cliff"
  ];

  console.log("Starting 1000 clicks chaos loop...");
  
  // We'll perform up to 1000 actions
  for (let i = 0; i < 1000; i++) {
    if (i % 100 === 0) console.log(`Completed ${i} actions...`);
    
    // Choose a random action
    const actionType = Math.floor(Math.random() * 6);
    
    try {
      if (actionType === 0) {
        // Type a prompt
        const inputSelector = 'textarea[placeholder*="Describe"], input[placeholder*="prompt"]';
        const elements = await page.$$(inputSelector);
        if (elements.length > 0) {
          const el = elements[Math.floor(Math.random() * elements.length)];
          const text = testPrompts[Math.floor(Math.random() * testPrompts.length)];
          await el.fill(text);
          clickCount++;
        }
      } else if (actionType === 1) {
        // Click Generate
        const generateBtn = 'button:has-text("Generate"), [data-testid="generate-button"], button.generate-btn';
        const elements = await page.$$(generateBtn);
        if (elements.length > 0) {
          const el = elements[Math.floor(Math.random() * elements.length)];
          await el.click({ force: true });
          clickCount++;
        }
      } else if (actionType === 2) {
        // Toggle aspect ratios or models (look for buttons with 16:9, 1:1, etc)
        const selectors = ['button:has-text("16:9")', 'button:has-text("1:1")', 'button:has-text("9:16")', 'button:has-text("Image")', 'button:has-text("Video")'];
        for (const sel of selectors) {
          const elements = await page.$$(sel);
          if (elements.length > 0) {
            await elements[0].click({ force: true });
            clickCount++;
            break;
          }
        }
      } else if (actionType === 3) {
        // Click random buttons in the UI
        const buttons = await page.$$('button');
        if (buttons.length > 0) {
          const btn = buttons[Math.floor(Math.random() * buttons.length)];
          // Only click visible buttons
          const isVisible = await btn.isVisible();
          if (isVisible) {
            await btn.click({ force: true, timeout: 500 }).catch(() => {});
            clickCount++;
          }
        }
      } else if (actionType === 4) {
        // Click canvas area or drawing tools
        const canvas = await page.$('canvas');
        if (canvas) {
          const box = await canvas.boundingBox();
          if (box) {
            const x = box.x + Math.random() * box.width;
            const y = box.y + Math.random() * box.height;
            await page.mouse.click(x, y);
            clickCount++;
          }
        }
      } else {
        // Small wait
        await page.waitForTimeout(50);
      }
    } catch (e) {
      // Ignore click errors (e.g. element detached)
    }
    
    // Safety check - if too many errors, abort
    if (errorCount > 50) {
      console.log("Too many errors, aborting test.");
      break;
    }
  }

  console.log(`Test complete. Performed ${clickCount} valid actions. Encountered ${errorCount} errors.`);
  await browser.close();
})();
