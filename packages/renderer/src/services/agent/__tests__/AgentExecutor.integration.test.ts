import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Unmock firebase/ai to actually hit the real API in this integration test
vi.unmock('firebase/ai');
vi.unmock('@/services/firebase');

import { AgentExecutor } from '../components/AgentExecutor';
import { agentRegistry } from '../registry';

// Integration Tests for AgentExecutor
// This ensures that the executor can load real agents from the registry,
// handle traces, and execute swarm logic correctly.

describe('AgentExecutor (Integration)', () => {
    let executor: AgentExecutor;


    beforeAll(() => {
        executor = new AgentExecutor(agentRegistry);
    });

    afterAll(() => {
    });

    it('should successfully load an existing agent from the real registry', async () => {
        // We assume 'generalist' or a similar core agent exists in the registry
        const agentId = 'generalist';
        const agent = await agentRegistry.getAsync(agentId);
        
        expect(agent).toBeDefined();
        expect(agent?.id).toBe(agentId);
    }, 30000);

    it('should throw an error when executing an unknown agent', async () => {
        const fakeAgentId = 'this-agent-does-not-exist-12345';
        
        const context: any = {
            activeModule: 'test'
        };

        await expect(
            executor.execute(fakeAgentId, 'Hello', context)
        ).rejects.toThrow(/Fatal: No agent found for ID/);
    });

    it('should execute a basic prompt through the generalist agent if credentials exist', async () => {
        // Skip in CI environment to avoid flaky external network timeouts and API rate limits
        if (process.env.CI || process.env.GITHUB_ACTIONS) {
            console.warn('Skipping AgentExecutor real execution test in CI environment.');
            return;
        }

        // Skip if no API key is provided, as real execution requires it.
        if (!process.env.VITE_API_KEY && !process.env.GEMINI_API_KEY) {
            console.warn('Skipping AgentExecutor real execution test: No API keys found.');
            return;
        }

        // Skip if API endpoint is unreachable (offline/sandboxed environment)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            await fetch('https://generativelanguage.googleapis.com/', {
                method: 'HEAD',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (_e) {
            console.warn('Skipping AgentExecutor real execution test: API endpoint unreachable.');
            return;
        }

        const agentId = 'generalist';
        const context: any = {
            activeModule: 'test',
            projectHandle: { name: 'IntegrationTestProject' }
        };

        const onProgress = (_event: any) => {
            // Optional: log or assert on streaming progress
        };

        try {
            const response = await executor.execute(agentId, 'Return the exact word "IntegrationSuccess". Nothing else.', context, onProgress);
            
            expect(response).toBeDefined();
            
            // GeneralistAgent catches fatal errors and returns them in response.error instead of throwing
            if (response.error) {
                console.warn('Execution returned an error response, possibly due to quota/auth:', response.error);
                if (!response.error.includes('quota') && !response.error.includes('403') && !response.error.includes('429') && !response.error.includes('endpoint unavailable') && !response.error.includes('API Key Invalid')) {
                    throw new Error(`Unexpected error returned by agent: ${response.error}`);
                }
            } else {
                expect(response.text).toContain('IntegrationSuccess');
            }
            
            expect(context.traceId).toBeDefined();
            expect(context.swarmId).toBeDefined();
        } catch (e: any) {
            // If it fails due to auth/quota (which are common in CI for real models),
            // we catch and log but don't fail the whole suite if it's an API error.
            console.warn('Execution threw an error, possibly due to quota/auth:', e.message);
            // We only rethrow if it's a structural error in our code.
            if (!e.message.includes('quota') && !e.message.includes('403') && !e.message.includes('429') && !e.message.includes('endpoint unavailable') && !e.message.includes('API Key Invalid')) {
                throw e;
            }
        }
    }, 30000); // 30s timeout for real LLM call
});
