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
    }
} as const;

/**
 * Calculate estimated cost for a video generation job.
 */
export function estimateVideoCost(options: {
    model?: string,
    durationSeconds?: number,
    resolution?: string,
    generateAudio?: boolean
}): number {
    const tier = options.model === 'fast' ? VIDEO_PRICING.FAST : VIDEO_PRICING.PRO;
    const duration = options.durationSeconds || 8;
    const is4K = options.resolution === '4k';

    let cost = duration * (is4K ? tier.perSecond4K : tier.perSecond);

    if (options.generateAudio) {
        cost += tier.audioAddOn;
    }

    return parseFloat(cost.toFixed(4));
}
