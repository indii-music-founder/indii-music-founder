
import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 375, height: 667 }, // iPhone SE
        isMobile: true,
        hasTouch: true
    });
    const page = await context.newPage();

    // Init script for test mode
    await context.addInitScript(() => {
        localStorage.setItem('TEST_MODE', 'true');
        window.__TEST_MODE__ = true;
    });

    console.log('Navigating to http://localhost:4242...');
    await page.goto('http://localhost:4242');

    console.log('Waiting for app...');
    try {
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
    } catch (e) {
        console.log('App container not found, trying guest login...');
        const guestLoginBtn = page.getByText('Guest Login (Dev)');
        if (await guestLoginBtn.isVisible()) {
            await guestLoginBtn.click();
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 15000 });
        }
    }

    console.log('Opening Agent...');
    await page.evaluate(() => {
        if (window.useStore) {
            const state = window.useStore.getState();
            if (!state.isAgentOpen) {
                state.toggleAgentWindow();
            }
        }
    });

    // Wait for animation
    await page.waitForTimeout(2000);

    console.log('Taking screenshot...');
    await page.screenshot({ path: 'verification/mobile_overlay.png' });

    await browser.close();
    console.log('Done.');
}

run().catch(console.error);
