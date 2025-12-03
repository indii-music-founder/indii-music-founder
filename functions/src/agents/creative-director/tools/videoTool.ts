import { GoogleAuth } from 'google-auth-library';
import { SchemaType } from '@google/generative-ai';
import { AI_MODELS } from '../../../config/ai-models';

export const videoToolDefinition = {
    name: "generateVideo",
    description: "Generates a video based on a text prompt using Google Veo.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            prompt: {
                type: SchemaType.STRING,
                description: "The detailed visual description of the video to generate."
            }
        },
        required: ["prompt"]
    }
};

export async function generateVideo(args: { prompt: string }) {
    const { prompt } = args;
    const projectId = process.env.GCLOUD_PROJECT || "architexture-ai-api";
    const location = "us-central1";
    const modelId = AI_MODELS.VIDEO.GENERATION;

    try {
        const auth = new GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken.token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                instances: [{ prompt }],
                parameters: { sampleCount: 1 },
            }),
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const data = await response.json();
        return {
            success: true,
            data
        };
    } catch (error: any) {
        console.error("Video Generation Failed:", error);
        return {
            success: false,
            error: error.message
        };
    }
}
