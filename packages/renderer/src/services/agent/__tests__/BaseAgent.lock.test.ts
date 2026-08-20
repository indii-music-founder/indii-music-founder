import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAgent } from '@/services/agent/BaseAgent';
import type { AgentResponse } from '@/services/agent/types';

// ----------------------------------------------------------------------------
// Mocks — minimal surface required to construct a BaseAgent under test
// (mirrors the scaffolding in Keeper_ContextIntegrity.repro.test.ts).
// ----------------------------------------------------------------------------

vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(),
    getApp: vi.fn(),
    getApps: vi.fn(() => [])
}));

vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({ currentUser: { uid: 'lock-test-user' } })),
    initializeAuth: vi.fn(),
    browserLocalPersistence: {},
    browserSessionPersistence: {}
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    initializeFirestore: vi.fn(),
    persistentLocalCache: vi.fn(),
    persistentMultipleTabManager: vi.fn(),
    Timestamp: { now: vi.fn(() => ({ toMillis: () => Date.now() })), fromDate: vi.fn(), fromMillis: vi.fn() },
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    collection: vi.fn()
}));

vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true }),
        trackUsage: vi.fn().mockResolvedValue(true),
        recordSpend: vi.fn().mockResolvedValue(true)
    }
}));

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContent: vi.fn().mockResolvedValue({ response: { text: () => 'ok' } }),
        getGenerativeModel: () => ({ generateContent: vi.fn() })
    }
}));

vi.mock('@/services/agent/AgentIdentityService', () => ({
    agentIdentityService: { mintIdentity: vi.fn().mockResolvedValue({ id: 'card' }) }
}));

// ----------------------------------------------------------------------------
// Test agent: overrides the protected execution body with a manually
// releasable gate so concurrency ordering is deterministic.
// ----------------------------------------------------------------------------

class LockTestAgent extends BaseAgent {
    public executions = 0;
    private gates: Array<() => void> = [];

    constructor() {
        super({
            id: 'finance',
            name: 'Lock Test',
            description: 'Deterministic lock serialization test agent',
            color: '#ffffff',
            category: 'specialist',
            systemPrompt: 'test',
            maxOutputTokens: 64,
            maxIterations: 1,
            modelId: 'models/gemini-lock-test',
            tools: [],
        });
    }

    /** Manually release the currently blocked execution (FIFO). */
    releaseNext(): void {
        this.gates.shift()?.();
    }

    protected async _executeInternal(): Promise<AgentResponse> {
        this.executions += 1;
        await new Promise<void>((resolve) => {
            this.gates.push(resolve);
        });
        return { text: `execution-${this.executions}` };
    }
}

describe('BaseAgent execution lock', () => {
    const clearLocks = () => {
        (BaseAgent as unknown as { executionLocks: Map<string, unknown> }).executionLocks.clear();
    };

    beforeEach(() => {
        vi.clearAllMocks();
        clearLocks();
    });

    afterEach(() => {
        clearLocks();
    });

    const context = { userId: 'lock-user', projectId: 'lock-project' };
    const executionCount = (agent: LockTestAgent) => agent.executions;
    const lockSize = () => (BaseAgent as unknown as { executionLocks: Map<string, unknown> }).executionLocks.size;

    it('serializes concurrent executions for the same user/project/agent key', async () => {
        const agent = new LockTestAgent();

        // All three calls arrive while the first execution is blocked.
        const first = agent.execute('task', context);
        const second = agent.execute('task', context);
        const third = agent.execute('task', context);

        // No execution may start until the first gate is released — the two
        // later callers must be queued, not running.
        await vi.waitFor(() => expect(executionCount(agent)).toBe(1));
        expect(lockSize()).toBe(1);

        agent.releaseNext();
        await vi.waitFor(() => expect(executionCount(agent)).toBe(2));

        agent.releaseNext();
        await vi.waitFor(() => expect(executionCount(agent)).toBe(3));

        agent.releaseNext();
        await Promise.all([first, second, third]);

        expect(executionCount(agent)).toBe(3);
        // The lock must be fully released once the newest execution completes.
        await vi.waitFor(() => expect(lockSize()).toBe(0));
    });

    it('releases the key only after the NEWEST chained execution completes', async () => {
        const agent = new LockTestAgent();

        const first = agent.execute('task', context);
        await vi.waitFor(() => expect(executionCount(agent)).toBe(1));

        // A chained successor registers while the first is still running.
        const second = agent.execute('task', context);

        // The first completes while the successor is queued — the key must
        // stay held (the successor is still pending behind it).
        agent.releaseNext();
        await vi.waitFor(() => expect(lockSize()).toBe(1));
        expect(executionCount(agent)).toBe(1);

        // The chained successor starts only after the first settles — wait
        // for it to actually begin, then release it.
        await vi.waitFor(() => expect(executionCount(agent)).toBe(2));
        agent.releaseNext();
        await Promise.all([first, second]);

        expect(executionCount(agent)).toBe(2);
        await vi.waitFor(() => expect(lockSize()).toBe(0));
    });

    it('lets a caller arriving between chained executions queue behind the newest, not run concurrently', async () => {
        const agent = new LockTestAgent();

        const first = agent.execute('task', context);
        await vi.waitFor(() => expect(executionCount(agent)).toBe(1));

        const second = agent.execute('task', context);
        // A NEW caller arrives while the second is already queued behind the
        // first. It must chain onto the second — never start its own run.
        const third = agent.execute('task', context);

        agent.releaseNext();
        await vi.waitFor(() => expect(executionCount(agent)).toBe(2));

        agent.releaseNext();
        await vi.waitFor(() => expect(executionCount(agent)).toBe(3));

        agent.releaseNext();
        await Promise.all([first, second, third]);
        expect(executionCount(agent)).toBe(3);
    });
});
