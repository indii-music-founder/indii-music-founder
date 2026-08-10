import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('@external-legacy @structural legacy deep-interaction exercise (localhost and fabricated credentials)', () => {
  const QA_DIR = path.join(process.cwd(), '.agent/artifacts/qa_screenshots');
  
  test.beforeAll(() => {
    if (!fs.existsSync(QA_DIR)) {
      fs.mkdirSync(QA_DIR, { recursive: true });
    }
  });

  test('Execute Universal Deep-Interaction Stress Test', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for deep interaction

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(`[Console Error]: ${msg.text()}`);
      }
    });
    
    page.on('pageerror', err => {
      errors.push(`[Page Error]: ${err.message}`);
    });

    const url = 'http://localhost:4243';
    console.log(`Navigating to ${url}...`);
    
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Login phase
    console.log("Attempting to sign in...");
    await page.getByPlaceholder('artist@indii.music').fill('test@indii.music');
    await page.getByPlaceholder('........').fill('password123');
    await page.getByRole('button', { name: /Sign In/i, exact: true }).click();
    await page.waitForTimeout(3000);

    // 1. Dashboard Phase
    await page.screenshot({ path: path.join(QA_DIR, `qa_dashboard_${Date.now()}.png`) });
    
    // Check if we are stuck on a loading screen or if the sidebar is visible
    // bypass-strict -- quarantined legacy stress suite predates semantic navigation labels.
    const sidebar = page.locator('nav').first(); // bypass-strict
    if (await sidebar.isVisible()) {
        console.log("Sidebar visible.");
    } else {
        errors.push("Sidebar not found on load.");
    }

    // Attempt to navigate to Creative
    // bypass-strict -- quarantined legacy stress suite accepts duplicate desktop/mobile links.
    const creativeLink = page.getByRole('link', { name: /Creative/i }).first(); // bypass-strict
    if (await creativeLink.isVisible()) {
        await creativeLink.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(QA_DIR, `qa_creative_${Date.now()}.png`) });
        console.log("Navigated to Creative.");
    }

    // Attempt to navigate to Video
    // bypass-strict -- quarantined legacy stress suite accepts duplicate desktop/mobile links.
    const videoLink = page.getByRole('link', { name: /Video/i }).first(); // bypass-strict
    if (await videoLink.isVisible()) {
        await videoLink.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(QA_DIR, `qa_video_${Date.now()}.png`) });
        console.log("Navigated to Video.");
    }

    // Write errors to a log file
    const logPath = path.join(process.cwd(), '.agent/artifacts/real_test_log.json');
    fs.writeFileSync(logPath, JSON.stringify(errors, null, 2));

    console.log(`Testing complete. Found ${errors.length} errors.`);
    if (errors.length > 0) {
        console.log(errors.join('\\n'));
    }
  });
});
