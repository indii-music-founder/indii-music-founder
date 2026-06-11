import { describe, expect, it } from 'vitest';
import { getRealAuthenticatedUserId, isAnonymousOrDemoUser, isDemoUserId } from './authGuards';

describe('authGuards', () => {
    it('rejects anonymous and demo users', () => {
        expect(isAnonymousOrDemoUser(null)).toBe(true);
        expect(isAnonymousOrDemoUser({ uid: 'founder-demo-uid', isAnonymous: false })).toBe(true);
        expect(isAnonymousOrDemoUser({ uid: 'anon-user', isAnonymous: true })).toBe(true);
        expect(isDemoUserId('guest')).toBe(true);
    });

    it('returns only real authenticated user IDs', () => {
        expect(getRealAuthenticatedUserId({ uid: 'real-user', isAnonymous: false })).toBe('real-user');
        expect(getRealAuthenticatedUserId({ uid: 'anon-user', isAnonymous: true })).toBeNull();
    });
});
