/**
 * Video Generation Pricing (USD)
 * 
 * Sourced from Vertex AI Veo 3.1 pricing tiers.
 */
export const VIDEO_PRICING = {
    PRO: {
        perSecond: 0.20,      // 720p/1080p Video Only
        perSecond4K: 0.40,    // 4K Video Only
        audioAddOn: 0.20      // Flat add-on for audio (up to 1080p)
    },
    FAST: {
        perSecond: 0.10,      // 720p/1080p Video Only
        perSecond4K: 0.30,    // 4K Video Only
        audioAddOn: 0.05      // Flat add-on for audio
    },
    LITE: {
        perSecond: 0.05,      // 720p/1080p Video Only — lowest cost tier
        perSecond4K: 0.05,    // Lite has no 4K tier; priced at base rate
        audioAddOn: 0.02      // Flat add-on for audio
    }
} as const;

/**
 * Calculate estimated cost for a video generation job.
 * Accepts tier keywords ('pro' | 'fast' | 'lite') or full model IDs
 * (e.g. 'veo-3.1-fast-generate-001') so all endpoints price consistently
 * (ISSUE-868).
 */
export function estimateVideoCost(options: {
    model?: string,
    durationSeconds?: number,
    resolution?: string,
    generateAudio?: boolean
}): number {
    const model = (options.model || '').toLowerCase();
    const tier = model.includes('lite') ? VIDEO_PRICING.LITE
        : model.includes('fast') ? VIDEO_PRICING.FAST
            : VIDEO_PRICING.PRO;
    const duration = options.durationSeconds ?? 5;
    const is4K = options.resolution === '4k';

    let cost = duration * (is4K ? tier.perSecond4K : tier.perSecond);

    if (options.generateAudio) {
        cost += tier.audioAddOn;
    }

    return parseFloat(cost.toFixed(4));
}

/**
 * Transcoder API output pricing, in USD per minute, as published by Google
 * Cloud on 2026-07-26. A canonical-master render deliberately submits two
 * video outputs: a visual concatenate pass and a final master-audio pass.
 *
 * Source: https://cloud.google.com/transcoder/pricing
 */
const TRANSCODER_VIDEO_USD_PER_MINUTE = {
    SD: 0.015,
    HD: 0.03,
    UHD: 0.06,
} as const;

/** Estimate the bounded Transcoder spend before a server queues a render. */
export function estimateTranscoderRenderCost(input: {
    width: number;
    height: number;
    durationSeconds: number;
    passes: 1 | 2;
}): number {
    if (!Number.isInteger(input.width) || !Number.isInteger(input.height)
        || input.width < 64 || input.height < 64 || input.width > 4096 || input.height > 2160) {
        throw new Error('Transcoder render resolution is invalid.');
    }
    if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0 || input.durationSeconds > 7_200) {
        throw new Error('Transcoder render duration is invalid.');
    }
    const perMinute = input.width > 1920 || input.height > 1080
        ? TRANSCODER_VIDEO_USD_PER_MINUTE.UHD
        : input.width >= 1280 || input.height >= 720
            ? TRANSCODER_VIDEO_USD_PER_MINUTE.HD
            : TRANSCODER_VIDEO_USD_PER_MINUTE.SD;
    return Number(((input.durationSeconds / 60) * perMinute * input.passes).toFixed(6));
}
