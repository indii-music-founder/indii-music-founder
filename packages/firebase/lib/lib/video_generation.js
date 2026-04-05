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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVideoFn = void 0;
const admin = __importStar(require("firebase-admin"));
const google_auth_library_1 = require("google-auth-library");
const models_1 = require("../config/models");
const generateVideoFn = (inngestClient, geminiApiKey) => inngestClient.createFunction({ id: "generate-video-logic" }, { event: "video/generate.requested" }, async ({ event, step }) => {
    const { jobId, prompt, userId, options } = event.data;
    const isThinking = (options === null || options === void 0 ? void 0 : options.thinking) === true;
    let finalPrompt = isThinking
        ? `[Think CINEMATIC PHYSICS & CONTINUITY]: ${prompt}`
        : prompt;
    if (finalPrompt.length > 500) {
        finalPrompt = finalPrompt.substring(0, 500);
    }
    console.log(`[Inngest] Starting video generation for Job: ${jobId} (Thinking: ${isThinking})`);
    try {
        // Update status to processing
        await step.run("update-status-processing", async () => {
            console.log(`[Inngest] Updating status to processing for ${jobId}`);
            try {
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    status: "processing",
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log(`[Inngest] Status updated to processing for ${jobId}`);
            }
            catch (err) {
                console.error(`[Inngest] Failed to update status:`, err);
                throw err;
            }
        });
        // Start Video Generation Operation (Vertex AI)
        const operation = await step.run("trigger-vertex-ai-video", async () => {
            var _a;
            const { model: requestedModel, generateAudio: requestedAudio } = options || {};
            const modelId = requestedModel === 'fast'
                ? models_1.FUNCTION_AI_MODELS.VIDEO.FAST
                : models_1.FUNCTION_AI_MODELS.VIDEO.PRO;
            const auth = new google_auth_library_1.GoogleAuth({
                scopes: ['https://www.googleapis.com/auth/cloud-platform']
            });
            const client = await auth.getClient();
            const projectId = await auth.getProjectId();
            const accessToken = await client.getAccessToken();
            const endpoint = `https://us-central1-aiplatform.googleapis.com/v1beta/projects/${projectId}/locations/us-central1/publishers/google/models/${modelId}:predictLongRunning`;
            const requestBody = {
                instances: [{ prompt: finalPrompt }],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: (options === null || options === void 0 ? void 0 : options.aspectRatio) || "16:9",
                    personGeneration: (options === null || options === void 0 ? void 0 : options.personGeneration) || "allow_adult",
                    generateAudio: requestedAudio !== null && requestedAudio !== void 0 ? requestedAudio : true
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
                ]
            };
            // VEO 3.1: Resolution support
            if (options === null || options === void 0 ? void 0 : options.resolution) {
                requestBody.parameters.resolution = options.resolution;
            }
            // VEO 3.1: Duration support (4, 6, 8 seconds)
            const rawDuration = (options === null || options === void 0 ? void 0 : options.durationSeconds) || (options === null || options === void 0 ? void 0 : options.duration);
            if (rawDuration) {
                // Clamp to supported values or default to 8
                let dur = typeof rawDuration === 'string' ? parseInt(rawDuration) : rawDuration;
                if (dur <= 4)
                    dur = 4;
                else if (dur <= 6)
                    dur = 6;
                else
                    dur = 8;
                requestBody.parameters.durationSeconds = dur;
                // Force 8s for 1080p/4k
                if (['1080p', '4k'].includes(options === null || options === void 0 ? void 0 : options.resolution)) {
                    requestBody.parameters.durationSeconds = 8;
                }
            }
            // VEO 3.1: Video Extension (Video-to-Video)
            const inputVideo = options === null || options === void 0 ? void 0 : options.inputVideo; // From payload (URL/Base64)
            if (inputVideo) {
                // Note: Extensions are limited to 720p
                if ((options === null || options === void 0 ? void 0 : options.resolution) && options.resolution !== '720p') {
                    console.warn("[VideoGen] Warning: Video extension forces 720p resolution. Overriding.");
                    requestBody.parameters.resolution = '720p';
                }
                // Handle string input (URL or Base64)
                // If it's a URL to a GS path or GCS http, Vertex might accept it directly or we need bytes.
                // The docs say: video: Video object from a previous generation
                // We'll try to fetch bytes if it's external, or pass if it's GCS URI
                // For now, let's assume we fetch bytes to be safe as API is tricky
                const fetchVideoBytes = async (url) => {
                    const res = await fetch(url);
                    const buf = await res.arrayBuffer();
                    return Buffer.from(buf).toString('base64');
                };
                // Check if it's already base64 (no http/gs)
                if (!inputVideo.startsWith('http') && !inputVideo.startsWith('gs://')) {
                    requestBody.instances[0].video = { bytesBase64Encoded: inputVideo };
                }
                else {
                    // Fetch it
                    const vBytes = await fetchVideoBytes(inputVideo);
                    requestBody.instances[0].video = { bytesBase64Encoded: vBytes };
                }
                // Extension uses 'video' param not 'image'
                requestBody.parameters.personGeneration = "allow_all";
            }
            // VEO 3.1: First Frame (Image-to-Video)
            let startImageBytes;
            const fetchImageAsBase64 = async (input) => {
                if (!input)
                    return undefined;
                if (input.startsWith('data:image')) {
                    return input.replace(/^data:image\/\w+;base64,/, '');
                }
                if (input.startsWith('http')) {
                    try {
                        const res = await fetch(input);
                        if (!res.ok)
                            throw new Error(`Failed to fetch image: ${res.statusText}`);
                        const buffer = await res.arrayBuffer();
                        return Buffer.from(buffer).toString('base64');
                    }
                    catch (err) {
                        console.error(`[Inngest] Failed to fetch frame from URL: ${input}`, err);
                        return undefined;
                    }
                }
                return input; // Assume raw base64
            };
            if ((_a = options === null || options === void 0 ? void 0 : options.image) === null || _a === void 0 ? void 0 : _a.imageBytes) {
                startImageBytes = options.image.imageBytes;
            }
            else {
                startImageBytes = await fetchImageAsBase64(options === null || options === void 0 ? void 0 : options.firstFrame);
            }
            if (startImageBytes) {
                requestBody.instances[0].image = {
                    bytesBase64Encoded: startImageBytes
                };
                requestBody.parameters.personGeneration = (options === null || options === void 0 ? void 0 : options.personGeneration) || "allow_adult";
            }
            // VEO 3.1: Last Frame (Interpolation)
            if (options === null || options === void 0 ? void 0 : options.lastFrame) {
                const lastImageBytes = await fetchImageAsBase64(options.lastFrame);
                if (lastImageBytes) {
                    requestBody.parameters.lastFrame = {
                        bytesBase64Encoded: lastImageBytes
                    };
                    requestBody.parameters.personGeneration = (options === null || options === void 0 ? void 0 : options.personGeneration) || "allow_adult";
                }
            }
            // VEO 3.1: Ingredients (Reference Images - Up to 3)
            const refImages = (options === null || options === void 0 ? void 0 : options.referenceImages) || (options === null || options === void 0 ? void 0 : options.ingredients);
            if (refImages && Array.isArray(refImages)) {
                requestBody.parameters.referenceImages = await Promise.all(refImages.slice(0, 3).map(async (ref) => {
                    var _a, _b;
                    // Handle both old schema (string) and new schema (object)
                    let rawContent = "";
                    let refType = "ASSET";
                    if (typeof ref === 'string') {
                        rawContent = ref;
                    }
                    else {
                        // New schema
                        rawContent = ((_a = ref.image) === null || _a === void 0 ? void 0 : _a.imageBytes) || ((_b = ref.image) === null || _b === void 0 ? void 0 : _b.uri) || ref.data || "";
                        refType = ref.referenceType || "ASSET";
                    }
                    const cleanBytes = await fetchImageAsBase64(rawContent);
                    return {
                        image: {
                            bytesBase64Encoded: cleanBytes || ""
                        },
                        referenceType: refType
                    };
                }));
                requestBody.parameters.personGeneration = (options === null || options === void 0 ? void 0 : options.personGeneration) || "allow_adult";
                // Reference images force 8s
                requestBody.parameters.duration = 8;
            }
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken.token}`
                },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Vertex AI Trigger Error: ${response.status} ${errorText}`);
            }
            const result = await response.json();
            if (!result.name)
                throw new Error("No operation name returned from Vertex AI");
            return result;
        });
        const operationName = operation.name;
        console.log(`[Inngest] Operation started: ${operationName}`);
        // Polling Loop
        let isCompleted = false;
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes (5s * 60)
        let finalResult = null;
        while (!isCompleted && attempts < maxAttempts) {
            attempts++;
            // Wait 5 seconds using Inngest sleep (better than setTimeout)
            await step.sleep(`wait-5s-${attempts}`, "5s");
            finalResult = await step.run(`check-status-${attempts}`, async () => {
                const auth = new google_auth_library_1.GoogleAuth({
                    scopes: ['https://www.googleapis.com/auth/cloud-platform']
                });
                const client = await auth.getClient();
                // Project ID not needed for polling as operationName contains full path
                const accessToken = await client.getAccessToken();
                // operationName from Vertex is usually: projects/.../locations/.../operations/...
                // So we can use the aiplatform endpoint directly with the name
                const statusEndpoint = `https://us-central1-aiplatform.googleapis.com/v1beta/${operationName}`;
                const statusResponse = await fetch(statusEndpoint, {
                    headers: {
                        'Authorization': `Bearer ${accessToken.token}`
                    }
                });
                if (!statusResponse.ok) {
                    if (statusResponse.status >= 400 && statusResponse.status < 500) {
                        const errorText = await statusResponse.text();
                        throw new Error(`Vertex AI API Error: ${statusResponse.status} ${errorText}`);
                    }
                    return null;
                }
                const statusData = await statusResponse.json();
                if (statusData.done)
                    return statusData;
                return null;
            });
            if (finalResult && finalResult.done) {
                isCompleted = true;
            }
        }
        if (!isCompleted || !finalResult) {
            throw new Error(`Video generation timed out after ${attempts} attempts. Operation may still be running in Vertex AI.`);
        }
        if (finalResult.error) {
            throw new Error(`Vertex AI Operation Failed: ${finalResult.error.code} - ${finalResult.error.message}`);
        }
        if (!finalResult.response) {
            throw new Error("No response data in final result after operation completed.");
        }
        // Process Result
        const { videoUri, metadata } = await step.run("process-video-output", async () => {
            var _a;
            const responseData = finalResult.response;
            console.log("[Inngest] Final Result from Google AI:", JSON.stringify(finalResult, null, 2));
            if (!responseData) {
                throw new Error("No response data in final result");
            }
            // Veo 3.1 Response Structure
            const generatedSamples = (_a = responseData.generateVideoResponse) === null || _a === void 0 ? void 0 : _a.generatedSamples;
            if (generatedSamples && generatedSamples.length > 0) {
                const sample = generatedSamples[0];
                if (sample.video && sample.video.uri) {
                    console.log(`[Inngest] Found video URI: ${sample.video.uri}`);
                    // Extract metadata
                    const videoMetadata = sample.videoMetadata || {};
                    let durationSeconds = 5;
                    if (videoMetadata.duration && typeof videoMetadata.duration === 'string') {
                        const match = videoMetadata.duration.match(/([\d.]+)s$/);
                        if (match) {
                            durationSeconds = parseFloat(match[1]);
                        }
                    }
                    let downloadUrl = sample.video.uri;
                    // Convert gs:// to public HTTPS URL if needed
                    if (downloadUrl.startsWith('gs://')) {
                        const path = downloadUrl.replace('gs://', '').split('/').slice(1).join('/');
                        const bucketName = downloadUrl.replace('gs://', '').split('/')[0];
                        downloadUrl = `https://storage.googleapis.com/${bucketName}/${path}`;
                    }
                    return {
                        videoUri: downloadUrl,
                        metadata: {
                            mime_type: videoMetadata.mimeType || "video/mp4",
                            duration_seconds: durationSeconds,
                            fps: 24, // Default as it's not always provided
                            resolution: (options === null || options === void 0 ? void 0 : options.resolution) || "1080p"
                        }
                    };
                }
            }
            // Fallback for older models
            const outputs = responseData.outputs;
            if (outputs && outputs.length > 0) {
                const output = outputs[0];
                let uri = null;
                // If it returns bytes
                if (output.video && output.video.bytesBase64Encoded) {
                    const bucket = admin.storage().bucket();
                    const file = bucket.file(`videos/${userId}/${jobId}.mp4`);
                    await file.save(Buffer.from(output.video.bytesBase64Encoded, 'base64'), {
                        metadata: { contentType: 'video/mp4' },
                        public: true
                    });
                    uri = file.publicUrl();
                }
                else if (output.videoUri) {
                    uri = output.videoUri;
                }
                else if (output.gcsUri) {
                    uri = output.gcsUri;
                }
                if (uri) {
                    return {
                        videoUri: uri,
                        metadata: {
                            mime_type: "video/mp4",
                            duration_seconds: 5,
                            fps: 24
                        }
                    };
                }
            }
            throw new Error("No video data or URI/generatedSamples found in operation response: " + JSON.stringify(responseData));
        });
        // Update status to complete
        await step.run("update-status-complete", async () => {
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "completed",
                videoUrl: videoUri,
                progress: 100,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                output: {
                    url: videoUri,
                    metadata: Object.assign(Object.assign({}, metadata), { duration_seconds: (metadata === null || metadata === void 0 ? void 0 : metadata.duration_seconds) || 5, fps: (options === null || options === void 0 ? void 0 : options.fps) || 30, mime_type: "video/mp4", resolution: (options === null || options === void 0 ? void 0 : options.aspectRatio) === "9:16" ? "720x1280" : "1280x720" })
                }
            }, { merge: true });
        });
        return { success: true, videoUrl: videoUri };
    }
    catch (error) {
        console.error(`[Inngest] Error in Video Generation (${jobId}):`, error);
        await step.run("update-status-failed", async () => {
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "failed",
                error: error.message || "Unknown error during video generation",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
        throw error;
    }
});
exports.generateVideoFn = generateVideoFn;
//# sourceMappingURL=video_generation.js.map