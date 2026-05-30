type RuntimeWindow = Window & {
    FIREBASE_E2E_MOCK?: unknown;
    FIREBASE_USER_MOCK?: unknown;
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
    return ((window as RuntimeWindow).FIREBASE_USER_MOCK as T | undefined) ?? null;
};

export const getE2ELocalStorageValue = (key: string): string | null => {
    if (!isFirebaseE2EMockEnabled()) return null;
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};
