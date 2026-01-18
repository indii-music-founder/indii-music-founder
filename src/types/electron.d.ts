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

    // SFTP (Distribution)
    sftp: {
        connect: (config: any) => Promise<{ success: boolean; error?: string }>;
        uploadDirectory: (localPath: string, remotePath: string) => Promise<{ success: boolean; files?: string[]; error?: string }>;
        disconnect: () => Promise<{ success: boolean }>;
        isConnected: () => Promise<boolean>;
    };

    // Agent Capabilities
    agent: {
        navigateAndExtract: (url: string) => Promise<{ success: boolean; title?: string; url?: string; text?: string; screenshotBase64?: string; error?: string }>;
        performAction: (action: 'click' | 'type' | 'scroll' | 'wait', selector: string, text?: string) => Promise<{ success: boolean; error?: string }>;
        captureState: () => Promise<{ success: boolean; title?: string; url?: string; text?: string; screenshotBase64?: string; error?: string }>;
        saveHistory: (id: string, data: any) => Promise<{ success: boolean; error?: string }>;
        getHistory: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        deleteHistory: (id: string) => Promise<{ success: boolean; error?: string }>;
    };

    // Credentials
    credentials: {
        save: (id: string, creds: any) => Promise<void>;
        get: (id: string) => Promise<any | null>;
        delete: (id: string) => Promise<boolean>;
    };

    // Distribution (DDEX Packaging)
    distribution: {
        stageRelease: (releaseId: string, files: { type: 'content' | 'path'; data: string; name: string }[]) => Promise<{ success: boolean; packagePath?: string; files?: string[]; error?: string }>;
        runForensics: (filePath: string) => Promise<{ success: boolean; report: any; error?: string }>;
        packageITMSP: (releaseId: string) => Promise<{ success: boolean; itmspPath?: string; message?: string; error?: string }>;
        calculateTax: (data: any) => Promise<{ success: boolean; report: any; error?: string }>;
        certifyTax: (userId: string, data: any) => Promise<{ success: boolean; report: any; error?: string }>;
        executeWaterfall: (data: any) => Promise<{ success: boolean; report: any; error?: string }>;
        validateMetadata: (metadata: any) => Promise<{ success: boolean; report: any; error?: string }>;
        generateISRC: (options?: any) => Promise<{ success: boolean; isrc?: string; report?: any; error?: string }>;
        generateUPC: (options?: any) => Promise<{ success: boolean; upc?: string; error?: string }>;
        registerRelease: (metadata: any, releaseId?: string) => Promise<{ success: boolean; release?: any; error?: string }>;
        generateDDEX: (metadata: any) => Promise<{ success: boolean; xml?: string; error?: string }>;
        generateContentIdCSV: (data: any) => Promise<{ success: boolean; csvData?: string; report?: any; error?: string }>;
        generateBWARM: (data: any) => Promise<{ success: boolean; csv?: string; report?: any; error?: string }>;
        checkMerlinStatus: (data: any) => Promise<{ success: boolean; report?: any; error?: string }>;
    };
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export { };
