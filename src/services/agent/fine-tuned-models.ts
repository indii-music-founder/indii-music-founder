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
    // R6 — gemini-2.5-pro base (~132 examples, ≥50% expert) — 2026-03-26
    'generalist':      'projects/223837784072/locations/us-central1/endpoints/723919005483532288',

    // === DEPARTMENTS ===
    // R6 — gemini-2.5-flash base (~130 examples, ≥50% expert) — 2026-03-26
    'finance':         'projects/223837784072/locations/us-central1/endpoints/3831402748369174528',
    // R6 — gemini-2.5-flash base (~106 examples, ≥50% expert) — 2026-03-26
    'legal':           'projects/223837784072/locations/us-central1/endpoints/2912668424385593344',
    // R6 — gemini-2.5-flash base (~131 examples, ≥50% expert) — 2026-03-26
    'distribution':    'projects/223837784072/locations/us-central1/endpoints/3941740939239751680',
    // R6 — gemini-2.5-flash base (~110 examples, ≥50% expert) — TODO: job still running
    'marketing':       'projects/223837784072/locations/us-central1/endpoints/4428411173972475904',
    // R6 — gemini-2.5-flash-lite base (~104 examples, ≥50% expert) — 2026-03-26
    'social':          'projects/223837784072/locations/us-central1/endpoints/6535251374651736064',
    // R6 — gemini-2.5-flash base (~109 examples, ≥50% expert) — 2026-03-26
    'publishing':      'projects/223837784072/locations/us-central1/endpoints/1989430500774641664',
    // R6 — gemini-2.5-flash base (~139 examples, ≥50% expert) — 2026-03-26
    'licensing':       'projects/223837784072/locations/us-central1/endpoints/6299375344168206336',

    // === SPECIALISTS ===
    // R6 — gemini-2.5-flash-lite base (~120 examples, ≥50% expert) — 2026-03-26
    'brand':           'projects/223837784072/locations/us-central1/endpoints/628217513401909248',
    // R6 — gemini-2.5-flash-lite base (~124 examples, ≥50% expert) — 2026-03-26
    'road':            'projects/223837784072/locations/us-central1/endpoints/1199611716124540928',
    // R6 — gemini-2.5-flash-lite base (~102 examples, ≥50% expert) — TODO: job still running
    'publicist':       'projects/223837784072/locations/us-central1/endpoints/3759626629307957248',
    // R6 — gemini-2.5-flash base (~110 examples, ≥50% expert) — 2026-03-26
    'music':           'projects/223837784072/locations/us-central1/endpoints/4597014685022158848',
    // R6 — gemini-2.5-flash-lite base (~134 examples, ≥50% expert) — TODO: job still running
    'video':           'projects/223837784072/locations/us-central1/endpoints/7846080341193261056',
    // R6 — gemini-2.5-flash-lite base (~111 examples, ≥50% expert) — TODO: job still running
    'devops':          'projects/223837784072/locations/us-central1/endpoints/953884061456138240',
    // R6 — gemini-2.5-flash-lite base (~87 examples, ≥50% expert) — TODO: job still running
    'security':        'projects/223837784072/locations/us-central1/endpoints/7299455936421167104',
    // R6 — gemini-2.5-flash-lite base (~97 examples, ≥50% expert) — TODO: job still running
    'producer':        'projects/223837784072/locations/us-central1/endpoints/8499102287161982976',
    // R6 — gemini-2.5-flash-lite base (~106 examples, ≥50% expert) — 2026-03-26
    'director':        'projects/223837784072/locations/us-central1/endpoints/5461705813477294080',
    // R6 — gemini-2.5-flash-lite base (~118 examples, ≥50% expert) — TODO: job still running
    'screenwriter':    'projects/223837784072/locations/us-central1/endpoints/1505012065855602688',
    // R6 — gemini-2.5-flash-lite base (~118 examples, ≥50% expert) — TODO: job still running
    'merchandise':     'projects/223837784072/locations/us-central1/endpoints/2194625758796709888',
    // R6 — gemini-2.5-flash-lite base (~120 examples, ≥50% expert) — TODO: job still running
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
