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
exports.generateVideoLogic = generateVideoLogic;
const admin = __importStar(require("firebase-admin"));
const google_auth_library_1 = require("google-auth-library");
async function generateVideoLogic({ event, step }) {
    const { jobId, prompt, userId, options } = event.data;
    try {
        // Step 1: Update status to processing
        await step.run("update-status-processing", async () => {
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "processing",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
        // Step 2: Generate Video via Vertex AI (Veo)
        const videoUri = await step.run("generate-veo-video", async () => {
            const auth = new google_auth_library_1.GoogleAuth({
                scopes: ['https://www.googleapis.com/auth/cloud-platform']
            });
            const client = await auth.getClient();
            const projectId = await auth.getProjectId();
            const accessToken = await client.getAccessToken();
            const LOCATION = 'us-central1';
            const modelId = 'veo-3.1-generate-preview';
            const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${modelId}:predict`;
            const requestBody = {
                instances: [{ prompt: prompt }],
                parameters: {
                    sampleCount: 1,
                    videoLength: (options === null || options === void 0 ? void 0 : options.duration) || (options === null || options === void 0 ? void 0 : options.durationSeconds) || "5s",
                    aspectRatio: (options === null || options === void 0 ? void 0 : options.aspectRatio) || "16:9"
                }
            };
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
            if (prediction.bytesBase64Encoded) {
                const bucket = admin.storage().bucket();
                const file = bucket.file(`videos/${userId}/${jobId}.mp4`);
                await file.save(Buffer.from(prediction.bytesBase64Encoded, 'base64'), {
                    metadata: { contentType: 'video/mp4' },
                });
                const [url] = await file.getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 1000 * 60 * 60 * 24 * 7
                });
                return url;
            }
            if (prediction.gcsUri)
                return prediction.gcsUri;
            if (prediction.videoUri)
                return prediction.videoUri;
            throw new Error("Unknown Veo response format: " + JSON.stringify(prediction));
        });
        // Step 3: Update status to complete
        await step.run("update-status-complete", async () => {
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "completed",
                videoUrl: videoUri,
                progress: 100,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
        return { success: true, videoUrl: videoUri };
    }
    catch (error) {
        await step.run("update-status-failed", async () => {
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "failed",
                error: error.message || "Unknown error during video generation",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
        throw error;
    }
}
//# sourceMappingURL=video.js.map