import { describe, expect, it } from 'vitest';
import { PresencePublishGate, SingleFlight } from './relayRequestControl';
import { HEARTBEAT_INTERVAL_MS } from './studioExecutorContracts';

describe('relay request volume control', () => {
    it('keeps routine presence below the 120s freshness window at 60 calls/hour', () => {
        expect(HEARTBEAT_INTERVAL_MS).toBe(60_000);
        expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(120_000);
    });

    it('does not overlap a pending heartbeat, even after many timer ticks', () => {
        const gate = new PresencePublishGate();
        expect(gate.tryBegin(0)).toBe(true);
        for (let t = 5_000; t <= 600_000; t += 5_000) expect(gate.tryBegin(t)).toBe(false);
        gate.succeed();
        expect(gate.tryBegin(600_000)).toBe(true);
    });

    it('backs off 1, 2, 4 then 5 minutes, including visibility-triggered attempts', () => {
        const gate = new PresencePublishGate();
        let now = 0;
        for (const delay of [60_000, 120_000, 240_000, 300_000, 300_000]) {
            expect(gate.tryBegin(now)).toBe(true);
            gate.fail(now);
            for (let t = now; t < now + delay; t += 5_000) expect(gate.tryBegin(t)).toBe(false);
            now += delay;
        }
        expect(gate.tryBegin(now)).toBe(true);
    });

    it('resets backoff after recovery rather than permanently disabling the relay', () => {
        const gate = new PresencePublishGate();
        expect(gate.tryBegin(0)).toBe(true);
        gate.fail(0);
        expect(gate.tryBegin(60_000)).toBe(true);
        gate.succeed();
        expect(gate.tryBegin(60_001)).toBe(true);
        gate.fail(60_001);
        expect(gate.tryBegin(120_000)).toBe(false);
        expect(gate.tryBegin(120_001)).toBe(true);
    });

    it('shares one outstanding operation across concurrent callers', async () => {
        const flight = new SingleFlight<number>();
        let finish!: (value: number) => void;
        let requests = 0;
        const request = () => {
            requests++;
            return new Promise<number>(resolve => { finish = resolve; });
        };
        const first = flight.run(request);
        const second = flight.run(request);
        await Promise.resolve();
        expect(requests).toBe(1);
        expect(second).toBe(first);
        finish(42);
        expect(await Promise.all([first, second])).toEqual([42, 42]);
        expect(await flight.run(async () => 99)).toBe(99);
    });

    it('clears a rejected operation so a later authorized retry can run', async () => {
        const flight = new SingleFlight<number>();
        const failure = new Error('protection unavailable');
        const first = flight.run(async () => { throw failure; });
        const second = flight.run(async () => 99);
        const settled = await Promise.allSettled([first, second]);
        expect(settled).toEqual([
            { status: 'rejected', reason: failure },
            { status: 'rejected', reason: failure },
        ]);
        expect(await flight.run(async () => 99)).toBe(99);
    });

    it('enforces exact retryAt boundaries up to the 300s cap and resets failure exponent after succeed()', () => {
        const gate = new PresencePublishGate();
        let now = 1_000;
        for (const expectedDelay of [60_000, 120_000, 240_000, 300_000, 300_000]) {
            expect(gate.tryBegin(now)).toBe(true);
            gate.fail(now);
            expect(gate.tryBegin(now + expectedDelay - 1)).toBe(false);
            now += expectedDelay;
        }
        expect(gate.tryBegin(now)).toBe(true);
        gate.succeed();

        expect(gate.tryBegin(now + 1)).toBe(true);
        gate.fail(now + 1);
        expect(gate.tryBegin(now + 60_000)).toBe(false);
        expect(gate.tryBegin(now + 60_001)).toBe(true);
    });

    it('propagates synchronous throws across shared SingleFlight callers and recovers cleanly', async () => {
        const flight = new SingleFlight<string>();
        const boom = new Error('sync throw');
        let calls = 0;
        const crashingRequest = () => {
            calls += 1;
            throw boom;
        };

        const first = flight.run(crashingRequest);
        const second = flight.run(crashingRequest);
        expect(second).toBe(first);

        const outcomes = await Promise.allSettled([first, second]);
        expect(calls).toBe(1);
        expect(outcomes).toEqual([
            { status: 'rejected', reason: boom },
            { status: 'rejected', reason: boom },
        ]);
        expect(await flight.run(async () => 'recovered')).toBe('recovered');
    });
});
