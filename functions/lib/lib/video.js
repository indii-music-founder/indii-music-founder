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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVideoLogic = exports.VideoJobSchema = void 0;
exports.generateVideoWithVeo = generateVideoWithVeo;
const admin = __importStar(require("firebase-admin"));
const google_auth_library_1 = require("google-auth-library");
const zod_1 = require("zod");
// Validation Schema
exports.VideoJobSchema = zod_1.z.object({
    jobId: zod_1.z.string().uuid().or(zod_1.z.string().min(1)), // UUID preferred but string allowed for backward compat
    userId: zod_1.z.string(),
    orgId: zod_1.z.string().optional().default("personal"),
    prompt: zod_1.z.string().min(1).max(5000),
    options: zod_1.z.object({
        duration: zod_1.z.enum(["5s", "10s"]).optional().default("5s"),
        aspectRatio: zod_1.z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
        // Advanced Options restoration
        durationSeconds: zod_1.z.number().optional(),
        resolution: zod_1.z.string().optional(),
        fps: zod_1.z.number().optional(),
        cameraMovement: zod_1.z.string().optional(),
        motionStrength: zod_1.z.number().optional(),
        seed: zod_1.z.number().optional(),
        negativePrompt: zod_1.z.string().optional(),
        model: zod_1.z.string().optional(),
        firstFrame: zod_1.z.string().optional(),
        lastFrame: zod_1.z.string().optional(),
        timeOffset: zod_1.z.number().optional(),
        ingredients: zod_1.z.array(zod_1.z.string()).optional(),
        shotList: zod_1.z.array(zod_1.z.any()).optional() // Allow shotList as any array for now
    }).optional().default({})
});
/**
 * Calls Vertex AI (Veo) to generate a video.
 * Handles API authentication, request formatting, and response parsing.
 * Saves the result to Firebase Storage and returns a Signed URL.
 */
async function generateVideoWithVeo(input, updateStatus) {
    const { jobId, userId, prompt, options } = input;
    // 1. Update status to processing
    await updateStatus("processing");
    // 2. Vertex AI Setup
    const auth = new google_auth_library_1.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const projectId = await auth.getProjectId();
    const accessToken = await client.getAccessToken();
    const location = 'us-central1';
    const modelId = 'veo-3.1-generate-preview';
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;
    // 3. Construct Request
    const requestBody = {
        instances: [{ prompt }],
        parameters: {
            sampleCount: 1,
            videoLength: options.duration || (options.durationSeconds ? `${options.durationSeconds}s` : "5s"),
            aspectRatio: options.aspectRatio
        }
    };
    console.log(`[VideoJob] Calling Veo API for job ${jobId}`);
    // 4. Call API
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vertex AI Error: ${response.status} ${errorText}`);
    }
    const result = await response.json();
    const predictions = result.predictions;
    if (!predictions || predictions.length === 0) {
        throw new Error("No predictions returned from Veo API");
    }
    const prediction = predictions[0];
    let videoUrl = "";
    // 5. Handle Response & Storage
    if (prediction.bytesBase64Encoded) {
        const bucket = admin.storage().bucket();
        const filePath = `videos/${userId}/${jobId}.mp4`;
        const file = bucket.file(filePath);
        await file.save(Buffer.from(prediction.bytesBase64Encoded, 'base64'), {
            metadata: { contentType: 'video/mp4' }
        });
        // Generate Signed URL (valid for 7 days)
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        videoUrl = signedUrl;
    }
    else if (prediction.gcsUri) {
        videoUrl = prediction.gcsUri;
    }
    else if (prediction.videoUri) {
        videoUrl = prediction.videoUri;
    }
    else {
        throw new Error("Unknown Veo response format");
    }
    // 6. Update status to completed
    await updateStatus("completed", { videoUrl, progress: 100 });
    return videoUrl;
}
/**
 * Core logic for generating video via Vertex AI (Veo)
 * This is the Inngest step handler.
 */
const generateVideoLogic = async ({ event, step }) => {
    const { jobId } = event.data;
    return await step.run("generate-veo-video", async () => {
        return await generateVideoWithVeo(event.data, async (status, data) => {
            await admin.firestore().collection("videoJobs").doc(jobId).set(Object.assign({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, data), { merge: true });
        });
    });
};
exports.generateVideoLogic = generateVideoLogic;
//# sourceMappingURL=video.js.map