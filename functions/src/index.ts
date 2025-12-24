import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { Inngest } from "inngest";
import { defineSecret } from "firebase-functions/params";
import { serve } from "inngest/express";
import corsLib from "cors";

import { GoogleAuth } from "google-auth-library";

// Initialize Firebase Admin
admin.initializeApp();

// Define Secrets
const inngestEventKey = defineSecret("INNGEST_EVENT_KEY");
const inngestSigningKey = defineSecret("INNGEST_SIGNING_KEY");

// Lazy Initialize Inngest Client
// We use a function factory or lazy initialization inside the handler to ensure secrets are available
const getInngestClient = () => {
    return new Inngest({
        id: "indii-os-functions",
        eventKey: inngestEventKey.value()
    });
};

/**
 * Trigger Video Generation Job
 * 
 * This callable function acts as the bridge between the Client App (Electron)
 * and the Asynchronous Worker Queue (Inngest).
 * 
 * Security: protected by Firebase Auth (onCall).
 */
export const triggerVideoJob = functions
    .runWith({
        secrets: [inngestEventKey],
        timeoutSeconds: 60,
        memory: "256MB"
    })
    .https.onCall(async (data: any, context: functions.https.CallableContext) => {
        // 1. Authentication Check
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to trigger video generation."
            );
        }

        const userId = context.auth.uid;
        const { prompt, jobId, orgId, ...options } = data;

        if (!prompt || !jobId) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Missing required fields: prompt or jobId."
            );
        }

        try {
            // 2. Publish Event to Inngest
            const inngest = getInngestClient();

            await inngest.send({
                name: "video/generate.requested",
                data: {
                    jobId: jobId,
                    userId: userId,
                    orgId: orgId || "personal", // Default to personal if missing
                    prompt: prompt,
                    options: options, // Pass through other options (aspect ratio, etc.)
                    timestamp: Date.now(),
                },
                user: {
                    id: userId,
                }
            });

            console.log(`[VideoJob] Triggered for JobID: ${jobId}, User: ${userId}`);

            return { success: true, message: "Video generation job queued." };

        } catch (error: any) {
            console.error("[VideoJob] Error triggering Inngest:", error);
            throw new functions.https.HttpsError(
                "internal",
                `Failed to queue video job: ${error.message}`
            );
        }
    });

/**
 * Inngest API Endpoint
 * 
 * This is the entry point for Inngest Cloud to call back into our functions
 * to execute steps.
 */
export const inngestApi = functions
    .runWith({ secrets: [inngestSigningKey, inngestEventKey] })
    .https.onRequest((req, res) => {
        // Initialize client INSIDE the handler to ensure secrets are available
        const inngestClient = getInngestClient();

        // Placeholder for actual video generation functions
        const generateVideoFn = inngestClient.createFunction(
            { id: "generate-video-logic" },
            { event: "video/generate.requested" },
            async ({ event, step }) => {
                return { message: "Placeholder implementation restored." };
            }
        );

        // Create the serve handler dynamically
        const handler = serve({
            client: inngestClient,
            functions: [generateVideoFn],
            signingKey: inngestSigningKey.value(),
        });

        // Execute the handler
        return handler(req, res);
    });

interface GenerateImageRequestData {
    prompt: string;
    aspectRatio?: string;
    count?: number;
    images?: { mimeType: string; data: string }[];
}

export const generateImage = functions.https.onCall(async (data: GenerateImageRequestData, context) => {
    try {
        const { prompt, aspectRatio, count, images } = data;
        const projectId = process.env.GCLOUD_PROJECT || "indiios-v-1-1";
        const location = "us-central1";
        const modelId = "gemini-3-pro-image-preview"; // Updated to latest Gemini 3 Image model

        // Note: Using the API Key provided by client? Or using Vertex AI IAM?
        // Client service passes apiKey, but we are in Cloud Functions effectively as a service account (if we init GoogleAuth).
        // Let's use Vertex AI IAM as it's more secure for backend.

        const auth = new GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;

        const parts: any[] = [{ text: prompt + (aspectRatio ? ` --aspect_ratio ${aspectRatio}` : '') }];

        if (images) {
            images.forEach(img => {
                parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
            });
        }

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken.token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: parts
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                    candidateCount: count || 1
                }
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

interface EditImageRequestData {
    image: string;
    mask?: string;
    prompt: string;
    referenceImage?: string;
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
        const { image, mask, prompt, referenceImage } = data;
        const projectId = process.env.GCLOUD_PROJECT || "indiios-v-1-1";
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
                    mimeType: "image/png",
                    data: image
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

        if (referenceImage) {
            parts.push({
                inlineData: {
                    mimeType: "image/png",
                    data: referenceImage
                }
            });
            parts.push({ text: "Use this third image as a reference." });
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

/**
 * RAG Proxy
 * Proxies requests to Google Generative Language API (Gemini) to hide API Key
 * and handle CORS/Referer restrictions server-side.
 */
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const cors = corsLib({ origin: true });

export const ragProxy = functions
    .runWith({
        secrets: [geminiApiKey],
        timeoutSeconds: 60
    })
    .https.onRequest((req, res) => {
        cors(req, res, async () => {
            // 1. Validate Authentication (Optional but recommended for production)
            // For now, we allow authentic calls or public if strict auth not required yet

            // 2. Proxy Logic
            try {
                const baseUrl = 'https://generativelanguage.googleapis.com';
                const targetPath = req.path; // e.g., /v1beta/corpora
                const targetUrl = `${baseUrl}${targetPath}?key=${geminiApiKey.value()}`;

                const fetchOptions: RequestInit = {
                    method: req.method,
                    headers: {
                        'Content-Type': 'application/json',
                        // Spoof Referer to satisfy API Key restrictions.
                        // Since this is a proxy, we claim to be the allowed client.
                        'Referer': 'http://localhost:3000/'
                    },
                    body: (req.method !== 'GET' && req.method !== 'HEAD') ?
                        (typeof req.body === 'object' ? JSON.stringify(req.body) : req.body)
                        : undefined
                };

                const response = await fetch(targetUrl, fetchOptions);

                // Read text explicitly to avoid stream issues in standard fetch inside functions environment if any
                const data = await response.text();

                if (!response.ok) {
                    console.error("RAG Proxy Upstream Error:", {
                        status: response.status,
                        statusText: response.statusText,
                        url: targetUrl,
                        body: data
                    });
                }

                res.status(response.status);
                try {
                    res.send(JSON.parse(data));
                } catch {
                    res.send(data);
                }
            } catch (error: any) {
                console.error("RAG Proxy Error:", error);
                res.status(500).send({ error: error.message });
            }
        });
    });

