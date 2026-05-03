import { test, expect } from './fixtures/auth';

test('Detroit Producer Deep Test (Phase 1)', async ({ authedPage: page }) => {
    console.log('Navigating to app on 4242...');
    await page.goto('http://localhost:4242');

    console.log('Waiting for load...');
    await page.waitForTimeout(3000);

    console.log('Activating Boardroom mode...');
    // We try multiple possible selectors for entering the boardroom
    await page.locator('text=Boardroom').first().click().catch(() => console.log('Text click failed'));
    await page.waitForTimeout(1000);

    const input = page.locator('textarea, input[type="text"]').last();
    
    if (await input.isVisible()) {
        console.log('Typing prompt...');
        await input.fill('I need help planning a release strategy for my new underground techno EP called Detroit Steel Machine. It drops in 6 weeks. What should I prioritize?');
        await input.press('Enter');
        console.log('Prompt submitted, waiting 15 seconds for agent to process...');
        await page.waitForTimeout(15000);
        await page.screenshot({ path: 'deep-test-boardroom-1.png' });
        console.log('Took screenshot: deep-test-boardroom-1.png');
    } else {
        console.log('Could not find Boardroom input.');
        await page.screenshot({ path: 'deep-test-boardroom-error.png' });
    }

    console.log('Navigating to Campaign Manager...');
    await page.goto('http://localhost:4242/marketing');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'deep-test-campaign-1.png' });
    
    console.log('Navigating to Booking Agent...');
    await page.goto('http://localhost:4242/road');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'deep-test-booking-1.png' });

    console.log('Navigating to Publicist...');
    await page.goto('http://localhost:4242/publicist');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'deep-test-publicist-1.png' });

    console.log('Test complete. Screenshots saved.');
});
