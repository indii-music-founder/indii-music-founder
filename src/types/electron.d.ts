import * as DistributionTypes from './distribution';

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
        stageRelease: (releaseId: string, files: { type: 'content' | 'path'; data: string; name: string }[]) => Promise<DistributionTypes.PackageResponse>;
        runForensics: (filePath: string) => Promise<DistributionTypes.IPCResponse<any>>;
        packageITMSP: (releaseId: string) => Promise<DistributionTypes.PackageResponse>;
        calculateTax: (data: DistributionTypes.TaxCalculationData) => Promise<DistributionTypes.IPCResponse<DistributionTypes.TaxReport>>;
        certifyTax: (userId: string, data: DistributionTypes.TaxCertificationData) => Promise<DistributionTypes.IPCResponse<DistributionTypes.TaxReport>>;
        executeWaterfall: (data: DistributionTypes.WaterfallData) => Promise<DistributionTypes.IPCResponse<DistributionTypes.WaterfallReport>>;
        validateMetadata: (metadata: DistributionTypes.DDEXMetadata) => Promise<DistributionTypes.IPCResponse<DistributionTypes.ValidationReport>>;
        generateISRC: (options?: DistributionTypes.ISRCGenerationOptions) => Promise<DistributionTypes.ISRCResponse>;
        generateUPC: (options?: DistributionTypes.UPCGenerationOptions) => Promise<DistributionTypes.UPCResponse>;
        registerRelease: (metadata: any, releaseId?: string) => Promise<DistributionTypes.IPCResponse<any>>;
        generateDDEX: (metadata: DistributionTypes.DDEXMetadata) => Promise<DistributionTypes.DDEXResponse>;
        generateContentIdCSV: (data: DistributionTypes.ContentIdData) => Promise<DistributionTypes.CSVResponse<DistributionTypes.ContentIdReport>>;
        generateBWARM: (data: DistributionTypes.BWarmData) => Promise<DistributionTypes.CSVResponse<any>>;
        checkMerlinStatus: (data: DistributionTypes.MerlinCheckData) => Promise<DistributionTypes.IPCResponse<DistributionTypes.MerlinReport>>;
        transmit: (config: DistributionTypes.SFTPConfig) => Promise<DistributionTypes.IPCResponse<DistributionTypes.SFTPReport>>;
    };
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
        MSStream?: any; // Legacy iOS detection
    }

    interface Navigator {
        standalone?: boolean; // iOS PWA detection
        wakeLock?: {
            request: (type: 'screen') => Promise<any>;
        };
        getBattery?: () => Promise<any>;
    }
}

export { };
