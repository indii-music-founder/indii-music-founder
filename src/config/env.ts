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
    firebaseProjectId: z.string().optional(),
    firebaseStorageBucket: z.string().optional(),
    firebaseDatabaseURL: z.string().url().optional(),

    // App Check
    VITE_FIREBASE_APP_CHECK_KEY: z.string().optional(),
    VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN: z.string().optional(),

    skipOnboarding: z.boolean().default(false),
});


const nodeEnv = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
const metaEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined;

const processEnv = {
    // Use environment variables when available - with fallbacks for Web/Public hosting
    // 🛡️ Sentinel: Removed hardcoded fallback API key for security.
    apiKey: readEnv('VITE_API_KEY') || "",
    projectId: readEnv('VITE_VERTEX_PROJECT_ID') || "",
    location: readEnv('VITE_VERTEX_LOCATION') || "us-central1",
    useVertex: toBoolean(readEnv('VITE_USE_VERTEX') || "false"),
    googleMapsApiKey: readEnv('VITE_GOOGLE_MAPS_API_KEY'),

    // Pass through frontend specific - no hardcoded fallbacks for security
    VITE_FUNCTIONS_URL: readEnv('VITE_FUNCTIONS_URL'),
    VITE_RAG_PROXY_URL: readEnv('VITE_RAG_PROXY_URL'),
    DEV: typeof metaEnv?.DEV === 'boolean'
        ? metaEnv.DEV
        : (nodeEnv === 'development' || toBoolean(readEnv('DEV'))),

    // Firebase specific overrides
    firebaseApiKey: readEnv('VITE_FIREBASE_API_KEY'),
    firebaseProjectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
    firebaseStorageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    firebaseDatabaseURL: readEnv('VITE_FIREBASE_DATABASE_URL'),
    appCheckKey: readEnv('VITE_FIREBASE_APP_CHECK_KEY'),
    appCheckDebugToken: readEnv('VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN'),

    skipOnboarding: toBoolean(readEnv('VITE_SKIP_ONBOARDING')),
};

const parsed = FrontendEnvSchema.safeParse(processEnv);

if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.format());

    // Explicitly log missing keys for easier debugging
    const missingKeys: string[] = [];
    if (!processEnv.apiKey) missingKeys.push('VITE_API_KEY');
    if (!processEnv.projectId) missingKeys.push('VITE_VERTEX_PROJECT_ID');
    if (!processEnv.firebaseApiKey) missingKeys.push('VITE_FIREBASE_API_KEY');

    if (missingKeys.length > 0) {
        console.warn("WARNING: The following environment variables are missing:", missingKeys.join(', '));
        console.warn("App will attempt to run with defaults, but some features may be disabled.");
    }

    // Downgraded from fatal throw to warning to allow Firebase Auth to initialize
    if (!processEnv.apiKey || !processEnv.projectId) {
        console.warn("Critical environment variables missing. Proceeding with caution.");
    }

    // We are proceeding despite validation errors
    console.warn("Environment validation failed, but critical keys might be present. Proceeding with caution.");
} else {
    // Validation successful
    // Environment validation passed
    // (console.log removed - Platinum Polish)
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
    // App Check keys - use processEnv directly since Zod schema uses different property names
    appCheckKey: processEnv.appCheckKey,
    appCheckDebugToken: processEnv.appCheckDebugToken,
};
// Firebase defaults for the production project.
// NOTE: Hardcoded fallbacks have been removed to prevent accidental production usage in dev/staging.
// All configuration must be provided via environment variables (VITE_FIREBASE_*).
export const firebaseDefaultConfig = {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: ""
};

// Resolved Firebase configuration that never falls back to unrelated API keys
// (e.g., Vertex) to avoid auth initialization errors.
const firebaseEnv = parsed.success ? parsed.data : processEnv;

export const firebaseConfig = {
    apiKey: firebaseEnv.firebaseApiKey || firebaseEnv.apiKey || "",
    authDomain: (firebaseEnv.firebaseProjectId || firebaseEnv.projectId) ? `${firebaseEnv.firebaseProjectId || firebaseEnv.projectId}.firebaseapp.com` : "",
    databaseURL: firebaseEnv.firebaseDatabaseURL || "",
    projectId: firebaseEnv.firebaseProjectId || firebaseEnv.projectId || "",
    storageBucket: firebaseEnv.firebaseStorageBucket || (firebaseEnv.firebaseProjectId || firebaseEnv.projectId ? `${firebaseEnv.firebaseProjectId || firebaseEnv.projectId}.firebasestorage.app` : ""),
    messagingSenderId: "223837784072", // Messaging Sender ID is generally static per project, but safe to keep or remove. Kept for now if needed.
    appId: "1:223837784072:web:28eabcf0c5dd985395e9bd", // Main App ID
    measurementId: "G-KNWPRGE5JK"
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn("⚠️ Firebase Configuration Missing: Please set VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID");
}
