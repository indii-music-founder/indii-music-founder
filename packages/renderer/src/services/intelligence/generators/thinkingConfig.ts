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

/** Argon accepts levels, not thinkingBudget or MINIMAL (Google migration guide). */
export function resolveModelThinkingConfig(model: string, value: unknown): unknown {
    if (model !== 'gemini-4-argon') return model.includes('gemini-3') ? value : undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const { thinkingBudget, thinkingLevel, ...preferences } = value as Record<string, unknown>;
    const level = typeof thinkingLevel === 'string' ? thinkingLevel.toUpperCase() : undefined;
    // Preserve an explicit supported level. LOW is the closest supported choice
    // for disabled/minimal thinking; other legacy budgets use Argon's MEDIUM default.
    const supportedLevel = level === 'LOW' || level === 'MEDIUM' || level === 'HIGH'
        ? level : level === 'MINIMAL' || thinkingBudget === 0 ? 'LOW' : undefined;
    return { ...preferences, ...(supportedLevel ? { thinkingLevel: supportedLevel } : {}) };
}
