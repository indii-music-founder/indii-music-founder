import { z } from 'zod';
import { CommonEnvSchema } from '../shared/schemas/env.schema.ts';
import { Logger } from '@/core/logger/Logger';

const toBoolean = (value: string | boolean | undefined): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return false;
};

const FrontendEnvSchema = CommonEnvSchema.extend({
    // Frontend specific
    VITE_FUNCTIONS_URL: z.string().url().optional(),
    VITE_RAG_PROXY_URL: z.union([z.string().url(), z.literal('')]).optional(),
    VITE_GOOGLE_MAPS_API_KEY: z.string().optional(),
    DEV: z.boolean().default(false),

    // Firebase specific overrides (optional)
    firebaseProjectId: z.string().optional(),
    firebaseStorageBucket: z.string().optional(),
    firebaseDatabaseURL: z.union([z.string().url(), z.literal('')]).optional(),

    // App Check
    VITE_FIREBASE_APP_CHECK_KEY: z.string().optional(),
    VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN: z.string().optional(),

    skipOnboarding: z.boolean().default(false),
});

const processEnv = {
    // 🛡️ Sentinel: Using strict import.meta.env for Vite compatibility
    apiKey: import.meta.env.VITE_API_KEY,
    projectId: import.meta.env.VITE_VERTEX_PROJECT_ID,
    location: import.meta.env.VITE_VERTEX_LOCATION || "us-central1",
    useVertex: toBoolean(import.meta.env.VITE_USE_VERTEX),
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,

    VITE_FUNCTIONS_URL: import.meta.env.VITE_FUNCTIONS_URL,
    VITE_RAG_PROXY_URL: import.meta.env.VITE_RAG_PROXY_URL,
    DEV: import.meta.env.DEV,

    // Firebase specific overrides
    firebaseApiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    firebaseDatabaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    appCheckKey: import.meta.env.VITE_FIREBASE_APP_CHECK_KEY,
    appCheckDebugToken: import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN,

    skipOnboarding: toBoolean(import.meta.env.VITE_SKIP_ONBOARDING),
};

const parsed = FrontendEnvSchema.safeParse(processEnv);

if (!parsed.success) {
    Logger.error('Env', "Invalid environment configuration:", parsed.error.format());

    // Explicitly log missing keys for easier debugging
    const missingKeys: string[] = [];
    if (!processEnv.apiKey) missingKeys.push('VITE_API_KEY');
    if (!processEnv.projectId) missingKeys.push('VITE_VERTEX_PROJECT_ID');
    if (!processEnv.firebaseApiKey) missingKeys.push('VITE_FIREBASE_API_KEY');

    if (missingKeys.length > 0) {
        Logger.warn('Env', "WARNING: The following environment variables are missing:", missingKeys.join(', '));
        Logger.warn('Env', "App will attempt to run with defaults, but some features may be disabled.");
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

export const firebaseConfig = {
    apiKey: processEnv.firebaseApiKey || "",
    authDomain: (processEnv.firebaseProjectId || processEnv.projectId || "indiios-v-1-1") + ".firebaseapp.com",
    databaseURL: processEnv.firebaseDatabaseURL || "https://indiios-v-1-1-default-rtdb.firebaseio.com",
    projectId: processEnv.firebaseProjectId || processEnv.projectId || "indiios-v-1-1",
    storageBucket: processEnv.firebaseStorageBucket || "indiios-v-1-1.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "223837784072",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:223837784072:web:28eabcf0c5dd985395e9bd",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-KNWPRGE5JK"
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    Logger.warn('Env', "⚠️ Firebase Configuration Incomplete: Please set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID");
}
