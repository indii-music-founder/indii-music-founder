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
exports.stitchVideoFn = exports.generateLongFormVideoFn = exports.LongFormVideoJobSchema = void 0;
exports.toGcsUri = toGcsUri;
exports.validateStartImage = validateStartImage;
const admin = __importStar(require("firebase-admin"));
const google_auth_library_1 = require("google-auth-library");
const zod_1 = require("zod");
const video_transcoder_1 = require("@google-cloud/video-transcoder");
const models_1 = require("../config/models");
/**
 * Robustly converts a Google Storage URL to a gs:// URI.
 */
function toGcsUri(url) {
    const uri = url;
    try {
        if (uri.startsWith('gs://')) {
            return uri;
        }
        if (uri.startsWith('http')) {
            const u = new URL(uri);
            if (u.hostname === 'storage.googleapis.com' || u.hostname === 'storage.cloud.google.com') {
                // Remove leading slash from pathname and decode to handle spaces/special chars
                const path = decodeURIComponent(u.pathname.substring(1));
                return `gs://${path}`;
            }
        }
    }
    catch (e) {
        console.warn(`[toGcsUri] Failed to parse URL ${url}:`, e);
    }
    // Fallback for simple cases or failures
    if (uri.startsWith('https://storage.googleapis.com/')) {
        return uri.replace('https://storage.googleapis.com/', 'gs://');
    }
    return uri;
}
// ----------------------------------------------------------------------------
// Types & Schemas
// ----------------------------------------------------------------------------
exports.LongFormVideoJobSchema = zod_1.z.object({
    jobId: zod_1.z.string().uuid().or(zod_1.z.string().min(1)),
    userId: zod_1.z.string(),
    orgId: zod_1.z.string().optional().default("personal"),
    prompts: zod_1.z.array(zod_1.z.string()).min(1), // Validation fixed: must have at least 1 prompt
    totalDuration: zod_1.z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), zod_1.z.coerce.number().optional()),
    startImage: zod_1.z.string().optional(),
    options: zod_1.z.object({
        aspectRatio: zod_1.z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
        resolution: zod_1.z.string().optional(),
        seed: zod_1.z.number().optional(),
        negativePrompt: zod_1.z.string().optional(),
        generateAudio: zod_1.z.boolean().optional(),
        thinking: zod_1.z.boolean().optional(),
        model: zod_1.z.string().optional(),
    }).optional().default({})
});
/**
 * Validates and extracts Base64 string from a startImage input.
 * Supports Data URLs and raw Base64 strings.
 * Rejects remote URLs (http/https).
 */
function validateStartImage(input) {
    const trimmed = input.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        throw new Error("Invalid startImage: Remote URLs are not supported. Please provide a Base64 string or Data URL.");
    }
    let base64 = trimmed;
    if (trimmed.startsWith('data:')) {
        const commaIndex = trimmed.indexOf(',');
        if (commaIndex === -1) {
            throw new Error("Invalid startImage: Malformed Data URL (missing comma).");
        }
        base64 = trimmed.slice(commaIndex + 1);
    }
    else if (trimmed.includes(',')) {
        // Reject comma in raw base64
        throw new Error("Invalid startImage: Raw Base64 string cannot contain commas.");
    }
    // Validate Base64 characters (allowing whitespace which we strip)
    const cleanBase64 = base64.replace(/\s/g, '');
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    // Ensure it is not empty
    if (cleanBase64.length === 0) {
        throw new Error("Invalid startImage: Empty Base64 string.");
    }
    if (!base64Regex.test(cleanBase64)) {
        throw new Error("Invalid startImage: String contains invalid Base64 characters.");
    }
    return cleanBase64;
}
// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
// Polling configuration
const SEGMENT_POLL_INTERVAL_SECONDS = 10;
const SEGMENT_MAX_POLL_ATTEMPTS = 30;
const STITCH_POLL_INTERVAL_SECONDS = 10;
const STITCH_MAX_POLL_ATTEMPTS = 60;
// Video segment defaults
const DEFAULT_SEGMENT_DURATION_SECONDS = 5;
// Frame extraction defaults
const DEFAULT_FRAME_EXTRACTION_OFFSET_SECONDS = 4.5;
const FRAME_EXTRACTION_POLL_INTERVAL_MS = 2000;
const FRAME_EXTRACTION_MAX_POLL_ATTEMPTS = 20;
// ----------------------------------------------------------------------------
// Inngest Functions
// ----------------------------------------------------------------------------
/**
 * Generates multiple video segments (Daisychaining)
 *
 * Uses Veo to generate each segment. If a startImage is provided (or extracted
 * from previous segment), it uses it for continuity.
 */
const generateLongFormVideoFn = (inngestClient, _geminiApiKey) => inngestClient.createFunction({ id: "generate-long-form-video" }, { event: "video/long_form.requested" }, async ({ event, step }) => {
    const { jobId, prompts, userId, startImage, options, orgId } = event.data;
    const segmentUrls = [];
    // Initialize currentStartImage
    let currentStartImage = startImage;
    const isThinking = (options === null || options === void 0 ? void 0 : options.thinking) === true;
    console.log(`[Inngest] Starting long-form generation for Job: ${jobId} (Thinking: ${isThinking})`);
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
            const rawPrompt = prompts[i];
            let segmentPrompt = isThinking
                ? `[Think CINEMATIC PHYSICS & CONTINUITY]: ${rawPrompt}`
                : rawPrompt;
            if (segmentPrompt.length > 500) {
                segmentPrompt = segmentPrompt.substring(0, 500);
            }
            // 1. Trigger Video Generation (Vertex AI)
            const operationName = await step.run(`trigger-segment-${i}`, async () => {
                const { model: requestedModel } = options || {};
                const modelId = requestedModel === 'fast'
                    ? models_1.FUNCTION_AI_MODELS.VIDEO.FAST
                    : models_1.FUNCTION_AI_MODELS.VIDEO.PRO;
                const auth = new google_auth_library_1.GoogleAuth({
                    scopes: ['https://www.googleapis.com/auth/cloud-platform']
                });
                const client = await auth.getClient();
                const projectId = await auth.getProjectId();
                const accessToken = await client.getAccessToken();
                const triggerEndpoint = `https://us-central1-aiplatform.googleapis.com/v1beta/projects/${projectId}/locations/us-central1/publishers/google/models/${modelId}:predictLongRunning`;
                // Validate startImage format (Base64 vs Data URL)
                let imagePayload = undefined;
                if (currentStartImage) {
                    const base64 = validateStartImage(currentStartImage);
                    imagePayload = { image: { bytesBase64Encoded: base64 } };
                }
                const requestBody = {
                    instances: [
                        Object.assign({ prompt: segmentPrompt }, (imagePayload ? imagePayload : {}))
                    ],
                    parameters: {
                        sampleCount: 1,
                        durationSeconds: DEFAULT_SEGMENT_DURATION_SECONDS,
                        aspectRatio: (options === null || options === void 0 ? void 0 : options.aspectRatio) || "16:9",
                        resolution: (options === null || options === void 0 ? void 0 : options.resolution) || "720p",
                        generateAudio: !!(options === null || options === void 0 ? void 0 : options.generateAudio)
                    }
                };
                const triggerResponse = await fetch(triggerEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken.token}`
                    },
                    body: JSON.stringify(requestBody)
                });
                if (!triggerResponse.ok) {
                    const errorText = await triggerResponse.text();
                    throw new Error(`Veo Trigger Segment ${i} failed: ${triggerResponse.status} ${errorText}`);
                }
                const triggerResult = await triggerResponse.json();
                return triggerResult.name;
            });
            // Polling Loop
            let segmentResult = null;
            let isDone = false;
            for (let attempt = 0; attempt < SEGMENT_MAX_POLL_ATTEMPTS; attempt++) {
                await step.sleep(`wait-segment-${i}-${attempt}`, `${SEGMENT_POLL_INTERVAL_SECONDS}s`);
                segmentResult = await step.run(`poll-segment-${i}-${attempt}`, async () => {
                    const auth = new google_auth_library_1.GoogleAuth({
                        scopes: ['https://www.googleapis.com/auth/cloud-platform']
                    });
                    const client = await auth.getClient();
                    const accessToken = await client.getAccessToken();
                    const statusResponse = await fetch(`https://us-central1-aiplatform.googleapis.com/v1beta/${operationName}`, {
                        headers: {
                            'Authorization': `Bearer ${accessToken.token}`
                        }
                    });
                    if (!statusResponse.ok) {
                        if (statusResponse.status >= 400 && statusResponse.status < 500) {
                            const errorText = await statusResponse.text();
                            throw new Error(`Vertex AI API Error: ${statusResponse.status} ${errorText}`);
                        }
                        return { done: false };
                    }
                    return await statusResponse.json();
                });
                if (segmentResult.done) {
                    isDone = true;
                    break;
                }
            }
            if (!isDone || !segmentResult || !segmentResult.response) {
                throw new Error(`Veo Segment ${i} timed out during polling`);
            }
            // Store segment in Cloud Storage
            const segmentUrl = await step.run(`store-segment-${i}`, async () => {
                const prediction = segmentResult.response.outputs[0];
                const bucket = admin.storage().bucket();
                const file = bucket.file(`videos/${userId}/${segmentId}.mp4`);
                if (prediction.video && prediction.video.bytesBase64Encoded) {
                    await file.save(Buffer.from(prediction.video.bytesBase64Encoded, 'base64'), {
                        metadata: { contentType: 'video/mp4' },
                        public: true
                    });
                }
                else {
                    throw new Error(`Unknown Veo response format for segment ${i}: ` + JSON.stringify(prediction));
                }
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
            // 4. Extract last frame for daisychaining
            if (i < prompts.length - 1) {
                try {
                    let extractionAttempts = 0;
                    const maxExtractionAttempts = 2;
                    while (extractionAttempts < maxExtractionAttempts) {
                        try {
                            // 4a. Trigger Transcoder Job
                            const jobName = await step.run(`trigger-segment-extract-${i}-attempt-${extractionAttempts}`, async () => {
                                const auth = new google_auth_library_1.GoogleAuth({
                                    scopes: ['https://www.googleapis.com/auth/cloud-platform']
                                });
                                const transcoder = new video_transcoder_1.TranscoderServiceClient();
                                try {
                                    const projectId = await auth.getProjectId();
                                    const location = 'us-central1';
                                    const bucket = admin.storage().bucket();
                                    const outputUri = `gs://${bucket.name}/frames/${userId}/${segmentId}/`;
                                    // Normalize Input URI
                                    const inputUri = toGcsUri(segmentUrl);
                                    // Calculate extraction time dynamically
                                    const extractionTime = Math.min(DEFAULT_FRAME_EXTRACTION_OFFSET_SECONDS, DEFAULT_SEGMENT_DURATION_SECONDS - 0.5);
                                    const extractionSeconds = Math.floor(extractionTime);
                                    const extractionNanos = Math.floor((extractionTime - extractionSeconds) * 1000000000);
                                    // Create Sprite Job
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
                                                        startTimeOffset: { seconds: extractionSeconds, nanos: extractionNanos },
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
                                    return job.name;
                                }
                                finally {
                                    await transcoder.close();
                                }
                            });
                            // 4b. Poll Transcoder Job
                            let finalState = 'PROCESSING';
                            for (let j = 0; j < FRAME_EXTRACTION_MAX_POLL_ATTEMPTS; j++) {
                                await step.sleep(`wait-extract-${i}-${extractionAttempts}-${j}`, `${FRAME_EXTRACTION_POLL_INTERVAL_MS / 1000}s`);
                                finalState = await step.run(`poll-extract-${i}-${extractionAttempts}-${j}`, async () => {
                                    const transcoder = new video_transcoder_1.TranscoderServiceClient();
                                    try {
                                        const [status] = await transcoder.getJob({ name: jobName });
                                        return status.state;
                                    }
                                    catch (err) {
                                        console.warn(`[FrameExtraction] Polling error: ${err.message}`);
                                        return 'PROCESSING';
                                    }
                                    finally {
                                        await transcoder.close();
                                    }
                                });
                                if (finalState === 'SUCCEEDED' || finalState === 'FAILED') {
                                    break;
                                }
                            }
                            if (finalState !== 'SUCCEEDED') {
                                throw new Error(`Frame extraction failed or timed out: ${finalState}`);
                            }
                            // 4c. Download Frame
                            currentStartImage = await step.run(`download-frame-${i}-attempt-${extractionAttempts}`, async () => {
                                const bucket = admin.storage().bucket();
                                const [files] = await bucket.getFiles({ prefix: `frames/${userId}/${segmentId}/frame_` });
                                if (!files || files.length === 0) {
                                    throw new Error(`No frame file generated for segment ${i}`);
                                }
                                const frameFile = files[0];
                                const [buffer] = await frameFile.download();
                                return `data:image/jpeg;base64,${buffer.toString('base64')}`;
                            });
                            break; // Success - exit retry loop
                        }
                        catch (e) {
                            extractionAttempts++;
                            console.warn(`[LongForm] Frame extraction attempt ${extractionAttempts} failed for segment ${i}:`, e.message);
                            if (extractionAttempts >= maxExtractionAttempts) {
                                console.error(`[LongForm] All frame extraction attempts failed for segment ${i}. Continuing without visual continuity.`);
                                await step.run(`log-extraction-failure-${i}`, async () => {
                                    await admin.firestore().collection("videoJobs").doc(jobId).set({
                                        warnings: admin.firestore.FieldValue.arrayUnion(`Frame extraction failed for segment ${i}: ${e.message}. Visual continuity may be affected.`),
                                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                    }, { merge: true });
                                });
                                currentStartImage = undefined;
                            }
                        }
                    }
                }
                catch (e) {
                    const errorMsg = e.message;
                    console.error(`[LongForm] Unexpected error during segment ${i} continuity extraction:`, errorMsg);
                }
            }
        } // end prompts loop
        // All segments done, trigger stitching
        const derivedMetadata = {
            duration_seconds: prompts.length * 5,
            fps: 30,
            mime_type: "video/mp4",
            resolution: (options === null || options === void 0 ? void 0 : options.aspectRatio) === "9:16" ? "720x1280" : "1280x720"
        };
        await step.sendEvent({
            name: "video/stitch.requested",
            data: {
                jobId,
                userId,
                segmentUrls,
                orgId,
                metadata: derivedMetadata,
                includeAudio: !!(options === null || options === void 0 ? void 0 : options.generateAudio)
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
 *
 * FIX #5: Now supports audio when source videos have audio tracks
 */
const stitchVideoFn = (inngestClient) => inngestClient.createFunction({ id: "stitch-video-segments" }, { event: "video/stitch.requested" }, async ({ event, step }) => {
    const { jobId, userId, segmentUrls, includeAudio } = event.data;
    const transcoder = new video_transcoder_1.TranscoderServiceClient();
    try {
        const projectId = await admin.app().options.projectId;
        const location = 'us-central1';
        const bucket = admin.storage().bucket();
        const outputDir = `gs://${bucket.name}/videos/${userId}/${jobId}_output/`;
        const jobName = await step.run("create-transcoder-job", async () => {
            // FIX #5: Build elementary streams dynamically based on audio availability
            const elementaryStreams = [
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
            ];
            // Add audio stream if source videos have audio
            if (includeAudio) {
                elementaryStreams.push({
                    key: "audio_stream0",
                    audioStream: {
                        codec: "aac",
                        bitrateBps: 128000,
                        channelCount: 2,
                        sampleRateHertz: 48000,
                    },
                });
            }
            const muxStreamElementary = includeAudio
                ? ["video_stream0", "audio_stream0"]
                : ["video_stream0"];
            const jobResult = await transcoder.createJob({
                parent: transcoder.locationPath(projectId, location),
                job: {
                    outputUri: outputDir,
                    config: {
                        inputs: segmentUrls.map((url, index) => {
                            return { key: `input${index}`, uri: toGcsUri(url) };
                        }),
                        editList: [
                            {
                                key: "atom0",
                                inputs: segmentUrls.map((_url, index) => `input${index}`)
                            }
                        ],
                        elementaryStreams,
                        muxStreams: [
                            {
                                key: "final_output",
                                container: "mp4",
                                elementaryStreams: muxStreamElementary,
                            }
                        ]
                    }
                }
            });
            const job = jobResult[0];
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
        // Poll with step.sleep
        // Poll with step.sleep to avoid timeout (using constants)
        let jobStatus = "PENDING";
        let retries = 0;
        while (jobStatus !== "SUCCEEDED" && jobStatus !== "FAILED" && retries < STITCH_MAX_POLL_ATTEMPTS) {
            await step.sleep(`wait-for-transcoder-${retries}`, `${STITCH_POLL_INTERVAL_SECONDS}s`);
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
            throw new Error(`Transcoder job timed out after ${STITCH_MAX_POLL_ATTEMPTS * STITCH_POLL_INTERVAL_SECONDS}s.`);
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
                output: {
                    url: finalVideoUrl,
                    metadata: event.data.metadata || {
                        // Fallback if metadata missing in event
                        duration_seconds: segmentUrls.length * 5,
                        fps: 30,
                        mime_type: "video/mp4",
                        resolution: "1280x720"
                    }
                },
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