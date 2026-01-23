const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    console.log('Navigating to Dashboard...');
    try {
        await page.goto('http://localhost:4242');
    } catch (e) {
        console.error('Failed to load page:', e);
        process.exit(1);
    }

    // Login if needed (Guest Login)
    try {
        const guestLoginBtn = page.getByRole('button', { name: /Guest Login/i });
        if (await guestLoginBtn.isVisible({ timeout: 5000 })) {
            await guestLoginBtn.click();
        }
    } catch (e) {
        // Already logged in or not visible
    }

    // Wait for Dashboard
    await page.getByText('Agent Workspace').waitFor({ timeout: 30000 });

    // Wait for CommandBar
    const commandBarInput = page.getByTestId('prompt-input').locator('textarea');
    await commandBarInput.waitFor();

    // Type text
    const testMessage = 'Persisted Text Verification';
    await commandBarInput.fill(testMessage);
    console.log('Typed text:', testMessage);

    console.log('Navigating to Onboarding (SPA)...');
    await page.evaluate(() => {
        if (window.useStore) {
            window.useStore.setState({ currentModule: 'onboarding' });
        } else {
            throw new Error('useStore not found');
        }
    });

    await page.getByText('Setup Your Profile').waitFor();
    console.log('Onboarding loaded.');

    console.log('Navigating back to Dashboard (SPA)...');
    await page.evaluate(() => {
        if (window.useStore) {
            window.useStore.setState({ currentModule: 'dashboard' });
        }
    });

    await commandBarInput.waitFor();
    const value = await commandBarInput.inputValue();
    console.log('Restored Value:', value);

    if (value !== testMessage) {
        console.error('Persistence failed! Got:', value);
    } else {
        console.log('Persistence verified!');
    }

    // Take screenshot
    await page.screenshot({ path: 'verification/persistence.png' });
    console.log('Screenshot saved to verification/persistence.png');

    await browser.close();
})();
