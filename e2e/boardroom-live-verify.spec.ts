import { test, expect } from './fixtures/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4242';

test('Boardroom Live Visual Verification', async ({ authedPage: page }) => {
    // Navigate to local server or configured BASE_URL
    console.log(`[E2E:Live] Navigating to: ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Capture Home Page initial state
    await page.screenshot({ path: 'artifacts/boardroom_live_home.png' });
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

    // Wait for the main app view to be fully loaded and authenticated
    console.log('[E2E:Live] Waiting for main app view to be loaded...');
    await page.waitForFunction(() => (window as any).useStore !== undefined, { timeout: 30000 });

    // Inject Boardroom mode state directly
    console.log('[E2E:Live] Injecting Boardroom overlay state...');
    await page.evaluate(() => {
        if ((window as any).useStore) {
            (window as any).useStore.getState().setConversationMode('boardroom');
        } else {
            console.error('Zustand store is not available in window context.');
        }
    });

    // Now wait for the boardroom prompt input to be mounted and visible
    await page.waitForSelector('[data-testid="main-prompt-input"]', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Capture initial Boardroom state
    await page.screenshot({ path: 'artifacts/boardroom_live_initial.png' });
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

    // Dynamic Wait: Wait for the Conductor to automatically call the seat_agent tool and add 'finance'
    console.log('[E2E:Live] Dynamically polling Zustand store for "finance" seating...');
    await page.waitForFunction(() => {
        const store = (window as any).useStore;
        if (!store) return false;
        const active = store.getState().activeAgents || [];
        return active.includes('finance');
    }, { timeout: 45000 });

    // Verify final active agents
    const activeAgents = await page.evaluate(() => {
        return (window as any).useStore ? (window as any).useStore.getState().activeAgents : [];
    });
    console.log('[E2E:Live] Active Boardroom Agents in store after seating:', activeAgents);

    // Capture Boardroom after seating the finance agent
    await page.screenshot({ path: 'artifacts/boardroom_live_seated.png' });
    console.log('[E2E:Live] Saved final boardroom seating screenshot.');

    // Assert that the finance agent was successfully seated
    expect(activeAgents).toContain('finance');
    console.log('[E2E:Live] Swarm seating successfully verified!');
});
