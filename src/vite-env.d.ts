/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_KEY: string
    readonly VITE_VERTEX_PROJECT_ID: string
    readonly VITE_VERTEX_LOCATION?: string
    readonly VITE_USE_VERTEX?: string
    readonly VITE_FUNCTIONS_URL?: string
    readonly VITE_RAG_PROXY_URL?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

interface Window {
    electronAPI?: {
        // General
        getPlatform: () => Promise<string>;
        getAppVersion: () => Promise<string>;

        // Auth
        auth: {
            login: () => Promise<void>;
            logout: () => Promise<void>;
            onUserUpdate: (callback: (user: any) => void) => void;
        };

        // Audio
        audio: {
            analyze: (filePath: string) => Promise<any>;
            getMetadata: (hash: string) => Promise<any>;
        };
    };
}
