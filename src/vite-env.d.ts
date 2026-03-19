/// <reference types="vite/client" />

interface ImportMetaEnv {
    // Core AI
    readonly VITE_API_KEY: string
    readonly VITE_API_URL?: string

    // Vertex AI
    readonly VITE_VERTEX_PROJECT_ID: string
    readonly VITE_VERTEX_LOCATION?: string
    readonly VITE_USE_VERTEX?: string

    // Firebase
    readonly VITE_FIREBASE_API_KEY?: string
    readonly VITE_FIREBASE_PROJECT_ID?: string
    readonly VITE_FIREBASE_AUTH_DOMAIN?: string
    readonly VITE_FIREBASE_STORAGE_BUCKET?: string
    readonly VITE_FIREBASE_DATABASE_URL?: string
    readonly VITE_FIREBASE_APP_ID?: string
    readonly VITE_FIREBASE_APP_CHECK_KEY?: string
    readonly VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN?: string
    readonly VITE_FIREBASE_VAPID_KEY?: string
    readonly VITE_FCM_VAPID_KEY?: string

    // Functions / Backend
    readonly VITE_FUNCTIONS_URL?: string
    readonly VITE_RAG_PROXY_URL?: string
    readonly VITE_USE_FUNCTIONS_EMULATOR?: string

    // Google / Maps
    readonly VITE_GOOGLE_MAPS_API_KEY?: string
    readonly VITE_GOOGLE_MAPS_KEY?: string
    readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string
    readonly VITE_GOOGLE_DEVKNOWLEDGE_API_KEY?: string

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
    readonly VITE_PRINTFUL_API_KEY?: string

    // Pinata (IPFS)
    readonly VITE_PINATA_API_KEY?: string
    readonly VITE_PINATA_SECRET?: string
    readonly VITE_PINATA_JWT?: string
    readonly VITE_PINATA_GATEWAY?: string

    // Web3 / Blockchain
    readonly VITE_ALCHEMY_API_KEY?: string
    readonly VITE_ETH_RPC_URL?: string
    readonly VITE_OPENSEA_API_KEY?: string
    readonly VITE_WALLETCONNECT_PROJECT_ID?: string
    readonly VITE_UD_API_KEY?: string

    // DocuSign
    readonly VITE_DOCUSIGN_ACCESS_TOKEN?: string
    readonly VITE_DOCUSIGN_ACCOUNT_ID?: string
    readonly VITE_DOCUSIGN_BASE_URL?: string

    // Microsoft
    readonly VITE_MICROSOFT_CLIENT_ID?: string

    // Monetization / Legal
    readonly VITE_NOTARIZE_API_KEY?: string

    // EPK / Press
    readonly VITE_EPK_BASE_URL?: string
    readonly VITE_PRESAVE_BASE_URL?: string

    // Remotion
    readonly VITE_REMOTION_SITE_NAME?: string

    // Observability
    readonly VITE_SENTRY_DSN?: string
    readonly VITE_DEBUG_SENTRY?: string

    // App
    readonly VITE_APP_VERSION?: string
    readonly VITE_SKIP_ONBOARDING?: string
    readonly VITE_EXPOSE_INTERNALS?: string

    // Spotify OAuth (PKCE — client ID is safe to expose, secret stays in Cloud Functions)
    readonly VITE_SPOTIFY_CLIENT_ID?: string

    // TikTok OAuth
    readonly VITE_TIKTOK_CLIENT_KEY?: string

    // Apple Music (MusicKit JS developer token — JWT signed with Apple .p8 key)
    readonly VITE_APPLE_MUSIC_DEV_TOKEN?: string

    // Meta / Instagram Graph API
    readonly VITE_META_APP_ID?: string

    // Legacy AI Sidecar (no longer active — kept for backward compat)
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
