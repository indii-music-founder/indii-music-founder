import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getFirebaseMessaging: vi.fn(),
    onMessage: vi.fn(),
}));

vi.mock('firebase/messaging', () => ({
    getToken: vi.fn(),
    onMessage: mocks.onMessage,
}));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    serverTimestamp: vi.fn(),
    setDoc: vi.fn(),
}));
vi.mock('@/services/firebase', () => ({
    app: {},
    db: {},
    getFirebaseMessaging: mocks.getFirebaseMessaging,
}));
vi.mock('@/utils/logger', () => ({
    logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { PushNotificationService } from './PushNotificationService';

describe('PushNotificationService foreground listener lifecycle', () => {
    it('does not attach a listener after the caller unsubscribes during lazy initialization', async () => {
        let resolveMessaging!: (value: object) => void;
        mocks.getFirebaseMessaging.mockReturnValueOnce(new Promise(resolve => {
            resolveMessaging = resolve;
        }));
        const service = new PushNotificationService();

        const unsubscribe = service.onForegroundMessage(vi.fn());
        unsubscribe();
        resolveMessaging({ app: 'messaging' });
        await Promise.resolve();
        await Promise.resolve();

        expect(mocks.onMessage).not.toHaveBeenCalled();
    });
});
