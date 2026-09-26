/**
 * Nano Banana Capability Registry — CANONICAL, SHARED
 *
 * Single source of truth for image-model capability across renderer and
 * Firebase packages (ISSUE-320). When Google ships model updates, change THIS
 * object and every consumer adapts:
 *
 *   - Firebase: re-exported from packages/firebase/src/config/models.ts
 *   - Renderer: defaults in INTELLIGENCE_CONFIG mirror these values; a
 *     dedicated sync test fails CI if the two drift apart.
 *
 * Do NOT declare model capabilities anywhere else.
 */
export const NANO_BANANA_CAPABILITIES = {
    'gemini-3-pro-image': {
        tier: 'pro' as const,
        displayName: 'Nano Banana Pro',
        maxResolution: '4K',
        supportedResolutions: ['1K', '2K', '4K'] as const,
        supportedAspectRatios: ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9', '9:21'] as const,
        maxReferenceImages: 14,
        supportsThinkingControl: false,
        supportsGoogleSearch: true,
        supportsImageSearch: false,
        supportsCandidateCount: false,
        supportsInterleaved: true,
        defaultThinking: 'always_on',
    },
    'gemini-3.1-flash-image': {
        tier: 'fast' as const,
        displayName: 'Nano Banana 2',
        maxResolution: '4K',
        supportedResolutions: ['512', '1K', '2K', '4K'] as const,
        supportedAspectRatios: ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9', '9:21'] as const,
        maxReferenceImages: 14, // 10 objects + 4 characters
        supportsThinkingControl: true, // minimal / high
        supportsGoogleSearch: false,
        supportsImageSearch: false,
        supportsCandidateCount: false,
        supportsInterleaved: true,
        defaultThinking: 'minimal',
    },
    'gemini-2.5-flash-image': {
        tier: 'legacy' as const,
        displayName: 'Nano Banana',
        maxResolution: '1K',
        supportedResolutions: ['512', '1K'] as const,
        supportedAspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'] as const,
        maxReferenceImages: 0,
        supportsThinkingControl: false,
        supportsGoogleSearch: false,
        supportsImageSearch: false,
        supportsCandidateCount: true,
        supportsInterleaved: true,
        defaultThinking: 'none',
    },
} as const;

export type NanoBananaModelKey = keyof typeof NANO_BANANA_CAPABILITIES;
export type NanoBananaCapability = (typeof NANO_BANANA_CAPABILITIES)[NanoBananaModelKey];
