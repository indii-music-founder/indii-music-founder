import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from './BaseAgent';
import { createTool } from './utils/ZodUtils';
import { z } from 'zod';
import { AgentConfig } from './types';
import { importWithRetry } from '@/utils/dynamicImport';

const canonicalComputerClick = vi.hoisted(() => vi.fn());
vi.mock('@/services/agent/tools', () => ({ TOOL_REGISTRY: { computer_click: canonicalComputerClick } }));

// Mock dependencies
vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContent: vi.fn(),
        generateContentStream: vi.fn(),
        generateSpeech: vi.fn()
    }
}));

vi.mock('firebase/app', () => ({
    serverTimestamp: vi.fn(),
    initializeApp: vi.fn(),
    getApp: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
    serverTimestamp: vi.fn(),
    Timestamp: {
        now: () => ({
            serverTimestamp: vi.fn(), toMillis: () => Date.now(), toDate: () => new Date()
        })
    },
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    initializeFirestore: vi.fn(),
    persistentLocalCache: vi.fn(),
    persistentMultipleTabManager: vi.fn(),
    collection: vi.fn()
}));

// Mock MembershipService
vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true, remainingBudget: 10, requiresApproval: false }),
        recordSpend: vi.fn()
    }
}));

// ISSUE-1116: ToolApprovalService is dynamically-import-free here (statically imported by
// BaseAgent.ts), so it must be mocked directly.
const mockCreatePendingApproval = vi.fn().mockResolvedValue('approval-123');
vi.mock('./governance/ToolApprovalService', () => ({
    toolApprovalService: {
        createPendingApproval: (...args: unknown[]) => mockCreatePendingApproval(...args)
    }
}));

// ISSUE-1172: ArtistOperatingProfileService is statically imported by BaseAgent.ts for the
// computer_* autonomous-control gate — must be mocked directly, same reasoning as above.
// Defaults to opted-IN so pre-existing tests (none of which use computer_* tools) are unaffected;
// the dedicated describe block below overrides this per-test to prove both gate states.
const mockGetAopProfile = vi.fn().mockResolvedValue({
    schemaVersion: 'artist-operating-profile.v1',
    businessGoals: [],
    creativeBoundaries: [],
    installedSoftware: [],
    connectedServiceIds: [],
    permissions: { autonomousComputerControl: true, allowDestructiveTools: false, preApprovedToolNames: [] }
});
vi.mock('./governance/ArtistOperatingProfileService', () => ({
    artistOperatingProfileService: {
        getProfile: () => mockGetAopProfile()
    }
}));

describe('BaseAgent Tool Validation', () => {
    let agent: BaseAgent;
    const testToolSchema = z.object({
        requiredString: z.string(),
        positiveNumber: z.number().positive()
    });

    const testToolHandler = vi.fn().mockResolvedValue({ success: true, data: 'ok' });

    beforeEach(async () => {
        vi.clearAllMocks();

        const config: AgentConfig = {
            id: 'generalist',
            name: 'Test Agent',
            description: 'Test',
            color: '#fff',
            category: 'specialist',
            systemPrompt: 'sys prompt',
            tools: [
                {
                    functionDeclarations: [
                        createTool(
                            'test_tool',
                            'A test tool',
                            testToolSchema
                        )
                    ]
                }
            ],
            functions: {
                test_tool: testToolHandler
            }
        };

        agent = new BaseAgent(config);
    });

    it('should execute tool when args are valid', async () => {
        const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));

        // Setup Autonomous mock to call the tool
        vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
            response: {
                text: () => 'Calling tool...',
                functionCalls: () => [{
                    name: 'test_tool',
                    args: {
                        requiredString: 'valid',
                        positiveNumber: 10
                    }
                }]
            }
        } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

        vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
            response: {
                text: () => 'Tool execution confirmed.'
            }
        } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

        const response = await agent.execute('Task');

        expect(testToolHandler).toHaveBeenCalled();
        expect(response.text).toContain('Tool execution confirmed');
    });

    it('should block tool execution when args are invalid', async () => {
        const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));

        vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
            response: {
                text: () => 'Calling tool with invalid args...',
                functionCalls: () => [{
                    name: 'test_tool',
                    args: {
                        requiredString: 'valid',
                        positiveNumber: -5 // Invalid
                    }
                }]
            }
        } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

        vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
            response: {
                text: () => 'I see there was a validation error.'
            }
        } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

        const response = await agent.execute('Task');

        expect(testToolHandler).not.toHaveBeenCalled();
        expect(response.text).toContain('validation error');
    });

    describe('ISSUE-1116: pre-execution approval gate', () => {
        const executeCodeHandler = vi.fn().mockResolvedValue({ success: true, data: 'ran' });

        it('halts before executing a canonical computer tool and creates a pending approval', async () => {
            const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));

            const config: AgentConfig = {
                id: 'generalist',
                name: 'Test Agent',
                description: 'Test',
                color: '#fff',
                category: 'specialist',
                systemPrompt: 'sys prompt',
                tools: [{
                    functionDeclarations: [createTool('computer_click', 'Clicks the host desktop', z.object({ x: z.number(), y: z.number() }))]
                }]
            };
            const gatedAgent = new BaseAgent(config);

            vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
                response: {
                    text: () => 'Running code...',
                    functionCalls: () => [{ name: 'computer_click', args: { x: 10, y: 20 } }]
                }
            } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

            const response = await gatedAgent.execute('Run some code');

            expect(executeCodeHandler).not.toHaveBeenCalled();
            expect(mockCreatePendingApproval).toHaveBeenCalledWith(expect.objectContaining({
                toolName: 'computer_click',
                args: { x: 10, y: 20 },
                riskTier: 'destructive'
            }));
            expect(response.error).toBe('AWAITING_TOOL_APPROVAL');
            expect(response.text).toContain('requires your explicit approval');
        });

        it('rejects an agent-local override of a computer tool before approval', async () => {
            const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
            const overridden = new BaseAgent({
                id: 'generalist', name: 'Test Agent', description: 'Test', color: '#fff', category: 'specialist', systemPrompt: 'sys prompt',
                tools: [{ functionDeclarations: [createTool('computer_click', 'Clicks the host desktop', z.object({ x: z.number(), y: z.number() }))] }],
                functions: { computer_click: executeCodeHandler },
            });
            vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
                response: { text: () => 'Clicking...', functionCalls: () => [{ name: 'computer_click', args: { x: 10, y: 20 } }] }
            } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

            const response = await overridden.execute('Click something');
            expect(executeCodeHandler).not.toHaveBeenCalled();
            expect(mockCreatePendingApproval).not.toHaveBeenCalled();
            expect(response.error).toMatch(/trusted approval implementation/i);
        });

        it('binds a local approval tool and validates arguments before creating the request', async () => {
            const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
            const localTool = vi.fn().mockResolvedValue({ success: true });
            const approvedAgent = new BaseAgent({
                id: 'generalist', name: 'Test Agent', description: 'Test', color: '#fff', category: 'specialist', systemPrompt: 'sys prompt',
                tools: [{ functionDeclarations: [createTool('rotate_credentials', 'Rotates credentials', z.object({ service: z.string() }))] }],
                functions: { rotate_credentials: localTool },
            });
            vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
                response: { text: () => 'Rotate...', functionCalls: () => [{ name: 'rotate_credentials', args: { service: 'music' } }] }
            } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

            const response = await approvedAgent.execute('Rotate credentials');
            expect(response.error).toBe('AWAITING_TOOL_APPROVAL');
            const boundCall = mockCreatePendingApproval.mock.lastCall?.[0] as { execute: (args: Record<string, unknown>) => Promise<unknown> };
            expect(boundCall.execute).toBeTypeOf('function');
            expect(localTool).not.toHaveBeenCalled();
            await boundCall.execute({ service: 'music' });
            expect(localTool).toHaveBeenCalledWith({ service: 'music' }, expect.any(Object), expect.any(Object));
        });

        it('does not create an approval for invalid tool arguments', async () => {
            const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
            const localTool = vi.fn().mockResolvedValue({ success: true });
            const approvedAgent = new BaseAgent({
                id: 'generalist', name: 'Test Agent', description: 'Test', color: '#fff', category: 'specialist', systemPrompt: 'sys prompt',
                tools: [{ functionDeclarations: [createTool('rotate_credentials', 'Rotates credentials', z.object({ service: z.string() }))] }],
                functions: { rotate_credentials: localTool },
            });
            vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
                response: { text: () => 'Rotate...', functionCalls: () => [{ name: 'rotate_credentials', args: { service: 99 } }] }
            } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);
            vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
                response: { text: () => 'I need a valid service name.' }
            } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

            await approvedAgent.execute('Rotate credentials');
            expect(localTool).not.toHaveBeenCalled();
            expect(mockCreatePendingApproval).not.toHaveBeenCalled();
        });

        it('does NOT gate an unclassified custom tool (e.g. test_tool) — only explicit requiresApproval:true entries', async () => {
            const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));

            vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
                response: {
                    text: () => 'Calling tool...',
                    functionCalls: () => [{ name: 'test_tool', args: { requiredString: 'valid', positiveNumber: 1 } }]
                }
            } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);
            vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
                response: { text: () => 'Done.' }
            } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

            await agent.execute('Task');

            expect(testToolHandler).toHaveBeenCalled();
            expect(mockCreatePendingApproval).not.toHaveBeenCalled();
        });
    });

    it.each([
        'credential_vault',
        'multi_platform_autopost',
        'dispatch_community_webhook',
        'set_asset_rights',
        'scale_deployment',
        'restart_service',
        'stage_stripe_payouts',
        'blender_live_command',
        'blender_render_music_video',
    ])('requires approval before executing %s', async (toolName) => {
        const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
        const handler = vi.fn().mockResolvedValue({ success: true });
        const guardedAgent = new BaseAgent({
            id: 'generalist', name: 'Test Agent', description: 'Test', color: '#fff', category: 'specialist', systemPrompt: 'sys prompt',
            tools: [{ functionDeclarations: [createTool(toolName, 'Consequential action', z.object({ value: z.string() }))] }],
            functions: { [toolName]: handler },
        });
        vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
            response: { text: () => 'Calling tool...', functionCalls: () => [{ name: toolName, args: { value: 'test' } }] },
        } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

        await guardedAgent.execute('Perform action');

        expect(handler).not.toHaveBeenCalled();
        expect(mockCreatePendingApproval).toHaveBeenCalledOnce();
        expect(mockCreatePendingApproval.mock.calls[0][0]).toEqual(expect.objectContaining({ toolName }));
    });

    describe('ISSUE-1172: Artist Operating Profile autonomous-computer-control gate', () => {
        const buildComputerAgent = () => new BaseAgent({
            id: 'generalist',
            name: 'Test Agent',
            description: 'Test',
            color: '#fff',
            category: 'specialist',
            systemPrompt: 'sys prompt',
            tools: [{
                functionDeclarations: [createTool('computer_click', 'Clicks the desktop', z.object({ x: z.number(), y: z.number() }))]
            }]
        });

        it('blocks computer_click before even queuing an approval when AOP has not opted in', async () => {
            mockGetAopProfile.mockResolvedValueOnce({
                schemaVersion: 'artist-operating-profile.v1',
                businessGoals: [], creativeBoundaries: [], installedSoftware: [], connectedServiceIds: [],
                permissions: { autonomousComputerControl: false, allowDestructiveTools: false, preApprovedToolNames: [] }
            });
            const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
            vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
                response: {
                    text: () => 'Clicking...',
                    functionCalls: () => [{ name: 'computer_click', args: { x: 10, y: 20 } }]
                }
            } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

            const response = await buildComputerAgent().execute('Click something');

            expect(mockCreatePendingApproval).not.toHaveBeenCalled();
            expect(response.error).toBe('AUTONOMOUS_COMPUTER_CONTROL_DISABLED');
            expect(response.text).toContain('Autonomous Computer Control enabled in Settings > Automation');
        });

        it('falls through to the ISSUE-1116 approval gate once AOP has opted in', async () => {
            mockGetAopProfile.mockResolvedValueOnce({
                schemaVersion: 'artist-operating-profile.v1',
                businessGoals: [], creativeBoundaries: [], installedSoftware: [], connectedServiceIds: [],
                permissions: { autonomousComputerControl: true, allowDestructiveTools: false, preApprovedToolNames: [] }
            });
            const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
            vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
                response: {
                    text: () => 'Clicking...',
                    functionCalls: () => [{ name: 'computer_click', args: { x: 10, y: 20 } }]
                }
            } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

            const response = await buildComputerAgent().execute('Click something');

            expect(mockCreatePendingApproval).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'computer_click' }));
            expect(response.error).toBe('AWAITING_TOOL_APPROVAL');
        });
    });
});
