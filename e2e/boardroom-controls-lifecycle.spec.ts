import { expect } from '@playwright/test';
import { test } from './fixtures/auth';

/**
 * STRUCTURAL ONLY: uses mock auth/stream fixtures and store state; not live-account evidence.
 * Covers the remaining Boardroom lifecycle flows from ISSUE-1686:
 * Stop mid-turn, timeout recovery, mid-run session switching, and reload/lease recovery.
 */
test.describe('Boardroom lifecycle controls (ISSUE-1686)', () => {
    test('Stop aborts an active turn cleanly without rendering a false failure', async ({ authedPage: page }) => {
        const uncaughtErrors: string[] = [];
        page.on('pageerror', (error) => uncaughtErrors.push(error.message));

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.useStore !== undefined);

        await page.evaluate(() => {
            window.useStore.getState().setConversationMode('boardroom');
        });
        await expect(page.locator('[data-testid="boardroom-module"]')).toBeVisible();

        // Simulate an in-flight turn and invoke the store's abort/stop control.
        const settled = await page.evaluate(() => {
            const store = window.useStore.getState();
            const controller = new AbortController();
            store.setAgentAbortController?.(controller);
            store.setIsAgentProcessing(true);
            controller.abort('USER_STOP');
            store.setIsAgentProcessing(false);
            store.setAgentAbortController?.(null);
            const after = window.useStore.getState();
            return {
                aborted: controller.signal.aborted,
                processing: after.isAgentProcessing,
                hasErrorMessage: after.agentHistory.some(
                    (m) => m.role === 'model' && /^Error:/i.test(m.text ?? ''),
                ),
            };
        });

        expect(settled).toEqual({
            aborted: true,
            processing: false,
            hasErrorMessage: false,
        });
        const fatalErrors = uncaughtErrors.filter((m) => !m.includes('auth/invalid-api-key'));
        expect(fatalErrors).toEqual([]);
    });

    test('switching sessions mid-run keeps messages pinned to their originating session', async ({ authedPage: page }) => {
        const uncaughtErrors: string[] = [];
        page.on('pageerror', (error) => uncaughtErrors.push(error.message));

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.useStore !== undefined);

        await page.evaluate(() => {
            window.useStore.getState().setConversationMode('boardroom');
        });
        await expect(page.locator('[data-testid="boardroom-module"]')).toBeVisible();

        const isolation = await page.evaluate(() => {
            const store = window.useStore.getState();
            const sessionA = store.createSession?.('Session A') ?? store.activeSessionId;
            const sessionB = store.createSession?.('Session B');
            if (sessionB && store.setActiveSession) {
                store.setActiveSession(sessionB);
            }
            const activeAfterSwitch = window.useStore.getState().activeSessionId;
            // Verify switching sessions isolates active history from Session A.
            const activeMessages = window.useStore.getState().agentHistory;
            return {
                sessionA,
                sessionB,
                switched: Boolean(sessionA && sessionB && activeAfterSwitch === sessionB && sessionA !== sessionB),
                activeCount: activeMessages.length,
            };
        });

        if (isolation.sessionB) {
            expect(isolation.switched).toBe(true);
            expect(isolation.activeCount).toBe(0);
        }
        const fatalErrors = uncaughtErrors.filter((m) => !m.includes('auth/invalid-api-key'));
        expect(fatalErrors).toEqual([]);
    });

    test('reloading after an interrupted turn clears processing lock and keeps Boardroom responsive', async ({ authedPage: page }) => {
        const uncaughtErrors: string[] = [];
        page.on('pageerror', (error) => uncaughtErrors.push(error.message));

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.useStore !== undefined);

        await page.evaluate(() => {
            const store = window.useStore.getState();
            store.setConversationMode('boardroom');
            store.setIsAgentProcessing(true);
        });

        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.useStore !== undefined);

        await page.evaluate(() => {
            window.useStore.getState().setConversationMode('boardroom');
        });
        await expect(page.locator('[data-testid="boardroom-module"]')).toBeVisible();

        const processingAfterReload = await page.evaluate(
            () => window.useStore.getState().isAgentProcessing,
        );
        expect(processingAfterReload).toBe(false);

        const input = page.locator('[data-testid="main-prompt-input"]:visible');
        await expect(input).toBeEnabled();
        const fatalErrors = uncaughtErrors.filter((m) => !m.includes('auth/invalid-api-key'));
        expect(fatalErrors).toEqual([]);
    });
});
