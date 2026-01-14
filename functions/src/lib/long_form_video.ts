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

                const segmentUrl = await step.run(`generate-segment-${i}`, async () => {
                    const auth = new GoogleAuth({
                        scopes: ['https://www.googleapis.com/auth/cloud-platform']
                    });

                    const client = await auth.getClient();
                    const projectId = await auth.getProjectId();
                    const accessToken = await client.getAccessToken();
                    const location = 'us-central1';
                    const modelId = 'veo-3.1-generate-preview';

                    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

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
                            videoLength: "5s",
                            aspectRatio: options?.aspectRatio || "16:9"
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

                    if (!result.predictions || result.predictions.length === 0) {
                        throw new Error(`Veo Segment ${i}: No predictions returned. Response: ${JSON.stringify(result)}`);
                    }

                    const prediction = result.predictions[0];
                    const bucket = admin.storage().bucket();
                    const file = bucket.file(`videos/${userId}/${segmentId}.mp4`);

                    if (prediction.bytesBase64Encoded) {
                        await file.save(Buffer.from(prediction.bytesBase64Encoded, 'base64'), {
                            metadata: { contentType: 'video/mp4' },
                            public: true
                        });

                    } else if (!prediction.videoUri && !prediction.gcsUri) {
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
                            const auth = new GoogleAuth({
                                scopes: ['https://www.googleapis.com/auth/cloud-platform']
                            });
                            const transcoder = new TranscoderServiceClient();
                            try {
                                const projectId = await auth.getProjectId();
                                const location = 'us-central1';
                                const bucket = admin.storage().bucket();
                                const outputUri = `gs://${bucket.name}/frames/${userId}/${segmentId}/`;

                                // 1. Normalize Input URI
                                const inputUri = toGcsUri(segmentUrl);

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
                                            finalState = status.state as string;
                                            break;
                                        }
                                    } catch (err: any) {
                                        console.warn(`[FrameExtraction] Polling error: ${err.message}`);
                                        // Continue polling unless critical failure
                                    }
                                }

                                if (finalState !== 'SUCCEEDED') throw new Error(`Frame extraction failed or timed out: ${finalState}`);

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
                            } finally {
                                await transcoder.close();
                            }
                        });

                        currentStartImage = nextStartImage;
                    } catch (e: any) {
                        console.warn(`[LongForm] Frame extraction failed for segment ${i}:`, e.message);
                        // Continue without chaining if extraction fails
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
                    metadata: derivedMetadata
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
 */
export const stitchVideoFn = (inngestClient: any) => inngestClient.createFunction(
    { id: "stitch-video-segments" },
    { event: "video/stitch.requested" },
    async ({ event, step }: any) => {
        const { jobId, userId, segmentUrls } = event.data;
        const transcoder = new TranscoderServiceClient();
        try {
            const projectId = await admin.app().options.projectId;
            const location = 'us-central1';
            const bucket = admin.storage().bucket();
            const outputDir = `gs://${bucket.name}/videos/${userId}/${jobId}_output/`;

            const jobName = await step.run("create-transcoder-job", async () => {
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
                await step.sleep(`wait-for-transcoder-${retries}`, "10s");

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
