import { z } from 'zod';
import { CommonEnvSchema } from '../shared/schemas/env.schema.ts';

const toBoolean = (value: string | boolean | undefined): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return false;
};

const FrontendEnvSchema = CommonEnvSchema.extend({
    // Frontend specific
    VITE_FUNCTIONS_REGION: z.string().optional(),
    VITE_FUNCTIONS_URL: z.string().url().optional(),
    VITE_RAG_PROXY_URL: z.union([z.string().url(), z.literal('')]).optional(),
    VITE_GOOGLE_MAPS_API_KEY: z.string().optional(),
    VITE_ENABLE_GOOGLE_MAPS: z.string().optional(),
    DEV: z.boolean().default(false),

    // Firebase specific overrides (optional)
    firebaseAuthDomain: z.string().optional(),
    firebaseProjectId: z.string().optional(),
    firebaseStorageBucket: z.string().optional(),
    firebaseDatabaseURL: z.union([z.string().url(), z.literal('')]).optional(),

    // App Check
    VITE_FIREBASE_APP_CHECK_KEY: z.string().optional(),
    VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN: z.string().optional(),

    // Autonomous Sidecar
    VITE_A0_BASE_URL: z.string().url().optional(),
    VITE_A0_RUNTIME_ID: z.string().optional(),
    VITE_A0_AUTH_LOGIN: z.string().optional(),
    VITE_A0_AUTH_PASSWORD: z.string().optional(),

    // Dev/Debug flags
    VITE_USE_FUNCTIONS_EMULATOR: z.string().optional(),
    VITE_EXPOSE_INTERNALS: z.string().optional(),

    skipOnboarding: z.boolean().default(false),
    enableGoogleMaps: z.boolean().default(true),
});

// Initial test env detection removed to fix duplicate declaration

const isTest =
    typeof process !== 'undefined' && process.env && (
        !!process.env.VITEST ||
        !!process.env.NODE_ENV?.includes('test') ||
        process.env.VITEST_WORKER_ID !== undefined
    );

export const getEnv = (metaValue: string | boolean | undefined, processValue: string | undefined): string | undefined => {
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

const getProcessEnv = (key: string): string | undefined => {
    try {
        if (typeof process !== 'undefined' && process.env) {
            return process.env[key];
        }
    } catch {
        return undefined;
    }
    return undefined;
};

const processEnv = {
    // 🛡️ Sentinel: Using static lookups for Vite compatibility
    // Vite requires static analysis of import.meta.env.VITE_* to perform replacement at build time.
    apiKey: import.meta.env.VITE_API_KEY || getProcessEnv('VITE_API_KEY'),
    projectId: import.meta.env.VITE_VERTEX_PROJECT_ID || getProcessEnv('VITE_VERTEX_PROJECT_ID'),
    location: import.meta.env.VITE_VERTEX_LOCATION || getProcessEnv('VITE_VERTEX_LOCATION') || "global",
    functionsRegion: import.meta.env.VITE_FUNCTIONS_REGION || getProcessEnv('VITE_FUNCTIONS_REGION') || 'us-central1',
    useVertex: toBoolean(import.meta.env.VITE_USE_VERTEX || getProcessEnv('VITE_USE_VERTEX')),
    googleMapsApiKey: (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_KEY || getProcessEnv('VITE_GOOGLE_MAPS_API_KEY') || getProcessEnv('VITE_GOOGLE_MAPS_KEY'))?.trim(),
    VITE_GOOGLE_MAPS_API_KEY: (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_KEY || getProcessEnv('VITE_GOOGLE_MAPS_API_KEY') || getProcessEnv('VITE_GOOGLE_MAPS_KEY'))?.trim(),
    VITE_ENABLE_GOOGLE_MAPS: import.meta.env.VITE_ENABLE_GOOGLE_MAPS || getProcessEnv('VITE_ENABLE_GOOGLE_MAPS'),
    enableGoogleMaps: (() => {
        const raw = import.meta.env.VITE_ENABLE_GOOGLE_MAPS || getProcessEnv('VITE_ENABLE_GOOGLE_MAPS');
        return raw === undefined ? true : toBoolean(raw);
    })(),

    VITE_FUNCTIONS_REGION: import.meta.env.VITE_FUNCTIONS_REGION || getProcessEnv('VITE_FUNCTIONS_REGION'),
    VITE_FUNCTIONS_URL: import.meta.env.VITE_FUNCTIONS_URL || getProcessEnv('VITE_FUNCTIONS_URL'),
    VITE_RAG_PROXY_URL: import.meta.env.VITE_RAG_PROXY_URL || getProcessEnv('VITE_RAG_PROXY_URL'),
    DEV: import.meta.env.DEV ?? getProcessEnv('NODE_ENV') !== 'production',

    // Firebase specific overrides
    firebaseApiKey: import.meta.env.VITE_FIREBASE_API_KEY || getProcessEnv('VITE_FIREBASE_API_KEY'),
    firebaseAuthDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || getProcessEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || getProcessEnv('VITE_FIREBASE_PROJECT_ID'),
    firebaseStorageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || getProcessEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    firebaseDatabaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || getProcessEnv('VITE_FIREBASE_DATABASE_URL'),
    appCheckKey: import.meta.env.VITE_FIREBASE_APP_CHECK_KEY || getProcessEnv('VITE_FIREBASE_APP_CHECK_KEY'),
    appCheckDebugToken: import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN || getProcessEnv('VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN'),
    appId: import.meta.env.VITE_FIREBASE_APP_ID || getProcessEnv('VITE_FIREBASE_APP_ID'),

    skipOnboarding: toBoolean(import.meta.env.VITE_SKIP_ONBOARDING || getProcessEnv('VITE_SKIP_ONBOARDING')),
    VITE_EXPOSE_INTERNALS: import.meta.env.VITE_EXPOSE_INTERNALS || getProcessEnv('VITE_EXPOSE_INTERNALS'),
    VITE_USE_FUNCTIONS_EMULATOR: import.meta.env.VITE_USE_FUNCTIONS_EMULATOR || getProcessEnv('VITE_USE_FUNCTIONS_EMULATOR'),

    // Autonomous Sidecar
    VITE_A0_BASE_URL: import.meta.env.VITE_A0_BASE_URL || getProcessEnv('VITE_A0_BASE_URL'),
    VITE_A0_RUNTIME_ID: import.meta.env.VITE_A0_RUNTIME_ID || getProcessEnv('VITE_A0_RUNTIME_ID'),
    VITE_A0_AUTH_LOGIN: import.meta.env.VITE_A0_AUTH_LOGIN || getProcessEnv('VITE_A0_AUTH_LOGIN'),
    VITE_A0_AUTH_PASSWORD: import.meta.env.VITE_A0_AUTH_PASSWORD || getProcessEnv('VITE_A0_AUTH_PASSWORD'),
};

// isTest moved to top

const parsed = FrontendEnvSchema.safeParse(processEnv);

if (!parsed.success && !isTest) {
    // Use console.error directly — Logger is NOT safe to use here because this
    // module is part of the Logger import chain. Using Logger here would
    // risk another circular evaluation failure.
    console.error('[indii.music][Env] Invalid environment configuration:', parsed.error.format());

    // Explicitly log missing keys for easier debugging
    const missingKeys: string[] = [];
    if (!processEnv.apiKey) missingKeys.push('VITE_API_KEY');
    if (!processEnv.projectId) missingKeys.push('VITE_VERTEX_PROJECT_ID');
    if (!processEnv.firebaseApiKey) missingKeys.push('VITE_FIREBASE_API_KEY');
    
    // Add Google Maps warning if missing but enabled
    if (processEnv.enableGoogleMaps && !processEnv.googleMapsApiKey) {
        console.warn('[indii.music][Env] Google Maps is enabled but VITE_GOOGLE_MAPS_API_KEY is missing. Map features will be disabled.');
    }

    if (missingKeys.length > 0) {
        const msg = `[indii.music][Env] Missing required environment variables: ${missingKeys.join(', ')}. Copy .env.example to .env and fill in values.`;
        // NEVER throw here — this file is evaluated during static module loading,
        // BEFORE ReactDOM.createRoot() runs. A throw here bypasses every try/catch
        // and error boundary, resulting in the infinite CSS spinner.
        // Log the error and allow the app to mount in degraded mode.
        console.error(msg);
    }
}

const runtimeEnv = parsed.success ? parsed.data : (processEnv as z.infer<typeof FrontendEnvSchema>);

// Item 326: Log env in dev mode
if (import.meta.env.DEV) {
    console.log('[indii.music][Env] Initialized:', {
        hasMapsKey: !!runtimeEnv.googleMapsApiKey,
        mapsEnabled: runtimeEnv.enableGoogleMaps,
    });
}

export const env = {
    ...runtimeEnv,
    VITE_API_KEY: runtimeEnv.apiKey,
    VITE_VERTEX_PROJECT_ID: runtimeEnv.projectId,
    VITE_VERTEX_LOCATION: runtimeEnv.location,
    VITE_FUNCTIONS_REGION: runtimeEnv.functionsRegion,
    VITE_USE_VERTEX: runtimeEnv.useVertex,
    VITE_GOOGLE_MAPS_API_KEY: runtimeEnv.googleMapsApiKey || runtimeEnv.VITE_GOOGLE_MAPS_API_KEY,
    enableGoogleMaps: runtimeEnv.enableGoogleMaps,
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
    appId: firebaseEnv.appId || getEnv(getSafeMetaEnv('VITE_FIREBASE_APP_ID'), getProcessEnv('VITE_FIREBASE_APP_ID')) || "",
    measurementId: getEnv(getSafeMetaEnv('VITE_FIREBASE_MEASUREMENT_ID'), getProcessEnv('VITE_FIREBASE_MEASUREMENT_ID')) || ""
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    const msg = "[indii.music][Env] Firebase Configuration Incomplete: Please set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID";
    console.error(msg);
    // Do not throw in production — the empty defaults above should prevent
    // this branch from ever being reached. If they do, we log and continue so
    // users see the login form rather than a blank page.
}
