import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getFirebaseMessaging: vi.fn(),
    onMessage: vi.fn(),
    getToken: vi.fn(),
    setDoc: vi.fn(),
}));

vi.mock('firebase/messaging', () => ({
    getToken: mocks.getToken,
    onMessage: mocks.onMessage,
}));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: { uid: 'user-1' } })) }));
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    serverTimestamp: vi.fn(),
    setDoc: mocks.setDoc,
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
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        Reflect.deleteProperty(navigator, 'serviceWorker');
        mocks.getFirebaseMessaging.mockReset();
        mocks.getToken.mockReset();
        mocks.setDoc.mockReset();
    });

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

    it('uses explicit worker registration and reports success only after the token is saved', async () => {
        vi.stubEnv('VITE_FCM_VAPID_KEY', 'public-vapid-key');
        vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') });
        const registration = { scope: '/' };
        const register = vi.fn().mockResolvedValue(registration);
        Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register } });
        mocks.getFirebaseMessaging.mockResolvedValue({ app: 'messaging' });
        mocks.getToken.mockResolvedValue('fcm-token');
        mocks.setDoc.mockResolvedValue(undefined);
        const service = new PushNotificationService();

        await expect(service.requestPermissionAndGetToken()).resolves.toBe('fcm-token');
        expect(register).toHaveBeenCalledWith('/firebase-messaging-sw.js', { scope: '/' });
        expect(mocks.getToken).toHaveBeenCalledWith({ app: 'messaging' }, { vapidKey: 'public-vapid-key', serviceWorkerRegistration: registration });
        expect(mocks.setDoc).toHaveBeenCalledOnce();

        mocks.setDoc.mockRejectedValueOnce(new Error('Firestore unavailable'));
        await expect(service.requestPermissionAndGetToken()).resolves.toBeNull();
    });
});
