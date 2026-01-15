import * as admin from "firebase-admin";
import { GoogleAuth } from "google-auth-library";
import { z } from "zod";
import { TranscoderServiceClient } from "@google-cloud/video-transcoder";

/**
 * Robustly converts a Google Storage URL to a gs:// URI
 */
export function toGcsUri(url: string): string {
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
    } catch (e) {
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

export const LongFormVideoJobSchema = z.object({
    jobId: z.string().uuid().or(z.string().min(1)),
    userId: z.string(),
    orgId: z.string().optional().default("personal"),
    prompts: z.array(z.string()).min(1), // Validation fixed: must have at least 1 prompt
    totalDuration: z.string().optional(),
    startImage: z.string().optional(),
    options: z.object({
        aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
        resolution: z.string().optional(),
        seed: z.number().optional(),
        negativePrompt: z.string().optional(),
        generateAudio: z.boolean().optional(),
    }).optional().default({})
});

export type LongFormVideoJobInput = z.infer<typeof LongFormVideoJobSchema>;

/**
 * Validates and extracts Base64 string from a startImage input.
 * Supports Data URLs and raw Base64 strings.
 * Rejects remote URLs (http/https).
 */
export function validateStartImage(input: string): string {
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
    } else if (trimmed.includes(',')) {
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
const FRAME_EXTRACTION_POLL_INTERVAL_MS = 2000;
const FRAME_EXTRACTION_MAX_POLL_ATTEMPTS = 20;
const STITCH_POLL_INTERVAL_SECONDS = 10;
const STITCH_MAX_POLL_ATTEMPTS = 60;

// Video segment defaults
const DEFAULT_SEGMENT_DURATION_SECONDS = 5;
const DEFAULT_FRAME_EXTRACTION_OFFSET_SECONDS = 4.5;

// ----------------------------------------------------------------------------
// Inngest Functions
// ----------------------------------------------------------------------------

/**
 * Generates multiple video segments (Daisychaining)
 *
 * Uses Veo to generate each segment. If a startImage is provided (or extracted
 * from previous segment), it uses it for continuity.
 */
export const generateLongFormVideoFn = (inngestClient: any) => inngestClient.createFunction(
    { id: "generate-long-form-video" },
    { event: "video/long_form.requested" },
    async ({ event, step }: any) => {
        const { jobId, prompts, userId, startImage, options, orgId } = event.data;
        const segmentUrls: string[] = [];

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

                // FIX #2: Validate API key exists before use
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    throw new Error("GEMINI_API_KEY environment variable is not set");
                }

                const operationName = await step.run(`trigger-segment-${i}`, async () => {
                    const modelId = 'veo-3.1-generate-preview';
                    const triggerEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predictLongRunning?key=${apiKey}`;

                    // Validate startImage format (Base64 vs Data URL)
                    let imagePayload = undefined;
                    if (currentStartImage) {
                        const base64 = validateStartImage(currentStartImage);
                        imagePayload = { image: { bytesBase64Encoded: base64 } };
                    }

                    const requestBody = {
                        instances: [
                            {
                                prompt: prompt,
                                ...(imagePayload ? imagePayload : {})
                            }
                        ],
                        parameters: {
                            sampleCount: 1,
                            videoLength: `${DEFAULT_SEGMENT_DURATION_SECONDS}s`,
                            aspectRatio: options?.aspectRatio || "16:9",
                            ...(options?.generateAudio ? { generateAudio: true } : {})
                        }
                    };

                    const triggerResponse = await fetch(triggerEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });

                    if (!triggerResponse.ok) {
                        const errorText = await triggerResponse.text();
                        throw new Error(`Veo Trigger Segment ${i} failed: ${triggerResponse.status} ${errorText}`);
                    }

                    const triggerResult = await triggerResponse.json();
                    return triggerResult.name as string;
                });

                // FIX #1: Move polling outside step.run using step.sleep
                let segmentResult: any = null;
                let isDone = false;

                for (let attempt = 0; attempt < SEGMENT_MAX_POLL_ATTEMPTS; attempt++) {
                    // Use step.sleep instead of setTimeout inside step.run
                    await step.sleep(`wait-segment-${i}-${attempt}`, `${SEGMENT_POLL_INTERVAL_SECONDS}s`);

                    segmentResult = await step.run(`poll-segment-${i}-${attempt}`, async () => {
                        const statusResponse = await fetch(
                            `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
                        );
                        if (!statusResponse.ok) {
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
                    throw new Error(`Veo Segment ${i} timed out during polling after ${SEGMENT_MAX_POLL_ATTEMPTS * SEGMENT_POLL_INTERVAL_SECONDS}s`);
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
                    } else {
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


                // Extract last frame for daisychaining
                if (i < prompts.length - 1) {
                    // FIX #3: Better error handling for frame extraction - retry with fallback
                    let extractionAttempts = 0;
                    const maxExtractionAttempts = 2;

                    while (extractionAttempts < maxExtractionAttempts) {
                        try {
                            // 1. Trigger Frame Extraction Job
                            const jobName = await step.run(`trigger-extract-frame-${i}-attempt-${extractionAttempts}`, async () => {
                                const auth = new GoogleAuth({
                                    scopes: ['https://www.googleapis.com/auth/cloud-platform']
                                });
                                const transcoder = new TranscoderServiceClient();
                                try {
                                    const projectId = await auth.getProjectId();
                                    const location = 'us-central1';
                                    const bucket = admin.storage().bucket();
                                    const outputUri = `gs://${bucket.name}/frames/${userId}/${segmentId}/`;

                                    // Normalize Input URI
                                    const inputUri = toGcsUri(segmentUrl);

                                    // Calculate frame extraction time dynamically
                                    const videoDurationSeconds = DEFAULT_SEGMENT_DURATION_SECONDS;
                                    const extractionTime = Math.min(
                                        DEFAULT_FRAME_EXTRACTION_OFFSET_SECONDS,
                                        videoDurationSeconds - 0.5
                                    );
                                    const extractionSeconds = Math.floor(extractionTime);
                                    const extractionNanos = Math.floor((extractionTime - extractionSeconds) * 1_000_000_000);

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
                                } finally {
                                    await transcoder.close();
                                }
                            });

                            // 2. Poll for Completion using step.sleep
                            let finalState = 'PROCESSING';
                            for (let j = 0; j < FRAME_EXTRACTION_MAX_POLL_ATTEMPTS; j++) {
                                await step.sleep(`wait-extract-${i}-${extractionAttempts}-${j}`, `${FRAME_EXTRACTION_POLL_INTERVAL_MS / 1000}s`);

                                finalState = await step.run(`poll-extract-${i}-${extractionAttempts}-${j}`, async () => {
                                    const transcoder = new TranscoderServiceClient();
                                    try {
                                        const [status] = await transcoder.getJob({ name: jobName });
                                        return status.state as string;
                                    } catch (err: any) {
                                        console.warn(`[FrameExtraction] Polling error: ${err.message}`);
                                        return 'PROCESSING';
                                    } finally {
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

                            // 3. Download and Convert to Base64
                            const nextStartImage = await step.run(`download-frame-${i}-attempt-${extractionAttempts}`, async () => {
                                const bucket = admin.storage().bucket();
                                const [files] = await bucket.getFiles({ prefix: `frames/${userId}/${segmentId}/frame_` });

                                if (!files || files.length === 0) {
                                    throw new Error(`No frame file generated for segment ${i}`);
                                }

                                const frameFile = files[0];
                                const [buffer] = await frameFile.download();
                                return `data:image/jpeg;base64,${buffer.toString('base64')}`;
                            });

                            currentStartImage = nextStartImage;
                            break; // Success - exit retry loop
                        } catch (e: any) {
                            extractionAttempts++;
                            console.warn(`[LongForm] Frame extraction attempt ${extractionAttempts} failed for segment ${i}:`, e.message);

                            if (extractionAttempts >= maxExtractionAttempts) {
                                // FIX #3: Log detailed error and continue without chaining
                                // This prevents complete job failure while maintaining visibility
                                console.error(`[LongForm] All frame extraction attempts failed for segment ${i}. Continuing without visual continuity.`);
                                await step.run(`log-extraction-failure-${i}`, async () => {
                                    await admin.firestore().collection("videoJobs").doc(jobId).set({
                                        warnings: admin.firestore.FieldValue.arrayUnion(
                                            `Frame extraction failed for segment ${i}: ${e.message}. Visual continuity may be affected.`
                                        ),
                                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                    }, { merge: true });
                                });
                                // Clear currentStartImage to prevent using stale data
                                currentStartImage = undefined;
                            }
                        }
                    }
                }
            }

            // All segments done, trigger stitching
            const derivedMetadata = {
                duration_seconds: prompts.length * 5,
                fps: 30,
                mime_type: "video/mp4",
                resolution: options?.aspectRatio === "9:16" ? "720x1280" : "1280x720"
            };

            await step.sendEvent({
                name: "video/stitch.requested",
                data: {
                    jobId,
                    userId,
                    segmentUrls,
                    orgId,
                    metadata: derivedMetadata,
                    includeAudio: !!options?.generateAudio
                }
            });

        } catch (error: any) {
            console.error("[LongFormVideo] Error:", error);
            await step.run("mark-failed", async () => {
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    status: "failed",
                    error: error.message,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
        }
    }
);

/**
 * Stitches multiple video segments into one using Google Cloud Transcoder API
 *
 * FIX #5: Now supports audio when source videos have audio tracks
 */
export const stitchVideoFn = (inngestClient: any) => inngestClient.createFunction(
    { id: "stitch-video-segments" },
    { event: "video/stitch.requested" },
    async ({ event, step }: any) => {
        const { jobId, userId, segmentUrls, includeAudio } = event.data;
        const transcoder = new TranscoderServiceClient();
        try {
            const projectId = await admin.app().options.projectId;
            const location = 'us-central1';
            const bucket = admin.storage().bucket();
            const outputDir = `gs://${bucket.name}/videos/${userId}/${jobId}_output/`;

            const jobName = await step.run("create-transcoder-job", async () => {
                // FIX #5: Build elementary streams dynamically based on audio availability
                const elementaryStreams: any[] = [
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

                const [job] = await transcoder.createJob({
                    parent: transcoder.locationPath(projectId!, location),
                    job: {
                        outputUri: outputDir,
                        config: {
                            inputs: segmentUrls.map((url: string, index: number) => {
                                return { key: `input${index}`, uri: toGcsUri(url) };
                            }),
                            editList: [
                                {
                                    key: "atom0",
                                    inputs: segmentUrls.map((_: any, index: number) => `input${index}`)
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

            // Poll with step.sleep to avoid timeout (using constants)
            let jobStatus = "PENDING";
            let retries = 0;

            while (jobStatus !== "SUCCEEDED" && jobStatus !== "FAILED" && retries < STITCH_MAX_POLL_ATTEMPTS) {
                await step.sleep(`wait-for-transcoder-${retries}`, `${STITCH_POLL_INTERVAL_SECONDS}s`);

                jobStatus = await step.run(`check-status-${retries}`, async () => {
                    const [job] = await transcoder.getJob({ name: jobName });
                    if (job.state === "FAILED") {
                        throw new Error(`Transcoder job failed: ${job.error?.message}`);
                    }
                    return job.state as string;
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

        } catch (error: any) {
            console.error("Stitching failed:", error);
            await step.run("mark-failed", async () => {
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    status: "failed",
                    stitchError: error.message,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
        } finally {
            await transcoder.close();
        }
    }
);
