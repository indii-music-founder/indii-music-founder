"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_CONFIG = exports.AI_MODELS = void 0;
exports.AI_MODELS = {
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
        EDIT: 'veo-2.0-generate-001'
    }
};
exports.AI_CONFIG = {
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
};
//# sourceMappingURL=ai-models.js.map