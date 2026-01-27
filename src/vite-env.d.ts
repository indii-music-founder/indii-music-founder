/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL?: string
    readonly VITE_API_KEY: string
    readonly VITE_VERTEX_PROJECT_ID: string
    readonly VITE_VERTEX_LOCATION?: string
    readonly VITE_USE_VERTEX?: string
    readonly VITE_FUNCTIONS_URL?: string
    readonly VITE_RAG_PROXY_URL?: string
    readonly VITE_GOOGLE_MAPS_API_KEY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}



declare module '*?raw' {
    const content: string;
    export default content;
}
