/// <reference types="vite/client" />
/// <reference types="@react-three/fiber" />

interface ImportMetaEnv {
    readonly VITE_API_URL?: string

    // Backend AI routing is resolved in Cloud Functions.
    readonly VITE_USE_VERTEX?: string

    // Firebase
    readonly VITE_FIREBASE_API_KEY?: string
    readonly VITE_FIREBASE_PROJECT_ID?: string
    readonly VITE_FIREBASE_AUTH_DOMAIN?: string
    readonly VITE_FIREBASE_STORAGE_BUCKET?: string
    readonly VITE_FIREBASE_DATABASE_URL?: string
    readonly VITE_FIREBASE_APP_ID?: string
    readonly VITE_FIREBASE_APP_CHECK_KEY?: string
    readonly VITE_FIREBASE_VAPID_KEY?: string
    readonly VITE_FCM_VAPID_KEY?: string

    // Functions / Backend
    readonly VITE_FUNCTIONS_REGION?: string
    readonly VITE_FUNCTIONS_URL?: string
    readonly VITE_RAG_PROXY_URL?: string
    readonly VITE_USE_FUNCTIONS_EMULATOR?: string

    // Google / Maps
    readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string

    // WebSocket / WCP
    readonly VITE_WEBSOCKET_URL?: string

    // Distribution / DDEX
    readonly VITE_DDEX_DPID_AMAZON?: string
    readonly VITE_DDEX_DPID_APPLE?: string
    readonly VITE_DDEX_DPID_DEEZER?: string
    readonly VITE_DDEX_DPID_SPOTIFY?: string
    readonly VITE_DDEX_DPID_TIDAL?: string
    readonly VITE_DDEX_DPID_YOUTUBE?: string
    readonly VITE_DDEX_LIVE_MODE?: string
    readonly VITE_AMAZON_SFTP_HOST?: string
    readonly VITE_DEEZER_SFTP_HOST?: string
    readonly VITE_SPOTIFY_SFTP_HOST?: string
    readonly VITE_TIDAL_SFTP_HOST?: string

    // Printful (Merchandise)

    // Microsoft
    readonly VITE_MICROSOFT_CLIENT_ID?: string

    // EPK / Press
    readonly VITE_EPK_BASE_URL?: string
    readonly VITE_PRESAVE_BASE_URL?: string

    // Remotion — Cloud Run (GCP)
    readonly VITE_REMOTION_BUNDLE_PATH?: string
    readonly VITE_REMOTION_SITE_NAME?: string
    readonly VITE_REMOTION_SERVICE_NAME?: string
    readonly VITE_REMOTION_GCP_REGION?: string
    readonly VITE_REMOTION_GCP_PROJECT_ID?: string

    // Observability
    readonly VITE_SENTRY_DSN?: string
    readonly VITE_DEBUG_SENTRY?: string

    // App
    readonly VITE_APP_VERSION?: string
    readonly VITE_SKIP_ONBOARDING?: string
    readonly VITE_EXPOSE_INTERNALS?: string
    readonly VITE_E2E?: string
    readonly VITE_FIREBASE_E2E_MOCK?: string

    // Spotify OAuth (PKCE — client ID is safe to expose, secret stays in Cloud Functions)
    readonly VITE_SPOTIFY_CLIENT_ID?: string

    // TikTok OAuth
    readonly VITE_TIKTOK_CLIENT_KEY?: string

    // Apple Music (MusicKit JS developer token — JWT signed with Apple .p8 key)

    // Meta / Instagram Graph API
    readonly VITE_META_APP_ID?: string

    // Legacy Autonomous Sidecar (no longer active — kept for backward compat)
    readonly VITE_A0_BASE_URL?: string
    readonly VITE_A0_RUNTIME_ID?: string
    readonly VITE_A0_AUTH_LOGIN?: string
    readonly VITE_A0_AUTH_PASSWORD?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}



declare module '*?raw' {
    const content: string;
    export default content;
}

// ISSUE-1190: this file previously declared THREE `JSX` namespaces — two
// ambient `declare module 'react/jsx-runtime'` / `'react/jsx-dev-runtime'`
// stubs plus a global one — each containing only a blanket
// `IntrinsicElements { [elemName: string]: any }`.
//
// Under `jsx: "react-jsx"` TypeScript resolves the JSX namespace from
// `react/jsx-runtime`, NOT from the global one. `@types/react@18`'s real
// `jsx-runtime.d.ts` exports a complete namespace (`IntrinsicAttributes`,
// `ElementType`, `LibraryManagedAttributes`, …). Supplying a partial one here
// meant `IntrinsicAttributes` — the only source of the `key` prop for any
// non-intrinsic element — was absent from the namespace TS actually consults.
// Symptom: `<React.Fragment key={x}>` failed with "Property 'key' does not
// exist", worked around with `@ts-expect-error` at each call site. Those
// suppressions silence EVERY error on the following line, which is how
// ISSUE-1185's real keying bug shipped while typechecking clean.
//
// Custom JSX elements now live in `types/three-elements.d.ts`, declared
// explicitly. `declare global` requires a module; this file is a script (no
// top-level import/export), so the declaration cannot correctly live here.
// Do not reintroduce a blanket index signature — it was the hole, not the fix.
