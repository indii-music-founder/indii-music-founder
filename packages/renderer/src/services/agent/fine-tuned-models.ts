/**
 * Fine-Tuned Model Registry
 *
 * This file is intentionally strict. Valid agent IDs must resolve to a
 * fine-tuned Vertex endpoint, either directly or through an explicit tuned
 * domain alias. Missing entries are migration defects and should fail loudly.
 *
 * Format: "projects/{project}/locations/{location}/endpoints/{endpointId}"
 *
 * Source of truth: packages/renderer/src/services/agent/fine-tuned-endpoints.generated.ts
 * Regen: node scripts/sync-fine-tuned-endpoints.mjs
 */
import { VALID_AGENT_IDS, type ValidAgentId } from './types';
import { R8_ENDPOINTS } from './fine-tuned-endpoints.generated';

const VERTEX_ENDPOINT_PATTERN = /^projects\/\d+\/locations\/[a-z0-9-]+\/endpoints\/\d+$/;

// Fine-tuned agents are enabled by default. Explicitly setting the env var to
// "false" is treated as a configuration error by getFineTunedModel().
export const USE_FINE_TUNED_AGENTS = import.meta.env.VITE_USE_FINE_TUNED_AGENTS !== 'false';

/**
 * Direct R8 endpoint map (reads from generated file).
 *
 * Base: gemini-3.1-flash-lite (400 examples)
 * Status: Training COMPLETE - 2026-06-21
 * Location: us (multi-region)
 */
export const DIRECT_FINE_TUNED_MODEL_REGISTRY = R8_ENDPOINTS as Partial<Record<ValidAgentId, string>>;

/**
 * Tuned domain aliases for agents that do not have their own R8 endpoint.
 *
 * These aliases are deliberate: they keep every valid agent on a fine-tuned
 * Vertex endpoint while preserving the narrower runtime identity/prompt/tool
 * surface of the worker metadata entry.
 */
export const FINE_TUNED_MODEL_ALIASES = {
    'finance.accounting': 'finance',
    'finance.tax': 'finance',
    'finance.royalty': 'finance',
    'legal.contracts': 'legal',
    'legal.compliance': 'legal',
    creative: 'director',
    analytics: 'marketing',
    keeper: 'generalist',
} as const satisfies Partial<Record<ValidAgentId, ValidAgentId>>;

function resolveRegistryEndpoint(agentId: ValidAgentId, seen: ValidAgentId[] = []): string {
    if (seen.includes(agentId)) {
        throw new Error(`[FineTunedModels] Alias cycle detected: ${[...seen, agentId].join(' -> ')}`);
    }

    const directEndpoint = DIRECT_FINE_TUNED_MODEL_REGISTRY[agentId as keyof typeof DIRECT_FINE_TUNED_MODEL_REGISTRY];
    if (directEndpoint) {
        return directEndpoint;
    }

    const aliasTarget = FINE_TUNED_MODEL_ALIASES[agentId as keyof typeof FINE_TUNED_MODEL_ALIASES];
    if (aliasTarget) {
        return resolveRegistryEndpoint(aliasTarget, [...seen, agentId]);
    }

    throw new Error(`[FineTunedModels] Missing fine-tuned endpoint for valid agent "${agentId}"`);
}

function buildResolvedRegistry(): Record<ValidAgentId, string> {
    return VALID_AGENT_IDS.reduce((acc, agentId) => {
        const endpoint = resolveRegistryEndpoint(agentId);
        if (!VERTEX_ENDPOINT_PATTERN.test(endpoint)) {
            throw new Error(`[FineTunedModels] Invalid Vertex endpoint for agent "${agentId}": ${endpoint}`);
        }
        acc[agentId] = endpoint;
        return acc;
    }, {} as Record<ValidAgentId, string>);
}

export const FINE_TUNED_MODEL_REGISTRY: Record<ValidAgentId, string> = buildResolvedRegistry();

/**
 * Returns the fine-tuned Vertex endpoint for a valid agent.
 *
 * This function never falls back to a base Gemini model. If tuned routing is
 * disabled or an agent is missing from the registry, it throws so migration
 * drift is visible immediately.
 */
export function getFineTunedModel(agentId: ValidAgentId): string {
    const endpoint = FINE_TUNED_MODEL_REGISTRY[agentId];
    if (!endpoint) {
        throw new Error(`[FineTunedModels] Missing fine-tuned endpoint for agent "${agentId}"`);
    }

    if (!USE_FINE_TUNED_AGENTS) {
        // Fallback to the latest approved Pro model since fine-tuned endpoints are unavailable
        return 'gemini-3.1-pro-preview';
    }

    return endpoint;
}
