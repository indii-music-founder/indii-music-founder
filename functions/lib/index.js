"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVideo = void 0;
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
            res.status(500).send({ error: error.message });
        }
    });
});
//# sourceMappingURL=index.js.map