import { beforeEach, describe, expect, it } from 'vitest';
import {
    classifyStudioRelayHealth,
    getStudioRelayHealth,
    recordPresencePublishAttempt,
    recordPresencePublishFailure,
    recordPresencePublishSuccess,
    resetStudioRelayHealth,
    STUDIO_RELAY_LIVE_WINDOW_MS,
} from './studioRelayHealth';

const NOW = 1_000_000;

describe('studioRelayHealth', () => {
    beforeEach(() => {
        resetStudioRelayHealth();
    });

    it('reports idle before the executor has published anything', () => {
        const verdict = classifyStudioRelayHealth(getStudioRelayHealth(), NOW);
        expect(verdict.status).toBe('idle');
    });

    it('reports live while publishes keep landing inside the freshness window', () => {
        recordPresencePublishAttempt(NOW - 5_000);
        recordPresencePublishSuccess(NOW - 5_000);

        const verdict = classifyStudioRelayHealth(getStudioRelayHealth(), NOW);
        expect(verdict.status).toBe('live');
        expect(verdict.detail).toContain('5s ago');
    });

    it('clears the failure message after a success so Live is never mixed with stale errors', () => {
        recordPresencePublishFailure(new Error('internal function error'));
        recordPresencePublishSuccess(NOW);

        const verdict = classifyStudioRelayHealth(getStudioRelayHealth(), NOW + 1_000);
        expect(verdict.status).toBe('live');
        expect(verdict.detail).not.toContain('internal');
    });

    it('reports failing with the real cause when publishes are rejected', () => {
        // The exact silent-failure scenario from the audit: a stale cloud
        // deploy rejects every heartbeat while the old UI still said "Ready".
        recordPresencePublishAttempt(NOW - 10_000);
        recordPresencePublishFailure(new Error('publishStudioPresence is not deployed'));
        recordPresencePublishAttempt(NOW - 5_000);
        recordPresencePublishFailure(new Error('publishStudioPresence is not deployed'));

        const snapshot = getStudioRelayHealth();
        expect(snapshot.consecutiveFailures).toBe(2);

        const verdict = classifyStudioRelayHealth(snapshot, NOW);
        expect(verdict.status).toBe('failing');
        expect(verdict.detail).toContain('not deployed');
    });

    it('downgrades an aged-out success to failing instead of pretending it is live', () => {
        recordPresencePublishSuccess(NOW - STUDIO_RELAY_LIVE_WINDOW_MS - 1_000);

        const verdict = classifyStudioRelayHealth(getStudioRelayHealth(), NOW);
        expect(verdict.status).toBe('failing');
        expect(verdict.detail).toContain('Last heartbeat');
    });
});
