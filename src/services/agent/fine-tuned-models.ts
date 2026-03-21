/**
 * Fine-Tuned Model Registry
 *
 * Maps each agent ID to its domain-specific fine-tuned Vertex AI endpoint.
 * When `VITE_USE_FINE_TUNED_AGENTS=true`, BaseAgent will prefer these
 * endpoints over the default `AI_MODELS.TEXT.AGENT` base model.
 *
 * HOW TO UPDATE:
 * 1. Run `gcloud ai models list --region=us-central1 --project=<project>`
 * 2. Copy the tuned model endpoint (e.g. "projects/<id>/locations/us-central1/endpoints/<id>")
 * 3. Replace the placeholder string below
 * 4. Set VITE_USE_FINE_TUNED_AGENTS=true in .env
 */

import type { ValidAgentId } from './types';

// Feature flag: only use fine-tuned endpoints when explicitly enabled
export const USE_FINE_TUNED_AGENTS = import.meta.env.VITE_USE_FINE_TUNED_AGENTS === 'true';

/**
 * Registry mapping agent IDs to their fine-tuned Vertex AI model endpoints.
 * Entries set to `undefined` will fall back to the base model.
 *
 * Format: "projects/{project}/locations/{location}/publishers/google/models/{tunedModelId}"
 * Or simply: "tunedModels/{tunedModelName}" for Gemini API tuned models
 */
export const FINE_TUNED_MODEL_REGISTRY: Partial<Record<ValidAgentId, string>> = {
    // === MANAGER'S OFFICE ===
    // R3 — gemini-2.5-pro base (40 train / 10 eval)
    'generalist':       'projects/223837784072/locations/us-central1/endpoints/3273097132063588352',
    // R3 — gemini-2.5-flash-lite base (24 train / 6 eval)
    'brand':            'projects/223837784072/locations/us-central1/endpoints/552922957131808768',
    // R3 — gemini-2.5-flash-lite base (37 train / 9 eval)
    'road':             'projects/223837784072/locations/us-central1/endpoints/2167463423544131584',
    // R3 — gemini-2.5-flash-lite base (39 train / 9 eval)
    'publicist':        'projects/223837784072/locations/us-central1/endpoints/8605359090870255616',

    // === DEPARTMENTS ===
    // R3 — gemini-2.5-flash-lite base (40 train / 10 eval)
    'marketing':        'projects/223837784072/locations/us-central1/endpoints/3714449895545896960',
    // R3 — gemini-2.5-flash-lite base (40 train / 10 eval)
    'social':           'projects/223837784072/locations/us-central1/endpoints/1591002671240708096',
    // R3 — gemini-2.5-flash base (48 train / 11 eval)
    'legal':            'projects/223837784072/locations/us-central1/endpoints/3818032686975418368',
    // R3 — gemini-2.5-flash-lite base (41 train / 10 eval)
    'publishing':       'projects/223837784072/locations/us-central1/endpoints/733629892180049920',
    // R3 — gemini-2.5-flash base (52 train / 13 eval)
    'finance':          'projects/223837784072/locations/us-central1/endpoints/7038106420545323008',
    // R3 — gemini-2.5-flash-lite base (36 train / 8 eval)
    'licensing':        'projects/223837784072/locations/us-central1/endpoints/5887436715752161280',

    // === SPECIALISTS ===
    // R3 — gemini-2.5-flash base (41 train / 10 eval)
    'distribution':     'projects/223837784072/locations/us-central1/endpoints/5397670256275619840',
    // R3 — gemini-2.5-flash-lite base (36 train / 8 eval)
    'music':            'projects/223837784072/locations/us-central1/endpoints/8319380514532229120',
    // R3 — gemini-2.5-flash-lite base (36 train / 8 eval)
    'video':            'projects/223837784072/locations/us-central1/endpoints/3047917150695063552',
    // R3 — gemini-2.5-flash-lite base (36 train / 9 eval)
    'devops':           'projects/223837784072/locations/us-central1/endpoints/1305587044856102912',
    // R3 — gemini-2.5-flash-lite base (41 train / 10 eval)
    'security':         'projects/223837784072/locations/us-central1/endpoints/4909592646659342336',
    // R3 — gemini-2.5-flash-lite base (38 train / 9 eval)
    'producer':         'projects/223837784072/locations/us-central1/endpoints/4861178950665109504',
    // R3 — gemini-2.5-flash-lite base (40 train / 9 eval)
    'director':         'projects/223837784072/locations/us-central1/endpoints/8871071468885114880',
    // R3 — gemini-2.5-flash-lite base (36 train / 9 eval)
    'screenwriter':     'projects/223837784072/locations/us-central1/endpoints/22061151055511552',
    // R3 — gemini-2.5-flash-lite base (40 train / 10 eval)
    'merchandise':      'projects/223837784072/locations/us-central1/endpoints/329994775576969216',
    // R3 — gemini-2.5-flash-lite base (36 train / 9 eval)
    'curriculum':       'projects/223837784072/locations/us-central1/endpoints/2544076942382989312',
    // Not included in R3 tuning batch
    'keeper':           undefined,
};

/**
 * Get the fine-tuned model endpoint for an agent, or undefined to use base model.
 * Returns `undefined` when:
 * - Feature flag is disabled
 * - Agent has no fine-tuned endpoint registered
 * - Endpoint is set to undefined (not yet available)
 */
export function getFineTunedModel(agentId: ValidAgentId): string | undefined {
    if (!USE_FINE_TUNED_AGENTS) return undefined;
    return FINE_TUNED_MODEL_REGISTRY[agentId];
}
