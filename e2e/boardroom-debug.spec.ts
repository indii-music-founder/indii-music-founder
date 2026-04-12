import { test, expect } from './fixtures/auth';

test('capture boardroom logs', async ({ authedPage: page }) => {
    const logs: string[] = [];

    page.on('console', msg => {
        const text = `[CONSOLE ${msg.type()}] ${msg.text()}`;
        logs.push(text);
        console.log(text);
    });

    page.on('pageerror', error => {
        const text = `[PAGE ERROR] ${error.message}`;
        logs.push(text);
        console.error(text);
    });

    console.log('Navigating to app...');
    await page.goto('http://localhost:4242');

    console.log('Waiting for load...');
    await page.waitForTimeout(3000);

    console.log('Activating Boardroom mode...');
    await page.locator('[aria-label="Enter Boardroom"]').click().catch(() => console.log('Toggle failed'));
    await page.waitForTimeout(1000);

    console.log('Locating Boardroom input...');
    const input = page.locator('[data-testid="main-prompt-input"]:visible').first();
    await input.waitFor({ state: 'visible', timeout: 15000 }).catch(() => console.log('Timeout waiting for textarea'));

    if (await input.isVisible()) {
        console.log('Typing prompt...');
        await input.fill('Hello this is a test prompt designed to test the Boardroom hang.');
        await input.press('Enter');
        console.log('Prompt submitted, waiting 8 seconds for agent to process...');
        await page.waitForTimeout(8000);
    } else {
        console.log('Could not find Boardroom input.');
    }

    console.log('Capturing final status...');
    const uiContent = await page.evaluate(() => {
        const panels = document.querySelectorAll('.prose');
        return Array.from(panels).map(p => p.textContent);
    });
    console.log('UI Panels:', uiContent);
    console.log('Test complete.');

    console.log('--- ALL CAPTURED LOGS ---');
    console.log(logs.join('\n'));
});
