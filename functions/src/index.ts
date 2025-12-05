import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as cors from "cors";
import { GoogleAuth } from "google-auth-library";
import { config } from "./config";


admin.initializeApp();
const corsHandler = cors({ origin: true });

import { GenerateVideoRequest } from "./shared/types/ai.dto";

interface VertexVideoInstance {
    prompt: string;
    image?: string;
    lastFrame?: boolean;
}

// NOTE: GenerateVideoRequest is for internal consistency, but here we are parsing
// raw JSON body from an onRequest (HTTP), so strictly speaking req.body is any.
// We can cast it.
// However, looking at the code, it defines `GenerateVideoRequestBody` interface right there.
// We should replace that legacy interface with our shared DTO if they match.
// The DTO has: model, prompt, image?, config?
// The local interface has: prompt, model?, image?, config?
// They are compatible. I will replace the local interface with the import.

export const generateVideo = functions.https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            const { prompt, model, image, config: videoConfig } = req.body as GenerateVideoRequest;
            const projectId = config.GCLOUD_PROJECT;
            const location = config.location;
            const modelId = model || config.MODEL_ID;

            // Get Access Token
            const auth = new GoogleAuth({
                scopes: ["https://www.googleapis.com/auth/cloud-platform"],
            });
            const client = await auth.getClient();
            const accessToken = await client.getAccessToken();

            const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

            const instance: VertexVideoInstance = { prompt };
            if (image) {
                if (typeof image === 'string') {
                    instance.image = image;
                } else if ((image as any).imageBytes) {
                    instance.image = (image as any).imageBytes;
                }
            }
            if (videoConfig && (videoConfig as any).lastFrame) {
                instance.lastFrame = Boolean((videoConfig as any).lastFrame);
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
        const projectId = config.GCLOUD_PROJECT;
        const location = config.location;
        const modelId = config.GEMINI_MODEL_ID;

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

// Old Inngest handler removed in favor of consolidated inngestServe
// import { inngest } from "./inngest/client";
// import { helloWorldFn, magicFillFn, generateVideoFn } from "./inngest/functions";
// import { serve } from "inngest/express";
// 
// export const inngestFn = functions.https.onRequest(serve({
//     client: inngest,
//     functions: [helloWorldFn, magicFillFn, generateVideoFn],
// }));

interface TriggerVideoGenerationRequestData {
    prompt: string;
    image?: string;
    endImage?: string;
    model?: string;
}

export const triggerVideoGeneration = functions.https.onCall(async (data: TriggerVideoGenerationRequestData, context) => {
    const { prompt, model } = data;
    let { image, endImage } = data;

    try {
        const bucket = admin.storage().bucket();
        const uniqueId = context.auth?.uid || 'anonymous';
        const timestamp = Date.now();

        const uploadImage = async (imgData: string, suffix: string) => {
            if (imgData.startsWith('data:')) {
                const base64Image = imgData.split(';base64,').pop();
                if (base64Image) {
                    const buffer = Buffer.from(base64Image, 'base64');
                    const filePath = `temp/videos/${uniqueId}_${timestamp}_${suffix}.png`;
                    const file = bucket.file(filePath);
                    await file.save(buffer, {
                        metadata: { contentType: 'image/png' }
                    });
                    // Use the bucket name from the file object if bucket.name is not available
                    const bucketName = bucket.name || config.GCLOUD_PROJECT + '.appspot.com';
                    return `gs://${bucketName}/${filePath}`;
                }
            }
            return imgData;
        };

        if (image) {
            image = await uploadImage(image, 'start');
        }

        if (endImage) {
            endImage = await uploadImage(endImage, 'end');
        }

        await inngest.send({
            name: "creative/generate-video",
            data: { prompt, image, endImage, model }
        });
        return { success: true, message: "Video generation triggered" };
    } catch (error: any) {
        console.error("Trigger Video Generation Error:", error);
        throw new functions.https.HttpsError('internal', `Failed to trigger video generation: ${error.message}`);
    }
});

import { legalAdvisor } from './agents/legal-advisor';
import { campaignManager } from './agents/campaign-manager';

interface AnalyzeContractRequestData {
    fileData: string; // Base64 encoded file data
    mimeType: string;
}

export const analyzeContract = functions.https.onCall(async (data: AnalyzeContractRequestData, context) => {
    try {
        const { fileData, mimeType } = data;
        if (!fileData || !mimeType) {
            throw new functions.https.HttpsError('invalid-argument', 'fileData and mimeType are required');
        }

        const result = await legalAdvisor.analyzeContract(fileData, mimeType);
        return result;
    } catch (error: unknown) {
        console.error("Function Error:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
    }
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
        const projectId = config.GCLOUD_PROJECT;
        const location = config.location;
        const modelId = config.GEMINI_MODEL_ID;

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

interface ExecuteCampaignRequestData {
    posts: any[];
}

export const executeCampaign = functions.https.onCall(async (data: ExecuteCampaignRequestData, context) => {
    try {
        const { posts } = data;
        if (!posts || !Array.isArray(posts)) {
            throw new functions.https.HttpsError('invalid-argument', 'posts array is required');
        }

        const result = await campaignManager.executeCampaign(posts);
        return { posts: result };
    } catch (error: unknown) {
        console.error("Function Error:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
    }
});

import { brandManager } from './agents/brand-manager';

interface AnalyzeBrandRequestData {
    content: string;
    guidelines: string;
}

export const analyzeBrand = functions.https.onCall(async (data: AnalyzeBrandRequestData, context) => {
    try {
        const { content, guidelines } = data;
        if (!content || !guidelines) {
            throw new functions.https.HttpsError('invalid-argument', 'content and guidelines are required');
        }

        const result = await brandManager.analyzeBrandConsistency(content, guidelines);
        return result;
    } catch (error: unknown) {
        console.error("Function Error:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
    }
});

interface GenerateBrandAssetRequestData {
    type: string;
    prompt: string;
}

export const generateBrandAsset = functions.https.onCall(async (data: GenerateBrandAssetRequestData, context) => {
    try {
        const { type, prompt } = data;
        if (!type || !prompt) {
            throw new functions.https.HttpsError('invalid-argument', 'type and prompt are required');
        }

        const result = await brandManager.generateBrandAsset(type, prompt);
        return result;
    } catch (error: unknown) {
        console.error("Function Error:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
    }
});

import { RoadManagerAgent } from './agents/road-manager';
const roadManager = new RoadManagerAgent();

interface GenerateItineraryRequestData {
    locations: string[];
    dates: { start: string, end: string };
}

export const generateItinerary = functions.https.onCall(async (data: GenerateItineraryRequestData, context) => {
    try {
        const { locations, dates } = data;
        if (!locations || !dates) {
            throw new functions.https.HttpsError('invalid-argument', 'locations and dates are required');
        }

        const result = await roadManager.generateItinerary(locations, dates);
        return result;
    } catch (error: unknown) {
        console.error("Function Error:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
    }
});

interface CheckLogisticsRequestData {
    itinerary: any;
}

export const checkLogistics = functions.https.onCall(async (data: CheckLogisticsRequestData, context) => {
    try {
        const { itinerary } = data;
        if (!itinerary) {
            throw new functions.https.HttpsError('invalid-argument', 'itinerary is required');
        }

        const result = await roadManager.checkLogistics(itinerary);
        return result;
    } catch (error: unknown) {
        console.error("Function Error:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
    }
});

interface FindPlacesRequestData {
    location: string;
    type: string;
    keyword?: string;
}

export const findPlaces = functions.https.onCall(async (data: FindPlacesRequestData, context) => {
    try {
        const { location, type, keyword } = data;
        if (!location || !type) {
            throw new functions.https.HttpsError('invalid-argument', 'location and type are required');
        }

        const result = await roadManager.findNearbyPlaces(location, type, keyword);
        return result;
    } catch (error: unknown) {
        console.error("Function Error:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
    }
});

interface CalculateFuelLogisticsRequestData {
    milesDriven: number;
    fuelLevelPercent: number;
    tankSizeGallons: number;
    mpg: number;
    gasPricePerGallon: number;
}

export const calculateFuelLogistics = functions.https.onCall(async (data: CalculateFuelLogisticsRequestData, context) => {
    try {
        const result = await roadManager.calculateFuelLogistics(data);
        return result;
    } catch (error: unknown) {
        console.error("Function Error:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
    }
});

export * from './ai/gemini';
export * from './rag/retrieval';

import { inngest } from "./jobs/inngest/client";
import { generateVideoJob } from "./jobs/videoJobs";
import { helloWorldFn, magicFillFn, generateVideoFn } from "./inngest/functions";
import { serve } from "inngest/express";

export const inngestServe = functions.https.onRequest(serve({
    client: inngest,
    functions: [
        helloWorldFn,
        magicFillFn,
        generateVideoFn,
        generateVideoJob
    ],
}));


export { triggerVideoJob } from './jobs/videoJobs';
