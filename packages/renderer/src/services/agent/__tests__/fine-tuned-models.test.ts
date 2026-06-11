/**
 * Fine-Tuned Model Registry — Unit Tests
 *
 * Verifies that the fine-tuned model registry strictly resolves tuned
 * endpoints for every valid agent and refuses base-model downgrade.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VALID_AGENT_IDS } from '../types';

// We need to test with different feature flag values, so we mock import.meta.env
describe('Fine-Tuned Model Registry', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should fail loudly when the tuned-agent flag is explicitly disabled', async () => {
        vi.stubEnv('VITE_USE_FINE_TUNED_AGENTS', 'false');
        const { getFineTunedModel } = await import('../fine-tuned-models');

        expect(() => getFineTunedModel('generalist')).toThrow('VITE_USE_FINE_TUNED_AGENTS=false');
    });

    it('should return endpoint strings for every valid agent when feature flag is enabled', async () => {
        vi.stubEnv('VITE_USE_FINE_TUNED_AGENTS', 'true');
        const { getFineTunedModel, FINE_TUNED_MODEL_REGISTRY } = await import('../fine-tuned-models');

        expect(Object.keys(FINE_TUNED_MODEL_REGISTRY).sort()).toEqual([...VALID_AGENT_IDS].sort());

        for (const agentId of VALID_AGENT_IDS) {
            const endpoint = getFineTunedModel(agentId);
            expect(endpoint, `Missing tuned endpoint for ${agentId}`).toContain('projects/');
            expect(endpoint).toContain('/endpoints/');
        }

        const generalistEndpoint = getFineTunedModel('generalist');
        const financeEndpoint = getFineTunedModel('finance');
        expect(generalistEndpoint).toContain('projects/');
        expect(financeEndpoint).toContain('projects/');
    });

    it('should have all endpoint strings in the correct Vertex Autonomous format', async () => {
        vi.stubEnv('VITE_USE_FINE_TUNED_AGENTS', 'true');
        const { FINE_TUNED_MODEL_REGISTRY } = await import('../fine-tuned-models');

        const endpointPattern = /^projects\/\d+\/locations\/[a-z0-9-]+\/endpoints\/\d+$/;

        for (const [agentId, endpoint] of Object.entries(FINE_TUNED_MODEL_REGISTRY)) {
            expect(endpoint, `Invalid endpoint format for agent '${agentId}': ${endpoint}`)
                .toMatch(endpointPattern);
        }
    });

    it('should cover all canonical agent IDs', async () => {
        const { FINE_TUNED_MODEL_REGISTRY } = await import('../fine-tuned-models');

        for (const agentId of VALID_AGENT_IDS) {
            expect(FINE_TUNED_MODEL_REGISTRY).toHaveProperty(agentId);
        }
    });
});
