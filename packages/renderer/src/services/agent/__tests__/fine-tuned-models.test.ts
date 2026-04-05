/**
 * Fine-Tuned Model Registry — Unit Tests
 *
 * Verifies that the fine-tuned model registry correctly resolves
 * endpoints for agents and respects the feature flag.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test with different feature flag values, so we mock import.meta.env
describe('Fine-Tuned Model Registry', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return undefined for all agents when feature flag is disabled', async () => {
        vi.stubEnv('VITE_USE_FINE_TUNED_AGENTS', 'false');
        const { getFineTunedModel } = await import('../fine-tuned-models');

        // All agents should return undefined when flag is off
        expect(getFineTunedModel('generalist')).toBeUndefined();
        expect(getFineTunedModel('finance')).toBeUndefined();
        expect(getFineTunedModel('legal')).toBeUndefined();
        expect(getFineTunedModel('marketing')).toBeUndefined();
    });

    it('should return endpoint strings for wired agents when feature flag is enabled', async () => {
        vi.stubEnv('VITE_USE_FINE_TUNED_AGENTS', 'true');
        const { getFineTunedModel, FINE_TUNED_MODEL_REGISTRY } = await import('../fine-tuned-models');

        // Count how many agents have endpoints wired
        const wiredAgents = Object.entries(FINE_TUNED_MODEL_REGISTRY)
            .filter(([_key, value]) => value !== undefined);

        // Should have at least 17 wired from R3
        expect(wiredAgents.length).toBeGreaterThanOrEqual(17);

        // Generalist should have an endpoint (Pro tier, first to complete)
        const generalistEndpoint = getFineTunedModel('generalist');
        expect(generalistEndpoint).toBeDefined();
        expect(generalistEndpoint).toContain('projects/');
        expect(generalistEndpoint).toContain('/endpoints/');

        // Finance should have an endpoint (Flash tier)
        const financeEndpoint = getFineTunedModel('finance');
        expect(financeEndpoint).toBeDefined();
        expect(financeEndpoint).toContain('projects/');
    });

    it('should return undefined for agents without endpoints (still training)', async () => {
        vi.stubEnv('VITE_USE_FINE_TUNED_AGENTS', 'true');
        const { getFineTunedModel, FINE_TUNED_MODEL_REGISTRY } = await import('../fine-tuned-models');

        // Find agents with undefined endpoints
        const pendingAgents = Object.entries(FINE_TUNED_MODEL_REGISTRY)
            .filter(([_key, value]) => value === undefined)
            .map(([key]) => key);

        // Each pending agent should return undefined even with flag enabled
        for (const agentId of pendingAgents) {
            expect(getFineTunedModel(agentId as Parameters<typeof getFineTunedModel>[0])).toBeUndefined();
        }
    });

    it('should have all endpoint strings in the correct Vertex AI format', async () => {
        vi.stubEnv('VITE_USE_FINE_TUNED_AGENTS', 'true');
        const { FINE_TUNED_MODEL_REGISTRY } = await import('../fine-tuned-models');

        const endpointPattern = /^projects\/\d+\/locations\/[a-z0-9-]+\/endpoints\/\d+$/;

        for (const [agentId, endpoint] of Object.entries(FINE_TUNED_MODEL_REGISTRY)) {
            if (endpoint !== undefined) {
                expect(endpoint, `Invalid endpoint format for agent '${agentId}': ${endpoint}`)
                    .toMatch(endpointPattern);
            }
        }
    });

    it('should cover all main agent IDs', async () => {
        const { FINE_TUNED_MODEL_REGISTRY } = await import('../fine-tuned-models');

        const expectedAgents = [
            'generalist', 'brand', 'road', 'publicist',
            'marketing', 'social', 'legal', 'publishing',
            'finance', 'licensing', 'distribution', 'music',
            'video', 'devops', 'security', 'producer',
            'director', 'screenwriter', 'merchandise', 'curriculum',
            'keeper',
        ];

        for (const agentId of expectedAgents) {
            expect(FINE_TUNED_MODEL_REGISTRY).toHaveProperty(agentId);
        }
    });
});
