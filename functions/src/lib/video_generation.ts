import * as admin from "firebase-admin";
import { FUNCTION_AI_MODELS } from "../config/models";

export const generateVideoFn = (inngestClient: any, geminiApiKey: any) => inngestClient.createFunction(
    { id: "generate-video-logic" },
    { event: "video/generate.requested" },
    async ({ event, step }: any) => {
        const { jobId, prompt, userId, options } = event.data;
        console.log(`[Inngest] Starting video generation for Job: ${jobId}`);

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
                } catch (err) {
                    console.error(`[Inngest] Failed to update status:`, err);
                    throw err;
                }
            });

            // Start Video Generation Operation
            const operation = await step.run("trigger-google-ai-video", async () => {
                const modelId = FUNCTION_AI_MODELS.VIDEO.GENERATION;
                const apiKey = geminiApiKey.value();
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predictLongRunning?key=${apiKey}`;

                const requestBody = {
                    instances: [{ prompt: prompt }],
                    parameters: {
                        sampleCount: 1,
                        // Note: veo-3.1-generate-preview does NOT support videoLength/seconds parameters currently
                        aspectRatio: options?.aspectRatio || "16:9"
                    },
                };

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Google AI Trigger Error: ${response.status} ${errorText}`);
                }

                const result = await response.json();
                if (!result.name) throw new Error("No operation name returned from Google AI");
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
                    const apiKey = geminiApiKey.value();
                    const statusEndpoint = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;

                    const statusResponse = await fetch(statusEndpoint);
                    if (!statusResponse.ok) return null;

                    const statusData = await statusResponse.json();
                    if (statusData.done) return statusData;
                    return null;
                });

                if (finalResult && finalResult.done) {
                    isCompleted = true;
                }
            }

            if (!isCompleted || !finalResult || !finalResult.response) {
                throw new Error(`Video generation timed out after ${attempts} attempts`);
            }

            // Process Result
            const videoUri = await step.run("process-video-output", async () => {
                const responseData = finalResult.response;
                console.log("[Inngest] Final Result from Google AI:", JSON.stringify(finalResult, null, 2));

                if (!responseData) {
                    throw new Error("No response data in final result");
                }

                // Veo 3.1 Response Structure
                const generatedSamples = responseData.generateVideoResponse?.generatedSamples;
                if (generatedSamples && generatedSamples.length > 0) {
                    const sample = generatedSamples[0];
                    if (sample.video && sample.video.uri) {
                        console.log(`[Inngest] Found video URI: ${sample.video.uri}`);
                        return sample.video.uri;
                    }
                }

                // Fallback for older models
                const outputs = responseData.outputs;
                if (outputs && outputs.length > 0) {
                    const output = outputs[0];

                    // If it returns bytes
                    if (output.video && output.video.bytesBase64Encoded) {
                        const bucket = admin.storage().bucket();
                        const file = bucket.file(`videos/${userId}/${jobId}.mp4`);
                        await file.save(Buffer.from(output.video.bytesBase64Encoded, 'base64'), {
                            metadata: { contentType: 'video/mp4' },
                            public: true
                        });
                        return file.publicUrl();
                    }

                    // If it returns a URI directly
                    if (output.videoUri) return output.videoUri;
                    if (output.gcsUri) return output.gcsUri;
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
                        metadata: {
                            duration_seconds: 5, // Veo preview is fixed at ~5s currently
                            fps: options?.fps || 30, // Default to 30 if not specified
                            mime_type: "video/mp4",
                            resolution: options?.aspectRatio === "9:16" ? "720x1280" : "1280x720"
                        }
                    }
                }, { merge: true });
            });

            return { success: true, videoUrl: videoUri };

        } catch (error: any) {
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
    }
);
