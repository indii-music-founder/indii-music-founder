export interface AuthTokenData {
    idToken: string;
    accessToken?: string | null;
}

export interface AudioAnalysisResult {
    status: 'success' | 'error';
    hash: string;
    metadata: {
        duration: number;
        format: string;
        bitrate: number;
    };
}

export interface ElectronAPI {
    // General
    getPlatform: () => Promise<string>;
    getAppVersion: () => Promise<string>;
    setPrivacyMode: (enabled: boolean) => Promise<void>;

    // Auth (Secure Main Process Flow)
    auth: {
        login: () => Promise<void>;
        logout: () => Promise<void>;
        onUserUpdate: (callback: (user: AuthTokenData | null) => void) => () => void;
    };

    // Audio (Native Processing)
    audio: {
        analyze: (filePath: string) => Promise<AudioAnalysisResult>;
        getMetadata: (hash: string) => Promise<any>;
    };

    // Network (Main Process Fetching)
    network: {
        fetchUrl: (url: string) => Promise<string>;
    };
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export { };
