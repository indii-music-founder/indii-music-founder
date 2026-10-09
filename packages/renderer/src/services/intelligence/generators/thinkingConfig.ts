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
