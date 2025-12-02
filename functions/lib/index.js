"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerVideoGeneration = exports.inngestFn = exports.editImage = exports.creativeDirectorAgent = exports.generateVideo = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");
const google_auth_library_1 = require("google-auth-library");
admin.initializeApp();
const corsHandler = cors({ origin: true });
exports.generateVideo = functions.https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            const { prompt, model, image, config } = req.body;
            const projectId = process.env.GCLOUD_PROJECT || "architexture-ai-api";
            const location = "us-central1";
            const modelId = model || "veo-3.1-generate-preview";
            // Get Access Token
            const auth = new google_auth_library_1.GoogleAuth({
                scopes: ["https://www.googleapis.com/auth/cloud-platform"],
            });
            const client = await auth.getClient();
            const accessToken = await client.getAccessToken();
            const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;
            const instance = { prompt };
            if (image)
                instance.image = image;
            if (config === null || config === void 0 ? void 0 : config.lastFrame)
                instance.lastFrame = config.lastFrame;
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
                const errorText = await response.text();
                console.error("Vertex API Error:", errorText);
                res.status(response.status).send({ error: errorText });
                return;
            }
            const data = await response.json();
            res.json(data);
        }
        catch (error) {
            console.error("Function Error:", error);
            if (error instanceof Error) {
                res.status(500).send({ error: error.message });
            }
            else {
                res.status(500).send({ error: "An unknown error occurred" });
            }
        }
    });
});
const creative_director_1 = require("./agents/creative-director");
exports.creativeDirectorAgent = functions.https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            const { prompt } = req.body;
            if (!prompt) {
                res.status(400).send({ error: "Prompt is required" });
                return;
            }
            // Execute the agent
            const result = await creative_director_1.creativeDirector.generate(prompt);
            res.json({ result });
        }
        catch (error) {
            console.error("Agent Error:", error);
            if (error instanceof Error) {
                res.status(500).send({ error: error.message });
            }
            else {
                res.status(500).send({ error: "An unknown error occurred" });
            }
        }
    });
});
exports.editImage = functions.https.onCall(async (data, context) => {
    try {
        const { image, mask, prompt } = data;
        const projectId = process.env.GCLOUD_PROJECT || "architexture-ai-api";
        const location = "us-central1";
        const modelId = "gemini-3-pro-image-preview";
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;
        const parts = [
            {
                inlineData: {
                    mimeType: "image/png", // Assuming PNG for now, or extract from base64 header if passed
                    data: image // Expecting raw base64 without header
                }
            }
        ];
        if (mask) {
            parts.push({
                inlineData: {
                    mimeType: "image/png",
                    data: mask
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
                    responseMimeType: "application/json"
                },
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Vertex API Error:", errorText);
            throw new functions.https.HttpsError('internal', errorText);
        }
        const result = await response.json();
        return result;
    }
    catch (error) {
        console.error("Function Error:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
    }
});
const client_1 = require("./inngest/client");
const functions_1 = require("./inngest/functions");
const express_1 = require("inngest/express");
exports.inngestFn = functions.https.onRequest((0, express_1.serve)({
    client: client_1.inngest,
    functions: [functions_1.helloWorldFn, functions_1.magicFillFn, functions_1.generateVideoFn],
}));
exports.triggerVideoGeneration = functions.https.onCall(async (data, context) => {
    const { prompt, image, model } = data;
    await client_1.inngest.send({
        name: "creative/generate-video",
        data: { prompt, image, model }
    });
    return { success: true, message: "Video generation triggered" };
});
//# sourceMappingURL=index.js.map