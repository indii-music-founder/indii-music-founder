import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';

/** Translate editor quality labels into provider model IDs before sending a request. */
export function resolveEditModel(model?: string): string {
    if (model === 'flash' || model === 'fast') return INTELLIGENCE_MODELS.IMAGE.FAST;
    if (!model || model === 'pro') return INTELLIGENCE_MODELS.IMAGE.GENERATION;
    return model;
}
