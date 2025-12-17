import { z } from 'zod';
import { CommonEnvSchema } from '@/shared/schemas/env.schema';

const FrontendEnvSchema = CommonEnvSchema.extend({
    // Frontend specific
    VITE_FUNCTIONS_URL: z.string().url().optional(),
    VITE_RAG_PROXY_URL: z.string().url().optional(),
    VITE_GOOGLE_MAPS_API_KEY: z.string().optional(),
    DEV: z.boolean().default(false),
 investigate-login-system-failure2025-12-1704-01-00
    // Firebase specific overrides (optional)
    firebaseApiKey: z.string().optional(),
    firebaseAuthDomain: z.string().optional(),
    firebaseProjectId: z.string().optional(),
    firebaseStorageBucket: z.string().optional(),
    firebaseAppId: z.string().optional(),
    firebaseMeasurementId: z.string().optional(),
    firebaseMessagingSenderId: z.string().optional(),
    firebaseDatabaseURL: z.string().url().optional(),

    skipOnboarding: z.boolean().default(false),
 main
});

const processEnv = {
    // Use environment variable - no hardcoded fallback for security
    apiKey: import.meta.env.VITE_API_KEY || (typeof process !== 'undefined' ? process.env.VITE_API_KEY : undefined),
    projectId: import.meta.env.VITE_VERTEX_PROJECT_ID || (typeof process !== 'undefined' ? process.env.VITE_VERTEX_PROJECT_ID : undefined),
    location: import.meta.env.VITE_VERTEX_LOCATION || (typeof process !== 'undefined' ? process.env.VITE_VERTEX_LOCATION : undefined),
    useVertex: (import.meta.env.VITE_USE_VERTEX || (typeof process !== 'undefined' ? process.env.VITE_USE_VERTEX : undefined)) === 'true',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || (typeof process !== 'undefined' ? process.env.VITE_GOOGLE_MAPS_API_KEY : undefined),

    // Pass through frontend specific
    VITE_FUNCTIONS_URL: getEnv('VITE_FUNCTIONS_URL') || 'https://us-central1-indiios-v-1-1.cloudfunctions.net',
    VITE_RAG_PROXY_URL: getEnv('VITE_RAG_PROXY_URL'),
    DEV: getEnv('DEV') || (typeof process !== 'undefined' && process.env.NODE_ENV === 'development'),

    // Firebase specific overrides
    firebaseApiKey: getEnv('VITE_FIREBASE_API_KEY'),
    firebaseAuthDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    firebaseProjectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
    firebaseStorageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    firebaseAppId: getEnv('VITE_FIREBASE_APP_ID'),
    firebaseMeasurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID'),
    firebaseMessagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    firebaseDatabaseURL: getEnv('VITE_FIREBASE_DATABASE_URL'),
    VITE_FUNCTIONS_URL: import.meta.env.VITE_FUNCTIONS_URL || (typeof process !== 'undefined' ? process.env.VITE_FUNCTIONS_URL : undefined) || 'https://us-central1-indiios-v-1-1.cloudfunctions.net',
    VITE_RAG_PROXY_URL: import.meta.env.VITE_RAG_PROXY_URL || (typeof process !== 'undefined' ? process.env.VITE_RAG_PROXY_URL : undefined),
    VITE_GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || (typeof process !== 'undefined' ? process.env.VITE_GOOGLE_MAPS_API_KEY : undefined),
    DEV: import.meta.env.DEV || (typeof process !== 'undefined' && process.env.NODE_ENV === 'development'),
    skipOnboarding: true,
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

const runtimeEnv = parsed.success ? parsed.data : (processEnv as typeof processEnv);

// Export a combined object that exposes both the clean keys (apiKey, projectId, etc.)
// and the historic VITE_* aliases so Vertex/Functions consumers keep working while
// reading from the typed config object.
export const env = {
    ...runtimeEnv,
    VITE_API_KEY: runtimeEnv.apiKey,
    VITE_VERTEX_PROJECT_ID: runtimeEnv.projectId,
    VITE_VERTEX_LOCATION: runtimeEnv.location,
    VITE_USE_VERTEX: runtimeEnv.useVertex,
};
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

// Firebase defaults for the production project. These keep the web app working when
// environment overrides are not supplied (e.g., on Firebase Hosting deployments).
export const firebaseDefaultConfig = {
    apiKey: "AIzaSyD7bmREk0yo8-WtJIngr7ek9U1-BC7BTC0",
    authDomain: "indiios-v-1-1.web.app",
    databaseURL: "https://indiios-v-1-1-default-rtdb.firebaseio.com",
    projectId: "indiios-v-1-1",
    storageBucket: "indiios-v-1-1.firebasestorage.app",
    messagingSenderId: "223837784072",
    appId: "1:223837784072:web:28eabcf0c5dd985395e9bd",
    measurementId: "G-KNWPRGE5JK"
};

// Resolved Firebase configuration that never falls back to unrelated API keys
// (e.g., Vertex) to avoid auth initialization errors.
const firebaseEnv = parsed.success ? parsed.data : processEnv;

export const firebaseConfig = {
    apiKey: firebaseEnv.firebaseApiKey || firebaseDefaultConfig.apiKey,
    authDomain: firebaseEnv.firebaseAuthDomain || firebaseDefaultConfig.authDomain,
    databaseURL: firebaseEnv.firebaseDatabaseURL || firebaseDefaultConfig.databaseURL,
    projectId: firebaseEnv.firebaseProjectId || firebaseDefaultConfig.projectId,
    storageBucket: firebaseEnv.firebaseStorageBucket || firebaseDefaultConfig.storageBucket,
    messagingSenderId: firebaseEnv.firebaseMessagingSenderId || firebaseDefaultConfig.messagingSenderId,
    appId: firebaseEnv.firebaseAppId || firebaseDefaultConfig.appId,
    measurementId: firebaseEnv.firebaseMeasurementId || firebaseDefaultConfig.measurementId,
};
