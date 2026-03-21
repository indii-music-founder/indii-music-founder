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
    'generalist':       undefined, // indii Conductor (hub orchestrator)
    'brand':            undefined, // Brand Agent
    'road':             undefined, // Road Manager
    'publicist':        undefined, // Publicist

    // === DEPARTMENTS ===
    'marketing':        undefined, // Marketing Agent
    'social':           undefined, // Social Media Agent
    'legal':            undefined, // Legal Agent
    'publishing':       undefined, // Publishing Agent
    'finance':          undefined, // Finance Agent
    'licensing':        undefined, // Licensing Agent

    // === SPECIALISTS ===
    'distribution':     undefined, // Distribution Agent
    'music':            undefined, // Music Agent
    'video':            undefined, // Video Agent
    'devops':           undefined, // DevOps Agent
    'security':         undefined, // Security Agent
    'producer':         undefined, // Producer
    'director':         undefined, // Director
    'screenwriter':     undefined, // Screenwriter
    'merchandise':      undefined, // Merchandise Agent
    'curriculum':       undefined, // Music Education Specialist
    'keeper':           undefined, // Context Integrity Guardian
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
