export const AI_MODELS = {
    TEXT: {
        // Main agent model with high reasoning capabilities
        AGENT: 'gemini-3-pro-preview',
        // Faster model for routing and simple tasks
        FAST: 'gemini-3-pro-preview', // Using same model for now as requested, but keeping constant separate for future flexibility
    },
    IMAGE: {
        // Main image generation model
        GENERATION: 'gemini-3-pro-image-preview',
    },
    VIDEO: {
        // Video generation model
        GENERATION: 'veo-3.1-generate-preview',
        EDIT: 'veo-3.1-generate-preview'
    }
} as const;

export const AI_CONFIG = {
    THINKING: {
        HIGH: {
            thinkingConfig: { thinkingLevel: "HIGH" }
        },
        LOW: {
            thinkingConfig: { thinkingLevel: "LOW" }
        }
    },
    IMAGE: {
        DEFAULT: {
            imageConfig: { imageSize: '2K' }
        }
    }
} as const;
