import { z } from 'zod';
import { APPROVED_MODELS } from '@/core/config/ai-models';

/**
 * AI System Configuration Schema
 * This defines the JSON structure stored in Firebase Remote Config (key: `ai_system_config`)
 */

// Schema for pricing overrides
export const ModelPricingSchema = z.object({
    input: z.number().optional(),
    output: z.number().optional(),
    perGeneration: z.number().optional()
});

export const RemoteAIConfigSchema = z.object({
    // Map of APPROVED_MODELS keys (e.g. TEXT_AGENT) to new Model IDs
    // Example: { "TEXT_AGENT": "gemini-4-ultra" }
    overrides: z.record(
        z.enum(Object.keys(APPROVED_MODELS) as [string, ...string[]]),
        z.string()
    ).optional().default({}),

    // Map of Model IDs to pricing configuration
    // Example: { "gemini-4-ultra": { input: 2.5, output: 5.0 } }
    pricing: z.record(z.string(), ModelPricingSchema).optional().default({}),

    // Global config overrides
    config: z.object({
        video_timeout_ms: z.number().optional(),
        think_budget_multiplier: z.number().optional().default(1.0)
    }).optional().default({})
});

export type RemoteAIConfig = z.infer<typeof RemoteAIConfigSchema>;
export type ModelPricing = z.infer<typeof ModelPricingSchema>;

/**
 * Default safe configuration if Remote Config fails
 */
export const DEFAULT_REMOTE_CONFIG: RemoteAIConfig = {
    overrides: {},
    pricing: {},
    config: {
        think_budget_multiplier: 1.0
    }
};
