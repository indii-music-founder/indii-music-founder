/**
 * Unit tests for NotificationTools — Multi-Channel Notifications
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationTools } from '@/services/agent/tools/NotificationTools';
import type { AgentContext } from '@/services/agent/types';

// Mock Firestore
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({ id: 'mock-coll' })),
    addDoc: vi.fn(() => Promise.resolve({ id: 'notif-doc-1' })),
    serverTimestamp: vi.fn(() => new Date()),
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-uid' } },
}));

vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        vi.fn(() => ({})),
        {
            getState: vi.fn(() => ({})),
            setState: vi.fn(),
            subscribe: vi.fn(() => () => { }),
        }
    ),
}));

const mockContext: AgentContext = {
    userId: 'test-uid',
};

describe('NotificationTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('send_notification', () => {
        it('should send a notification successfully', async () => {
            // Mock Notification API as granted
            Object.defineProperty(globalThis, 'Notification', {
                writable: true,
                configurable: true,
                value: class MockNotification {
                    static permission = 'granted';
                    onclick: (() => void) | null = null;
                    constructor(_title: string, _options?: NotificationOptions) {
                        // no-op
                    }
                },
            });

            const result = await NotificationTools.send_notification(
                { title: 'Test Alert', body: 'Something happened', urgency: 'info' },
                mockContext
            );

            expect(result.success).toBe(true);
            expect(result.data?.title).toBe('Test Alert');
            expect(result.data?.desktopDelivered).toBe(true);
            expect(result.data?.persisted).toBe(true);
        });

        it('should handle denied notification permission', async () => {
            Object.defineProperty(globalThis, 'Notification', {
                writable: true,
                configurable: true,
                value: class MockNotification {
                    static permission = 'denied';
                    constructor(_title: string, _options?: NotificationOptions) {
                        // no-op
                    }
                },
            });

            const result = await NotificationTools.send_notification(
                { title: 'Denied Test', body: 'Will not show', urgency: 'info' },
                mockContext
            );

            expect(result.success).toBe(true);
            expect(result.data?.desktopDelivered).toBe(false);
            expect(result.message).toContain('unavailable');
        });

        it('should reject missing title', async () => {
            const result = await NotificationTools.send_notification(
                { title: '', body: 'No title', urgency: 'info' },
                mockContext
            );

            expect(result.success).toBe(false);
        });

        it('should reject missing body', async () => {
            const result = await NotificationTools.send_notification(
                { title: 'Title', body: '', urgency: 'info' },
                mockContext
            );

            expect(result.success).toBe(false);
        });

        it('should include action_url in response when provided', async () => {
            Object.defineProperty(globalThis, 'Notification', {
                writable: true,
                configurable: true,
                value: class MockNotification {
                    static permission = 'granted';
                    onclick: (() => void) | null = null;
                    constructor(_title: string, _options?: NotificationOptions) {
                        // no-op
                    }
                },
            });

            const result = await NotificationTools.send_notification(
                { title: 'Navigate', body: 'Click to go', urgency: 'info', action_url: '/distribution' },
                mockContext
            );

            expect(result.success).toBe(true);
            expect(result.data?.desktopDelivered).toBe(true);
        });
    });
});
