"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoTool = void 0;
const core_1 = require("@mastra/core");
const zod_1 = require("zod");
const google_auth_library_1 = require("google-auth-library");
const ai_models_1 = require("../../../config/ai-models");
exports.videoTool = (0, core_1.createTool)({
    id: 'generate-video',
    description: 'Generates a video based on a text prompt using Google Veo.',
    inputSchema: zod_1.z.object({
        prompt: zod_1.z.string().describe('The detailed visual description of the video to generate.'),
    }),
    execute: async ({ context }) => {
        const { prompt } = context;
        const projectId = process.env.GCLOUD_PROJECT || "architexture-ai-api";
        const location = "us-central1";
        const modelId = ai_models_1.AI_MODELS.VIDEO.GENERATION;
        try {
            const auth = new google_auth_library_1.GoogleAuth({
                scopes: ["https://www.googleapis.com/auth/cloud-platform"],
            });
            const client = await auth.getClient();
            const accessToken = await client.getAccessToken();
            const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken.token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    instances: [{ prompt }],
                    parameters: { sampleCount: 1 },
                }),
            });
            if (!response.ok) {
                throw new Error(await response.text());
            }
            const data = await response.json();
            return {
                success: true,
                data
            };
        }
        catch (error) {
            console.error("Video Generation Failed:", error);
            return {
                success: false,
                error: error.message
            };
        }
    },
});
//# sourceMappingURL=videoTool.js.map