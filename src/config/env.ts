import { z } from 'zod';

const envSchema = z.object({
    VITE_API_KEY: z.string().min(1, "VITE_API_KEY is required"),
    VITE_VERTEX_PROJECT_ID: z.string().min(1, "VITE_VERTEX_PROJECT_ID is required"),
    VITE_VERTEX_LOCATION: z.string().default('us-central1'),
    VITE_USE_VERTEX: z.enum(['true', 'false']).default('false').transform(val => val === 'true'),
    VITE_FUNCTIONS_URL: z.string().url().optional(),
    VITE_RAG_PROXY_URL: z.string().url().optional(),
    DEV: z.boolean().default(false),
});

const processEnv = {
    VITE_API_KEY: import.meta.env.VITE_API_KEY,
    VITE_VERTEX_PROJECT_ID: import.meta.env.VITE_VERTEX_PROJECT_ID,
    VITE_VERTEX_LOCATION: import.meta.env.VITE_VERTEX_LOCATION,
    VITE_USE_VERTEX: import.meta.env.VITE_USE_VERTEX,
    VITE_FUNCTIONS_URL: import.meta.env.VITE_FUNCTIONS_URL,
    VITE_RAG_PROXY_URL: import.meta.env.VITE_RAG_PROXY_URL,
    DEV: import.meta.env.DEV,
};

const parsed = envSchema.safeParse(processEnv);

if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.format());
    // In production, we might want to throw, but for now let's warn and allow partial failure if possible,
    // or throw if critical keys are missing.
    if (!processEnv.VITE_API_KEY || !processEnv.VITE_VERTEX_PROJECT_ID) {
        throw new Error("Critical environment variables missing. Check console for details.");
    }
}

export const env = parsed.success ? parsed.data : (processEnv as any) as z.infer<typeof envSchema>;
