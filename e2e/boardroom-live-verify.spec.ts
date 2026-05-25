import { test, expect } from '@playwright/test';

test('Boardroom Live Visual Verification', async ({ page }) => {
    // Navigate to live production site
    console.log('[E2E:Live] Navigating to live production site: https://indii-music-studio.web.app');
    await page.goto('https://indii-music-studio.web.app', { waitUntil: 'networkidle', timeout: 30000 });

    // Capture Home Page initial state
    await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/media__1779690015541.png' });
    console.log('[E2E:Live] Saved initial home page screenshot.');

    // Bypass onboarding modal
    try {
        console.log('[E2E:Live] Handling onboarding modal...');
        const exploreGuest = page.getByRole('button', { name: /Explore as Guest/i });
        await exploreGuest.waitFor({ state: 'visible', timeout: 5000 });
        await exploreGuest.click();
        console.log('[E2E:Live] Clicked "Explore as Guest" successfully.');
        
        const declineCookies = page.getByRole('button', { name: /Decline/i });
        await declineCookies.waitFor({ state: 'visible', timeout: 3000 });
        await declineCookies.click();
        console.log('[E2E:Live] Declined cookies.');
    } catch (e) {
        console.log('[E2E:Live] Onboarding dialog not found, proceeding.');
    }

    // Inject Boardroom mode state directly
    console.log('[E2E:Live] Injecting Boardroom overlay state...');
    await page.evaluate(() => {
        if ((window as any).useStore) {
            (window as any).useStore.getState().setConversationMode('boardroom');
        } else {
            console.error('Zustand store is not available in window context.');
        }
    });
    await page.waitForTimeout(3000);

    // Capture initial Boardroom state
    await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/media__1779690176238.png' });
    console.log('[E2E:Live] Saved initial empty Boardroom state screenshot.');

    // Send chat message to bring in the financial department
    console.log('[E2E:Live] Submitting message to Conductor to summon Finance...');
    const chatInput = page.getByPlaceholder(/message|launch/i).first();
    if (await chatInput.isVisible()) {
        await chatInput.fill('Can we bring in the financial department');
        await chatInput.press('Enter');
    } else {
        const textbox = page.getByRole('textbox').first();
        await textbox.fill('Can we bring in the financial department');
        await textbox.press('Enter');
    }

    // Wait for the Conductor to respond and call the seat_agent tool
    console.log('[E2E:Live] Waiting for seating and Conductor response...');
    await page.waitForTimeout(15000);

    // Verify if the finance agent is now seated in the store
    const activeAgents = await page.evaluate(() => {
        return (window as any).useStore ? (window as any).useStore.getState().activeAgents : [];
    });
    console.log('[E2E:Live] Active Boardroom Agents in store:', activeAgents);

    // Capture Boardroom after seating the finance agent
    await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/media__1779690559030.png' });
    console.log('[E2E:Live] Saved final boardroom seating screenshot.');

    // Assert that the finance agent was successfully seated
    expect(activeAgents).toContain('finance');
    console.log('[E2E:Live] Swarm seating successfully verified!');
});
