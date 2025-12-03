"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoToolDefinition = void 0;
exports.generateVideo = generateVideo;
const google_auth_library_1 = require("google-auth-library");
const generative_ai_1 = require("@google/generative-ai");
const ai_models_1 = require("../../../config/ai-models");
exports.videoToolDefinition = {
    name: "generateVideo",
    description: "Generates a video based on a text prompt using Google Veo.",
    parameters: {
        type: generative_ai_1.SchemaType.OBJECT,
        properties: {
            prompt: {
                type: generative_ai_1.SchemaType.STRING,
                description: "The detailed visual description of the video to generate."
            }
        },
        required: ["prompt"]
    }
};
async function generateVideo(args) {
    const { prompt } = args;
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
}
//# sourceMappingURL=videoTool.js.map