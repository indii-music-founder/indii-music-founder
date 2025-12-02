import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as cors from "cors";
import { GoogleAuth } from "google-auth-library";


admin.initializeApp();
const corsHandler = cors({ origin: true });

interface GenerateVideoRequestBody {
    prompt: string;
    model?: string;
    image?: string;
    config?: {
        lastFrame?: boolean;
    };
}

interface VertexVideoInstance {
    prompt: string;
    image?: string;
    lastFrame?: boolean;
}

export const generateVideo = functions.https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            const { prompt, model, image, config } = req.body as GenerateVideoRequestBody;
            const projectId = process.env.GCLOUD_PROJECT || "architexture-ai-api";
            const location = "us-central1";
            const modelId = model || "veo-3.1-generate-preview";

            // Get Access Token
            const auth = new GoogleAuth({
                scopes: ["https://www.googleapis.com/auth/cloud-platform"],
            });
            const client = await auth.getClient();
            const accessToken = await client.getAccessToken();

            const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

            const instance: VertexVideoInstance = { prompt };
            if (image) instance.image = image;
            if (config?.lastFrame) instance.lastFrame = config.lastFrame;

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
        } catch (error: unknown) {
            console.error("Function Error:", error);
            if (error instanceof Error) {
                res.status(500).send({ error: error.message });
            } else {
                res.status(500).send({ error: "An unknown error occurred" });
            }
        }
    });
});

import { creativeDirector } from './agents/creative-director';

interface CreativeDirectorAgentRequestBody {
    prompt: string;
}

export const creativeDirectorAgent = functions.https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            const { prompt } = req.body as CreativeDirectorAgentRequestBody;

            if (!prompt) {
                res.status(400).send({ error: "Prompt is required" });
                return;
            }

            // Execute the agent
            const result = await creativeDirector.generate(prompt);

            res.json({ result });
        } catch (error: unknown) {
            console.error("Agent Error:", error);
            if (error instanceof Error) {
                res.status(500).send({ error: error.message });
            } else {
                res.status(500).send({ error: "An unknown error occurred" });
            }
        }
    });
});

interface EditImageRequestData {
    image: string;
    mask?: string;
    prompt: string;
}

interface Part {
    inlineData?: {
        mimeType: string;
        data: string;
    };
    text?: string;
}

export const editImage = functions.https.onCall(async (data: EditImageRequestData, context) => {
    try {
        const { image, mask, prompt } = data;
        const projectId = process.env.GCLOUD_PROJECT || "architexture-ai-api";
        const location = "us-central1";
        const modelId = "gemini-3-pro-image-preview";

        const auth = new GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;

        const parts: Part[] = [
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
    } catch (error: unknown) {
        console.error("Function Error:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
    }
});

import { inngest } from "./inngest/client";
import { helloWorldFn, magicFillFn, generateVideoFn } from "./inngest/functions";
import { serve } from "inngest/express";

export const inngestFn = functions.https.onRequest(serve({
    client: inngest,
    functions: [helloWorldFn, magicFillFn, generateVideoFn],
}));

interface TriggerVideoGenerationRequestData {
    prompt: string;
    image?: string;
    model?: string;
}

export const triggerVideoGeneration = functions.https.onCall(async (data: TriggerVideoGenerationRequestData, context) => {
    const { prompt, image, model } = data;
    await inngest.send({
        name: "creative/generate-video",
        data: { prompt, image, model }
    });
    return { success: true, message: "Video generation triggered" };
});
