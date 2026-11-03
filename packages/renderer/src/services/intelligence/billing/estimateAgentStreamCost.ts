import { MODEL_PRICING } from '@/core/config/intelligence-models';

/** Conservative admission estimate; the server remains the cost authority. */
export function estimateAgentStreamCost(
    prompt: unknown,
    systemInstruction: string | undefined,
    tools: unknown,
    model: string,
    maxOutputTokens: unknown,
): number {
    const serialized = JSON.stringify({ prompt, systemInstruction, tools });
    if (typeof serialized !== 'string') throw new Error('Cannot estimate an unserializable AI request');
    // Fine-tuned endpoint IDs use their base model's rate. Unknown text models
    // use the highest declared text rate instead of a zero-cost fallback.
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
