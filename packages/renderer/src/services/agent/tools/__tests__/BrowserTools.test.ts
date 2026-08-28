/**
 * Unit tests for BrowserTools — the "Ghost Hands" bridge surface.
 * Covers: fail-closed web behavior and the browser_action audit trail
 * (action + selector persisted, typed text never persisted).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserTools } from '@/services/agent/tools/BrowserTools';
import { addDoc } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({ id: 'browserHistory' })),
    addDoc: vi.fn(() => Promise.resolve({ id: 'audit-doc-1' })),
    serverTimestamp: vi.fn(() => new Date()),
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-uid' } },
}));

const mockAddDoc = vi.mocked(addDoc);

let electronBridge: {
    navigateAndExtract: ReturnType<typeof vi.fn>;
    performAction: ReturnType<typeof vi.fn>;
    captureState: ReturnType<typeof vi.fn>;
};

describe('BrowserTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const agentBridge = {
            navigateAndExtract: vi.fn().mockResolvedValue({ success: true, title: 'T', text: 'body' }),
            performAction: vi.fn().mockResolvedValue({ success: true }),
            captureState: vi.fn().mockResolvedValue({ success: true, title: 'T', text: 'body' }),
        };
        // Partial stub — tests only touch the agent namespace of the bridge.
        (window as unknown as { electronAPI: unknown }).electronAPI = { agent: agentBridge };
        electronBridge = agentBridge;
    });

    describe('browser_action audit trail', () => {
        it('persists action + selector on success', async () => {
            const result = await BrowserTools.browser_action(
                { action: 'click', selector: '.submit-btn' },
                { userId: 'test-uid' } as never
            );

            expect(result.success).toBe(true);
            expect(mockAddDoc).toHaveBeenCalledTimes(1);
            const [, doc] = mockAddDoc.mock.calls[0]!;
            expect(doc).toMatchObject({
                action: 'click',
                selector: '.submit-btn',
                status: 'action',
            });
        });

        it('never persists typed text', async () => {
            await BrowserTools.browser_action(
                { action: 'type', selector: '#password', text: 'super-secret-credentials' },
                { userId: 'test-uid' } as never
            );

            const [, doc] = mockAddDoc.mock.calls[0]!;
            expect(JSON.stringify(doc)).not.toContain('super-secret-credentials');
        });

        it('still succeeds when the audit write fails (best-effort)', async () => {
            mockAddDoc.mockRejectedValueOnce(new Error('firestore down'));

            const result = await BrowserTools.browser_action(
                { action: 'click', selector: '.btn' },
                { userId: 'test-uid' } as never
            );

            expect(result.success).toBe(true);
        });

        it('does not write an audit doc when the action fails', async () => {
            electronBridge.performAction.mockResolvedValueOnce({
                success: false,
                error: 'Element not found',
            });

            const result = await BrowserTools.browser_action(
                { action: 'click', selector: '.missing' },
                { userId: 'test-uid' } as never
            );

            expect(result.success).toBe(false);
            expect(mockAddDoc).not.toHaveBeenCalled();
        });
    });

    describe('fail-closed contract', () => {
        it('browser_navigate errors clearly without the Electron bridge', async () => {
            (window as unknown as { electronAPI: unknown }).electronAPI = undefined;

            const result = await BrowserTools.browser_navigate({ url: 'https://example.com' }, { userId: 'test-uid' } as never);

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/requires the indii desktop app/);
        });
    });
});
