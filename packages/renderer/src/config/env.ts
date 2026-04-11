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
    firebaseAuthDomain: z.string().optional(),
    firebaseProjectId: z.string().optional(),
    firebaseStorageBucket: z.string().optional(),
    firebaseDatabaseURL: z.union([z.string().url(), z.literal('')]).optional(),

    // App Check
    VITE_FIREBASE_APP_CHECK_KEY: z.string().optional(),
    VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN: z.string().optional(),

    // AI Sidecar
    VITE_A0_BASE_URL: z.string().url().optional(),
    VITE_A0_RUNTIME_ID: z.string().optional(),
    VITE_A0_AUTH_LOGIN: z.string().optional(),
    VITE_A0_AUTH_PASSWORD: z.string().optional(),

    // Dev/Debug flags
    VITE_USE_FUNCTIONS_EMULATOR: z.string().optional(),
    VITE_EXPOSE_INTERNALS: z.string().optional(),

    skipOnboarding: z.boolean().default(false),
});

// Robust test environment detection early for getEnv logic
const getProcessEnv = (key: string): string | undefined => {
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key];
    }
    return undefined;
};

const isTest =
    typeof process !== 'undefined' && process.env && (
        !!process.env.VITEST ||
        !!process.env.NODE_ENV?.includes('test') ||
        process.env.VITEST_WORKER_ID !== undefined
    );

const getEnv = (metaValue: string | boolean | undefined, processValue: string | undefined): string | undefined => {
    // In test environment, prioritize process.env (processValue) for easier mocking
    if (isTest) return processValue || (typeof metaValue === 'string' ? metaValue : undefined) || undefined;

    const val = (typeof metaValue === 'string' ? metaValue : undefined) || processValue;
    return val || undefined;
};

const getSafeMetaEnv = (key: string): string | boolean | undefined => {
    try {
        return (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env?.[key];
    } catch {
        return undefined;
    }
};

const processEnv = {
    // 🛡️ Sentinel: Using static lookups for Vite compatibility
    apiKey: getEnv(getSafeMetaEnv('VITE_API_KEY'), getProcessEnv('VITE_API_KEY')),
    projectId: getEnv(getSafeMetaEnv('VITE_VERTEX_PROJECT_ID'), getProcessEnv('VITE_VERTEX_PROJECT_ID')),
    location: getEnv(getSafeMetaEnv('VITE_VERTEX_LOCATION'), getProcessEnv('VITE_VERTEX_LOCATION')) || "us-central1",
    useVertex: toBoolean(getSafeMetaEnv('VITE_USE_VERTEX') || getProcessEnv('VITE_USE_VERTEX')),
    googleMapsApiKey: getEnv(getSafeMetaEnv('VITE_GOOGLE_MAPS_API_KEY'), getProcessEnv('VITE_GOOGLE_MAPS_API_KEY')),

    VITE_FUNCTIONS_URL: getEnv(getSafeMetaEnv('VITE_FUNCTIONS_URL'), getProcessEnv('VITE_FUNCTIONS_URL')),
    VITE_RAG_PROXY_URL: getEnv(getSafeMetaEnv('VITE_RAG_PROXY_URL'), getProcessEnv('VITE_RAG_PROXY_URL')),
    DEV: getSafeMetaEnv('DEV') ?? getProcessEnv('NODE_ENV') !== 'production',

    // Firebase specific overrides
    firebaseApiKey: getEnv(getSafeMetaEnv('VITE_FIREBASE_API_KEY'), getProcessEnv('VITE_FIREBASE_API_KEY')),
    firebaseAuthDomain: getEnv(getSafeMetaEnv('VITE_FIREBASE_AUTH_DOMAIN'), getProcessEnv('VITE_FIREBASE_AUTH_DOMAIN')),
    firebaseProjectId: getEnv(getSafeMetaEnv('VITE_FIREBASE_PROJECT_ID'), getProcessEnv('VITE_FIREBASE_PROJECT_ID')),
    firebaseStorageBucket: getEnv(getSafeMetaEnv('VITE_FIREBASE_STORAGE_BUCKET'), getProcessEnv('VITE_FIREBASE_STORAGE_BUCKET')),
    firebaseDatabaseURL: getEnv(getSafeMetaEnv('VITE_FIREBASE_DATABASE_URL'), getProcessEnv('VITE_FIREBASE_DATABASE_URL')),
    appCheckKey: getEnv(getSafeMetaEnv('VITE_FIREBASE_APP_CHECK_KEY'), getProcessEnv('VITE_FIREBASE_APP_CHECK_KEY')),
    appCheckDebugToken: getEnv(getSafeMetaEnv('VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN'), getProcessEnv('VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN')),

    skipOnboarding: toBoolean(getSafeMetaEnv('VITE_SKIP_ONBOARDING') || getProcessEnv('VITE_SKIP_ONBOARDING')),
    VITE_EXPOSE_INTERNALS: getEnv(getSafeMetaEnv('VITE_EXPOSE_INTERNALS'), getProcessEnv('VITE_EXPOSE_INTERNALS')),
    VITE_USE_FUNCTIONS_EMULATOR: getEnv(getSafeMetaEnv('VITE_USE_FUNCTIONS_EMULATOR'), getProcessEnv('VITE_USE_FUNCTIONS_EMULATOR')),

    // AI Sidecar
    VITE_A0_BASE_URL: getEnv(getSafeMetaEnv('VITE_A0_BASE_URL'), getProcessEnv('VITE_A0_BASE_URL')),
    VITE_A0_RUNTIME_ID: getEnv(getSafeMetaEnv('VITE_A0_RUNTIME_ID'), getProcessEnv('VITE_A0_RUNTIME_ID')),
    VITE_A0_AUTH_LOGIN: getEnv(getSafeMetaEnv('VITE_A0_AUTH_LOGIN'), getProcessEnv('VITE_A0_AUTH_LOGIN')),
    VITE_A0_AUTH_PASSWORD: getEnv(getSafeMetaEnv('VITE_A0_AUTH_PASSWORD'), getProcessEnv('VITE_A0_AUTH_PASSWORD')),
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

const runtimeEnv = parsed.success ? parsed.data : (processEnv as z.infer<typeof FrontendEnvSchema>);

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

// Firebase configuration — all values sourced from .env (VITE_FIREBASE_*).
// No hardcoded fallbacks. If keys are missing, the app will show the login
// screen with an error rather than silently connecting to the wrong project.
export const firebaseConfig = {
    apiKey: firebaseEnv.firebaseApiKey || "",
    authDomain: firebaseEnv.firebaseAuthDomain || "",
    databaseURL: firebaseEnv.firebaseDatabaseURL || "",
    projectId: firebaseEnv.firebaseProjectId || "",
    storageBucket: firebaseEnv.firebaseStorageBucket || "",
    messagingSenderId: getEnv(getSafeMetaEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'), getProcessEnv('VITE_FIREBASE_MESSAGING_SENDER_ID')) || "",
    appId: getEnv(getSafeMetaEnv('VITE_FIREBASE_APP_ID'), getProcessEnv('VITE_FIREBASE_APP_ID')) || "",
    measurementId: getEnv(getSafeMetaEnv('VITE_FIREBASE_MEASUREMENT_ID'), getProcessEnv('VITE_FIREBASE_MEASUREMENT_ID')) || ""
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    const msg = "Firebase Configuration Incomplete: Please set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID";
    Logger.error('Env', msg);
    // Do not throw in production — the hardcoded fallbacks above should prevent
    // this branch from ever being reached. If they do, we log and continue so
    // users see the login form rather than a blank page.
}
