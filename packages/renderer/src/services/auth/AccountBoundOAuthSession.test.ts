import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    beginAccountBoundOAuthSession,
    requireAccountBoundOAuthSession,
} from './AccountBoundOAuthSession';

describe('AccountBoundOAuthSession', () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.useRealTimers();
    });

    it('accepts only the Firebase account that initiated the flow', () => {
        const session = beginAccountBoundOAuthSession('spotify', 'user-a', { codeVerifier: 'pkce-a' });

        expect(requireAccountBoundOAuthSession('spotify', session.state, 'user-a')).toMatchObject({
            ownerUid: 'user-a',
            codeVerifier: 'pkce-a',
        });
        expect(() => requireAccountBoundOAuthSession('spotify', session.state, 'user-b'))
            .toThrow('signed-in account changed');
    });

    it('rejects and consumes an invalid state value', () => {
        const session = beginAccountBoundOAuthSession('gmail', 'user-a');

        expect(() => requireAccountBoundOAuthSession('gmail', 'attacker-state', 'user-a'))
            .toThrow('OAuth state mismatch');
        expect(() => requireAccountBoundOAuthSession('gmail', session.state, 'user-a'))
            .toThrow('OAuth state mismatch');
    });

    it('expires abandoned authorization requests', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-08T12:00:00Z'));
        const session = beginAccountBoundOAuthSession('tiktok', 'user-a');
        vi.advanceTimersByTime(10 * 60 * 1000 + 1);

        expect(() => requireAccountBoundOAuthSession('tiktok', session.state, 'user-a'))
            .toThrow('authorization request expired');
    });
});
