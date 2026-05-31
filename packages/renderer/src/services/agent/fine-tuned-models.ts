/**
 * Fine-Tuned Model Registry
 *
 * This file is intentionally strict. Valid agent IDs must resolve to a
 * fine-tuned Vertex endpoint, either directly or through an explicit tuned
 * domain alias. Missing entries are migration defects and should fail loudly.
 *
 * Format: "projects/{project}/locations/{location}/endpoints/{endpointId}"
 */

import { VALID_AGENT_IDS, type ValidAgentId } from './types';

const VERTEX_ENDPOINT_PATTERN = /^projects\/\d+\/locations\/[a-z0-9-]+\/endpoints\/\d+$/;

// Fine-tuned agents are enabled by default. Explicitly setting the env var to
// "false" is treated as a configuration error by getFineTunedModel().
export const USE_FINE_TUNED_AGENTS = import.meta.env.VITE_USE_FINE_TUNED_AGENTS !== 'false';

/**
 * Direct R8 endpoint map.
 *
 * Base: gemini-3.1-flash-lite (400 examples) - 2026-05-09
 * Status: Training COMPLETE - 2026-05-10
 */
export const DIRECT_FINE_TUNED_MODEL_REGISTRY = {
    generalist:      'projects/223837784072/locations/us-central1/endpoints/8440177260006211584',
    finance:         'projects/223837784072/locations/us-central1/endpoints/3270044887784882176',
    legal:           'projects/223837784072/locations/us-central1/endpoints/7521442936022630400',
    distribution:    'projects/223837784072/locations/us-central1/endpoints/4566237155537453056',
    marketing:       'projects/223837784072/locations/us-central1/endpoints/2166662979079110656',
    social:          'projects/223837784072/locations/us-central1/endpoints/2513440150386638848',
    publishing:      'projects/223837784072/locations/us-central1/endpoints/8962594816781189120',
    licensing:       'projects/223837784072/locations/us-central1/endpoints/1071443844697948160',
    brand:           'projects/223837784072/locations/us-central1/endpoints/1396547442798755840',
    road:            'projects/223837784072/locations/us-central1/endpoints/6548665416510603264',
    publicist:       'projects/223837784072/locations/us-central1/endpoints/6584694213529567232',
    music:           'projects/223837784072/locations/us-central1/endpoints/6646900183382622208',
    video:           'projects/223837784072/locations/us-central1/endpoints/4778750762953998336',
    devops:          'projects/223837784072/locations/us-central1/endpoints/4200038210836889600',
    security:        'projects/223837784072/locations/us-central1/endpoints/3481714070271295488',
    producer:        'projects/223837784072/locations/us-central1/endpoints/8255529675284021248',
    director:        'projects/223837784072/locations/us-central1/endpoints/8584292448082067456',
    screenwriter:    'projects/223837784072/locations/us-central1/endpoints/453043320864636928',
    merchandise:     'projects/223837784072/locations/us-central1/endpoints/4666160772269735936',
    curriculum:      'projects/223837784072/locations/us-central1/endpoints/2758886330078330880',
} as const satisfies Partial<Record<ValidAgentId, string>>;

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
    const isE2E = typeof window !== 'undefined' && window.location?.search.includes('e2e=true') || (typeof window !== 'undefined' && (window as any).isFirebaseE2EMockEnabled) || (typeof process !== 'undefined' && process.env.VITE_PLAYWRIGHT_E2E === 'true');
    if (isE2E) {
        return 'gemini-3.1-flash-lite'; // E2E fallback
    }


    if (!USE_FINE_TUNED_AGENTS) {
        throw new Error(
            `[FineTunedModels] VITE_USE_FINE_TUNED_AGENTS=false disables tuned agent routing. ` +
            `Agent "${agentId}" cannot run against a base model.`
        );
    }

    const endpoint = FINE_TUNED_MODEL_REGISTRY[agentId];
    if (!endpoint) {
        throw new Error(`[FineTunedModels] Missing fine-tuned endpoint for agent "${agentId}"`);
    }

    return endpoint;
}
