import * as admin from "firebase-admin";
import { GoogleAuth } from "google-auth-library";
import { z } from "zod";
import { TranscoderServiceClient } from "@google-cloud/video-transcoder";
import { Inngest } from "inngest";
import { FUNCTION_INTELLIGENCE_MODELS } from "../config/models";
import { getVertexAIBaseUrl } from "./vertexClient";
import { verifyMasterAudioObject } from '../functions/storage/verifyMasterAudio';
import {
    buildMasterAudioStitchPlan,
    type VerifiedMasterAudioForStitch,
} from '../functions/video/stitchMasterAudio';
import { finalizeOperationReservation } from '../functions/billing/enforceOperationCost';
import { renderFailureReservationOutcome } from '../functions/video/renderCostLifecycle';

/**
 * Robustly converts a Google Storage URL to a gs:// URI.
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
    totalDuration: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : val),
        z.coerce.number().optional(),
    ),
    startImage: z.string().optional(),
    options: z.object({
        aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
        resolution: z.string().optional(),
        seed: z.number().optional(),
        negativePrompt: z.string().optional(),
        generateAudio: z.boolean().optional(),
        thinking: z.boolean().optional(),
        model: z.string().optional(),
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
const STITCH_POLL_INTERVAL_SECONDS = 10;
const STITCH_MAX_POLL_ATTEMPTS = 60;

// Video segment defaults
const DEFAULT_SEGMENT_DURATION_SECONDS = 5;

// Frame extraction defaults
const DEFAULT_FRAME_EXTRACTION_OFFSET_SECONDS = 4.5;
const FRAME_EXTRACTION_POLL_INTERVAL_MS = 2000;
const FRAME_EXTRACTION_MAX_POLL_ATTEMPTS = 20;

function renderResolution(raw: unknown): { width: number; height: number } {
    if (typeof raw !== 'string') return { width: 1280, height: 720 };
    const match = raw.match(/^(\d{2,4})x(\d{2,4})$/);
    if (!match) return { width: 1280, height: 720 };
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (width < 64 || height < 64 || width > 3840 || height > 3840) {
        throw new Error('Requested render resolution is outside the allowed range.');
    }
    return { width, height };
}

// ----------------------------------------------------------------------------
// Inngest Functions
// ----------------------------------------------------------------------------

/**
 * Generates multiple video segments (Daisychaining)
 *
 * Uses Veo to generate each segment. If a startImage is provided (or extracted
 * from previous segment), it uses it for continuity.
 */
export const generateLongFormVideoFn = (inngestClient: Inngest, _legacyUnusedProviderCredential?: string) => inngestClient.createFunction(
    { id: "generate-long-form-video" },
    { event: "video/long_form.requested" },
    async ({ event, step }) => {
        const data = event.data as LongFormVideoJobInput;
        const { jobId, prompts, userId, startImage, options, orgId } = data;
        const segmentUrls: string[] = [];

        // Initialize currentStartImage
        let currentStartImage = startImage;
        const isThinking = options?.thinking === true;

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
                        ? FUNCTION_INTELLIGENCE_MODELS.VIDEO.FAST
                        : FUNCTION_INTELLIGENCE_MODELS.VIDEO.PRO;

                    const auth = new GoogleAuth({
                        scopes: ['https://www.googleapis.com/auth/cloud-platform']
                    });
                    const client = await auth.getClient();
                    const projectId = await auth.getProjectId();
                    const accessToken = await client.getAccessToken();

                    const location = process.env.VERTEX_VIDEO_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';
                    const triggerEndpoint = `${getVertexAIBaseUrl(location)}/v1beta/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;

                    // Validate startImage format (Base64 vs Data URL)
                    let imagePayload = undefined;
                    if (currentStartImage) {
                        const base64 = validateStartImage(currentStartImage);
                        imagePayload = { image: { bytesBase64Encoded: base64 } };
                    }

                    const requestBody = {
                        instances: [
                            {
                                prompt: segmentPrompt,
                                ...(imagePayload ? imagePayload : {})
                            }
                        ],
                        parameters: {
                            sampleCount: 1,
                            durationSeconds: DEFAULT_SEGMENT_DURATION_SECONDS,
                            aspectRatio: options?.aspectRatio || "16:9",
                            resolution: options?.resolution || "720p",
                            generateAudio: !!options?.generateAudio
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
                        if (triggerResponse.status === 404) {
                            throw new Error(`failed-precondition: Veo model not found or not deployed. Status ${triggerResponse.status}. ${errorText}`);
                        }
                        throw new Error(`Veo Trigger Segment ${i} failed: ${triggerResponse.status} ${errorText}`);
                    }

                    const triggerResult = (await triggerResponse.json()) as Record<string, unknown>;
                    return triggerResult.name as string;
                });

                // Polling Loop
                let segmentResult: Record<string, unknown> | null = null;
                let isDone = false;

                for (let attempt = 0; attempt < SEGMENT_MAX_POLL_ATTEMPTS; attempt++) {
                    await step.sleep(`wait-segment-${i}-${attempt}`, `${SEGMENT_POLL_INTERVAL_SECONDS}s`);

                    segmentResult = await step.run(`poll-segment-${i}-${attempt}`, async () => {
                        const auth = new GoogleAuth({
                            scopes: ['https://www.googleapis.com/auth/cloud-platform']
                        });
                        const client = await auth.getClient();
                        const accessToken = await client.getAccessToken();

                        const location = process.env.VERTEX_VIDEO_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';
                        const statusResponse = await fetch(
                            `${getVertexAIBaseUrl(location)}/v1beta/${operationName}`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${accessToken.token}`
                                }
                            }
                        );
                        if (!statusResponse.ok) {
                            if (statusResponse.status >= 400 && statusResponse.status < 500) {
                                const errorText = await statusResponse.text();
                                if (statusResponse.status === 404) {
                                    throw new Error(`failed-precondition: Vertex AI API Error: ${statusResponse.status} ${errorText}`);
                                }
                                throw new Error(`Vertex AI API Error: ${statusResponse.status} ${errorText}`);
                            }
                            return { done: false };
                        }
                        return (await statusResponse.json()) as Record<string, unknown>;
                    });

                    if (segmentResult?.done) {
                        isDone = true;
                        break;
                    }
                }

                if (!isDone || !segmentResult || !segmentResult.response) {
                    throw new Error(`Veo Segment ${i} timed out during polling`);
                }

                // Store segment in Cloud Storage
                const segmentUrl = await step.run(`store-segment-${i}`, async () => {
                    const response = segmentResult?.response as Record<string, unknown>;
                    const outputs = response?.outputs as Record<string, unknown>[];
                    const prediction = outputs?.[0];
                    const bucket = admin.storage().bucket();
                    const file = bucket.file(`videos/${userId}/${segmentId}.mp4`);

                    const video = prediction?.video as Record<string, unknown>;
                    if (video?.bytesBase64Encoded) {
                        await file.save(Buffer.from(video.bytesBase64Encoded as string, 'base64'), {
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


                // 4. Extract last frame for daisychaining
                if (i < prompts.length - 1) {
                    try {
                        let extractionAttempts = 0;
                        const maxExtractionAttempts = 2;

                        while (extractionAttempts < maxExtractionAttempts) {
                            try {
                                // 4a. Trigger Transcoder Job
                                const jobName = await step.run(`trigger-segment-extract-${i}-attempt-${extractionAttempts}`, async () => {
                                    const auth = new GoogleAuth({
                                        scopes: ['https://www.googleapis.com/auth/cloud-platform']
                                    });
                                    const transcoder = new TranscoderServiceClient();
                                    try {
                                        const projectId = await auth.getProjectId();
                                        const location = process.env.VERTEX_VIDEO_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';
                                        const bucket = admin.storage().bucket();
                                        const outputUri = `gs://${bucket.name}/frames/${userId}/${segmentId}/`;

                                        // Normalize Input URI
                                        const inputUri = toGcsUri(segmentUrl);

                                        // Calculate extraction time dynamically
                                        const extractionTime = Math.min(
                                            DEFAULT_FRAME_EXTRACTION_OFFSET_SECONDS,
                                            DEFAULT_SEGMENT_DURATION_SECONDS - 0.5
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
                                        return job.name as string;
                                    } finally {
                                        await transcoder.close();
                                    }
                                });

                                // 4b. Poll Transcoder Job
                                let finalState = 'PROCESSING';

                                for (let j = 0; j < FRAME_EXTRACTION_MAX_POLL_ATTEMPTS; j++) {
                                    await step.sleep(`wait-extract-${i}-${extractionAttempts}-${j}`, `${FRAME_EXTRACTION_POLL_INTERVAL_MS / 1000}s`);

                                    finalState = await step.run(`poll-extract-${i}-${extractionAttempts}-${j}`, async () => {
                                        const transcoder = new TranscoderServiceClient();
                                        try {
                                            const [status] = await transcoder.getJob({ name: jobName });
                                            return status.state as string;
                                        } catch (err: unknown) {
                                            console.warn(`[FrameExtraction] Polling error: ${(err as Error).message}`);
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
                            } catch (e: unknown) {
                                extractionAttempts++;
                                console.warn(`[LongForm] Frame extraction attempt ${extractionAttempts} failed for segment ${i}:`, (e as Error).message);

                                if (extractionAttempts >= maxExtractionAttempts) {
                                    console.error(`[LongForm] All frame extraction attempts failed for segment ${i}. Continuing without visual continuity.`);
                                    await step.run(`log-extraction-failure-${i}`, async () => {
                                        await admin.firestore().collection("videoJobs").doc(jobId).set({
                                            warnings: admin.firestore.FieldValue.arrayUnion(
                                                `Frame extraction failed for segment ${i}: ${(e as Error).message}. Visual continuity may be affected.`
                                            ),
                                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                        }, { merge: true });
                                    });
                                    currentStartImage = undefined;
                                }
                            }
                        }
                    } catch (e: unknown) {
                        const errorMsg = (e as Error).message;
                        console.error(`[LongForm] Unexpected error during segment ${i} continuity extraction:`, errorMsg);
                    }
                }
            } // end prompts loop

            // All segments done, trigger stitching
            const derivedMetadata = {
                duration_seconds: prompts.length * 5,
                fps: 30,
                mime_type: "video/mp4",
                resolution: options?.aspectRatio === "9:16" ? "720x1280" : "1280x720"
            };

            await step.sendEvent("trigger-stitch", {
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

        } catch (error: unknown) {
            console.error("[LongFormVideo] Error:", error);
            await step.run("mark-failed", async () => {
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    status: "failed",
                    error: (error as Error).message,
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
export const stitchVideoFn = (inngestClient: Inngest) => inngestClient.createFunction(
    { id: "stitch-video-segments" },
    { event: "video/stitch.requested" },
    async ({ event, step }) => {
        const eventData = event.data as Record<string, unknown>;
        const jobId = typeof eventData.jobId === 'string' ? eventData.jobId : '';
        const userId = typeof eventData.userId === 'string' ? eventData.userId : '';
        const segmentUrls = Array.isArray(eventData.segmentUrls)
            ? eventData.segmentUrls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
            : [];
        const includeAudio = eventData.includeAudio === true;
        const costReservationId = typeof eventData.costReservationId === 'string'
            ? eventData.costReservationId
            : undefined;
        const transcoder = new TranscoderServiceClient();
        try {
            const projectId = admin.app().options.projectId;
            const location = process.env.VERTEX_VIDEO_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';
            const bucket = admin.storage().bucket();
            const outputDir = `gs://${bucket.name}/videos/${userId}/${jobId}_output/`;

            if (!jobId || !userId || segmentUrls.length === 0) {
                throw new Error('Stitch request is missing its job, owner, or video segment contract.');
            }

            const rawMaster = eventData.masterAudio;
            const masterRecord = rawMaster && typeof rawMaster === 'object' && !Array.isArray(rawMaster)
                ? rawMaster as Record<string, unknown>
                : undefined;
            let masterAudio: VerifiedMasterAudioForStitch | undefined;
            if (masterRecord) {
                const verification = await step.run('reverify-canonical-master', async () => {
                    return verifyMasterAudioObject(userId, {
                        storagePath: masterRecord.storagePath as string,
                        expectedSha256: masterRecord.contentHash as string,
                        masterFingerprint: masterRecord.masterFingerprint as string,
                    });
                });
                if (verification.generation !== masterRecord.generation) {
                    throw new Error('Canonical master generation changed before the stitch worker started.');
                }
                masterAudio = {
                    storagePath: verification.storagePath,
                    contentHash: verification.contentHash,
                    generation: verification.generation,
                    masterFingerprint: masterRecord.masterFingerprint as string,
                    volume: masterRecord.volume as number,
                    uri: `gs://${bucket.name}/${verification.storagePath}`,
                };
            }

            const waitForTranscoderJob = async (jobName: string, stepPrefix: string): Promise<void> => {
                let jobStatus = 'PENDING';
                let retries = 0;
                while (jobStatus !== 'SUCCEEDED' && jobStatus !== 'FAILED' && retries < STITCH_MAX_POLL_ATTEMPTS) {
                    await step.sleep(`${stepPrefix}-wait-${retries}`, `${STITCH_POLL_INTERVAL_SECONDS}s`);
                    jobStatus = await step.run(`${stepPrefix}-status-${retries}`, async () => {
                        const result = await transcoder.getJob({ name: jobName });
                        const job = result[0];
                        if (job.state === 'FAILED') {
                            throw new Error(`Transcoder job failed: ${job.error?.message}`);
                        }
                        return job.state as string;
                    });
                    retries++;
                }
                if (jobStatus !== 'SUCCEEDED') {
                    throw new Error(`Transcoder job timed out after ${STITCH_MAX_POLL_ATTEMPTS * STITCH_POLL_INTERVAL_SECONDS}s.`);
                }
            };

            // Transcoder has no caller-provided idempotency key. Record an
            // intent immediately before every external submission so a worker
            // retry cannot incorrectly refund a provider job that may have
            // been accepted between the request and our next Firestore write.
            const markTranscoderSubmissionAttempted = async (stage: string): Promise<void> => {
                await step.run(`mark-${stage}-transcoder-submission-attempted`, async () => {
                    await admin.firestore().collection('videoJobs').doc(jobId).set({
                        status: 'stitching',
                        renderStage: stage,
                        transcoderSubmission: {
                            attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
                            stage,
                        },
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                });
            };

            if (masterAudio) {
                const options = eventData.options && typeof eventData.options === 'object'
                    ? eventData.options as Record<string, unknown>
                    : {};
                const plan = buildMasterAudioStitchPlan({
                    bucketName: bucket.name,
                    jobId,
                    userId,
                    resolution: renderResolution(options.resolution),
                    timelineDurationSeconds: Number(options.timelineDurationSeconds),
                    segmentUris: segmentUrls,
                    masterAudio,
                });

                await markTranscoderSubmissionAttempted('submitting_video_concatenation');
                const concatJobName = await step.run('concatenate-video-without-native-audio', async () => {
                    const [job] = await transcoder.createJob({
                        parent: transcoder.locationPath(projectId!, location),
                        job: { outputUri: plan.intermediateOutputUri, config: plan.concatenateConfig },
                    });
                    return job.name as string;
                });
                await step.run('mark-master-render-concatenating', async () => {
                    await admin.firestore().collection('videoJobs').doc(jobId).set({
                        status: 'stitching',
                        transcoderJobName: concatJobName,
                        renderStage: 'concatenating_video',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                });
                await waitForTranscoderJob(concatJobName, 'concat-video');

                await markTranscoderSubmissionAttempted('submitting_canonical_master_mix');
                const masterJobName = await step.run('map-canonical-master-audio', async () => {
                    const [job] = await transcoder.createJob({
                        parent: transcoder.locationPath(projectId!, location),
                        job: { outputUri: plan.finalOutputUri, config: plan.masterMixConfig },
                    });
                    return job.name as string;
                });
                await step.run('mark-master-render-mixing', async () => {
                    await admin.firestore().collection('videoJobs').doc(jobId).set({
                        status: 'stitching',
                        transcoderJobName: masterJobName,
                        renderStage: 'mapping_canonical_master',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                });
                await waitForTranscoderJob(masterJobName, 'map-master-audio');

                await step.run('mark-master-render-completed', async () => {
                    await admin.firestore().collection('videoJobs').doc(jobId).set({
                        status: 'completed',
                        videoUrl: `https://storage.googleapis.com/${bucket.name}/videos/${userId}/${jobId}_output/master-pass/final_output.mp4`,
                        output: {
                            url: `https://storage.googleapis.com/${bucket.name}/videos/${userId}/${jobId}_output/master-pass/final_output.mp4`,
                            metadata: {
                                duration_seconds: segmentUrls.length * 5,
                                fps: 30,
                                mime_type: 'video/mp4',
                                audioMix: 'master_replaces_native',
                                masterContentHash: masterAudio.contentHash,
                                masterGeneration: masterAudio.generation,
                            },
                        },
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                });
                if (costReservationId) {
                    await step.run('settle-master-render-cost', async () => {
                        await finalizeOperationReservation({ userId, operationId: costReservationId, outcome: 'SETTLED' });
                    });
                }
                return;
            }

            await markTranscoderSubmissionAttempted('submitting_standard_stitch');
            const jobName = await step.run("create-transcoder-job", async () => {
                // FIX #5: Build elementary streams dynamically based on audio availability
                const elementaryStreams: Record<string, unknown>[] = [
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
                                    inputs: segmentUrls.map((_url: string, index: number) => `input${index}`)
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
                const jobList = jobResult as Record<string, unknown>[];
                const job = jobList[0];
                return job.name as string;
            });

            // Update status to stitching
            await step.run("update-status-stitching", async () => {
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    status: "stitching",
                    transcoderJobName: jobName,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });

            await waitForTranscoderJob(jobName, 'stitch-video');

            // Construct public URL
            const finalVideoUrl = await step.run("get-final-url", async () => {
                return `https://storage.googleapis.com/${bucket.name}/videos/${userId}/${jobId}_output/final_output.mp4`;
            });

            // Update status to completed
            await step.run("mark-completed", async () => {
                const eventData = event.data as Record<string, unknown>;
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    status: "completed",
                    videoUrl: finalVideoUrl,
                    output: {
                        url: finalVideoUrl,
                        metadata: (eventData.metadata as Record<string, unknown>) || {
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
            if (costReservationId) {
                await step.run('settle-render-cost', async () => {
                    await finalizeOperationReservation({ userId, operationId: costReservationId, outcome: 'SETTLED' });
                });
            }

        } catch (error: unknown) {
            console.error('Stitching failed', { jobId });
            try {
                await step.run("mark-failed", async () => {
                    await admin.firestore().collection("videoJobs").doc(jobId).set({
                        status: "failed",
                        stitchError: 'The cloud renderer could not complete this job.',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                });
            } catch {
                // Continue into financial reconciliation. A status-write outage
                // must not turn a possibly submitted provider job into a refund.
                console.error('Unable to record render failure status', { jobId });
            }
            if (costReservationId) {
                const transcoderSubmissionAttempted = jobId
                    ? await step.run('inspect-transcoder-submission-for-cost', async () => {
                        try {
                            const job = await admin.firestore().collection('videoJobs').doc(jobId).get();
                            const submission = job.data()?.transcoderSubmission as Record<string, unknown> | undefined;
                            return submission?.attemptedAt !== undefined;
                        } catch {
                            // Fail closed financially: if the worker cannot
                            // inspect durable evidence, do not assert that no
                            // provider submission occurred.
                            return true;
                        }
                    })
                    : false;
                const outcome = renderFailureReservationOutcome({ transcoderSubmissionAttempted });
                await step.run('reconcile-failed-render-cost', async () => {
                    await finalizeOperationReservation({ userId, operationId: costReservationId, outcome });
                });
            }
        } finally {
            await transcoder.close();
        }
    }
);
