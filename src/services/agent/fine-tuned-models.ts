/**
 * Fine-Tuned Model Registry
 *
 * Maps each agent ID to its domain-specific fine-tuned Vertex AI endpoint.
 * When `VITE_USE_FINE_TUNED_AGENTS=true`, BaseAgent will prefer these
 * endpoints over the default `AI_MODELS.TEXT.AGENT` base model.
 *
 * HOW TO UPDATE:
 * 1. Run `python3 scripts/wire-r5-endpoints.py --write` after R5 jobs complete
 * 2. Set VITE_USE_FINE_TUNED_AGENTS=true in .env
 */

import type { ValidAgentId } from './types';

// Feature flag: only use fine-tuned endpoints when explicitly enabled
export const USE_FINE_TUNED_AGENTS = import.meta.env.VITE_USE_FINE_TUNED_AGENTS === 'true';

/**
 * Registry mapping agent IDs to their fine-tuned Vertex AI model endpoints.
 * Entries set to `undefined` will fall back to the base model.
 *
 * Format: "projects/{project}/locations/{location}/endpoints/{endpointId}"
 */
export const FINE_TUNED_MODEL_REGISTRY: Partial<Record<ValidAgentId, string>> = {
    // === MANAGER'S OFFICE ===
    // R7 — gemini-2.5-pro base (~132 examples, ≥60% expert) — 2026-03-27
    'generalist':    'projects/223837784072/locations/us-central1/endpoints/4735553150121934848',

    // === DEPARTMENTS ===
    // R7 — gemini-2.5-flash base (~163 examples, ≥60% expert) — 2026-03-27
    'finance':       'projects/223837784072/locations/us-central1/endpoints/6137298534141001728',
    // R7 — gemini-2.5-flash base (~133 examples, ≥60% expert) — 2026-03-27
    'legal':         'projects/223837784072/locations/us-central1/endpoints/4777774396628533248',
    // R7 — gemini-2.5-flash base (~164 examples, ≥60% expert) — 2026-03-27
    'distribution':  'projects/223837784072/locations/us-central1/endpoints/5237704508573745152',
    // R7 — gemini-2.5-flash-lite base (~139 examples, ≥60% expert) — 2026-03-27
    'marketing':     'projects/223837784072/locations/us-central1/endpoints/1319009882807992320',
    // R7 — gemini-2.5-flash-lite base (~131 examples, ≥60% expert) — 2026-03-27
    'social':        'projects/223837784072/locations/us-central1/endpoints/5771381064417148928',
    // R7 — gemini-2.5-flash-lite base (~136 examples, ≥60% expert) — 2026-03-27
    'publishing':    'projects/223837784072/locations/us-central1/endpoints/3258372472344412160',
    // R7 — gemini-2.5-flash-lite base (~140 examples, ≥60% expert) — 2026-03-27
    'licensing':     'projects/223837784072/locations/us-central1/endpoints/6679982289239146496',

    // === SPECIALISTS ===
    // R7 — gemini-2.5-flash-lite base (~119 examples, ≥60% expert) — 2026-03-27
    'brand':         'projects/223837784072/locations/us-central1/endpoints/7567191415831134208',
    // R7 — gemini-2.5-flash-lite base (~124 examples, ≥60% expert) — 2026-03-27
    'road':          'projects/223837784072/locations/us-central1/endpoints/3656378089413279744',
    // R7 — gemini-2.5-flash-lite base (~103 examples, ≥60% expert) — 2026-03-27
    'publicist':     'projects/223837784072/locations/us-central1/endpoints/2417325241932972032',
    // R7 — gemini-2.5-flash-lite base (~111 examples, ≥60% expert) — 2026-03-27
    'music':         'projects/223837784072/locations/us-central1/endpoints/1795828493355843584',
    // R7 — gemini-2.5-flash-lite base (~134 examples, ≥60% expert) — 2026-03-27
    'video':         'projects/223837784072/locations/us-central1/endpoints/8143652168134557696',
    // R7 — gemini-2.5-flash-lite base (~125 examples, ≥60% expert) — 2026-03-27
    'devops':        'projects/223837784072/locations/us-central1/endpoints/4433249025134690304',
    // R7 — gemini-2.5-flash-lite base (~88 examples, ≥60% expert) — 2026-03-27
    'security':      'projects/223837784072/locations/us-central1/endpoints/1282418135835607040',
    // R7 — gemini-2.5-flash-lite base (~97 examples, ≥60% expert) — 2026-03-27
    'producer':      'projects/223837784072/locations/us-central1/endpoints/1620188107888394240',
    // R7 — gemini-2.5-flash-lite base (~132 examples, ≥60% expert) — 2026-03-27
    'director':      'projects/223837784072/locations/us-central1/endpoints/5993183346065145856',
    // R7 — gemini-2.5-flash-lite base (~131 examples, ≥60% expert) — 2026-03-27
    'screenwriter':  'projects/223837784072/locations/us-central1/endpoints/6342775267139780608',
    // R7 — gemini-2.5-flash-lite base (~132 examples, ≥60% expert) — 2026-03-27
    'merchandise':   'projects/223837784072/locations/us-central1/endpoints/7718062003348045824',
    // R7 — gemini-2.5-flash-lite base (~120 examples, ≥60% expert) — 2026-03-27
    'curriculum':    'projects/223837784072/locations/us-central1/endpoints/8815251462566182912',

    // Not yet fine-tuned
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
