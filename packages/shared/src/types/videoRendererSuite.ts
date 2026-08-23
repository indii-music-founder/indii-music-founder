/**
 * VideoRendererContract compliance suite (MIG-006).
 *
 * ONE behavioral specification, executed against EVERY engine adapter.
 * A new engine passes this suite or it does not ship. Invariants here are the
 * intersection both cloud-shaped and locally-executing adapters must honor;
 * transport-specific strictness (e.g. https signed URLs) stays in each
 * adapter's own tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CompletedRenderReceipt, VideoRenderConfig, VideoRenderReceipt, VideoRendererContract } from './videoRenderer.js';

/**
 * Harness each adapter binds to the suite. `complete`/`fail` drive an
 * in-flight job deterministically (stub backend for cloud adapters, real
 * engine completion or test hook for local ones).
 */
export interface RendererContractScenario {
    /** Fresh adapter instance per test (no cross-test job leakage). */
    makeAdapter(): VideoRendererContract;
    /** A minimal valid config this adapter accepts. */
    baseConfig(): VideoRenderConfig;
    /** Resolve the in-flight job identified by renderId as completed. */
    complete(renderId: string): void | Promise<void>;
    /** Force the in-flight job into a failed terminal state. */
    fail(renderId: string, message: string): void | Promise<void>;
    dispose?(): void | Promise<void>;
}

// Real local engines execute this same suite; keep polling tight while allowing
// enough wall time for a cold browser/encoder start on CI.
const SHORT_POLL = { pollIntervalMs: 5, timeoutMs: 120_000 };

export const runVideoRendererContractSuite = (
    suiteName: string,
    makeScenario: () => RendererContractScenario,
): void => {
    describe(`${suiteName} — VideoRendererContract compliance`, () => {
        let scenario: RendererContractScenario;

        beforeEach(() => {
            scenario = makeScenario();
        });
        afterEach(() => scenario.dispose?.());

        it('admits a valid render and returns a queued receipt', async () => {
            const adapter = scenario.makeAdapter();
            const cfg = scenario.baseConfig();
            const queued = await adapter.queueComposition(cfg);
            expect(queued.status).toBe('queued');
            expect(queued.renderId.trim()).not.toBe('');
            expect(queued.projectId).toBe(cfg.projectId);
            expect(queued.progress).toBeGreaterThanOrEqual(0);
            expect(queued.progress).toBeLessThanOrEqual(100);
        });

        it('fails closed on missing projectId', async () => {
            const adapter = scenario.makeAdapter();
            const cfg = { ...scenario.baseConfig(), projectId: undefined };
            await expect(adapter.queueComposition(cfg)).rejects.toThrow();
        });

        it('fails closed on missing organizationId', async () => {
            const adapter = scenario.makeAdapter();
            const cfg = { ...scenario.baseConfig(), organizationId: undefined };
            await expect(adapter.queueComposition(cfg)).rejects.toThrow();
        });

        it('rejects receipt reads for unknown render ids', async () => {
            const adapter = scenario.makeAdapter();
            await expect(adapter.getRenderReceipt('no-such-render-id')).rejects.toThrow();
        });

        it('resolves waitForRender with a completed receipt carrying the artifact', async () => {
            const adapter = scenario.makeAdapter();
            const config = scenario.baseConfig();
            const queued = await adapter.queueComposition(config);
            const observed: VideoRenderReceipt[] = [];
            const pending = adapter.waitForRender(queued.renderId, receipt => observed.push(receipt), SHORT_POLL);
            await scenario.complete(queued.renderId);
            const done = (await pending) as CompletedRenderReceipt;
            expect(done.status).toBe('completed');
            expect(done.progress).toBe(100);
            expect(done.renderId).toBe(queued.renderId);
            expect(done.projectId).toBe(config.projectId);
            expect(typeof done.asset.url).toBe('string');
            expect(done.asset.url.length).toBeGreaterThan(0);
            expect(done.asset.mimeType).toBe('video/mp4');
            expect(done.asset.expiresAt).toBeGreaterThan(Date.now() - 1_000);
            expect(typeof done.asset.generation).toBe('string');
            expect(done.asset.generation.length).toBeGreaterThan(0);
            expect(observed.length).toBeGreaterThan(0);
            expect(observed.at(-1)?.status).toBe('completed');
            for (const receipt of observed) {
                expect(receipt.renderId).toBe(queued.renderId);
                expect(receipt.projectId).toBe(config.projectId);
                expect(receipt.progress).toBeGreaterThanOrEqual(0);
                expect(receipt.progress).toBeLessThanOrEqual(100);
            }
        });

        it('propagates engine failures through waitForRender', async () => {
            const adapter = scenario.makeAdapter();
            const queued = await adapter.queueComposition(scenario.baseConfig());
            const pending = adapter.waitForRender(queued.renderId, undefined, SHORT_POLL);
            await scenario.fail(queued.renderId, 'engine-explosion');
            await expect(pending).rejects.toThrow(/engine-explosion/);
        });
    });
};
