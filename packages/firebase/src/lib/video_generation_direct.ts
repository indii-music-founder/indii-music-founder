/**
 * video_generation_direct.ts
 *
 * Video generation using the @google/genai SDK with Vertex AI backend.
 * Uses the same SDK methods as the Gemini API docs, but with vertexai:true
 * for production Cloud Functions (ADC auth, no API key needed).
 *
 * Previous approach used raw REST to Vertex AI predictLongRunning which returned 404.
 * The SDK handles endpoint routing automatically.
 */

import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import { FUNCTION_AI_MODELS } from "../config/models";

/**
 * Sleep helper.
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
    options: Record<string, unknown>;
}

/**
 * Run video generation using the @google/genai SDK with Vertex AI backend.
 *
 * Pattern from official docs (https://ai.google.dev/gemini-api/docs/video):
 *   1. ai.models.generateVideos({ model, prompt, config }) → operation
 *   2. Poll with ai.operations.getVideosOperation({ operation })
 *   3. Result in operation.response.generatedVideos[0].video
 *   4. Extract video URI and update Firestore
 */
export async function generateVideoDirect(params: DirectVideoGenerationParams): Promise<void> {
    const { jobId, userId, prompt, options: rawOptions } = params;
    const options = rawOptions as Record<string, unknown>;
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

        // ── Step 2: Initialize SDK ─────────────────────────────────────────
        const { model: requestedModel } = options || {};
        const modelId = requestedModel === 'fast'
            ? FUNCTION_AI_MODELS.VIDEO.FAST
            : FUNCTION_AI_MODELS.VIDEO.PRO;

        // Vertex AI for production — ADC handles auth automatically in Cloud Functions
        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'indiios-v-1-1';
        const ai = new GoogleGenAI({
            vertexai: true,
            project: projectId,
            location: 'us-central1',
        });

        console.log(`[VideoGenDirect] Using Vertex AI SDK with model: ${modelId}, project: ${projectId}`);

        // ── Step 3: Build config ───────────────────────────────────────────
        // Only include parameters confirmed by official docs:
        // aspectRatio, durationSeconds, personGeneration, resolution, numberOfVideos
        const config: Record<string, unknown> = {
            numberOfVideos: 1,
        };

        // Aspect ratio
        const aspectRatio = options?.aspectRatio;
        if (aspectRatio === "9:16" || aspectRatio === "16:9") {
            config.aspectRatio = aspectRatio;
        } else {
            config.aspectRatio = "16:9"; // Default
        }

        // Duration — must be 4, 5, 6, or 8
        const rawDuration = options.durationSeconds || options.duration;
        if (rawDuration) {
            let dur = typeof rawDuration === 'string' ? parseInt(rawDuration) : (rawDuration as number);
            if (dur <= 4) dur = 4;
            else if (dur <= 6) dur = 6; // strictly 4, 6, or 8 for Veo 3.1
            else dur = 8;
            config.durationSeconds = dur;
        }

        // Person generation — Veo 3.1 supports allow_adult, allow_all
        if (options.personGeneration) {
            config.personGeneration = options.personGeneration;
        }

        // Resolution — 720p, 1080p, 4k
        if (options.resolution && ['720p', '1080p', '4k'].includes(options.resolution as string)) {
            config.resolution = options.resolution;
        }

        // ── Step 4: Build image input if provided ──────────────────────────
        let imageInput: { imageBytes: string; mimeType: string } | undefined;

        let startImageBytes: string | undefined;
        const optImage = (options.image as Record<string, unknown>) || {};
        if (optImage.imageBytes) {
            startImageBytes = optImage.imageBytes as string;
        } else {
            startImageBytes = await fetchImageAsBase64(options.firstFrame as string);
        }
        if (startImageBytes) {
            imageInput = {
                imageBytes: startImageBytes,
                mimeType: "image/png",
            };
        }

        // ── Step 5: Call SDK — exact pattern from official docs ─────────────
        console.log(`[VideoGenDirect] Calling ai.models.generateVideos() with model: ${modelId}`);

        let operation;
        if (imageInput) {
            // Image-to-video
            operation = await ai.models.generateVideos({
                model: modelId,
                prompt: finalPrompt,
                image: imageInput,
                config: config,
            });
        } else {
            // Text-to-video
            operation = await ai.models.generateVideos({
                model: modelId,
                prompt: finalPrompt,
                config: config,
            });
        }

        console.log(`[VideoGenDirect] Operation created. Polling for completion...`);

        // ── Step 6: Poll for completion ────────────────────────────────────
        // Official pattern: ai.operations.getVideosOperation({ operation })
        let attempts = 0;
        const maxAttempts = 36; // 6 minutes at 10s intervals (video gen takes 11s-6min per docs)

        while (!operation.done && attempts < maxAttempts) {
            attempts++;
            await sleep(10000); // 10 second intervals per official docs

            // Update progress in Firestore every 3 polls
            if (attempts % 3 === 0) {
                const progress = Math.min(90, Math.round((attempts / maxAttempts) * 100));
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    progress: progress,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log(`[VideoGenDirect] Poll ${attempts}/${maxAttempts} (${progress}%) for ${jobId}`);
            }

            try {
                operation = await ai.operations.getVideosOperation({ operation });
            } catch (pollErr: unknown) {
                const err = pollErr as Error;
                console.warn(`[VideoGenDirect] Poll attempt ${attempts} failed: ${err.message}`);
                if (attempts >= maxAttempts) {
                    throw new Error(`Polling failed after ${attempts} attempts: ${err.message}`);
                }
            }
        }

        if (!operation.done) {
            throw new Error(`Video generation timed out after ${attempts * 10}s.`);
        }

        console.log(`[VideoGenDirect] Operation complete for ${jobId}`);

        // ── Step 7: Extract video from response ────────────────────────────
        const response = operation.response as unknown as { generatedVideos?: Array<Record<string, unknown>> };
        if (!response) {
            const opAny = operation as unknown as { error?: { message?: string } };
            if (opAny.error) {
                console.error(`[VideoGenDirect] Vertex AI Operation Error details:`, JSON.stringify(opAny.error, null, 2));
                throw new Error(`Vertex AI API Error: ${opAny.error.message || JSON.stringify(opAny.error)}`);
            }
            throw new Error("No response in completed operation");
        }

        const generatedVideos = response.generatedVideos;
        if (!generatedVideos || generatedVideos.length === 0) {
            throw new Error("No generated videos in response: " + JSON.stringify(response));
        }

        const videoResult = generatedVideos[0];
        const video = videoResult.video;

        console.log(`[VideoGenDirect] Video result keys:`, Object.keys(videoResult));
        if (video) {
            console.log(`[VideoGenDirect] Video object keys:`, Object.keys(video));
        }

        let videoUrl: string = "";
        const durationSec = config.durationSeconds || 5;
        const resolutionStr = config.resolution || "720p";

        // ALWAYS download the video and upload to Firebase Storage, 
        // as raw Google API URIs require authentication to play in the browser.

        const targetBucketName = (process.env.VITE_FIREBASE_STORAGE_BUCKET || 'indiios-alpha-electron.appspot.com').replace('.appspot.com', '');

        // Check for bytesBase64Encoded or videoBytes inline first
        const videoObj = video as Record<string, unknown>;
        const base64Data = videoObj.bytesBase64Encoded || videoObj.videoBytes;
        if (base64Data) {
            console.log(`[VideoGenDirect] Got inline base64 video, uploading to Storage ${targetBucketName}...`);
            const bucket = admin.storage().bucket(targetBucketName);
            const filePath = `videos/${userId}/${jobId}.mp4`;
            const file = bucket.file(filePath);

            // Depending on SDK version, videoBytes might be a string (base64) or Uint8Array. 
            // Buffer.from works well with string ('base64' encoding) or raw byte arrays.
            let buffer: Buffer;
            if (typeof base64Data === 'string') {
                buffer = Buffer.from(base64Data, 'base64');
            } else {
                buffer = Buffer.from(base64Data as Uint8Array);
            }

            await file.save(buffer, {
                metadata: { contentType: 'video/mp4' },
                public: true
            });
            videoUrl = file.publicUrl();
            console.log(`[VideoGenDirect] Uploaded to Firebase Storage from inline bytes: ${videoUrl}`);
        }

        // Otherwise, download via SDK file API
        if (!videoUrl && videoObj.name) {
            console.log(`[VideoGenDirect] Attempting SDK file download for: ${videoObj.name}`);
            try {
                const tmpPath = `/tmp/${jobId}.mp4`;
                // Cast to any for the external API call where the SDK type is complex
                await ai.files.download({ file: videoObj as any, downloadPath: tmpPath });

                // Read from tmp and upload to Storage
                const fs = await import("fs");
                const videoBuffer = fs.readFileSync(tmpPath);
                const bucket = admin.storage().bucket(targetBucketName);
                const filePath = `videos/${userId}/${jobId}.mp4`;
                const storageFile = bucket.file(filePath);
                await storageFile.save(videoBuffer, {
                    metadata: { contentType: 'video/mp4' },
                    public: true
                });
                videoUrl = storageFile.publicUrl();
                console.log(`[VideoGenDirect] Downloaded via SDK and uploaded: ${videoUrl}`);

                // Clean up tmp
                if (fs.existsSync(tmpPath)) {
                    fs.unlinkSync(tmpPath);
                }
            } catch (downloadErr: unknown) {
                console.error(`[VideoGenDirect] SDK file download failed:`, downloadErr);
            }
        }

        // Fallback: If it gave us a URI, try fetching it directly with the API key or ADC
        if (!videoUrl && videoObj.uri) {
            const vUri = videoObj.uri as string;
            console.log(`[VideoGenDirect] Attempting fetch fallback from URI: ${vUri}`);
            try {
                const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
                const fetchUrl = apiKey && !vUri.includes('key=') ? `${vUri}&key=${apiKey}` : vUri;
                const res = await fetch(fetchUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
                const arrayBuf = await res.arrayBuffer();
                const buffer = Buffer.from(arrayBuf);

                const bucket = admin.storage().bucket();
                const filePath = `videos/${userId}/${jobId}.mp4`;
                const file = bucket.file(filePath);
                await file.save(buffer, {
                    metadata: { contentType: 'video/mp4' },
                    public: true
                });
                videoUrl = file.publicUrl();
                console.log(`[VideoGenDirect] Fetched directly from URI and uploaded: ${videoUrl}`);
            } catch (err: unknown) {
                console.error(`[VideoGenDirect] URI fetch fallback failed:`, err);
            }
        }

        if (!videoUrl) {
            // Strip out massive buffers to prevent Firestore 1MB document limit crashes
            const safeOutputKeys = generatedVideos.map((v: Record<string, unknown>) => Object.keys((v?.video as Record<string, unknown>) || {}));
            throw new Error(`No video URL or downloadable video in response. Available keys: ${JSON.stringify(safeOutputKeys)}`);
        }

        // ── Step 8: Update Firestore → "completed" ────────────────────────
        await admin.firestore().collection("videoJobs").doc(jobId).set({
            status: "completed",
            videoUrl: videoUrl,
            progress: 100,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            output: {
                url: videoUrl,
                metadata: {
                    duration_seconds: durationSec,
                    fps: options?.fps || 24,
                    mime_type: "video/mp4",
                    resolution: resolutionStr,
                }
            }
        }, { merge: true });

        console.log(`[VideoGenDirect] ✅ Job ${jobId} completed. Video: ${videoUrl}`);

    } catch (error: unknown) {
        const err = error as Error;
        console.error(`[VideoGenDirect] ❌ Error in Video Generation (${jobId}):`, err);
        await admin.firestore().collection("videoJobs").doc(jobId).set({
            status: "failed",
            error: err.message || "Unknown error during video generation",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
}
