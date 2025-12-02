"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVideoFn = exports.magicFillFn = exports.helloWorldFn = void 0;
const client_1 = require("./client");
const google_auth_library_1 = require("google-auth-library");
const ai_models_1 = require("../config/ai-models");
exports.helloWorldFn = client_1.inngest.createFunction({ id: "hello-world-fn" }, { event: "test/hello.world" }, async ({ event, step }) => {
    await step.sleep("wait-a-moment", "1s");
    return { event, body: "Hello from Cloud Functions!" };
});
exports.magicFillFn = client_1.inngest.createFunction({ id: "magic-fill-fn" }, { event: "creative/magic-fill" }, async ({ event, step }) => {
    const { image, mask, prompt } = event.data;
    const projectId = process.env.GCLOUD_PROJECT || "architexture-ai-api";
    const location = "us-central1";
    const modelId = ai_models_1.AI_MODELS.IMAGE.GENERATION;
    const result = await step.run("generate-edit", async () => {
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        // Use generateContent for Gemini models
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;
        const parts = [
            {
                inlineData: {
                    mimeType: image.split(';')[0].split(':')[1],
                    data: image.split(',')[1]
                }
            }
        ];
        if (mask) {
            parts.push({
                inlineData: {
                    mimeType: mask.split(';')[0].split(':')[1],
                    data: mask.split(',')[1]
                }
            });
            parts.push({ text: "Use the second image as a mask for inpainting." });
        }
        parts.push({ text: `Edit this image: ${prompt}` });
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken.token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts }],
                generationConfig: {
                    responseMimeType: "application/json" // Request JSON if possible, or just text
                },
            }),
        });
        if (!response.ok) {
            throw new Error(await response.text());
        }
        return await response.json();
    });
    return { success: true, data: result };
});
exports.generateVideoFn = client_1.inngest.createFunction({ id: "generate-video-fn" }, { event: "creative/generate-video" }, async ({ event, step }) => {
    const { prompt, image, model } = event.data;
    const projectId = process.env.GCLOUD_PROJECT || "architexture-ai-api";
    const location = "us-central1";
    const modelId = model || "veo-3.1-generate-preview"; // Default to Veo
    const result = await step.run("generate-video", async () => {
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;
        const instance = { prompt };
        if (image) {
            // Veo expects specific image format
            instance.image = {
                mimeType: image.split(';')[0].split(':')[1],
                imageBytes: image.split(',')[1]
            };
        }
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken.token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                instances: [instance],
                parameters: { sampleCount: 1 },
            }),
        });
        if (!response.ok) {
            throw new Error(await response.text());
        }
        return await response.json();
    });
    return { success: true, data: result };
});
//# sourceMappingURL=functions.js.map