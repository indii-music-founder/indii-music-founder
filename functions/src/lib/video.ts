import * as admin from "firebase-admin";
import { GoogleAuth } from "google-auth-library";

interface VideoOptions {
    duration?: string;
    durationSeconds?: number;
    aspectRatio?: string;
}

interface VideoGenerateEvent {
    data: {
        jobId: string;
        prompt: string;
        userId: string;
        orgId: string;
        options: VideoOptions;
        timestamp: number;
    }
}

interface Step {
    run: <T>(name: string, callback: () => Promise<T>) => Promise<T>;
}

export async function generateVideoLogic({ event, step }: { event: VideoGenerateEvent, step: Step }) {
    const { jobId, prompt, userId, options } = event.data;

    try {
        // Step 1: Update status to processing
        await step.run("update-status-processing", async () => {
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "processing",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });

        // Step 2: Generate Video via Vertex AI (Veo)
        const videoUri = await step.run("generate-veo-video", async () => {
            const auth = new GoogleAuth({
                scopes: ['https://www.googleapis.com/auth/cloud-platform']
            });

            const client = await auth.getClient();
            const projectId = await auth.getProjectId();
            const accessToken = await client.getAccessToken();
            const LOCATION = 'us-central1';
            const modelId = 'veo-3.1-generate-preview';

            const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${modelId}:predict`;

            // Handle duration logic
            let videoLength = "5s"; // default
            if (options?.duration) {
                videoLength = options.duration;
            } else if (options?.durationSeconds) {
                videoLength = `${options.durationSeconds}s`;
            }

            const requestBody = {
                instances: [{ prompt: prompt }],
                parameters: {
                    sampleCount: 1,
                    videoLength: videoLength,
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
                throw new Error(`Vertex AI Error: ${response.status} ${errorText}`);
            }

            const result = await response.json();
            const predictions = result.predictions;

            if (!predictions || predictions.length === 0) {
                throw new Error("No predictions returned from Veo API");
            }

            const prediction = predictions[0];

            if (prediction.bytesBase64Encoded) {
                const bucket = admin.storage().bucket();
                const file = bucket.file(`videos/${userId}/${jobId}.mp4`);
                await file.save(Buffer.from(prediction.bytesBase64Encoded, 'base64'), {
                    metadata: { contentType: 'video/mp4' },
                });

                const [url] = await file.getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
                });
                return url;
            }

            if (prediction.gcsUri) return prediction.gcsUri;
            if (prediction.videoUri) return prediction.videoUri;

            throw new Error("Unknown Veo response format: " + JSON.stringify(prediction));
        });

        // Step 3: Update status to complete
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
        await step.run("update-status-failed", async () => {
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "failed",
                error: error.message || "Unknown error during video generation",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
        // Re-throw to allow Inngest to handle retries if configured
        throw error;
    }
}
