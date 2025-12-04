import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    GCLOUD_PROJECT: z.string().default('architexture-ai-api'),
    LOCATION: z.string().default('us-central1'),
    MODEL_ID: z.string().default('veo-3.1-generate-preview'),
    GEMINI_MODEL_ID: z.string().default('gemini-3-pro-image-preview'),
    VITE_API_KEY: z.string().min(1, "VITE_API_KEY is required"),
});

const processEnv = {
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
    LOCATION: process.env.LOCATION || 'us-central1',
    MODEL_ID: process.env.MODEL_ID,
    GEMINI_MODEL_ID: process.env.GEMINI_MODEL_ID,
    VITE_API_KEY: process.env.VITE_API_KEY,
};

const parsed = envSchema.safeParse(processEnv);

if (!parsed.success) {
    console.warn("Invalid backend environment configuration:", parsed.error.format());
}

export const config = parsed.success ? parsed.data : processEnv as z.infer<typeof envSchema>;
