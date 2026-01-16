import { z } from 'zod';
import { CommonEnvSchema } from '../shared/schemas/env.schema.ts';

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

const getEnv = (metaValue: any, processValue: any): string => {
    return (metaValue || processValue || "") as string;
};

const processEnv = {
    // 🛡️ Sentinel: Using static lookups for Vite compatibility
    apiKey: getEnv(import.meta.env.VITE_API_KEY, process.env.VITE_API_KEY),
    projectId: getEnv(import.meta.env.VITE_VERTEX_PROJECT_ID, process.env.VITE_VERTEX_PROJECT_ID),
    location: getEnv(import.meta.env.VITE_VERTEX_LOCATION, process.env.VITE_VERTEX_LOCATION) || "us-central1",
    useVertex: toBoolean(import.meta.env.VITE_USE_VERTEX || process.env.VITE_USE_VERTEX),
    googleMapsApiKey: getEnv(import.meta.env.VITE_GOOGLE_MAPS_API_KEY, process.env.VITE_GOOGLE_MAPS_API_KEY),

    VITE_FUNCTIONS_URL: getEnv(import.meta.env.VITE_FUNCTIONS_URL, process.env.VITE_FUNCTIONS_URL),
    VITE_RAG_PROXY_URL: getEnv(import.meta.env.VITE_RAG_PROXY_URL, process.env.VITE_RAG_PROXY_URL),
    DEV: import.meta.env.DEV,

    // Firebase specific overrides
    firebaseApiKey: getEnv(import.meta.env.VITE_FIREBASE_API_KEY, process.env.VITE_FIREBASE_API_KEY),
    firebaseProjectId: getEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID, process.env.VITE_FIREBASE_PROJECT_ID),
    firebaseStorageBucket: getEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, process.env.VITE_FIREBASE_STORAGE_BUCKET),
    firebaseDatabaseURL: getEnv(import.meta.env.VITE_FIREBASE_DATABASE_URL, process.env.VITE_FIREBASE_DATABASE_URL),
    appCheckKey: getEnv(import.meta.env.VITE_FIREBASE_APP_CHECK_KEY, process.env.VITE_FIREBASE_APP_CHECK_KEY),
    appCheckDebugToken: getEnv(import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN, process.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN),

    skipOnboarding: toBoolean(import.meta.env.VITE_SKIP_ONBOARDING || process.env.VITE_SKIP_ONBOARDING),
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
}

const runtimeEnv = parsed.success ? parsed.data : (processEnv as any);

export const env = {
    ...runtimeEnv,
    VITE_API_KEY: runtimeEnv.apiKey,
    VITE_VERTEX_PROJECT_ID: runtimeEnv.projectId,
    VITE_VERTEX_LOCATION: runtimeEnv.location,
    VITE_USE_VERTEX: runtimeEnv.useVertex,
    appCheckKey: processEnv.appCheckKey,
    appCheckDebugToken: processEnv.appCheckDebugToken,
};

// Firebase defaults
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

const firebaseEnv = processEnv;

export const firebaseConfig = {
    apiKey: firebaseEnv.firebaseApiKey || firebaseEnv.apiKey || "",
    authDomain: (firebaseEnv.firebaseProjectId || firebaseEnv.projectId) ? `${firebaseEnv.firebaseProjectId || firebaseEnv.projectId}.firebaseapp.com` : "",
    databaseURL: firebaseEnv.firebaseDatabaseURL || "",
    projectId: firebaseEnv.firebaseProjectId || firebaseEnv.projectId || "",
    storageBucket: firebaseEnv.firebaseStorageBucket || (firebaseEnv.firebaseProjectId || firebaseEnv.projectId ? `${firebaseEnv.firebaseProjectId || firebaseEnv.projectId}.firebasestorage.app` : ""),
    messagingSenderId: "223837784072",
    appId: "1:223837784072:web:28eabcf0c5dd985395e9bd",
    measurementId: "G-KNWPRGE5JK"
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn("⚠️ Firebase Configuration Missing: Please set VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID");
}
