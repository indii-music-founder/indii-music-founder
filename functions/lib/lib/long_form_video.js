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
exports.stitchVideoFn = exports.generateLongFormVideoFn = exports.LongFormVideoJobSchema = void 0;
const admin = __importStar(require("firebase-admin"));
const google_auth_library_1 = require("google-auth-library");
const zod_1 = require("zod");
const video_transcoder_1 = require("@google-cloud/video-transcoder");
// ----------------------------------------------------------------------------
// Types & Schemas
// ----------------------------------------------------------------------------
exports.LongFormVideoJobSchema = zod_1.z.object({
    jobId: zod_1.z.string().uuid().or(zod_1.z.string().min(1)),
    userId: zod_1.z.string(),
    orgId: zod_1.z.string().optional().default("personal"),
    prompts: zod_1.z.array(zod_1.z.string()).min(1), // Validation fixed: must have at least 1 prompt
    totalDuration: zod_1.z.string().optional(),
    startImage: zod_1.z.string().optional(),
    options: zod_1.z.object({
        aspectRatio: zod_1.z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
        resolution: zod_1.z.string().optional(),
        seed: zod_1.z.number().optional(),
        negativePrompt: zod_1.z.string().optional(),
    }).optional().default({})
});
// ----------------------------------------------------------------------------
// Inngest Functions
// ----------------------------------------------------------------------------
/**
 * Generates multiple video segments (Daisychaining)
 *
 * Uses Veo to generate each segment. If a startImage is provided (or extracted
 * from previous segment), it uses it for continuity.
 */
const generateLongFormVideoFn = (inngestClient) => inngestClient.createFunction({ id: "generate-long-form-video" }, { event: "video/long_form.requested" }, async ({ event, step }) => {
    const { jobId, prompts, userId, startImage, options, orgId } = event.data;
    const segmentUrls = [];
    // Initialize currentStartImage
    let currentStartImage = startImage;
    try {
        // Update main job status
        await step.run("update-parent-processing", async () => {
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "processing",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
        for (let i = 0; i < prompts.length; i++) {
            const segmentId = `${jobId}_seg_${i}`;
            const prompt = prompts[i];
            const segmentUrl = await step.run(`generate-segment-${i}`, async () => {
                const auth = new google_auth_library_1.GoogleAuth({
                    scopes: ['https://www.googleapis.com/auth/cloud-platform']
                });
                const client = await auth.getClient();
                const projectId = await auth.getProjectId();
                const accessToken = await client.getAccessToken();
                const location = 'us-central1';
                const modelId = 'veo-3.1-generate-preview';
                const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;
                // Fix: Validate startImage format (Base64 vs Data URL)
                let imagePayload = undefined;
                if (currentStartImage) {
                    const base64 = currentStartImage.includes(',')
                        ? currentStartImage.split(',')[1]
                        : currentStartImage;
                    imagePayload = { image: { bytesBase64Encoded: base64 } };
                }
                const requestBody = {
                    instances: [
                        Object.assign({ prompt: prompt }, (imagePayload ? imagePayload : {}))
                    ],
                    parameters: {
                        sampleCount: 1,
                        videoLength: "5s",
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
                    throw new Error(`Veo Segment ${i} failed: ${response.status} ${errorText}`);
                }
                const result = await response.json();
                // Fix: Check for predictions
                if (!result.predictions || result.predictions.length === 0) {
                    throw new Error(`Veo Segment ${i}: No predictions returned`);
                }
                const prediction = result.predictions[0];
                const bucket = admin.storage().bucket();
                const file = bucket.file(`videos/${userId}/${segmentId}.mp4`);
                if (prediction.bytesBase64Encoded) {
                    await file.save(Buffer.from(prediction.bytesBase64Encoded, 'base64'), {
                        metadata: { contentType: 'video/mp4' },
                        public: true
                    });
                }
                else if (!prediction.videoUri && !prediction.gcsUri) {
                    throw new Error(`Unknown Veo response format for segment ${i}: ` + JSON.stringify(prediction));
                }
                // Return public URL or GCS URI
                return `https://storage.googleapis.com/${bucket.name}/videos/${userId}/${segmentId}.mp4`;
            });
            segmentUrls.push(segmentUrl);
            await step.run(`update-progress-${i}`, async () => {
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    completedSegments: i + 1,
                    progress: Math.floor(((i + 1) / prompts.length) * 100),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
            // Extract last frame for daisychaining
            if (i < prompts.length - 1) {
                try {
                    const nextStartImage = await step.run(`extract-frame-${i}`, async () => {
                        const auth = new google_auth_library_1.GoogleAuth({
                            scopes: ['https://www.googleapis.com/auth/cloud-platform']
                        });
                        const transcoder = new video_transcoder_1.TranscoderServiceClient();
                        try {
                            const projectId = await auth.getProjectId();
                            const location = 'us-central1';
                            const bucket = admin.storage().bucket();
                            const outputUri = `gs://${bucket.name}/frames/${userId}/${segmentId}/`;
                            // 1. Normalize Input URI
                            let inputUri = segmentUrl;
                            if (inputUri.startsWith('https://storage.googleapis.com/')) {
                                const path = inputUri.replace(`https://storage.googleapis.com/${bucket.name}/`, '');
                                inputUri = `gs://${bucket.name}/${path}`;
                            }
                            // 2. Create Sprite Job (acting as frame extractor)
                            const [job] = await transcoder.createJob({
                                parent: transcoder.locationPath(projectId, location),
                                job: {
                                    outputUri,
                                    config: {
                                        inputs: [{ key: "input0", uri: inputUri }],
                                        editList: [{ key: "atom0", inputs: ["input0"] }],
                                        spriteSheets: [
                                            {
                                                filePrefix: "frame_",
                                                startTimeOffset: { seconds: 4, nanos: 500000000 },
                                                endTimeOffset: { seconds: 0, nanos: 0 },
                                                columnCount: 1,
                                                rowCount: 1,
                                                totalCount: 1,
                                                quality: 100
                                            }
                                        ]
                                    }
                                }
                            });
                            // 3. Poll for Completion (Max 40s)
                            let finalState = 'PROCESSING';
                            for (let j = 0; j < 20; j++) {
                                await new Promise(r => setTimeout(r, 2000));
                                try {
                                    const [status] = await transcoder.getJob({ name: job.name });
                                    if (status.state === 'SUCCEEDED' || status.state === 'FAILED') {
                                        finalState = status.state;
                                        break;
                                    }
                                }
                                catch (err) {
                                    console.warn(`[FrameExtraction] Polling error: ${err.message}`);
                                    // Continue polling unless critical failure
                                }
                            }
                            if (finalState !== 'SUCCEEDED')
                                throw new Error(`Frame extraction failed or timed out: ${finalState}`);
                            // 4. Download and Convert to Base64
                            // Wait a bit for file consistency
                            await new Promise(r => setTimeout(r, 1000));
                            const [files] = await bucket.getFiles({ prefix: `frames/${userId}/${segmentId}/frame_` });
                            if (!files || files.length === 0) {
                                console.warn(`[LongForm] No frame generated for segment ${i}`);
                                return undefined; // Fallback
                            }
                            const frameFile = files[0];
                            const [buffer] = await frameFile.download();
                            return `data:image/jpeg;base64,${buffer.toString('base64')}`;
                        }
                        finally {
                            await transcoder.close();
                        }
                    });
                    currentStartImage = nextStartImage;
                }
                catch (e) {
                    console.warn(`[LongForm] Frame extraction failed for segment ${i}:`, e.message);
                    // Continue without chaining if extraction fails
                }
            }
        }
        // All segments done, trigger stitching
        await step.sendEvent({
            name: "video/stitch.requested",
            data: {
                jobId,
                userId,
                segmentUrls,
                orgId
            }
        });
    }
    catch (error) {
        console.error("[LongFormVideo] Error:", error);
        await step.run("mark-failed", async () => {
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "failed",
                error: error.message,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
    }
});
exports.generateLongFormVideoFn = generateLongFormVideoFn;
/**
 * Stitches multiple video segments into one using Google Cloud Transcoder API
 */
const stitchVideoFn = (inngestClient) => inngestClient.createFunction({ id: "stitch-video-segments" }, { event: "video/stitch.requested" }, async ({ event, step }) => {
    const { jobId, userId, segmentUrls } = event.data;
    const transcoder = new video_transcoder_1.TranscoderServiceClient();
    try {
        const projectId = await admin.app().options.projectId;
        const location = 'us-central1';
        const bucket = admin.storage().bucket();
        const outputDir = `gs://${bucket.name}/videos/${userId}/${jobId}_output/`;
        const jobName = await step.run("create-transcoder-job", async () => {
            const [job] = await transcoder.createJob({
                parent: transcoder.locationPath(projectId, location),
                job: {
                    outputUri: outputDir,
                    config: {
                        inputs: segmentUrls.map((url, index) => {
                            // Fix: Robust URL replacement
                            let uri = url;
                            if (uri.startsWith('https://storage.googleapis.com/')) {
                                const path = uri.replace('https://storage.googleapis.com/', '');
                                uri = `gs://${path}`;
                            }
                            return { key: `input${index}`, uri };
                        }),
                        editList: [
                            {
                                key: "atom0",
                                inputs: segmentUrls.map((_, index) => `input${index}`)
                            }
                        ],
                        elementaryStreams: [
                            {
                                key: "video_stream0",
                                videoStream: {
                                    h264: {
                                        heightPixels: 720,
                                        widthPixels: 1280,
                                        bitrateBps: 5000000,
                                        frameRate: 30,
                                    },
                                },
                            }
                            // Audio stream removed to prevent failure with silent Veo videos
                        ],
                        muxStreams: [
                            {
                                key: "final_output",
                                container: "mp4",
                                elementaryStreams: ["video_stream0"], // Only video
                            }
                        ]
                    }
                }
            });
            return job.name;
        });
        // Update status to stitching
        await step.run("update-status-stitching", async () => {
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "stitching",
                transcoderJobName: jobName,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
        // Fix: Poll with step.sleep to avoid timeout
        let jobStatus = "PENDING";
        let retries = 0;
        while (jobStatus !== "SUCCEEDED" && jobStatus !== "FAILED" && retries < 60) {
            // Wait for 10 seconds between checks
            await step.sleep("wait-for-transcoder", "10s");
            jobStatus = await step.run(`check-status-${retries}`, async () => {
                var _a;
                const [job] = await transcoder.getJob({ name: jobName });
                if (job.state === "FAILED") {
                    throw new Error(`Transcoder job failed: ${(_a = job.error) === null || _a === void 0 ? void 0 : _a.message}`);
                }
                return job.state;
            });
            retries++;
        }
        if (jobStatus !== "SUCCEEDED") {
            throw new Error("Transcoder job timed out or failed to complete in time.");
        }
        // Construct public URL
        const finalVideoUrl = await step.run("get-final-url", async () => {
            return `https://storage.googleapis.com/${bucket.name}/videos/${userId}/${jobId}_output/final_output.mp4`;
        });
        // Update status to completed
        await step.run("mark-completed", async () => {
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "completed",
                videoUrl: finalVideoUrl,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
    }
    catch (error) {
        console.error("Stitching failed:", error);
        await step.run("mark-failed", async () => {
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "failed",
                stitchError: error.message,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
    }
    finally {
        await transcoder.close();
    }
});
exports.stitchVideoFn = stitchVideoFn;
//# sourceMappingURL=long_form_video.js.map