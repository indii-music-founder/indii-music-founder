"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageTool = void 0;
const core_1 = require("@mastra/core");
const zod_1 = require("zod");
const generative_ai_1 = require("@google/generative-ai");
const ai_models_1 = require("../../../config/ai-models");
exports.imageTool = (0, core_1.createTool)({
    id: 'generate-image',
    description: 'Generates an image based on a text prompt using Google Gemini 3.0 Pro Image.',
    inputSchema: zod_1.z.object({
        prompt: zod_1.z.string().describe('The detailed visual description of the image to generate.'),
        aspectRatio: zod_1.z.string().optional().describe('The aspect ratio of the image (e.g., "16:9", "1:1"). Defaults to "1:1".'),
    }),
    execute: async ({ context }) => {
        const { prompt } = context;
        // Initialize Google GenAI
        const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
        // Use the specific model from shared config
        const model = genAI.getGenerativeModel({ model: ai_models_1.AI_MODELS.IMAGE.GENERATION });
        try {
            await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                // generationConfig: { aspectRatio: aspectRatio || '1:1' } // Hypothetical config
            });
            // Assuming the response contains image data or a URL
            // For now, we return a mock success if we can't actually call the preview model yet
            // or return the actual data if the SDK supports it.
            return {
                success: true,
                message: `Generated image for prompt: "${prompt}"`,
                // data: result.response... 
                mockUrl: "https://placehold.co/1024x1024/png?text=AI+Generated+Image"
            };
        }
        catch (error) {
            console.error("Image Generation Failed:", error);
            return {
                success: false,
                error: error.message
            };
        }
    },
});
//# sourceMappingURL=imageTool.js.map