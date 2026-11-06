import { MODEL_PRICING } from '@/core/config/intelligence-models';

/** Conservative admission estimate; the server remains the cost authority. */
export function estimateAgentStreamCost(
    prompt: unknown,
    systemInstruction: string | undefined,
    tools: unknown,
    model: string,
    maxOutputTokens: unknown,
): number {
    // Mirror the backend's serialized contents envelope. A raw string is
    // wrapped as one user content before submission; pricing the raw string
    // alone can round one cent-microstep below the server's admission floor.
    const contents = typeof prompt === 'string'
        ? [{ role: 'user', parts: [{ text: prompt }] }]
        : prompt;
    const serialized = JSON.stringify({ contents, systemInstruction, tools });
    if (typeof serialized !== 'string') throw new Error('Cannot estimate an unserializable AI request');
    // Registered models use explicit admission rates, including Argon. Endpoint
    // and unknown IDs retain the existing backend-compatible baseline; this is
    // not a universal upper bound for new models, which need explicit entries.
    const known = MODEL_PRICING[model as keyof typeof MODEL_PRICING];
    const inputRate = known && 'input' in known ? known.input : 1.25;
    const outputRate = known && 'output' in known ? known.output : 10;
    const outputLimit = typeof maxOutputTokens === 'number' && Number.isFinite(maxOutputTokens)
        ? Math.min(8_192, Math.max(1, Math.ceil(maxOutputTokens)))
        : 8_192;
    const estimatedInputTokens = Math.ceil(serialized.length / 4);
    const estimate = (estimatedInputTokens * inputRate + outputLimit * outputRate) / 1_000_000;
    return Math.max(0.001, Math.ceil(estimate * 100_000) / 100_000);
}
