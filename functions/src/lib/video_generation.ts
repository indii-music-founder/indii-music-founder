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
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    status: "processing",
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
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
                        videoLength: options?.duration || options?.durationSeconds || "5s",
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
                const outputs = responseData.outputs;

                if (!outputs || outputs.length === 0) {
                    throw new Error("No outputs found in operation response");
                }

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

                throw new Error("Could not find video data or URI in output: " + JSON.stringify(output));
            });

            // Update status to complete
            await step.run("update-status-complete", async () => {
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    status: "completed",
                    videoUrl: videoUri,
                    progress: 100,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
