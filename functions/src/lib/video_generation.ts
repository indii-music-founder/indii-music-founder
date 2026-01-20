import * as admin from "firebase-admin";
import { GoogleAuth } from "google-auth-library";
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

            // Start Video Generation Operation (Vertex AI)
            const operation = await step.run("trigger-vertex-ai-video", async () => {
                const modelId = FUNCTION_AI_MODELS.VIDEO.GENERATION;
                const auth = new GoogleAuth({
                    scopes: ['https://www.googleapis.com/auth/cloud-platform']
                });
                const client = await auth.getClient();
                const projectId = await auth.getProjectId();
                const accessToken = await client.getAccessToken();

                const endpoint = `https://us-central1-aiplatform.googleapis.com/v1beta/projects/${projectId}/locations/us-central1/publishers/google/models/${modelId}:predictLongRunning`;

                const requestBody: any = {
                    instances: [{ prompt: prompt }],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: options?.aspectRatio || "16:9"
                    }
                };

                // VEO 3.1: Resolution support
                if (options?.resolution) {
                    requestBody.parameters.resolution = options.resolution;
                }

                // VEO 3.1: Duration support (4, 6, 8 seconds)
                const rawDuration = options?.durationSeconds || options?.duration;
                if (rawDuration) {
                    // Clamp to supported values or default to 8
                    let dur = typeof rawDuration === 'string' ? parseInt(rawDuration) : rawDuration;
                    if (dur <= 4) dur = 4;
                    else if (dur <= 6) dur = 6;
                    else dur = 8;
                    requestBody.parameters.duration = dur;
                }

                // VEO 3.1: First Frame (Image-to-Video)
                // options.image comes from VideoService as { imageBytes: string, mimeType: string }
                // options.firstFrame comes from VideoGenerationService as Data URI string
                let startImageBytes: string | undefined;

                if (options?.image?.imageBytes) {
                    startImageBytes = options.image.imageBytes;
                } else if (options?.firstFrame) {
                    startImageBytes = options.firstFrame.replace(/^data:image\/\w+;base64,/, '');
                }

                if (startImageBytes) {
                    requestBody.instances[0].image = {
                        bytesBase64Encoded: startImageBytes
                    };
                    // Required for image generation
                    requestBody.parameters.personGeneration = "allow_adult";
                }

                // VEO 3.1: Last Frame (Interpolation)
                // options.lastFrame comes as Data URI string: "data:image/png;base64,..."
                if (options?.lastFrame) {
                    const cleanLastFrame = options.lastFrame.replace(/^data:image\/\w+;base64,/, '');
                    requestBody.parameters.lastFrame = {
                        bytesBase64Encoded: cleanLastFrame
                    };
                    // Ensure personGeneration is set if not already
                    requestBody.parameters.personGeneration = "allow_adult";
                }

                // VEO 3.1: Ingredients (Reference Images - Up to 3)
                const refImages = options?.referenceImages || options?.ingredients;
                if (refImages && Array.isArray(refImages)) {
                    requestBody.parameters.referenceImages = refImages.slice(0, 3).map((ref: any) => {
                        // Extract bytes if it's a nested object (VideoService formats it this way)
                        const rawBytes = ref.image?.imageBytes || ref.data || ref || "";
                        const cleanBytes = typeof rawBytes === 'string' ? rawBytes.replace(/^data:image\/\w+;base64,/, '') : rawBytes;

                        return {
                            image: {
                                bytesBase64Encoded: cleanBytes
                            },
                            referenceType: ref.referenceType || "ASSET"
                        };
                    });
                    requestBody.parameters.personGeneration = "allow_adult";
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
                if (!result.name) throw new Error("No operation name returned from Vertex AI");
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
                    const auth = new GoogleAuth({
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

                    if (!statusResponse.ok) return null;

                    const statusData = await statusResponse.json();
                    if (statusData.done) return statusData;
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

                        // Extract metadata
                        const videoMetadata = sample.videoMetadata || {};
                        let durationSeconds = 5;
                        if (videoMetadata.duration && typeof videoMetadata.duration === 'string') {
                            const match = videoMetadata.duration.match(/([\d.]+)s$/);
                            if (match) {
                                durationSeconds = parseFloat(match[1]);
                            }
                        }

                        return {
                            videoUri: sample.video.uri,
                            metadata: {
                                mime_type: videoMetadata.mimeType || "video/mp4",
                                duration_seconds: durationSeconds,
                                fps: 24, // Default as it's not always provided
                                resolution: options?.resolution || "1080p"
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
                    } else if (output.videoUri) {
                        uri = output.videoUri;
                    } else if (output.gcsUri) {
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
                        metadata: {
                            ...metadata,
                            duration_seconds: metadata?.duration_seconds || 5,
                            fps: options?.fps || 30,
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
