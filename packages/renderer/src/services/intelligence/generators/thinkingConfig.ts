import { MODEL_THINKING_LEVELS } from '@/core/config/model-thinking';

/** Keep disabled thinking compatible with the provider after caller options merge. */
export function normalizeDisabledThinkingConfig<T extends object>(config: T): T {
    const thinkingConfig = (config as { thinkingConfig?: unknown }).thinkingConfig;
    if (!thinkingConfig || typeof thinkingConfig !== 'object' || Array.isArray(thinkingConfig)
        || !('thinkingBudget' in thinkingConfig) || thinkingConfig.thinkingBudget !== 0) {
        return config;
    }

    return {
        ...config,
        thinkingConfig: { ...thinkingConfig, includeThoughts: false },
    };
}

/** Gemini 4 models accept reviewed levels, not legacy budgets or MINIMAL. */
export function resolveModelThinkingConfig(model: string, value: unknown): unknown {
    const supportedLevels = Object.prototype.hasOwnProperty.call(MODEL_THINKING_LEVELS, model)
        ? MODEL_THINKING_LEVELS[model] : undefined;
    if (!supportedLevels) return model.includes('gemini-3') ? value : undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const { thinkingBudget, thinkingLevel, ...preferences } = value as Record<string, unknown>;
    const level = typeof thinkingLevel === 'string' ? thinkingLevel.toUpperCase() : undefined;
    if (thinkingLevel !== undefined && (level === undefined ||
        (!supportedLevels.includes(level) && level !== 'MINIMAL'))) {
        throw new Error(`Unsupported thinking level for ${model}; use ${supportedLevels.join(', ')}.`);
    }
    // Preserve an explicit supported level. LOW is the closest supported choice
    // for disabled/minimal thinking; other legacy budgets use the model's default.
    const supportedLevel = level !== undefined && supportedLevels.includes(level)
        ? level : level === 'MINIMAL' || thinkingBudget === 0 ? 'LOW' : undefined;
    return { ...preferences, ...(supportedLevel ? { thinkingLevel: supportedLevel } : {}) };
}
