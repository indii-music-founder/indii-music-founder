type RuntimeWindow = Window & {
    FIREBASE_E2E_MOCK?: unknown;
    FIREBASE_USER_MOCK?: Record<string, unknown>;
};

const trueLike = (value: unknown): boolean =>
    value === true || value === 'true' || value === '1';

export const isTestHarnessRuntime = (): boolean => {
    // SECURITY: Ensure E2E mocks are stripped out of production builds
    if (import.meta.env.PROD && import.meta.env.MODE !== 'test') return false;

    const env = import.meta.env;
    if (env.MODE === 'test' || trueLike(env.VITE_E2E) || trueLike(env.VITE_FIREBASE_E2E_MOCK)) {
        return true;
    }

    try {
        return typeof process !== 'undefined' && (
            process.env.VITEST === 'true' ||
            process.env.NODE_ENV === 'test' ||
            process.env.VITE_E2E === 'true' ||
            process.env.VITE_FIREBASE_E2E_MOCK === 'true'
        );
    } catch {
        return false;
    }
};

export const isFirebaseE2EMockEnabled = (): boolean => {
    if (!isTestHarnessRuntime()) return false;

    if (typeof window !== 'undefined' && trueLike((window as RuntimeWindow).FIREBASE_E2E_MOCK)) {
        return true;
    }

    try {
        return trueLike(localStorage.getItem('FIREBASE_E2E_MOCK'));
    } catch {
        return false;
    }
};

export const getE2EMockUser = <T>(): T | null => {
    if (!isFirebaseE2EMockEnabled() || typeof window === 'undefined') return null;
    
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
