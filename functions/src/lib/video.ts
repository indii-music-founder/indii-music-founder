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
