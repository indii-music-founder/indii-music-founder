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
    // R4 — gemini-2.5-pro base (80 train / 20 eval) — 2026-03-24
    'generalist':       'projects/223837784072/locations/us-central1/endpoints/1872196172974653440',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'brand':            'projects/223837784072/locations/us-central1/endpoints/1331764217690193920',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'road':             'projects/223837784072/locations/us-central1/endpoints/5032597211481899008',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'publicist':        'projects/223837784072/locations/us-central1/endpoints/3987762097931943936',

    // === DEPARTMENTS ===
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'marketing':        'projects/223837784072/locations/us-central1/endpoints/7487059008398819328',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'social':           'projects/223837784072/locations/us-central1/endpoints/2736887301429788672',
    // R3 — gemini-2.5-flash base — R4 endpoint pending deployment
    'legal':            'projects/223837784072/locations/us-central1/endpoints/3818032686975418368',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'publishing':       'projects/223837784072/locations/us-central1/endpoints/398393194917658624',
    // R4 — gemini-2.5-flash base (80 train / 20 eval) — 2026-03-24
    'finance':          'projects/223837784072/locations/us-central1/endpoints/4577733649117478912',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'licensing':        'projects/223837784072/locations/us-central1/endpoints/483961587837698048',

    // === SPECIALISTS ===
    // R3 — gemini-2.5-flash base — R4 endpoint pending deployment
    'distribution':     'projects/223837784072/locations/us-central1/endpoints/5397670256275619840',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'music':            'projects/223837784072/locations/us-central1/endpoints/5042730310643482624',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'video':            'projects/223837784072/locations/us-central1/endpoints/6181015116461375488',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'devops':           'projects/223837784072/locations/us-central1/endpoints/5609057963785322496',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'security':         'projects/223837784072/locations/us-central1/endpoints/6084187724472909824',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'producer':         'projects/223837784072/locations/us-central1/endpoints/5086640407010344960',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'director':         'projects/223837784072/locations/us-central1/endpoints/1060422340141121536',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'screenwriter':     'projects/223837784072/locations/us-central1/endpoints/7982454967409573888',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'merchandise':      'projects/223837784072/locations/us-central1/endpoints/286929104140238848',
    // R4 — gemini-2.5-flash-lite base (80 train / 20 eval) — 2026-03-24
    'curriculum':       'projects/223837784072/locations/us-central1/endpoints/7527591405045153792',
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
