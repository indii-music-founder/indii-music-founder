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
    // R5 — gemini-2.5-pro base (100 examples) — 2026-03-25
    'generalist':      'projects/223837784072/locations/us-central1/endpoints/6477549004426051584',

    // === DEPARTMENTS ===
    // R5 — gemini-2.5-flash base (100 examples) — 2026-03-25
    'finance':         'projects/223837784072/locations/us-central1/endpoints/969646660151934976',
    // R5 — gemini-2.5-flash base (100 examples) — 2026-03-25
    'legal':           'projects/223837784072/locations/us-central1/endpoints/5559518367884247040',
    // R5 — gemini-2.5-flash base (100 examples) — 2026-03-25
    'distribution':    'projects/223837784072/locations/us-central1/endpoints/4660346554782056448',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'marketing':       'projects/223837784072/locations/us-central1/endpoints/4428411173972475904',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'social':          'projects/223837784072/locations/us-central1/endpoints/2635978522279018496',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'publishing':      'projects/223837784072/locations/us-central1/endpoints/649891086608629760',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'licensing':       'projects/223837784072/locations/us-central1/endpoints/3386953760143048704',

    // === SPECIALISTS ===
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'brand':           'projects/223837784072/locations/us-central1/endpoints/8196798162174738432',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'road':            'projects/223837784072/locations/us-central1/endpoints/5522222933470085120',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'publicist':       'projects/223837784072/locations/us-central1/endpoints/3759626629307957248',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'music':           'projects/223837784072/locations/us-central1/endpoints/1381726026056335360',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'video':           'projects/223837784072/locations/us-central1/endpoints/7846080341193261056',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'devops':          'projects/223837784072/locations/us-central1/endpoints/953884061456138240',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'security':        'projects/223837784072/locations/us-central1/endpoints/7299455936421167104',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'producer':        'projects/223837784072/locations/us-central1/endpoints/8499102287161982976',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'director':        'projects/223837784072/locations/us-central1/endpoints/7103549352630550528',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'screenwriter':    'projects/223837784072/locations/us-central1/endpoints/1505012065855602688',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'merchandise':     'projects/223837784072/locations/us-central1/endpoints/2194625758796709888',
    // R5 — gemini-2.5-flash-lite base (100 examples) — 2026-03-25
    'curriculum':      'projects/223837784072/locations/us-central1/endpoints/482694950442500096',

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
