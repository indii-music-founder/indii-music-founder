/**
 * StudioExecutorCore — G1 characterization sweep (REMOTE_EXECUTOR_CORE_PLAN
 * §20.2). These are the tests that were structurally impossible while the
 * executor lived inside a React hook; they run the real Core class against
 * fake transports/adapters with fake timers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    HEARTBEAT_INTERVAL_MS,
    PROCESSING_TIMEOUT_MS,
    shouldReportQueuedChatToRemote,
    type ExecutorCoreDeps,
    type RemoteCommand,
    type StudioExecutionAdapter,
} from '../studioExecutorContracts';
import { StudioExecutorCore } from '../StudioExecutorCore';

// ─── Fakes ──────────────────────────────────────────────────────────────────

type CommandHandler = (command: RemoteCommand & { id: string }) => Promise<void> | void;
type DispatchHandler = (task: any) => Promise<void> | void;

function makeRelay() {
    const pushes: Array<Record<string, unknown>> = [];
    const responses: Array<{ id: string; text: string; agentId?: string; isStreaming?: boolean; imageUrls?: string[]; boardroomMessageId?: string; videoUrls?: string[] }> = [];
    const completions: string[] = [];
    const dispatchClaims: string[] = [];
    const dispatchStatuses: Array<{ id: string; status: string; error?: unknown }> = [];
    const released: string[] = [];
    const cleaned: number[] = [];

    let commandHandler: CommandHandler | null = null;
    let dispatchHandler: DispatchHandler | null = null;

    return {
        pushes,
        responses,
        completions,
        dispatchClaims,
        dispatchStatuses,
        released,
        cleaned,
        emitCommand: (cmd: RemoteCommand & { id: string }) => commandHandler?.(cmd),
        emitDispatch: (task: any) => dispatchHandler?.(task),
        relay: {
            onCommand: (cb: CommandHandler) => {
                commandHandler = cb;
                return () => {
                    commandHandler = null;
                };
            },
            onDispatchTask: (cb: DispatchHandler) => {
                dispatchHandler = cb;
                return () => {
                    dispatchHandler = null;
                };
            },
            sendResponse: vi.fn(async (id: string, text: string, agentId?: string, isStreaming?: boolean, imageUrls?: string[], boardroomMessageId?: string, videoUrls?: string[]) => {
                responses.push({ id, text, agentId, isStreaming, imageUrls, boardroomMessageId, videoUrls });
            }),
            markCommandCompleted: vi.fn(async (id: string) => {
                completions.push(id);
            }),
            claimDispatchTask: vi.fn(async (id: string) => {
                dispatchClaims.push(id);
                return true;
            }),
            updateDispatchTaskStatus: vi.fn(async (id: string, status: string, error?: unknown) => {
                dispatchStatuses.push({ id, status, error });
            }),
            pushDesktopState: vi.fn(async (state: Record<string, unknown>) => {
                pushes.push(state);
            }),
            releaseStudioPresence: vi.fn(async (instanceId: string) => {
                released.push(instanceId);
            }),
            cleanupOld: vi.fn(async (hours: number) => {
                cleaned.push(hours);
                return 0;
            }),
        },
    };
}

function makeAdapter(over: Partial<StudioExecutionAdapter> = {}) {
    const calls = { wake: 0, execute: 0, executeDispatch: 0 };
    const adapter: StudioExecutionAdapter = {
        wakeStudio: vi.fn(() => {
            calls.wake++;
        }),
        isAgentBusy: vi.fn(() => false),
        presenceSnapshot: vi.fn(() => ({
            currentModule: 'dashboard',
            isAgentProcessing: false,
            activeSessionId: 'sess-1',
            sleepMode: false,
            capabilities: { agent: true, computer: true, audio: true, daw: false, ui: true },
        })),
        executeCommand: vi.fn(async () => ({ relays: [{ text: 'ok' }], queuedBehindActiveRun: false })),
        executeDispatchTask: vi.fn(async () => undefined),
        collectResponses: vi.fn(() => []),
        ...over,
    };
    return { adapter, calls };
}

const cmd = (over: Partial<RemoteCommand> & { id: string }): RemoteCommand & { id: string } => ({
    text: 'hello',
    timestamp: {} as never,
    status: 'pending',
    createdAt: {} as never,
    executionTarget: 'studio',
    ...over,
});

function makeDeps(relay: ReturnType<typeof makeRelay>, adapter: StudioExecutionAdapter, over: Partial<ExecutorCoreDeps> = {}): ExecutorCoreDeps {
    const diagnostics: Array<{ stage: string; details?: Record<string, unknown> }> = [];
    return {
        relay: relay.relay,
        lease: { claim: vi.fn(async () => true) },
        adapter,
        shouldProcess: (c) => c.executionTarget !== 'cloud',
        parse: (text) => ({ kind: 'chat', text } as never),
        getUserId: () => 'uid-test-0001',
        scanPending: vi.fn(async () => []),
        writeDiagnostic: vi.fn(async (stage: string, details?: Record<string, unknown>) => {
            diagnostics.push({ stage, details });
        }),
        ...over,
    } as ExecutorCoreDeps & { diagnostics: typeof diagnostics };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('StudioExecutorCore lifecycle (G1 sweep)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-23T09:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function build(over?: Partial<ExecutorCoreDeps>) {
        const relay = makeRelay();
        const { adapter, calls } = makeAdapter();
        const deps = makeDeps(relay, adapter, over) as ExecutorCoreDeps & { diagnostics: Array<{ stage: string }> };
        const core = new StudioExecutorCore(deps);
        return { core, relay, adapter, calls, deps };
    }

    it('publishes presence immediately and on the 5s heartbeat cadence', async () => {
        const { core, relay } = build();
        core.start();

        expect(relay.relay.pushDesktopState).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 2);
        expect(relay.relay.pushDesktopState).toHaveBeenCalledTimes(3);

        const first = relay.pushes[0];
        expect(first).toMatchObject({
            online: true,
            role: 'studio',
            listenerReady: true,
            studioInstanceId: core.instanceId,
            currentModule: 'dashboard',
            sleepMode: false,
            capabilities: { agent: true, computer: true, audio: true, daw: false, ui: true },
        });
    });

    it('pushes an extra heartbeat when the host signals visibility regained', async () => {
        let fireVisibility: (() => void) | null = null;
        const subscribeVisibility = vi.fn((cb: () => void) => {
            fireVisibility = cb;
            return () => {
                fireVisibility = null;
            };
        });
        const relay = makeRelay();
        const { adapter } = makeAdapter();
        const deps = makeDeps(relay, adapter, { subscribeVisibility });
        const core = new StudioExecutorCore(deps);
        core.start();
        expect(relay.relay.pushDesktopState).toHaveBeenCalledTimes(1);
        expect(subscribeVisibility).toHaveBeenCalledTimes(1);

        fireVisibility!();
        await vi.advanceTimersByTimeAsync(0);
        expect(relay.relay.pushDesktopState.mock.calls.length).toBeGreaterThanOrEqual(2);

        await core.stop();
        expect(fireVisibility).toBeNull(); // host subscription disposed by stop()
    });

    it('stop() clears every timer, removes listeners, and releases presence exactly once', async () => {
        const { core, relay } = build();
        core.start();
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
        const pushesAtStop = relay.relay.pushDesktopState.mock.calls.length;
        expect(relay.cleaned).toContain(24); // cleanup cadence ran at start

        await core.stop();

        expect(relay.released).toEqual([core.instanceId]);
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 5);
        expect(relay.relay.pushDesktopState.mock.calls.length).toBe(pushesAtStop); // frozen

        // Releasing again is a no-op — presence was published once.
        await core.stop();
        expect(relay.released).toHaveLength(1);
    });

    it('never releases presence it never published', async () => {
        const relay = makeRelay();
        const { adapter } = makeAdapter();
        const deps = makeDeps(relay, adapter);
        // Force every publish to fail.
        relay.relay.pushDesktopState = vi.fn(async () => {
            throw new Error('functions offline');
        });
        const core = new StudioExecutorCore(deps);
        core.start();
        await vi.advanceTimersByTimeAsync(0);

        await core.stop();
        expect(relay.released).toEqual([]);
    });

    it('receipt → claim → wake → delegate → relay → complete, then sweeps backlog', async () => {
        const scanPending = vi.fn(async () => []);
        const { core, relay, adapter, calls, deps } = build({ scanPending });

        core.start();
        expect(scanPending).toHaveBeenCalled(); // startup backlog sweep

        const command = cmd({ id: 'c1', text: 'hello there' });
        await relay.emitCommand(command);

        expect(deps.lease.claim).toHaveBeenCalledWith('c1', core.instanceId);
        expect(calls.wake).toBe(1);
        expect(vi.mocked(adapter.executeCommand)).toHaveBeenCalledTimes(1);
        expect(relay.responses.some(r => r.id === 'c1' && r.text === 'ok')).toBe(true);
        expect(relay.completions).toContain('c1');
        expect(scanPending).toHaveBeenCalledTimes(2); // start + post-command sweep
    });

    it('skips cloud-owned commands before claiming anything', async () => {
        const { core, relay, adapter, deps } = build();
        core.start();

        await relay.emitCommand(cmd({ id: 'cloud-1', executionTarget: 'cloud' }));

        expect(deps.lease.claim).not.toHaveBeenCalled();
        expect(vi.mocked(adapter.executeCommand)).not.toHaveBeenCalled();
        expect(relay.completions).not.toContain('cloud-1');
        void adapter;
    });

    it('does not run a second command while one is processing; defers via busy-skip + rescan', async () => {
        // 'second' stays pending in Firestore while the lock is held; the
        // post-completion sweep is what recovers it (real claim flips status).
        const pendingInFirestore = [cmd({ id: 'second', text: 'hello' })];
        let firstReleased = false;
        const scanPending = vi.fn(async () => (firstReleased ? pendingInFirestore.splice(0) : []));
        const { core, relay, adapter } = build({ scanPending });
        let releaseFirst: (() => void) | null = null;
        vi.mocked(adapter.executeCommand).mockImplementationOnce(
            () => new Promise(resolve => {
                releaseFirst = () => resolve({ relays: [], queuedBehindActiveRun: false });
            })
        );

        core.start();
        const first = relay.emitCommand(cmd({ id: 'first', text: 'hello' }));
        const second = relay.emitCommand(cmd({ id: 'second', text: 'hello' }));
        await vi.advanceTimersByTimeAsync(0);

        expect(vi.mocked(adapter.executeCommand)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(adapter.executeCommand).mock.calls[0]![0].command.id).toBe('first');

        releaseFirst!();
        firstReleased = true;
        await first;
        await second;
        await vi.advanceTimersByTimeAsync(0);

        // The second command reaches the adapter through the post-completion sweep path.
        expect(vi.mocked(adapter.executeCommand).mock.calls.some(([c]) => c.command.id === 'second')).toBe(true);
    });

    it('watchdog keeps the lock while the agent is genuinely busy, unlocks after settle', async () => {
        let busy = true;
        let releaseRoute: (() => void) | null = null;
        const scanPending = vi.fn(async () => []);
        const { core, relay, adapter } = build({ scanPending });
        vi.mocked(adapter.isAgentBusy).mockImplementation(() => busy);
        vi.mocked(adapter.executeCommand).mockImplementationOnce(
            () => new Promise(resolve => {
                releaseRoute = () => resolve({ relays: [{ text: 'finally done' }], queuedBehindActiveRun: false });
            })
        );

        core.start();
        const done = relay.emitCommand(cmd({ id: 'slow-nav', text: 'long haul' }));
        await vi.advanceTimersByTimeAsync(PROCESSING_TIMEOUT_MS - 1_000);

        // Route still hanging inside its 120s window → untouched, unlocked never fired.
        expect(relay.completions).toEqual([]);

        // At 120s the watchdog fires; agent busy → lock extended instead of released.
        await vi.advanceTimersByTimeAsync(1_000);
        expect(relay.completions).toEqual([]);

        // Agent settles; the next 30s recheck releases the lock and sweeps.
        busy = false;
        await vi.advanceTimersByTimeAsync(30_000);

        releaseRoute!();
        await done;

        expect(relay.completions).toContain('slow-nav');
        expect(vi.mocked(adapter.isAgentBusy).mock.calls.length).toBeGreaterThan(0);
    });

    it('reports QUEUED when the chat was parked behind an active desktop run', async () => {
        const { core, relay, adapter } = build();
        // The adapter captured this outcome while the prior run was active.
        // By the time Core receives it, the live busy flag may already be false.
        vi.mocked(adapter.isAgentBusy).mockReturnValue(false);
        vi.mocked(adapter.executeCommand).mockResolvedValue({ relays: [], queuedBehindActiveRun: true });

        core.start();
        await relay.emitCommand(cmd({ id: 'q1', text: 'hello' }));

        const final = relay.responses.filter(r => r.id === 'q1' && !r.isStreaming);
        expect(final).toHaveLength(1);
        expect(final[0]!.text).toContain('Queued');
        expect(relay.completions).toContain('q1');
        expect(adapter.isAgentBusy).not.toHaveBeenCalled();
    });

    it('relays every boardroom reply oldest-first and falls back to Done. only when free with zero output', async () => {
        const { core, relay, adapter } = build();
        core.start();

        vi.mocked(adapter.executeCommand).mockResolvedValueOnce({
            relays: [
                { text: 'conductor view', agentId: 'generalist', boardroomMessageId: 'bm-1' },
                { text: 'finance view', agentId: 'finance', boardroomMessageId: 'bm-2' },
            ],
            queuedBehindActiveRun: false,
        });
        await relay.emitCommand(cmd({ id: 'board-1', text: 'discuss' }));

        const finals = relay.responses.filter(r => r.id === 'board-1');
        expect(finals.map(r => r.text)).toEqual(['conductor view', 'finance view']);
        expect(finals[1]!.agentId).toBe('finance');

        vi.mocked(adapter.executeCommand).mockResolvedValueOnce({ relays: [], queuedBehindActiveRun: false });
        await relay.emitCommand(cmd({ id: 'silent', text: 'nothing' }));
        expect(relay.responses.filter(r => r.id === 'silent').map(r => r.text)).toEqual(['Done.']);

        // Contract sanity: the decider itself.
        expect(shouldReportQueuedChatToRemote(false, true)).toBe(true);
    });

    it('answers route throws with an honest error response and still completes', async () => {
        const { core, relay, adapter } = build();
        vi.mocked(adapter.executeCommand).mockRejectedValueOnce(new Error('Vertex exploded'));

        core.start();
        await relay.emitCommand(cmd({ id: 'boom', text: 'generate something' }));

        expect(relay.responses.some(r => r.id === 'boom' && r.text.includes('Vertex exploded'))).toBe(true);
        expect(relay.completions).toContain('boom');
    });

    it('rejected commands answer with a warning, never reach the adapter', async () => {
        const { core, relay, adapter, deps } = build({
            parse: () => ({ kind: 'rejected', reason: 'disallowed payload' }) as never,
        });

        core.start();
        await relay.emitCommand(cmd({ id: 'bad', text: 'junk' }));

        expect(relay.responses.some(r => r.id === 'bad' && r.text.includes('could not be handled'))).toBe(true);
        expect(vi.mocked(adapter.executeCommand)).not.toHaveBeenCalled();
        void deps;
    });

    it('dispatch tasks: atomic claim, wake, execution receipt, loud failure', async () => {
        const relayOk = makeRelay();
        const okAdapter = makeAdapter().adapter;
        const okDeps = makeDeps(relayOk, okAdapter);
        const okCore = new StudioExecutorCore(okDeps);
        okCore.start();

        await relayOk.emitDispatch({ id: 't1', type: 'voice_memo', payload: {}, status: 'pending', createdAt: {} as never });
        expect(okAdapter.wakeStudio).toHaveBeenCalled();
        expect(relayOk.dispatchClaims).toEqual(['t1']);
        expect(relayOk.dispatchStatuses.find(s => s.id === 't1')?.status).toBeUndefined(); // adapter wrote receipt itself
        await okCore.stop();

        // Failure path: adapter throws → task fails loudly with EXECUTION_ERROR.
        const relayBad = makeRelay();
        const badAdapter = makeAdapter({
            executeDispatchTask: vi.fn(async () => {
                throw new Error('lease missing');
            }),
        }).adapter;
        const badCore = new StudioExecutorCore(makeDeps(relayBad, badAdapter));
        badCore.start();

        await relayBad.emitDispatch({ id: 't2', type: 'computer_task', payload: { goal: 'x' }, status: 'pending', createdAt: {} as never });
        expect(relayBad.dispatchStatuses.find(s => s.id === 't2')).toMatchObject({
            status: 'failed',
            error: { code: 'EXECUTION_ERROR', message: 'lease missing' },
        });
        await badCore.stop();
    });

    it('restart recovery: stop→start re-arms heartbeat and rescans the backlog', async () => {
        const backlog = [cmd({ id: 'backlog-1', text: 'queued earlier' })];
        const scanPending = vi.fn(async () => backlog.splice(0));
        const { core, relay, adapter } = build({ scanPending });

        core.start();
        await core.stop();
        const releasesAfterFirstStop = relay.released.length;

        core.start();
        await vi.advanceTimersByTimeAsync(0);

        expect(core.isRunning).toBe(true);
        expect(relay.released.length).toBe(releasesAfterFirstStop);
        // Backlog command from before the restart executed after the fresh start.
        expect(vi.mocked(adapter.executeCommand).mock.calls.some(([c]) => c.command.id === 'backlog-1')).toBe(true);
    });

    it('releases the processing lock after an unclaimed command', async () => {
        const lease = { claim: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true) };
        const { core, relay, adapter } = build({ lease });

        core.start();
        await relay.emitCommand(cmd({ id: 'stolen', text: 'hi' }));
        await relay.emitCommand(cmd({ id: 'next', text: 'still works' }));

        expect(lease.claim).toHaveBeenCalledTimes(2);
        expect(vi.mocked(adapter.executeCommand)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(adapter.executeCommand).mock.calls[0]![0].command.id).toBe('next');
        expect(relay.completions).not.toContain('stolen');
        expect(relay.completions).toContain('next');
    });

    it('releases the processing lock after a lease claim error', async () => {
        const lease = {
            claim: vi.fn().mockRejectedValueOnce(new Error('lease offline')).mockResolvedValueOnce(true),
        };
        const { core, relay, adapter } = build({ lease });

        core.start();
        await relay.emitCommand(cmd({ id: 'retry-later', text: 'hi' }));
        await relay.emitCommand(cmd({ id: 'next', text: 'still works' }));

        expect(lease.claim).toHaveBeenCalledTimes(2);
        expect(vi.mocked(adapter.executeCommand)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(adapter.executeCommand).mock.calls[0]![0].command.id).toBe('next');
        expect(relay.completions).toContain('next');
    });

    it('instance ids satisfy the server-side device schema', () => {
        const { core } = build();
        expect(core.instanceId).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
        expect(new StudioExecutorCore(build().deps).instanceId).not.toBe(core.instanceId);
    });
});
