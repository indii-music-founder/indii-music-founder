import { z } from 'zod';
import { CommonEnvSchema } from '../shared/schemas/env.schema.ts';

const readEnv = (key: string): string | undefined => {
    if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && key in import.meta.env) {
        return import.meta.env[key] as string | undefined;
    }

    if (typeof process !== 'undefined' && process.env) {
        return process.env[key];
    }

    return undefined;
};

const toBoolean = (value: string | boolean | undefined): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return false;
};

const FrontendEnvSchema = CommonEnvSchema.extend({
    // Frontend specific
    VITE_FUNCTIONS_URL: z.string().url().optional(),
    VITE_RAG_PROXY_URL: z.string().url().optional(),
    VITE_GOOGLE_MAPS_API_KEY: z.string().optional(),
    DEV: z.boolean().default(false),

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
});


const nodeEnv = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
const metaEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined;

const processEnv = {
    // Use environment variables when available - no hardcoded fallback for security
    apiKey: readEnv('VITE_API_KEY'),
    projectId: readEnv('VITE_VERTEX_PROJECT_ID'),
    location: readEnv('VITE_VERTEX_LOCATION'),
    useVertex: toBoolean(readEnv('VITE_USE_VERTEX')),
    googleMapsApiKey: readEnv('VITE_GOOGLE_MAPS_API_KEY'),

    // Pass through frontend specific - no hardcoded fallbacks for security
    VITE_FUNCTIONS_URL: readEnv('VITE_FUNCTIONS_URL'),
    VITE_RAG_PROXY_URL: readEnv('VITE_RAG_PROXY_URL'),
    DEV: typeof metaEnv?.DEV === 'boolean'
        ? metaEnv.DEV
        : (nodeEnv === 'development' || toBoolean(readEnv('DEV'))),

    // Firebase specific overrides
    firebaseApiKey: readEnv('VITE_FIREBASE_API_KEY'),
    firebaseAuthDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    firebaseProjectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
    firebaseStorageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    firebaseAppId: readEnv('VITE_FIREBASE_APP_ID'),
    firebaseMeasurementId: readEnv('VITE_FIREBASE_MEASUREMENT_ID'),
    firebaseMessagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    firebaseDatabaseURL: readEnv('VITE_FIREBASE_DATABASE_URL'),

    skipOnboarding: toBoolean(readEnv('VITE_SKIP_ONBOARDING')),
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

    // Fail fast if critical keys are missing (only at runtime, not during build)
    if (!processEnv.apiKey || !processEnv.projectId) {
        console.error("Critical environment variables missing.", processEnv);
        // Only throw in browser (runtime) - allow build to complete for CI
        if (typeof window !== 'undefined') {
            throw new Error("Critical environment variables missing. Check console for details.");
        }
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
// Firebase defaults for the production project. These keep the web app working when
// environment overrides are not supplied (e.g., on Firebase Hosting deployments).
// NOTE: Firebase API keys are PUBLIC by design (security is enforced via Firestore rules).
// These fallbacks are required for Firebase Hosting where env vars aren't available at runtime.
export const firebaseDefaultConfig = {
    apiKey: "", // Enforce VITE_FIREBASE_API_KEY in .env
    authDomain: "indiios-v-1-1.firebaseapp.com",
    databaseURL: "https://indiios-v-1-1-default-rtdb.firebaseio.com",
    projectId: "indiios-v-1-1",
    storageBucket: "indiios-v-1-1.firebasestorage.app",
    messagingSenderId: "223837784072",
    appId: "1:223837784072:web:3af738739465ea4095e9bd", // Primary Web App ID
    measurementId: "G-7WW3HEHFTF" // Matching Analytics ID
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
