import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BOARDROOM_MAX_EXECUTED_AGENTS, GENERATION_RATE_LIMIT } from '@indii/shared';
import { RateLimiter } from './RateLimiter';
import { CLIENT_GENERATION_PACING } from './FirebaseIntelligenceService';

describe('client generation pacing vs. server limit', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(1_700_000_000_000);
    });
    afterEach(() => vi.useRealTimers());

    it('derives burst + rate from the shared server limit', () => {
        expect(CLIENT_GENERATION_PACING.burst).toBe(BOARDROOM_MAX_EXECUTED_AGENTS);
        expect(CLIENT_GENERATION_PACING.burst + CLIENT_GENERATION_PACING.ratePerMinute)
            .toBeLessThanOrEqual(GENERATION_RATE_LIMIT.maxRequests);
    });

    it('starts a full Boardroom wave immediately (no per-request wait)', async () => {
        const limiter = new RateLimiter(CLIENT_GENERATION_PACING.ratePerMinute, CLIENT_GENERATION_PACING.burst);
        const admitted: number[] = [];
        const start = Date.now();
        const waves = Array.from({ length: BOARDROOM_MAX_EXECUTED_AGENTS }, () =>
            limiter.acquire(300_000).then(() => admitted.push(Date.now() - start)));
        await vi.advanceTimersByTimeAsync(0);
        await Promise.all(waves);
        expect(admitted).toHaveLength(BOARDROOM_MAX_EXECUTED_AGENTS);
        expect(Math.max(...admitted)).toBe(0);
    });

    it('never admits more than the server allows in any sliding window', async () => {
        const limiter = new RateLimiter(CLIENT_GENERATION_PACING.ratePerMinute, CLIENT_GENERATION_PACING.burst);
        const admitted: number[] = [];
        const start = Date.now();
        // Saturate: far more demand than the window allows, over three minutes.
        for (let i = 0; i < 120; i++) {
            void limiter.acquire(10 * 60_000).then(() => admitted.push(Date.now() - start)).catch(() => undefined);
        }
        await vi.advanceTimersByTimeAsync(3 * 60_000);
        expect(admitted.length).toBeGreaterThan(GENERATION_RATE_LIMIT.maxRequests);
        for (const t of admitted) {
            const inWindow = admitted.filter((u) => u >= t && u < t + GENERATION_RATE_LIMIT.windowMs).length;
            expect(inWindow).toBeLessThanOrEqual(GENERATION_RATE_LIMIT.maxRequests);
        }
    });
});
