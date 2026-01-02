import * as admin from "firebase-admin";
import { GoogleAuth } from "google-auth-library";

/**
 * Core logic for generating video via Vertex AI (Veo)
 * This is separated from index.ts to improve testability and organization.
 */
export const generateVideoLogic = async ({ event, step }: any) => {
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
            // Use GoogleAuth to get credentials for Vertex AI
            const auth = new GoogleAuth({
                scopes: ['https://www.googleapis.com/auth/cloud-platform']
            });

            const client = await auth.getClient();
            const projectId = await auth.getProjectId();
            const accessToken = await client.getAccessToken();
            const location = 'us-central1';
            // Using the Veo 3.1 Preview model
            const modelId = 'veo-3.1-generate-preview';

            const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

            // Construct request body for Veo
            const requestBody = {
                instances: [
                    {
                        prompt: prompt,
                    }
                ],
                parameters: {
                    sampleCount: 1,
                    // Map options to Veo parameters
                    videoLength: options?.duration || options?.durationSeconds || "5s",
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

            // Handle different possible response formats

            // Case A: Base64 Encoded Video
            if (prediction.bytesBase64Encoded) {
                const bucket = admin.storage().bucket();
                const file = bucket.file(`videos/${userId}/${jobId}.mp4`);
                await file.save(Buffer.from(prediction.bytesBase64Encoded, 'base64'), {
                    metadata: { contentType: 'video/mp4' },
                    // public: true - REMOVED for security
                });

                // Generate Signed URL
                const [signedUrl] = await file.getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 1000 * 60 * 60 * 24 * 2, // 2 days
                });

                return signedUrl;
            }

            // Case B: GCS URI
            if (prediction.gcsUri) {
                 // Note: GCS URIs (gs://) are not directly accessible via HTTP.
                 // Ideally we would sign this URL or copy it to our bucket.
                 // For now, we return it as is, or we could copy it.
                 return prediction.gcsUri;
            }

            // Case C: Video URI (Direct HTTP link if supported)
            if (prediction.videoUri) {
                return prediction.videoUri;
            }

            throw new Error("Unknown Veo response format: " + JSON.stringify(prediction));
        });

        // Step 3: Update status to complete
        await step.run("update-status-complete", async () => {
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "completed", // Aligning with 'completed' vs 'complete' inconsistency - defaulting to 'completed'
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
};
import { z } from "zod";
import * as admin from "firebase-admin";
import { GoogleAuth } from "google-auth-library";

// Validation Schema
export const VideoJobSchema = z.object({
    jobId: z.string().uuid(),
    userId: z.string(),
    orgId: z.string().optional().default("personal"),
    prompt: z.string().min(1),
    options: z.object({
        duration: z.enum(["5s", "10s"]).optional().default("5s"),
        aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
    }).optional().default({})
});

export type VideoJobInput = z.infer<typeof VideoJobSchema>;

/**
 * Calls Vertex AI (Veo) to generate a video.
 * Handles API authentication, request formatting, and response parsing.
 * Saves the result to Firebase Storage and returns a Signed URL.
 */
export async function generateVideoWithVeo(
    input: VideoJobInput,
    updateStatus: (status: string, data?: any) => Promise<void>
): Promise<string> {
    const { jobId, userId, prompt, options } = input;

    // 1. Update status to processing
    await updateStatus("processing");

    // 2. Vertex AI Setup
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const projectId = await auth.getProjectId();
    const accessToken = await client.getAccessToken();
    const location = 'us-central1';
    const modelId = 'veo-3.1-generate-preview';

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

    // 3. Construct Request
    const requestBody = {
        instances: [{ prompt }],
        parameters: {
            sampleCount: 1,
            videoLength: options.duration,
            aspectRatio: options.aspectRatio
        }
    };

    console.log(`[VideoJob] Calling Veo API for job ${jobId}`);

    // 4. Call API
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
    let videoUrl = "";

    // 5. Handle Response & Storage
    if (prediction.bytesBase64Encoded) {
        const bucket = admin.storage().bucket();
        const filePath = `videos/${userId}/${jobId}.mp4`;
        const file = bucket.file(filePath);

        await file.save(Buffer.from(prediction.bytesBase64Encoded, 'base64'), {
            metadata: { contentType: 'video/mp4' }
        });

        // Generate Signed URL (valid for 7 days)
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        videoUrl = signedUrl;
    } else if (prediction.gcsUri) {
         // If it's a gs:// URI, we return it. The frontend might need to handle it or we might need to copy it.
         // For now, assuming standard flow.
         videoUrl = prediction.gcsUri;
    } else if (prediction.videoUri) {
        videoUrl = prediction.videoUri;
    } else {
        throw new Error("Unknown Veo response format");
    }

    // 6. Update status to completed
    await updateStatus("completed", { videoUrl, progress: 100 });

    return videoUrl;
}
