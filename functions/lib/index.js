"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderVideo = exports.triggerVideoJob = exports.inngestServe = exports.calculateFuelLogistics = exports.findPlaces = exports.checkLogistics = exports.generateItinerary = exports.generateBrandAsset = exports.analyzeBrand = exports.executeCampaign = exports.generateImage = exports.analyzeContract = exports.triggerVideoGeneration = exports.editImage = exports.creativeDirectorAgent = exports.generateVideo = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");
const google_auth_library_1 = require("google-auth-library");
const config_1 = require("./config");
admin.initializeApp();
const corsHandler = cors({ origin: true });
// NOTE: GenerateVideoRequest is for internal consistency, but here we are parsing
// raw JSON body from an onRequest (HTTP), so strictly speaking req.body is any.
// We can cast it.
// However, looking at the code, it defines `GenerateVideoRequestBody` interface right there.
// We should replace that legacy interface with our shared DTO if they match.
// The DTO has: model, prompt, image?, config?
// The local interface has: prompt, model?, image?, config?
// They are compatible. I will replace the local interface with the import.
exports.generateVideo = functions.https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            const { prompt, model, image, config: videoConfig } = req.body;
            const projectId = config_1.config.GCLOUD_PROJECT;
            const location = config_1.config.location;
            const modelId = model || config_1.config.MODEL_ID;
            // Get Access Token
            const auth = new google_auth_library_1.GoogleAuth({
                scopes: ["https://www.googleapis.com/auth/cloud-platform"],
            });
            const client = await auth.getClient();
            const accessToken = await client.getAccessToken();
            const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;
            const instance = { prompt };
            if (image) {
                if (typeof image === 'string') {
                    instance.image = image;
                }
                else if (image.imageBytes) {
                    instance.image = image.imageBytes;
                }
            }
            if (videoConfig && videoConfig.lastFrame) {
                instance.lastFrame = Boolean(videoConfig.lastFrame);
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
        const projectId = config_1.config.GCLOUD_PROJECT;
        const location = config_1.config.location;
        const modelId = config_1.config.GEMINI_MODEL_ID;
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
exports.triggerVideoGeneration = functions.https.onCall(async (data, context) => {
    var _a;
    const { prompt, model } = data;
    let { image, endImage } = data;
    try {
        const bucket = admin.storage().bucket();
        const uniqueId = ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid) || 'anonymous';
        const timestamp = Date.now();
        const uploadImage = async (imgData, suffix) => {
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
                    const bucketName = bucket.name || config_1.config.GCLOUD_PROJECT + '.appspot.com';
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
        await client_1.inngest.send({
            name: "creative/generate-video",
            data: { prompt, image, endImage, model }
        });
        return { success: true, message: "Video generation triggered" };
    }
    catch (error) {
        console.error("Trigger Video Generation Error:", error);
        throw new functions.https.HttpsError('internal', `Failed to trigger video generation: ${error.message}`);
    }
});
const legal_advisor_1 = require("./agents/legal-advisor");
const campaign_manager_1 = require("./agents/campaign-manager");
exports.analyzeContract = functions.https.onCall(async (data, context) => {
    try {
        const { fileData, mimeType } = data;
        if (!fileData || !mimeType) {
            throw new functions.https.HttpsError('invalid-argument', 'fileData and mimeType are required');
        }
        const result = await legal_advisor_1.legalAdvisor.analyzeContract(fileData, mimeType);
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
exports.generateImage = functions.https.onCall(async (data, context) => {
    try {
        const { prompt, aspectRatio, count, images } = data;
        const projectId = config_1.config.GCLOUD_PROJECT;
        const location = config_1.config.location;
        const modelId = config_1.config.GEMINI_MODEL_ID;
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;
        const parts = [{ text: prompt + (aspectRatio ? ` --aspect_ratio ${aspectRatio}` : '') }];
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
    }
    catch (error) {
        console.error("Function Error:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
    }
});
exports.executeCampaign = functions.https.onCall(async (data, context) => {
    try {
        const { posts } = data;
        if (!posts || !Array.isArray(posts)) {
            throw new functions.https.HttpsError('invalid-argument', 'posts array is required');
        }
        const result = await campaign_manager_1.campaignManager.executeCampaign(posts);
        return { posts: result };
    }
    catch (error) {
        console.error("Function Error:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
    }
});
const brand_manager_1 = require("./agents/brand-manager");
exports.analyzeBrand = functions.https.onCall(async (data, context) => {
    try {
        const { content, guidelines } = data;
        if (!content || !guidelines) {
            throw new functions.https.HttpsError('invalid-argument', 'content and guidelines are required');
        }
        const result = await brand_manager_1.brandManager.analyzeBrandConsistency(content, guidelines);
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
exports.generateBrandAsset = functions.https.onCall(async (data, context) => {
    try {
        const { type, prompt } = data;
        if (!type || !prompt) {
            throw new functions.https.HttpsError('invalid-argument', 'type and prompt are required');
        }
        const result = await brand_manager_1.brandManager.generateBrandAsset(type, prompt);
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
const road_manager_1 = require("./agents/road-manager");
const roadManager = new road_manager_1.RoadManagerAgent();
exports.generateItinerary = functions.https.onCall(async (data, context) => {
    try {
        const { locations, dates } = data;
        if (!locations || !dates) {
            throw new functions.https.HttpsError('invalid-argument', 'locations and dates are required');
        }
        const result = await roadManager.generateItinerary(locations, dates);
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
exports.checkLogistics = functions.https.onCall(async (data, context) => {
    try {
        const { itinerary } = data;
        if (!itinerary) {
            throw new functions.https.HttpsError('invalid-argument', 'itinerary is required');
        }
        const result = await roadManager.checkLogistics(itinerary);
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
exports.findPlaces = functions.https.onCall(async (data, context) => {
    try {
        const { location, type, keyword } = data;
        if (!location || !type) {
            throw new functions.https.HttpsError('invalid-argument', 'location and type are required');
        }
        const result = await roadManager.findNearbyPlaces(location, type, keyword);
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
exports.calculateFuelLogistics = functions.https.onCall(async (data, context) => {
    try {
        const result = await roadManager.calculateFuelLogistics(data);
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
__exportStar(require("./ai/gemini"), exports);
__exportStar(require("./rag/retrieval"), exports);
const client_1 = require("./jobs/inngest/client");
const videoJobs_1 = require("./jobs/videoJobs");
const functions_1 = require("./inngest/functions");
const express_1 = require("inngest/express");
exports.inngestServe = functions.https.onRequest((0, express_1.serve)({
    client: client_1.inngest,
    functions: [
        functions_1.helloWorldFn,
        functions_1.magicFillFn,
        functions_1.generateVideoFn,
        videoJobs_1.generateVideoJob
    ],
}));
var videoJobs_2 = require("./jobs/videoJobs");
Object.defineProperty(exports, "triggerVideoJob", { enumerable: true, get: function () { return videoJobs_2.triggerVideoJob; } });
var render_1 = require("./video/render");
Object.defineProperty(exports, "renderVideo", { enumerable: true, get: function () { return render_1.renderVideo; } });
//# sourceMappingURL=index.js.map