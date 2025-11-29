/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_KEY: string;
    readonly VITE_VERTEX_PROJECT_ID: string;
    readonly VITE_VERTEX_LOCATION: string;
    readonly VITE_GOOGLE_MAPS_KEY: string;
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
