"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIDEO_PRICING = void 0;
exports.estimateVideoCost = estimateVideoCost;
/**
 * Video Generation Pricing (USD)
 *
 * Sourced from Vertex AI Veo 3.1 pricing tiers.
 */
exports.VIDEO_PRICING = {
    PRO: {
        perSecond: 0.20, // 720p/1080p Video Only
        perSecond4K: 0.40, // 4K Video Only
        audioAddOn: 0.20 // Flat add-on for audio (up to 1080p)
    },
    FAST: {
        perSecond: 0.10, // 720p/1080p Video Only
        perSecond4K: 0.30, // 4K Video Only
        audioAddOn: 0.05 // Flat add-on for audio
    }
};
/**
 * Calculate estimated cost for a video generation job.
 */
function estimateVideoCost(options) {
    var _a;
    const tier = options.model === 'fast' ? exports.VIDEO_PRICING.FAST : exports.VIDEO_PRICING.PRO;
    const duration = (_a = options.durationSeconds) !== null && _a !== void 0 ? _a : 5;
    const is4K = options.resolution === '4k';
    let cost = duration * (is4K ? tier.perSecond4K : tier.perSecond);
    if (options.generateAudio) {
        cost += tier.audioAddOn;
    }
    return parseFloat(cost.toFixed(4));
}
//# sourceMappingURL=pricing.js.map