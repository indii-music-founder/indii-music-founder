
import { test, expect } from '@playwright/test';

test('inspect /select-org rendering', async ({ page }) => {
    await page.goto('/select-org');

    // Inject state to simulate authenticated user on Select Org module
    await page.waitForFunction(() => !!(window as any).useStore);
    await page.evaluate(() => {
        (window as any).__TEST_MODE__ = true;
        (window as any).useStore.setState({
            isAuthenticated: true,
            isAuthReady: true,
            user: { uid: 'test-user', email: 'test@example.com' },
            currentModule: 'select-org',
            // Simulate organizations being loaded but maybe empty or populated
            organizations: [{ id: 'org-1', name: 'Test Org', members: ['me'] }]
        });
    });

    // Wait a bit for React to react
    await page.waitForTimeout(2000);

    // Diagnostics

    // 1. Check if "Select Organization" text is visible (Header)
    const isVisible = await page.getByText('Select Organization').isVisible();
    console.log(`"Select Organization" visible: ${isVisible}`);

    // 2. Dump HTML if not visible
    if (!isVisible) {
        const content = await page.content();
        console.log('--- PAGE CONTENT DUMP ---');
        console.log(content);
        console.log('-------------------------');

        // Take screenshot
        await page.screenshot({ path: 'select-org-debug.png' });
    }

    // 3. Check for white background body/div issues
    // We expect bg-black.
    const bgColor = await page.evaluate(() => {
        const el = document.querySelector('.min-h-screen'); // The main wrapper in SelectOrg
        return el ? window.getComputedStyle(el).backgroundColor : 'element-not-found';
    });
    console.log(`Wrapper Background Color: ${bgColor}`);

    expect(isVisible).toBe(true);
});
