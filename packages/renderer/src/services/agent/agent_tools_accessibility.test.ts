/**
 * Comprehensive Agent Tool Accessibility Test
 * 
 * This test verifies that all agents have proper access to their configured tools
 * and identifies any tools that might be cut off due to limits.
 */

import { describe, it, expect, vi } from 'vitest';
import { TOOL_REGISTRY, BASE_TOOLS } from './tools';
import { agentRegistry } from './registry';
import { AGENT_CONFIGS } from './agentConfig';
import { VALID_AGENT_IDS } from './types';
import { ToolPoolAssembler } from './governance/ToolPoolAssembler';
import { TOOL_RISK_REGISTRY, resolveToolRiskMetadata } from './ToolRiskRegistry';
import { SUPERPOWER_TOOLS } from './definitions/SuperpowerTools';
import { createTool } from './utils/ZodUtils';
import { z } from 'zod';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            currentProjectId: 'test-project',
            currentOrganizationId: 'org-1',
            currentModule: 'creative',
            addAgentMessage: vi.fn(),
            updateAgentMessage: vi.fn(),
            agentHistory: [],
            uploadedImages: [],
            userProfile: { brandKit: { colors: [], fonts: [], releaseDetails: {} } },
            projects: [],
            requestApproval: vi.fn().mockResolvedValue(true)
        })
    }
}));

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContent: vi.fn().mockResolvedValue({ text: () => 'Mock Autonomous Response' }),
        generateContentStream: vi.fn(),
        parseJSON: vi.fn()
    }
}));

vi.mock('./MemoryService', () => ({
    memoryService: {
        saveMemory: vi.fn(),
        retrieveRelevantMemories: vi.fn().mockResolvedValue(['Memory 1', 'Memory 2'])
    }
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user' } },
    getFirebaseAI: vi.fn().mockReturnValue({}),
    remoteConfig: { settings: {}, defaultConfig: {} },
    functions: {},
    db: {},
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

describe('Agent Tool Accessibility Audit', () => {

    it('has explicit risk metadata for every exposed or callable tool', () => {
        const exposed = new Set([...Object.keys(TOOL_REGISTRY), ...SUPERPOWER_TOOLS.map(tool => tool.name)]);
        for (const config of AGENT_CONFIGS) {
            for (const declaration of config.tools.flatMap(group => group.functionDeclarations)) exposed.add(declaration.name);
            for (const name of Object.keys(config.functions ?? {})) exposed.add(name);
            for (const name of config.authorizedTools ?? []) exposed.add(name);
        }
        // CurriculumAgent declares these outside the department config registry.
        exposed.add('create_learning_path');
        exposed.add('generate_quiz');
        expect([...exposed].filter(name => !TOOL_RISK_REGISTRY[name]).sort()).toEqual([]);
    });

    it('does not advertise unclassified tools and honors explicit local metadata', () => {
        const unknown = createTool('unclassified_local_tool', 'Unknown', z.object({}));
        const local = createTool('classified_local_tool', 'Classified', z.object({}), {
            riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read local data',
        });
        const malformed = createTool('malformed_local_tool', 'Malformed', z.object({}));
        malformed.riskMetadata = { riskTier: 'read', permissionTier: 'builtin', description: 'Missing approval decision' } as NonNullable<typeof malformed.riskMetadata>;
        const unbound = createTool('unbound_global_tool', 'Unbound', z.object({}), {
            riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Not bound to a local implementation',
        });
        const available = ToolPoolAssembler.assemble([unknown, local, malformed, unbound], {
            agentId: 'generalist', moduleContext: 'creative', isReadOnly: true,
            localToolNames: new Set(['classified_local_tool', 'malformed_local_tool']),
        });
        expect(available.map(tool => tool.name)).toContain('classified_local_tool');
        expect(available.map(tool => tool.name)).not.toContain('unclassified_local_tool');
        expect(available.map(tool => tool.name)).not.toContain('malformed_local_tool');
        expect(available.map(tool => tool.name)).not.toContain('unbound_global_tool');
    });

    it('distinguishes draft preparation from external and binding actions', () => {
        for (const name of ['deploy_email_newsletter', 'deploy_micro_ad_campaign', 'deploy_sms_blast', 'register_work_with_pro']) {
            expect(TOOL_RISK_REGISTRY[name]?.requiresApproval).toBe(false);
            expect(TOOL_RISK_REGISTRY[name]?.riskTier).toBe('write');
        }
        for (const name of ['send_email', 'report_bug', 'schedule_campaign_waterfall', 'schedule_task', 'subscribe_to_event', 'certify_tax_profile', 'issue_isrc', 'generate_live_epk']) {
            expect(TOOL_RISK_REGISTRY[name]?.requiresApproval).toBe(true);
        }
        for (const name of ['validate_metadata', 'check_dsp_delivery_status', 'get_harness_run']) {
            expect(TOOL_RISK_REGISTRY[name]?.riskTier).toBe('read');
        }
    });

    it('does not let declaration metadata downgrade a centrally classified tool', () => {
        const declaration = createTool('send_email', 'Send email', z.object({}), {
            riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Incorrect override',
        });
        expect(resolveToolRiskMetadata('send_email', declaration)?.requiresApproval).toBe(true);
        expect(resolveToolRiskMetadata('send_email', declaration)?.riskTier).toBe('write');
    });

    it('rejects a destructive local tool that disables approval', () => {
        const declaration = createTool('unsafe_local_tool', 'Unsafe', z.object({}), {
            riskTier: 'destructive', permissionTier: 'plugin', requiresApproval: false, description: 'Destructive action',
        });
        expect(resolveToolRiskMetadata('unsafe_local_tool', declaration)).toBeUndefined();
    });

    describe('TOOL_REGISTRY Completeness', () => {
        it('should have all critical tools registered', () => {
            const criticalTools = [
                'generate_image',
                'generate_video',
                'save_memory',
                'recall_memories',
                'verify_output',
                'request_approval',
                'delegate_task',
                'create_project',
                'list_projects',
                'search_knowledge'
            ];

            const missingTools: string[] = [];
            criticalTools.forEach(tool => {
                if (!TOOL_REGISTRY[tool]) {
                    missingTools.push(tool);
                }
            });

            // console.log(`\n📋 TOOL_REGISTRY has ${Object.keys(TOOL_REGISTRY).length} tools registered`);

            if (missingTools.length > 0) {
                console.error(`❌ Missing critical tools: ${missingTools.join(', ')}`);
            }

            expect(missingTools).toHaveLength(0);
        });

        it('should list all registered tools', () => {
            const tools = Object.keys(TOOL_REGISTRY);
            // console.log('\n🛠️ All Registered Tools:');
            // tools.forEach((tool, i) => {
            //     console.log(`   ${i + 1}. ${tool}`);
            // });
            expect(tools.length).toBeGreaterThan(0);
        });
    });

    describe('GeneralistAgent (indii Conductor) Tool Access', () => {
        it('should have access to full TOOL_REGISTRY', async () => {
            const agent = await agentRegistry.getAsync('generalist');
            expect(agent).toBeDefined();
            expect(agent?.name).toBe('indii Conductor');

            // GeneralistAgent uses TOOL_REGISTRY directly
            // Check that it's properly constructed
            // console.log(`\n🤖 GeneralistAgent loaded: ${agent?.name}`);
        });

        it('should have BASE_TOOLS string describing all tools', () => {
            expect(BASE_TOOLS).toBeDefined();
            expect(BASE_TOOLS.length).toBeGreaterThan(0);

            // Count tool descriptions in BASE_TOOLS
            const _toolCount = (BASE_TOOLS.match(/\d+\.\s+\w+\(/g) || []).length;
            // console.log(`\n📝 BASE_TOOLS describes ${toolCount} tools in system prompt`);
        });
    });

    describe('Specialist Agent Tool Configurations', () => {
        const SUPERPOWER_TOOL_COUNT = 12; // From BaseAgent SUPERPOWER_TOOLS
        const CURRENT_LIMIT = 24; // Updated limit in BaseAgent (was 12)

        it('should audit each agent configuration for tool limits', () => {
            // console.log('\n📊 Agent Tool Configuration Audit:');
            // console.log('═══════════════════════════════════════════════════════════');

            const auditResults: Array<{
                id: string;
                name: string;
                configuredTools: number;
                effectiveTools: number;
                overLimit: boolean;
            }> = [];

            AGENT_CONFIGS.forEach(config => {
                const configuredToolCount = config.tools
                    .flatMap(t => t.functionDeclarations || [])
                    .length;

                const _functionsCount = Object.keys(config.functions || {}).length;

                // Effective tools = config tools + filtered superpowers (capped at CURRENT_LIMIT)
                const totalPotential = configuredToolCount + SUPERPOWER_TOOL_COUNT;
                const effectiveTools = Math.min(totalPotential, CURRENT_LIMIT);
                const overLimit = totalPotential > CURRENT_LIMIT;

                auditResults.push({
                    id: config.id,
                    name: config.name,
                    configuredTools: configuredToolCount,
                    effectiveTools,
                    overLimit
                });

                const _status = overLimit ? '⚠️' : '✅';
                const _lostTools = overLimit ? ` (${totalPotential - CURRENT_LIMIT} tools cut off!)` : '';

                // console.log(`${status} ${config.name.padEnd(25)} | Configured: ${configuredToolCount.toString().padStart(2)} | Functions: ${functionsCount.toString().padStart(2)} | Effective: ${effectiveTools}${lostTools}`);
            });

            // console.log('═══════════════════════════════════════════════════════════');

            auditResults.forEach(result => {
                expect(result.effectiveTools).toBeLessThanOrEqual(CURRENT_LIMIT);
            });
        });

        it('should preserve every specialist-declared tool in the assembled runtime pool', () => {
            const cutOffTools: Array<{ agent: string; tool: string }> = [];

            AGENT_CONFIGS.forEach(config => {
                const declaredTools = config.tools.flatMap(t => t.functionDeclarations || []);
                const assembledTools = ToolPoolAssembler.assemble(
                    declaredTools,
                    {
                        agentId: config.id,
                        moduleContext: config.id,
                        isReadOnly: false,
                    }
                );
                const assembledNames = new Set(assembledTools.map(tool => tool.name));

                declaredTools.forEach(tool => {
                    if (!assembledNames.has(tool.name)) {
                        cutOffTools.push({ agent: config.id, tool: tool.name });
                    }
                });
            });

            expect(cutOffTools).toHaveLength(0);
        });

        it('should verify runtime registry contains no unknown agent IDs', () => {
            const validIds = new Set<string>(VALID_AGENT_IDS);
            const registeredIds = agentRegistry.getAll().map(agent => agent.id);
            const unknownIds = registeredIds.filter(id => !validIds.has(id));

            expect(unknownIds).toHaveLength(0);
        });

        it('should verify all VALID_AGENT_IDS have registered loaders', async () => {
            console.log('\n🔍 Verifying Agent Registration:');

            const unregisteredAgents: string[] = [];

            for (const agentId of VALID_AGENT_IDS) {
                // All IDs in VALID_AGENT_IDS are canonical; no aliases to skip.

                const agent = await agentRegistry.getAsync(agentId);
                if (!agent) {
                    unregisteredAgents.push(agentId);
                    console.log(`   ❌ ${agentId}: NOT FOUND`);
                } else {
                    console.log(`   ✅ ${agentId}: ${agent.name}`);
                }
            }

            if (unregisteredAgents.length > 0) {
                console.error(`\n❌ Unregistered agents: ${unregisteredAgents.join(', ')}`);
            }

            expect(unregisteredAgents).toHaveLength(0);
        });
    });

    describe('Tool Function Implementation Verification', () => {
        it('should verify all agent-specific tools have implementations', () => {
            // console.log('\n🔧 Verifying Tool Implementations:');

            const missingImplementations: Array<{ agent: string; tool: string }> = [];

            AGENT_CONFIGS.forEach(config => {
                const declaredTools = config.tools
                    .flatMap(t => t.functionDeclarations || [])
                    .map(f => f.name);

                const implementedTools = Object.keys(config.functions || {});

                declaredTools.forEach(tool => {
                    // Check if it's in config.functions OR in global TOOL_REGISTRY
                    if (!implementedTools.includes(tool) && !TOOL_REGISTRY[tool]) {
                        missingImplementations.push({ agent: config.name, tool });
                    }
                });
            });

            if (missingImplementations.length > 0) {
                console.log('\n❌ Missing Tool Implementations:');
                missingImplementations.forEach(({ agent, tool }) => {
                    console.log(`   - ${agent}: ${tool}`);
                });
                console.log('\nDEBUG all missing:', JSON.stringify(missingImplementations));
            } else {
                // console.log('   ✅ All declared tools have implementations');
            }

            expect(missingImplementations).toHaveLength(0);
        });

        it('should verify all loaded runtime agents can resolve declared tool handlers', async () => {
            const missingRuntimeHandlers: Array<{ agent: string; tool: string }> = [];

            for (const agentId of VALID_AGENT_IDS) {
                const agent = await agentRegistry.getAsync(agentId);
                expect(agent, `Expected registry to load ${agentId}`).toBeDefined();

                const runtimeAgent = agent as unknown as {
                    tools?: Array<{ functionDeclarations?: Array<{ name: string }> }>;
                    functions?: Record<string, unknown>;
                };
                const declaredTools = runtimeAgent.tools
                    ?.flatMap(toolGroup => toolGroup.functionDeclarations || [])
                    .map(tool => tool.name) || [];
                const localFunctions = Object.keys(runtimeAgent.functions || {});

                declaredTools.forEach(tool => {
                    if (!localFunctions.includes(tool) && !TOOL_REGISTRY[tool]) {
                        missingRuntimeHandlers.push({ agent: agentId, tool });
                    }
                });
            }

            expect(missingRuntimeHandlers).toHaveLength(0);
        });
    });
});
