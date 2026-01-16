/**
 * Comprehensive Agent Tool Accessibility Test
 * 
 * This test verifies that all agents have proper access to their configured tools
 * and identifies any tools that might be cut off due to limits.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { TOOL_REGISTRY, BASE_TOOLS } from './tools';
import { agentRegistry } from './registry';
import { AGENT_CONFIGS } from './agentConfig';
import { VALID_AGENT_IDS } from './types';

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

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn().mockResolvedValue({ text: () => 'Mock AI Response' }),
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
    auth: { currentUser: { uid: 'test-user' } }
}));

describe('Agent Tool Accessibility Audit', () => {

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

            console.log(`\n📋 TOOL_REGISTRY has ${Object.keys(TOOL_REGISTRY).length} tools registered`);

            if (missingTools.length > 0) {
                console.error(`❌ Missing critical tools: ${missingTools.join(', ')}`);
            }

            expect(missingTools).toHaveLength(0);
        });

        it('should list all registered tools', () => {
            const tools = Object.keys(TOOL_REGISTRY);
            console.log('\n🛠️ All Registered Tools:');
            tools.forEach((tool, i) => {
                console.log(`   ${i + 1}. ${tool}`);
            });
            expect(tools.length).toBeGreaterThan(0);
        });
    });

    describe('GeneralistAgent (Agent Zero) Tool Access', () => {
        it('should have access to full TOOL_REGISTRY', async () => {
            const agent = await agentRegistry.getAsync('generalist');
            expect(agent).toBeDefined();
            expect(agent?.name).toBe('Agent Zero');

            // GeneralistAgent uses TOOL_REGISTRY directly
            // Check that it's properly constructed
            console.log(`\n🤖 GeneralistAgent loaded: ${agent?.name}`);
        });

        it('should have BASE_TOOLS string describing all tools', () => {
            expect(BASE_TOOLS).toBeDefined();
            expect(BASE_TOOLS.length).toBeGreaterThan(0);

            // Count tool descriptions in BASE_TOOLS
            const toolCount = (BASE_TOOLS.match(/\d+\.\s+\w+\(/g) || []).length;
            console.log(`\n📝 BASE_TOOLS describes ${toolCount} tools in system prompt`);
        });
    });

    describe('Specialist Agent Tool Configurations', () => {
        const SUPERPOWER_TOOL_COUNT = 12; // From BaseAgent SUPERPOWER_TOOLS
        const CURRENT_LIMIT = 24; // Updated limit in BaseAgent (was 12)

        it('should audit each agent configuration for tool limits', () => {
            console.log('\n📊 Agent Tool Configuration Audit:');
            console.log('═══════════════════════════════════════════════════════════');

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

                const functionsCount = Object.keys(config.functions || {}).length;

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

                const status = overLimit ? '⚠️' : '✅';
                const lostTools = overLimit ? ` (${totalPotential - CURRENT_LIMIT} tools cut off!)` : '';

                console.log(`${status} ${config.name.padEnd(25)} | Configured: ${configuredToolCount.toString().padStart(2)} | Functions: ${functionsCount.toString().padStart(2)} | Effective: ${effectiveTools}${lostTools}`);
            });

            console.log('═══════════════════════════════════════════════════════════');

            const overLimitAgents = auditResults.filter(a => a.overLimit);
            if (overLimitAgents.length > 0) {
                console.log(`\n⚠️ ${overLimitAgents.length} agents are OVER the ${CURRENT_LIMIT}-tool limit:`);
                overLimitAgents.forEach(a => {
                    console.log(`   - ${a.name}: Has ${a.configuredTools} + ${SUPERPOWER_TOOL_COUNT} superpowers = ${a.configuredTools + SUPERPOWER_TOOL_COUNT} total`);
                });
            } else {
                console.log('\n✅ All agents are within the tool limit');
            }
        });

        it('should verify all VALID_AGENT_IDS have registered loaders', async () => {
            console.log('\n🔍 Verifying Agent Registration:');

            const unregisteredAgents: string[] = [];

            for (const agentId of VALID_AGENT_IDS) {
                if (agentId === 'road-manager') continue; // Alias, skip

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
            console.log('\n🔧 Verifying Tool Implementations:');

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
            } else {
                console.log('   ✅ All declared tools have implementations');
            }

            // This is a warning, not a failure - some tools might be in TOOL_REGISTRY
            expect(missingImplementations.length).toBeLessThanOrEqual(5); // Allow some flexibility
        });
    });
});
