import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    isTestHarnessRuntime,
    isFirebaseE2EMockEnabled,
    getE2EMockUser,
    getE2ELocalStorageValue
} from './e2eMode';

describe('e2eMode utilities', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_E2E', 'false');
        vi.stubEnv('VITE_FIREBASE_E2E_MOCK', 'false');
        localStorage.clear();
        if (typeof window !== 'undefined') {
            delete (window as any).FIREBASE_E2E_MOCK;
            delete (window as any).FIREBASE_USER_MOCK;
        }
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe('isTestHarnessRuntime', () => {
        it('should return true when VITE_E2E is true', () => {
            vi.stubEnv('VITE_E2E', 'true');
            expect(isTestHarnessRuntime()).toBe(true);
        });

        it('should return true when VITE_FIREBASE_E2E_MOCK is true', () => {
            vi.stubEnv('VITE_FIREBASE_E2E_MOCK', 'true');
            expect(isTestHarnessRuntime()).toBe(true);
        });

        it('should return true when env.MODE is test', () => {
            // Vitest default MODE is test
            expect(isTestHarnessRuntime()).toBe(true);
        });
    });

    describe('isFirebaseE2EMockEnabled', () => {
        it('should return false when not in test harness runtime', () => {
            // Force return false by stubbing MODE and env vars
            vi.stubEnv('VITE_E2E', 'false');
            vi.stubEnv('VITE_FIREBASE_E2E_MOCK', 'false');
            expect(isFirebaseE2EMockEnabled()).toBe(false);
        });

        it('should return true when window.FIREBASE_E2E_MOCK is true', () => {
            (window as any).FIREBASE_E2E_MOCK = true;
            expect(isFirebaseE2EMockEnabled()).toBe(true);
        });

        it('should return true when localStorage has FIREBASE_E2E_MOCK as true', () => {
            localStorage.setItem('FIREBASE_E2E_MOCK', 'true');
            expect(isFirebaseE2EMockEnabled()).toBe(true);
        });
    });

    describe('getE2EMockUser', () => {
        it('should return null if Firebase E2E mock is disabled', () => {
            expect(getE2EMockUser()).toBeNull();
        });

        it('should return default mock user when enabled without custom user', () => {
            (window as any).FIREBASE_E2E_MOCK = true;
            const user = getE2EMockUser<any>();
            expect(user).not.toBeNull();
            expect(user.uid).toBe('test-agent-123');
            expect(user.email).toBe('test@indii.com');
        });

        it('should return merged user when custom user is set on window', () => {
            (window as any).FIREBASE_E2E_MOCK = true;
            (window as any).FIREBASE_USER_MOCK = { uid: 'custom-id', displayName: 'Custom Agent' };
            const user = getE2EMockUser<any>();
            expect(user.uid).toBe('custom-id');
            expect(user.displayName).toBe('Custom Agent');
            expect(user.email).toBe('test@indii.com');
        });
    });

    describe('getE2ELocalStorageValue', () => {
        it('should return null if mock disabled', () => {
            localStorage.setItem('some-key', 'some-value');
            expect(getE2ELocalStorageValue('some-key')).toBeNull();
        });

        it('should return value if mock enabled', () => {
            (window as any).FIREBASE_E2E_MOCK = true;
            localStorage.setItem('some-key', 'some-value');
            expect(getE2ELocalStorageValue('some-key')).toBe('some-value');
        });
    });
});
