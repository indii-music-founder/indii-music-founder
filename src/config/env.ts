import { z } from 'zod';
import { CommonEnvSchema } from '@/shared/schemas/env.schema';

const FrontendEnvSchema = CommonEnvSchema.extend({
    // Frontend specific
    VITE_FUNCTIONS_URL: z.string().url().optional(),
    VITE_RAG_PROXY_URL: z.string().url().optional(),
    DEV: z.boolean().default(false),
});

// Helper to safely get env vars in both Vite (browser) and Node (scripts) output
const getEnv = (key: string) => {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        return import.meta.env[key];
    }
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key];
    }
    return undefined;
};

const processEnv = {
    apiKey: getEnv('VITE_API_KEY'),
    projectId: getEnv('VITE_VERTEX_PROJECT_ID'),
    location: getEnv('VITE_VERTEX_LOCATION'),
    useVertex: getEnv('VITE_USE_VERTEX') === 'true',

    // Pass through frontend specific
    VITE_FUNCTIONS_URL: getEnv('VITE_FUNCTIONS_URL') || 'https://us-central1-indiios-v-1-1.cloudfunctions.net',
    VITE_RAG_PROXY_URL: getEnv('VITE_RAG_PROXY_URL'),
    DEV: getEnv('DEV') || (typeof process !== 'undefined' && process.env.NODE_ENV === 'development'),
};

const parsed = FrontendEnvSchema.safeParse(processEnv);

if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.format());

    // Explicitly log missing keys for easier debugging
    const missingKeys: string[] = [];
    if (!processEnv.apiKey) missingKeys.push('VITE_API_KEY');
    if (!processEnv.projectId) missingKeys.push('VITE_VERTEX_PROJECT_ID');

    if (missingKeys.length > 0) {
        console.error("CRITICAL: The following environment variables are missing:", missingKeys.join(', '));
        console.error("Please check your .env file.");
    }

    // In production, we might want to throw, but for now let's warn and allow partial failure if possible,
    // or throw if critical keys are missing.
    if (!processEnv.apiKey || !processEnv.projectId) {
        console.error("Critical environment variables missing.", processEnv);
        // throw new Error("Critical environment variables missing. Check console for details.");
    }

    // We are proceeding despite validation errors
    console.warn("Environment validation failed, but critical keys might be present. Proceeding with caution.");
} else {
    // Validation successful
    // console.log("Environment configuration valid.");
}

// Export a combined object that has both the common properties (apiKey, etc) AND the original VITE_ keys
// to maintain backward compatibility if needed, OR just export the clean structure.
// The plan implies we want cleaner structure.
export const env = parsed.success ? parsed.data : (processEnv as any);
// Re-export specific VITE keys if needed by existing code, or rely on 'env.apiKey' usage.
// Note: Codebases usually use `env.VITE_API_KEY`. 
// To avoid massive refactor of call sites, we can map back or just expose both.
// For "Consolidated Configuration", let's prefer the new clean keys but keep VITE_ on the object if strictly needed.
// However, the schema defines `apiKey`.
// Let's add getters for backward compat or update call sites. 
// Updating call sites is better for "Refactor".
// I will check AIService.ts usage in a moment. To be safe, I will add backward compat getters.
// Actually, `AIService` used `env.VITE_API_KEY` in the file view I saw earlier.
// So I should probably map the new keys back to old names OR update `AIService`.
// I'll update `AIService` to use clean keys as part of this refactor.
