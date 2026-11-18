import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const wiringMocks = vi.hoisted(() => ({
    uid: 'user-1' as string | null,
    e2eMock: false,
    commandHandler: null as ((cmd: Record<string, unknown>) => Promise<void> | void) | null,
    pushDesktopState: vi.fn(async () => undefined),
    releaseStudioPresence: vi.fn(async () => undefined),
    cleanupOld: vi.fn(async () => 0),
    claimCommand: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => false),
    setDoc: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
    getDocs: vi.fn<(...args: unknown[]) => Promise<{ docs: unknown[] }>>(async () => ({ docs: [] })),
    executeCommand: vi.fn(async () => ({ relays: [], queuedBehindActiveRun: false })),
    executeDispatchTask: vi.fn(async () => undefined),
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        get currentUser() {
            return wiringMocks.uid ? { uid: wiringMocks.uid } : null;
        },
    },
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({ path: 'users/user-1/remote-relay/diagnostics' })),
    setDoc: (...args: unknown[]) => wiringMocks.setDoc(...args),
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
    collection: vi.fn(() => ({ path: 'users/user-1/remote-relay-commands' })),
    getDocs: (...args: unknown[]) => wiringMocks.getDocs(...args),
    query: vi.fn((...args: unknown[]) => args),
    where: vi.fn((...args: unknown[]) => args),
}));

vi.mock('@/utils/authGuards', () => ({
    getRealAuthenticatedUserId: vi.fn(() => wiringMocks.uid),
}));

vi.mock('@/utils/e2eMode', () => ({
    isFirebaseE2EMockEnabled: vi.fn(() => wiringMocks.e2eMock),
}));

vi.mock('@/services/agent/RemoteRelayService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/services/agent/RemoteRelayService')>();
    return {
        ...actual,
        remoteRelayService: {
            onCommand: vi.fn((cb: (cmd: Record<string, unknown>) => Promise<void> | void) => {
                wiringMocks.commandHandler = cb;
                return () => {
                    wiringMocks.commandHandler = null;
                };
            }),
            onDispatchTask: vi.fn(() => () => undefined),
            sendResponse: vi.fn(async () => undefined),
            markCommandCompleted: vi.fn(async () => undefined),
            claimDispatchTask: vi.fn(async () => false),
            updateDispatchTaskStatus: vi.fn(async () => undefined),
            pushDesktopState: wiringMocks.pushDesktopState,
            releaseStudioPresence: wiringMocks.releaseStudioPresence,
            cleanupOld: wiringMocks.cleanupOld,
        },
    };
});

vi.mock('@/services/agent/StudioExecutorLeaseService', () => ({
    studioExecutorLeaseService: {
        claimCommand: wiringMocks.claimCommand,
    },
}));

vi.mock('../rendererExecutionAdapter', () => ({
    createRendererExecutionAdapter: () => ({
        wakeStudio: vi.fn(),
        isAgentBusy: () => false,
        presenceSnapshot: () => ({
            currentModule: 'dashboard',
            isAgentProcessing: false,
            activeSessionId: 'sess-1',
            pendingApproval: null,
            sleepMode: false,
            capabilities: { agent: true, computer: true, audio: true, daw: false, ui: true },
        }),
        executeCommand: wiringMocks.executeCommand,
        executeDispatchTask: wiringMocks.executeDispatchTask,
        collectResponses: () => [],
    }),
}));

import { createDefaultStudioExecutorCore } from '../studioExecutorCore.wiring';

describe('studioExecutorCore.wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        wiringMocks.uid = 'user-1';
        wiringMocks.e2eMock = false;
        wiringMocks.commandHandler = null;
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'visible',
        });
    });

    afterEach(() => {
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'visible',
        });
    });

    it('pushes presence on visible visibilitychange only while running and cleans up listener on stop()', async () => {
        const core = createDefaultStudioExecutorCore();
        core.start();

        await vi.waitFor(() => {
            expect(wiringMocks.pushDesktopState).toHaveBeenCalledTimes(1);
        });

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'hidden',
        });
        document.dispatchEvent(new Event('visibilitychange'));
        expect(wiringMocks.pushDesktopState).toHaveBeenCalledTimes(1);

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.waitFor(() => {
            expect(wiringMocks.pushDesktopState).toHaveBeenCalledTimes(2);
        });

        await core.stop();
        document.dispatchEvent(new Event('visibilitychange'));
        expect(wiringMocks.pushDesktopState).toHaveBeenCalledTimes(2);
    });

    it('routes studio-targeted and legacy studio commands to lease claim while ignoring cloud commands', async () => {
        const core = createDefaultStudioExecutorCore();
        core.start();

        await wiringMocks.commandHandler?.({ id: 'cmd-cloud', text: 'Hi', executionTarget: 'cloud' });
        expect(wiringMocks.claimCommand).not.toHaveBeenCalled();

        await wiringMocks.commandHandler?.({ id: 'cmd-legacy', text: '[GENERATE_IMAGE] neon cover' });
        expect(wiringMocks.claimCommand).toHaveBeenCalledWith('cmd-legacy', core.instanceId);

        await wiringMocks.commandHandler?.({ id: 'cmd-studio', text: 'Plan tour', executionTarget: 'studio' });
        expect(wiringMocks.claimCommand).toHaveBeenCalledWith('cmd-studio', core.instanceId);

        await core.stop();
    });

    it('no-ops diagnostic writes when unauthenticated or when Firebase E2E mock mode is active', async () => {
        wiringMocks.uid = null;
        const unauthCore = createDefaultStudioExecutorCore();
        unauthCore.start();
        expect(wiringMocks.setDoc).not.toHaveBeenCalled();
        await unauthCore.stop();

        wiringMocks.uid = 'user-1';
        wiringMocks.e2eMock = true;
        const e2eCore = createDefaultStudioExecutorCore();
        e2eCore.start();
        expect(wiringMocks.setDoc).not.toHaveBeenCalled();
        await e2eCore.stop();
    });
});
