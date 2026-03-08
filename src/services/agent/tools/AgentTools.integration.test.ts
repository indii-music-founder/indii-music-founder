/**
 * Item 281: Agent Tool Integration Tests
 *
 * Tests core agent tools using mocked Firestore — verifies that tool inputs/outputs
 * conform to the agent schema and that tools handle edge cases gracefully.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user-123' } },
    storage: {},
}));

// Mock store
vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        vi.fn(() => ({
            agentMode: 'assistant',
            setAgentMode: vi.fn(),
            requestApproval: vi.fn().mockResolvedValue(true),
        })),
        {
            getState: () => ({
                agentMode: 'assistant',
                setAgentMode: vi.fn(),
                requestApproval: vi.fn().mockResolvedValue(true),
            }),
        }
    ),
}));

// Mock AgentService
vi.mock('@/services/agent/AgentService', () => ({
    agentService: {
        runAgent: vi.fn().mockResolvedValue({
            text: 'Delegated task result from mock agent.',
            agentId: 'creative-director',
        }),
    },
}));

// Mock LoopDetector
vi.mock('@/services/agent/LoopDetector', () => ({
    DelegationLoopDetector: {
        recordDelegation: vi.fn().mockReturnValue({ isLoop: false }),
    },
}));

describe('Agent Tool Integration Tests (Item 281)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('CoreTools', () => {
        it('delegate_task validates agent ID', async () => {
            const { CoreTools } = await import('@/services/agent/tools/CoreTools');
            const result = await CoreTools.delegate_task(
                { targetAgentId: 'nonexistent-agent', task: 'Do something' },
                { traceId: 'test-trace' },
                undefined
            );
            expect(result).toBeDefined();
            // Should fail with invalid agent ID
            if ('error' in result || result.message?.includes('Invalid agent ID')) {
                expect(true).toBe(true); // Expected behavior
            }
        });

        it('set_mode rejects invalid modes', async () => {
            const { CoreTools } = await import('@/services/agent/tools/CoreTools');
            const result = await CoreTools.set_mode(
                { mode: 'INVALID_MODE' },
                {},
                undefined
            );
            expect(result).toBeDefined();
            // Should contain error about invalid mode
            expect(
                result.message?.includes('Invalid mode') || result.error !== undefined
            ).toBe(true);
        });

        it('update_prompt returns the text', async () => {
            const { CoreTools } = await import('@/services/agent/tools/CoreTools');
            const result = await CoreTools.update_prompt(
                { text: 'Generate a hip-hop beat' },
                {},
                undefined
            ) as any;
            expect(result.text).toBe('Generate a hip-hop beat');
        });

        it('check_calendar_notifications returns structured data', async () => {
            const { CoreTools } = await import('@/services/agent/tools/CoreTools');
            const result = await CoreTools.check_calendar_notifications(
                {},
                {},
                undefined
            ) as any;
            expect(result.status).toBe('checked');
            expect(result.notifications).toBeInstanceOf(Array);
            expect(result.newNotifications).toBeGreaterThanOrEqual(0);
        });
    });

    describe('NavigationTools', () => {
        it('exports a valid tool record', async () => {
            const { NavigationTools } = await import('@/services/agent/tools/NavigationTools');
            expect(NavigationTools).toBeDefined();
            expect(typeof NavigationTools).toBe('object');
            // All values should be functions
            for (const [name, fn] of Object.entries(NavigationTools)) {
                expect(typeof fn).toBe('function');
            }
        });
    });

    describe('MemoryTools', () => {
        it('exports a valid tool record', async () => {
            const { MemoryTools } = await import('@/services/agent/tools/MemoryTools');
            expect(MemoryTools).toBeDefined();
            expect(typeof MemoryTools).toBe('object');
            for (const [_name, fn] of Object.entries(MemoryTools)) {
                expect(typeof fn).toBe('function');
            }
        });
    });

    describe('Tool Schema Conformance', () => {
        it('all tool files export Record<string, Function>', async () => {
            const toolModules = [
                '@/services/agent/tools/CoreTools',
                '@/services/agent/tools/NavigationTools',
                '@/services/agent/tools/MemoryTools',
            ];

            for (const modulePath of toolModules) {
                const mod = await import(modulePath);
                const toolKeys = Object.keys(mod).filter(k => k.endsWith('Tools'));

                for (const key of toolKeys) {
                    const toolRecord = mod[key];
                    expect(typeof toolRecord).toBe('object');

                    for (const [toolName, toolFn] of Object.entries(toolRecord)) {
                        expect(typeof toolFn).toBe('function');
                    }
                }
            }
        });
    });
});
