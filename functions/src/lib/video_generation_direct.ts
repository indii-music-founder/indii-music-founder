/**
 * video_generation_direct.ts
 *
 * Standalone video generation that bypasses Inngest entirely.
 * Runs the Vertex AI `:predictLongRunning` pipeline directly with native polling.
 *
 * This replaces the broken Inngest callback pipeline that has been a dead letter
 * queue since January 2026.
 */

import * as admin from "firebase-admin";
import { GoogleAuth } from "google-auth-library";
import { FUNCTION_AI_MODELS } from "../config/models";

/**
 * Sleep helper — replaces Inngest's `step.sleep()`.
 */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Fetch an image input (URL, data URI, or raw base64) and return pure base64 bytes.
 */
const fetchImageAsBase64 = async (input: string | undefined): Promise<string | undefined> => {
    if (!input) return undefined;
    if (input.startsWith('data:image')) {
        return input.replace(/^data:image\/\w+;base64,/, '');
    }
    if (input.startsWith('http')) {
        try {
            const res = await fetch(input);
            if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
            const buffer = await res.arrayBuffer();
            return Buffer.from(buffer).toString('base64');
        } catch (err) {
            console.error(`[VideoGenDirect] Failed to fetch frame from URL: ${input}`, err);
            return undefined;
        }
    }
    return input; // Assume raw base64
};

export interface DirectVideoGenerationParams {
    jobId: string;
    userId: string;
    orgId: string;
    prompt: string;
    options: Record<string, any>;
}

/**
 * Run the full Vertex AI video generation pipeline directly (no Inngest).
 *
 * 1. Updates Firestore → "processing"
 * 2. Calls Vertex AI `:predictLongRunning`
 * 3. Polls for completion (up to 5 min)
 * 4. Updates Firestore → "completed" with video URL
 * 5. On error → "failed" with error message
 */
export async function generateVideoDirect(params: DirectVideoGenerationParams): Promise<void> {
    const { jobId, userId, prompt, options } = params;
    const isThinking = options?.thinking === true;
    let finalPrompt = isThinking
        ? `[Think CINEMATIC PHYSICS & CONTINUITY]: ${prompt}`
        : prompt;

    if (finalPrompt.length > 500) {
        finalPrompt = finalPrompt.substring(0, 500);
    }

    console.log(`[VideoGenDirect] Starting for Job: ${jobId} (Thinking: ${isThinking})`);

    try {
        // ── Step 1: Update status to "processing" ──────────────────────────
        await admin.firestore().collection("videoJobs").doc(jobId).set({
            status: "processing",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log(`[VideoGenDirect] Status → processing for ${jobId}`);

        // ── Step 2: Trigger Vertex AI `:predictLongRunning` ────────────────
        const { model: requestedModel, generateAudio: requestedAudio } = options || {};
        const modelId = requestedModel === 'fast'
            ? FUNCTION_AI_MODELS.VIDEO.FAST
            : FUNCTION_AI_MODELS.VIDEO.PRO;

        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const projectId = await auth.getProjectId();
        const accessToken = await client.getAccessToken();

        const endpoint = `https://us-central1-aiplatform.googleapis.com/v1beta/projects/${projectId}/locations/us-central1/publishers/google/models/${modelId}:predictLongRunning`;

        const requestBody: any = {
            instances: [{ prompt: finalPrompt }],
            parameters: {
                sampleCount: 1,
                aspectRatio: options?.aspectRatio || "16:9",
                personGeneration: options?.personGeneration || "allow_adult",
                generateAudio: requestedAudio ?? true
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
            ]
        };

        // VEO 3.1: Resolution support
        if (options?.resolution) {
            requestBody.parameters.resolution = options.resolution;
        }

        // VEO 3.1: Duration support (4, 6, 8 seconds)
        const rawDuration = options?.durationSeconds || options?.duration;
        if (rawDuration) {
            let dur = typeof rawDuration === 'string' ? parseInt(rawDuration) : rawDuration;
            if (dur <= 4) dur = 4;
            else if (dur <= 6) dur = 6;
            else dur = 8;
            requestBody.parameters.durationSeconds = dur;

            // Force 8s for 1080p/4k
            if (['1080p', '4k'].includes(options?.resolution)) {
                requestBody.parameters.durationSeconds = 8;
            }
        }

        // VEO 3.1: Video Extension (Video-to-Video)
        const inputVideo = options?.inputVideo;
        if (inputVideo) {
            if (options?.resolution && options.resolution !== '720p') {
                console.warn("[VideoGenDirect] Video extension forces 720p resolution. Overriding.");
                requestBody.parameters.resolution = '720p';
            }

            const fetchVideoBytes = async (url: string) => {
                const res = await fetch(url);
                const buf = await res.arrayBuffer();
                return Buffer.from(buf).toString('base64');
            };

            if (!inputVideo.startsWith('http') && !inputVideo.startsWith('gs://')) {
                requestBody.instances[0].video = { bytesBase64Encoded: inputVideo };
            } else {
                const vBytes = await fetchVideoBytes(inputVideo);
                requestBody.instances[0].video = { bytesBase64Encoded: vBytes };
            }
            requestBody.parameters.personGeneration = "allow_all";
        }

        // VEO 3.1: First Frame (Image-to-Video)
        let startImageBytes: string | undefined;

        if (options?.image?.imageBytes) {
            startImageBytes = options.image.imageBytes;
        } else {
            startImageBytes = await fetchImageAsBase64(options?.firstFrame);
        }

        if (startImageBytes) {
            requestBody.instances[0].image = {
                bytesBase64Encoded: startImageBytes
            };
            requestBody.parameters.personGeneration = options?.personGeneration || "allow_adult";
        }

        // VEO 3.1: Last Frame (Interpolation)
        if (options?.lastFrame) {
            const lastImageBytes = await fetchImageAsBase64(options.lastFrame);
            if (lastImageBytes) {
                requestBody.parameters.lastFrame = {
                    bytesBase64Encoded: lastImageBytes
                };
                requestBody.parameters.personGeneration = options?.personGeneration || "allow_adult";
            }
        }

        // VEO 3.1: Ingredients (Reference Images — Up to 3)
        const refImages = options?.referenceImages || options?.ingredients;
        if (refImages && Array.isArray(refImages)) {
            requestBody.parameters.referenceImages = await Promise.all(refImages.slice(0, 3).map(async (ref: any) => {
                let rawContent = "";
                let refType = "ASSET";

                if (typeof ref === 'string') {
                    rawContent = ref;
                } else {
                    rawContent = ref.image?.imageBytes || ref.image?.uri || ref.data || "";
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
            requestBody.parameters.personGeneration = options?.personGeneration || "allow_adult";
            requestBody.parameters.duration = 8;
        }

        // ── Fire the request ───────────────────────────────────────────────
        console.log(`[VideoGenDirect] Calling Vertex AI: ${modelId}`);
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
        if (!result.name) throw new Error("No operation name returned from Vertex AI");

        const operationName = result.name;
        console.log(`[VideoGenDirect] Operation started: ${operationName}`);

        // ── Step 3: Poll for completion ────────────────────────────────────
        let isCompleted = false;
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes (5s * 60)
        let finalResult: any = null;

        while (!isCompleted && attempts < maxAttempts) {
            attempts++;
            await sleep(5000); // 5 second intervals

            // Re-authenticate for each poll (token may expire)
            const pollClient = await auth.getClient();
            const pollToken = await pollClient.getAccessToken();

            const statusEndpoint = `https://us-central1-aiplatform.googleapis.com/v1beta/${operationName}`;

            const statusResponse = await fetch(statusEndpoint, {
                headers: {
                    'Authorization': `Bearer ${pollToken.token}`
                }
            });

            if (!statusResponse.ok) {
                if (statusResponse.status >= 400 && statusResponse.status < 500) {
                    const errorText = await statusResponse.text();
                    throw new Error(`Vertex AI API Error: ${statusResponse.status} ${errorText}`);
                }
                // 5xx errors — retry
                console.warn(`[VideoGenDirect] Poll attempt ${attempts} returned ${statusResponse.status}, retrying...`);
                continue;
            }

            const statusData = await statusResponse.json();
            if (statusData.done) {
                finalResult = statusData;
                isCompleted = true;
            }

            // Update progress in Firestore every 5 polls
            if (attempts % 5 === 0) {
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    progress: Math.min(90, Math.round((attempts / maxAttempts) * 100)),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
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

        // ── Step 4: Process result ─────────────────────────────────────────
        const responseData = finalResult.response;
        console.log("[VideoGenDirect] Final Result:", JSON.stringify(finalResult, null, 2));

        let videoUri: string | null = null;
        let metadata: Record<string, any> = {};

        // Veo 3.1 Response Structure
        const generatedSamples = responseData.generateVideoResponse?.generatedSamples;
        if (generatedSamples && generatedSamples.length > 0) {
            const sample = generatedSamples[0];
            if (sample.video && sample.video.uri) {
                console.log(`[VideoGenDirect] Found video URI: ${sample.video.uri}`);

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

                videoUri = downloadUrl;
                metadata = {
                    mime_type: videoMetadata.mimeType || "video/mp4",
                    duration_seconds: durationSeconds,
                    fps: 24,
                    resolution: options?.resolution || "1080p"
                };
            }
        }

        // Fallback for older models
        if (!videoUri) {
            const outputs = responseData.outputs;
            if (outputs && outputs.length > 0) {
                const output = outputs[0];

                if (output.video && output.video.bytesBase64Encoded) {
                    const bucket = admin.storage().bucket();
                    const file = bucket.file(`videos/${userId}/${jobId}.mp4`);
                    await file.save(Buffer.from(output.video.bytesBase64Encoded, 'base64'), {
                        metadata: { contentType: 'video/mp4' },
                        public: true
                    });
                    videoUri = file.publicUrl();
                } else if (output.videoUri) {
                    videoUri = output.videoUri;
                } else if (output.gcsUri) {
                    videoUri = output.gcsUri;
                }

                if (videoUri) {
                    metadata = {
                        mime_type: "video/mp4",
                        duration_seconds: 5,
                        fps: 24
                    };
                }
            }
        }

        if (!videoUri) {
            throw new Error("No video data or URI found in operation response: " + JSON.stringify(responseData));
        }

        // ── Step 5: Update Firestore → "completed" ────────────────────────
        await admin.firestore().collection("videoJobs").doc(jobId).set({
            status: "completed",
            videoUrl: videoUri,
            progress: 100,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            output: {
                url: videoUri,
                metadata: {
                    ...metadata,
                    duration_seconds: metadata?.duration_seconds || 5,
                    fps: options?.fps || 30,
                    mime_type: "video/mp4",
                    resolution: options?.aspectRatio === "9:16" ? "720x1280" : "1280x720"
                }
            }
        }, { merge: true });

        console.log(`[VideoGenDirect] ✅ Job ${jobId} completed. Video: ${videoUri}`);

    } catch (error: any) {
        console.error(`[VideoGenDirect] ❌ Error in Video Generation (${jobId}):`, error);
        await admin.firestore().collection("videoJobs").doc(jobId).set({
            status: "failed",
            error: error.message || "Unknown error during video generation",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
}
