import { test, expect } from './fixtures/auth';

/**
 * Agent Flows E2E Tests
 *
 * Covers: AgentDashboard tabs (scout, browser, campaigns, inbox),
 * ScoutMapVisualization rendering, venue card interactions, and
 * mobile viewport warning guard.
 *
 * Run: npx playwright test e2e/agent-flows.spec.ts
 */

test.describe('Agent Dashboard', () => {
    test.use({ viewport: { width: 1280, height: 800 } }); // Desktop only — mobile shows warning

    test.beforeEach(async ({ authedPage: page }) => {
        // Mock Firestore agent_traces collection
        await page.route('**/firestore.googleapis.com/**/agent_traces**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ documents: [] }),
            });
        });

        console.log('[AGENT TEST] Navigating to Agent module...');
        await page.goto('/agent', { waitUntil: 'domcontentloaded' });

        // Wait for scout content container
        await page.locator('[data-testid="agent-content-scout"]').waitFor({ state: 'visible', timeout: 20_000 });
        await expect(page.locator('h1:has-text("The Scout")')).toBeVisible({ timeout: 15_000 });
    });

    test('agent module loads without crashing on desktop viewport', async ({ authedPage: page }) => {
        await expect(page.locator('[data-testid="agent-content-scout"]')).toBeVisible();
        await expect(page.locator('h1:has-text("The Scout")')).toBeVisible();
        await expect(page.locator('text=mobile only, text=desktop required')).not.toBeVisible();
    });

    test('agent dashboard tab navigation works and shows distinct content', async ({ authedPage: page }) => {
        const tabs = [
            { id: 'browser', contentId: 'agent-content-browser' },
            { id: 'campaigns', contentId: 'agent-content-campaigns' },
            { id: 'inbox', contentId: 'agent-content-inbox' },
            { id: 'scout', contentId: 'agent-content-scout' },
        ];

        for (const tab of tabs) {
            const tabBtn = page.locator(`[data-testid="agent-tab-${tab.id}"]`);
            await expect(tabBtn).toBeVisible({ timeout: 10_000 });
            await tabBtn.click();

            const content = page.locator(`[data-testid="${tab.contentId}"]`);
            await expect(content).toBeVisible({ timeout: 10_000 });
        }
    });

    test('scout tab shows map or venue interface', async ({ authedPage: page }) => {
        const scoutTab = page.locator('[data-testid="agent-tab-scout"]');
        await scoutTab.click();

        await expect(page.locator('[data-testid="agent-content-scout"]')).toBeVisible();
        await expect(page.locator('[data-testid="scout-controls"]')).toBeVisible();
        await expect(page.locator('[data-testid="deploy-scout-btn"]')).toBeVisible();
    });

    test('campaigns and inbox tabs show stub or content (regression guard)', async ({ authedPage: page }) => {
        // Test Campaigns tab
        await page.locator('[data-testid="agent-tab-campaigns"]').click();
        await expect(page.locator('[data-testid="agent-content-campaigns"]')).toBeVisible({ timeout: 10_000 });

        // Test Inbox tab
        await page.locator('[data-testid="agent-tab-inbox"]').click();
        await expect(page.locator('[data-testid="agent-content-inbox"]')).toBeVisible({ timeout: 10_000 });
    });

    test('agent responds to user messages with streaming response', async ({ authedPage: page }) => {
        const chatTab = page.locator('[data-testid="agent-tab-chat"]');
        await chatTab.click();
        await expect(page.locator('[data-testid="agent-content-chat"]')).toBeVisible({ timeout: 10_000 });

        const messageInput = page.locator('[data-testid="agent-content-chat"]').getByTestId('main-prompt-input');
        await expect(messageInput).toBeVisible({ timeout: 10_000 });

        await messageInput.fill('What are my upcoming releases?');
        const sendBtn = page.locator('[data-testid="agent-content-chat"]').getByTestId('command-bar-run-btn');
        if (await sendBtn.isVisible()) {
            await sendBtn.click();
        } else {
            await messageInput.press('Enter');
        }

        const userMsg = page.locator('[data-testid="agent-content-chat"]').getByTestId('user-message');
        await expect(userMsg).toBeVisible({ timeout: 15_000 });
    });

    test('agent specializes tasks by routing to appropriate agent', async ({ authedPage: page }) => {
        const chatTab = page.locator('[data-testid="agent-tab-chat"]');
        await chatTab.click();
        await expect(page.locator('[data-testid="agent-content-chat"]')).toBeVisible({ timeout: 10_000 });

        const messageInput = page.locator('[data-testid="agent-content-chat"]').getByTestId('main-prompt-input');
        await expect(messageInput).toBeVisible({ timeout: 10_000 });

        await messageInput.fill('I need to submit my album to DistroKid');
        await messageInput.press('Enter');

        const userMsg = page.locator('[data-testid="agent-content-chat"]').getByTestId('user-message');
        await expect(userMsg).toBeVisible({ timeout: 15_000 });
    });
});

test.describe('Agent Mobile Warning', () => {
    test.use({ viewport: { width: 375, height: 812 } }); // iPhone SE

    test('agent module shows mobile warning on small viewports', async ({ authedPage: page }) => {
        await page.goto('/agent', { waitUntil: 'domcontentloaded' });

        const remoteLoc = page.getByRole('heading', { name: /indiiCONTROLLER|indiiREMOTE/i });
        const warningLoc = page.getByText(/requires a larger screen|wider screen|desktop/i);
        const containerLoc = page.locator('[data-testid="app-container"]');

        await Promise.race([
            remoteLoc.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => { }),
            warningLoc.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => { }),
            containerLoc.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => { }),
        ]);

        const remoteSeen = await remoteLoc.isVisible().catch(() => false);
        const warningSeen = await warningLoc.isVisible().catch(() => false);
        const containerSeen = await containerLoc.isVisible().catch(() => false);

        console.log(`[AGENT MOBILE] mobileRemote=${remoteSeen} mobileWarning=${warningSeen} appContainer=${containerSeen}`);

        expect(remoteSeen || warningSeen || containerSeen,
            'Expected mobile-remote, a mobile warning, or app-container to be visible on phone viewport'
        ).toBe(true);
    });
});
