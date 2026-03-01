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

// Robust test environment detection early for getEnv logic
const isTest =
    typeof process !== 'undefined' && (
        !!process.env.VITEST ||
        !!process.env.NODE_ENV?.includes('test') ||
        process.env.VITEST_WORKER_ID !== undefined
    );

const getEnv = (metaValue: any, processValue: any): string | undefined => {
    // In test environment, prioritize process.env (processValue) for easier mocking
    if (isTest) return processValue || metaValue || undefined;

    const val = metaValue || processValue;
    return val || undefined;
};

const getSafeMetaEnv = (key: string): any => {
    try {
        return (import.meta as any).env?.[key];
    } catch {
        return undefined;
    }
};

const processEnv = {
    // 🛡️ Sentinel: Using static lookups for Vite compatibility
    apiKey: getEnv(getSafeMetaEnv('VITE_API_KEY'), process.env.VITE_API_KEY),
    projectId: getEnv(getSafeMetaEnv('VITE_VERTEX_PROJECT_ID'), process.env.VITE_VERTEX_PROJECT_ID),
    location: getEnv(getSafeMetaEnv('VITE_VERTEX_LOCATION'), process.env.VITE_VERTEX_LOCATION) || "us-central1",
    useVertex: toBoolean(getSafeMetaEnv('VITE_USE_VERTEX') || process.env.VITE_USE_VERTEX),
    googleMapsApiKey: getEnv(getSafeMetaEnv('VITE_GOOGLE_MAPS_API_KEY'), process.env.VITE_GOOGLE_MAPS_API_KEY),

    VITE_FUNCTIONS_URL: getEnv(getSafeMetaEnv('VITE_FUNCTIONS_URL'), process.env.VITE_FUNCTIONS_URL),
    VITE_RAG_PROXY_URL: getEnv(getSafeMetaEnv('VITE_RAG_PROXY_URL'), process.env.VITE_RAG_PROXY_URL),
    DEV: getSafeMetaEnv('DEV') ?? process.env.NODE_ENV !== 'production',

    // Firebase specific overrides
    firebaseApiKey: getEnv(getSafeMetaEnv('VITE_FIREBASE_API_KEY'), process.env.VITE_FIREBASE_API_KEY),
    firebaseProjectId: getEnv(getSafeMetaEnv('VITE_FIREBASE_PROJECT_ID'), process.env.VITE_FIREBASE_PROJECT_ID),
    firebaseStorageBucket: getEnv(getSafeMetaEnv('VITE_FIREBASE_STORAGE_BUCKET'), process.env.VITE_FIREBASE_STORAGE_BUCKET),
    firebaseDatabaseURL: getEnv(getSafeMetaEnv('VITE_FIREBASE_DATABASE_URL'), process.env.VITE_FIREBASE_DATABASE_URL),
    appCheckKey: getEnv(getSafeMetaEnv('VITE_FIREBASE_APP_CHECK_KEY'), process.env.VITE_FIREBASE_APP_CHECK_KEY),
    appCheckDebugToken: getEnv(getSafeMetaEnv('VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN'), process.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN),

    skipOnboarding: toBoolean(getSafeMetaEnv('VITE_SKIP_ONBOARDING') || process.env.VITE_SKIP_ONBOARDING),
    VITE_EXPOSE_INTERNALS: getEnv(getSafeMetaEnv('VITE_EXPOSE_INTERNALS'), process.env.VITE_EXPOSE_INTERNALS),
};

// isTest moved to top

const parsed = FrontendEnvSchema.safeParse(processEnv);

if (!parsed.success && !isTest) {
    Logger.error('Env', "Invalid environment configuration:", parsed.error.format());

    // Explicitly log missing keys for easier debugging
    const missingKeys: string[] = [];
    if (!processEnv.apiKey) missingKeys.push('VITE_API_KEY');
    if (!processEnv.projectId) missingKeys.push('VITE_VERTEX_PROJECT_ID');
    if (!processEnv.firebaseApiKey) missingKeys.push('VITE_FIREBASE_API_KEY');

    if (missingKeys.length > 0) {
        const msg = `Missing required environment variables: ${missingKeys.join(', ')}. Copy .env.example to .env and fill in values.`;
        Logger.error('Env', msg);

        // In production, throw to prevent running with broken config
        if (getSafeMetaEnv('PROD')) {
            throw new Error(msg);
        }

        // In dev, warn but continue with degraded functionality
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

const firebaseEnv = processEnv;

export const firebaseConfig = {
    apiKey: firebaseEnv.firebaseApiKey || "",
    authDomain: "indiios-v-1-1.firebaseapp.com",
    databaseURL: "https://indiios-v-1-1-default-rtdb.firebaseio.com",
    projectId: "indiios-v-1-1",
    storageBucket: firebaseEnv.firebaseStorageBucket || "indiios-v-1-1.firebasestorage.app",
    messagingSenderId: "223837784072",
    appId: "1:223837784072:web:3af738739465ea4095e9bd",
    measurementId: "G-7WW3HEHFTF"
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    const msg = "Firebase Configuration Incomplete: Please set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID";
    Logger.error('Env', msg);

    if (getSafeMetaEnv('PROD')) {
        throw new Error(msg);
    }
}
