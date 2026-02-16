
import { APPROVED_MODELS, MODEL_PRICING, AI_CONFIG, getModelKey } from '@/core/config/ai-models';
import { logger } from '@/utils/logger';
import { remoteConfig } from '@/services/firebase';
import { getValue } from 'firebase/remote-config';
import { RemoteAIConfigSchema } from '@/services/ai/config/RemoteAIConfig';

export interface CostEstimate {
    model: string;
    estimatedCostUsd: number;
    estimatedCredits: number;
    unit: 'tokens' | 'seconds' | 'generation';
    details: string;
}

export class CostPredictor {
    private static CREDIT_MULTIPLIER = 1000; // Example: $1.00 = 1000 credits

    /**
     * Predict cost for text generation
     */
    static predictTextCost(prompt: string, expectedOutputTokens = 500, model = APPROVED_MODELS.TEXT_FAST): CostEstimate {
        const pricing = this.getPricing(model);
        if (!pricing || !('input' in pricing)) {
            return this.getUnknownEstimate(model);
        }

        // Estimate input tokens (rough heuristic: 4 chars per token)
        const inputTokens = Math.ceil(prompt.length / 4);
        const totalTokens = inputTokens + expectedOutputTokens;

        const costUsd = ((inputTokens * pricing.input) / 1000000) + ((expectedOutputTokens * pricing.output) / 1000000);

        return {
            model,
            estimatedCostUsd: costUsd,
            estimatedCredits: Math.ceil(costUsd * this.CREDIT_MULTIPLIER),
            unit: 'tokens',
            details: `Based on ~${inputTokens} input and ${expectedOutputTokens} planned output tokens.`
        };
    }

    /**
     * Predict cost for image generation
     */
    static predictImageCost(count = 1, model = APPROVED_MODELS.IMAGE_GEN): CostEstimate {
        const pricing = this.getPricing(model);
        if (!pricing || !('perGeneration' in pricing)) {
            return this.getUnknownEstimate(model);
        }

        const costUsd = pricing.perGeneration * count;

        return {
            model,
            estimatedCostUsd: costUsd,
            estimatedCredits: Math.ceil(costUsd * this.CREDIT_MULTIPLIER),
            unit: 'generation',
            details: `Calculated for ${count} static image generation(s).`
        };
    }

    /**
     * Predict cost for video generation (Veo 3.1)
     */
    static predictVideoCost(durationSeconds: number = AI_CONFIG.VIDEO.DEFAULT_DURATION_SECONDS, model = APPROVED_MODELS.VIDEO_GEN): CostEstimate {
        const pricing = this.getPricing(model);
        if (!pricing || !('perSecond' in pricing)) {
            return this.getUnknownEstimate(model);
        }

        const costUsd = pricing.perSecond * durationSeconds;

        return {
            model,
            estimatedCostUsd: parseFloat(costUsd.toFixed(4)),
            estimatedCredits: Math.ceil(costUsd * this.CREDIT_MULTIPLIER),
            unit: 'seconds',
            details: `Based on ${durationSeconds}s at $${pricing.perSecond}/s for premium video synthesis.`
        };
    }

    private static getUnknownEstimate(model: string): CostEstimate {
        return {
            model,
            estimatedCostUsd: 0,
            estimatedCredits: 0,
            unit: 'generation',
            details: 'Price data unavailable for this model.'
        };
    }

    /**
     * Get pricing configuration for a model, checking Remote Config first
     */
    private static getPricing(modelId: string): any {
        // 1. Check Remote Config
        try {
            const configStr = getValue(remoteConfig, 'ai_system_config').asString();
            if (configStr) {
                const parsed = JSON.parse(configStr);
                const validated = RemoteAIConfigSchema.safeParse(parsed);

                if (validated.success) {
                    const dynamicConfig = validated.data;

                    // Logic A: Direct override
                    if (dynamicConfig.pricing[modelId]) {
                        return dynamicConfig.pricing[modelId];
                    }

                    // Logic B: Key override
                    const key = getModelKey(modelId);
                    if (key && dynamicConfig.overrides[key]) {
                        const overrideId = dynamicConfig.overrides[key];
                        if (dynamicConfig.pricing[overrideId]) {
                            return dynamicConfig.pricing[overrideId];
                        }
                    }
                }
            }
        } catch (e) {
            // Ignore
        }

        // 2. Fallback to static pricing
        return MODEL_PRICING[modelId as keyof typeof MODEL_PRICING];
    }
}
