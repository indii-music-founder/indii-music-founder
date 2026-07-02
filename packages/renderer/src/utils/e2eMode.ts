import { logger } from '@/utils/logger';

type RuntimeWindow = Window & {
    FIREBASE_E2E_MOCK?: unknown;
    FIREBASE_USER_MOCK?: Record<string, unknown>;
};

const trueLike = (value: unknown): boolean =>
    value === true || value === 'true' || value === '1';

const isLocalDevHost = (): boolean =>
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const isTestHarnessRuntime = (): boolean => {
    // SECURITY: Ensure E2E mocks are stripped out of production builds
    if (import.meta.env.PROD && import.meta.env.MODE !== 'test') return false;

    if (import.meta.env.MODE === 'test' || trueLike(import.meta.env.VITE_E2E) || trueLike(import.meta.env.VITE_FIREBASE_E2E_MOCK)) {
        return true;
    }

    try {
        return typeof process !== 'undefined' && (
            process.env.VITEST === 'true' ||
            process.env.NODE_ENV === 'test'
        );
    } catch {
        return false;
    }
};

export const isFirebaseE2EMockEnabled = (): boolean => {
    if (!isTestHarnessRuntime() && !isLocalDevHost()) {
        logger.debug('[e2eMode] Disabled: not test harness and not local dev host');
        return false;
    }

    if (typeof window !== 'undefined') {
        const winMock = (window as RuntimeWindow).FIREBASE_E2E_MOCK;
        if (winMock === false || winMock === 'false') {
            logger.debug('[e2eMode] Disabled: window.FIREBASE_E2E_MOCK is false');
            return false;
        }
        if (trueLike(winMock)) {
            logger.debug('[e2eMode] Enabled: window.FIREBASE_E2E_MOCK is true');
            return true;
        }
    }

    try {
        const lsMock = localStorage.getItem('FIREBASE_E2E_MOCK');
        if (lsMock === 'false') {
            logger.debug('[e2eMode] Disabled: localStorage FIREBASE_E2E_MOCK is false');
            return false;
        }
        if (trueLike(lsMock)) {
            logger.debug('[e2eMode] Enabled: localStorage FIREBASE_E2E_MOCK is true');
            return true;
        }
    } catch (e) {
        logger.warn('[e2eMode] Failed to read localStorage:', e);
    }

    try {
        const envMock = typeof import.meta !== 'undefined' && import.meta.env
            ? import.meta.env.VITE_FIREBASE_E2E_MOCK
            : undefined;
        return trueLike(envMock);
    } catch (e) {
        logger.warn('[e2eMode] import.meta.env check failed, defaulting to false:', e);
        return false;
    }
};

export const getE2EMockUser = <T>(): T | null => {
    if (!isFirebaseE2EMockEnabled() || typeof window === 'undefined') return null;

    try {
        if (localStorage.getItem('FIREBASE_E2E_SIGNED_OUT') === '1') {
            return null;
        }
    } catch {
        // ignore
    }
    
    const defaultUser = {
        uid: 'test-agent-123',
        email: 'test@indii.com',
        displayName: 'Automated Test Agent',
        emailVerified: true,
        isAnonymous: false,
        tenantId: null,
        providerData: [],
        metadata: { creationTime: new Date().toISOString(), lastSignInTime: new Date().toISOString() },
        refreshToken: 'mock-refresh-token',
        getIdToken: async () => 'mock-id-token',
        getIdTokenResult: async () => ({ token: 'mock-id-token', claims: {}, authTime: new Date().toISOString(), issuedAtTime: new Date().toISOString(), signInProvider: 'password', signInSecondFactor: null }),
        reload: async () => {},
        delete: async () => {},
        toJSON: function() { return { uid: this.uid }; }
    };

    let customUser: Record<string, unknown> | null = null;

    // 1. Check window object
    if ((window as RuntimeWindow).FIREBASE_USER_MOCK) {
        customUser = (window as RuntimeWindow).FIREBASE_USER_MOCK ?? null;
    } else {
        // 2. Check localStorage
        try {
            const stored = localStorage.getItem('FIREBASE_USER_MOCK');
            if (stored) customUser = JSON.parse(stored);
        } catch {
            // ignore
        }
        
        // 3. Check environment
        if (!customUser) {
            try {
                const envUser = import.meta.env.VITE_FIREBASE_USER_MOCK;
                if (envUser) customUser = JSON.parse(envUser);
            } catch {
                // ignore
            }
        }
    }

    if (customUser) {
        return { ...defaultUser, ...customUser } as unknown as T;
    }

    return defaultUser as unknown as T;
};

export const getE2ELocalStorageValue = (key: string): string | null => {
    if (!isFirebaseE2EMockEnabled()) return null;
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};
