import { test, expect } from './fixtures/auth';
import * as path from 'path';

test.describe('Visual QA - Agent Alignment Transitions', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('capture screenshots of modules', async ({ authedPage: page }) => {
        // Playwright-managed per-test output dir (uploaded with the report); never a machine-local path.
        const artifactDir = test.info().outputPath('visual-qa');

        // Nav to Dashboard
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(artifactDir, 'dashboard_module.png'), fullPage: true });

        // Nav to Creative
        const creativeBtn = page.locator('[data-testid="nav-item-creative"]');
        await expect(creativeBtn).toBeVisible();
        await creativeBtn.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(artifactDir, 'creative_module.png'), fullPage: true });

        // Nav to Distribution
        const distBtn = page.locator('[data-testid="nav-item-distribution"]');
        await expect(distBtn).toBeVisible();
        await distBtn.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(artifactDir, 'distribution_module.png'), fullPage: true });
    });
});
