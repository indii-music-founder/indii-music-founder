/* eslint-disable @typescript-eslint/no-explicit-any -- Utility/config types use any by design */

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
    streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        sample_rate?: string;
        bits_per_raw_sample?: string;
        bits_per_sample?: string;
        channels?: number;
    }>;
}

export interface ElectronAPI {
    // General
    getPlatform: () => Promise<string>;
    getAppVersion: () => Promise<string>;
    setPrivacyMode: (enabled: boolean) => Promise<void>;
    selectFile: (options?: { title?: string, filters?: { name: string, extensions: string[] }[] }) => Promise<string | null>;
    selectDirectory: (options?: { title?: string }) => Promise<string | null>;
    showNotification: (title: string, body: string) => void;

    // System Info (Mobile Remote, Device Detection)
    system?: {
        getMobileRemoteInfo?: () => Promise<{ localIp: string; port: number } | null>;
    };

    // Filesystem (Electron IPC)
    fs?: {
        listFiles: (path: string) => Promise<{ name: string; path: string; extension: string; sizeBytes: number }[]>;
        readTextFile: (path: string) => Promise<string>;
        readBinaryFile: (path: string) => Promise<Uint8Array>;
        mkdir: (path: string) => Promise<void>;
    };

    // Auth (Secure Main Process Flow)
    auth: {
        login: () => Promise<void>;
        logout: () => Promise<void>;
        onUserUpdate: (callback: (user: AuthTokenData | null) => void) => () => void;
    };

    // Audio (Native Processing)
    audio: {
        analyze: (filePath: string) => Promise<AudioAnalysisResult>;
        getMetadata: (hash: string) => Promise<unknown>;
        transcode: (options: unknown) => Promise<{ success: boolean; error?: string }>;
        master: (options: unknown) => Promise<{ success: boolean; path?: string; error?: string }>;
    };

    // Network (Main Process Fetching)
    network: {
        fetchUrl: (url: string) => Promise<string>;
    };

    // SFTP (Distribution)
    sftp: {
        connect: (config: unknown) => Promise<{ success: boolean; error?: string }>;
        uploadDirectory: (localPath: string, remotePath: string) => Promise<{ success: boolean; files?: string[]; error?: string }>;
        disconnect: () => Promise<{ success: boolean }>;
        isConnected: () => Promise<boolean>;
    };

    // Agent Capabilities
    agent: {
        navigateAndExtract: (url: string) => Promise<{ success: boolean; title?: string; url?: string; text?: string; screenshotBase64?: string; error?: string }>;
        performAction: (action: 'click' | 'type' | 'scroll' | 'wait', selector: string, text?: string) => Promise<{ success: boolean; error?: string }>;
        captureState: () => Promise<{ success: boolean; title?: string; url?: string; text?: string; screenshotBase64?: string; error?: string }>;
        saveHistory: (id: string, data: unknown) => Promise<{ success: boolean; error?: string }>;
        getHistory: (id: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
        deleteHistory: (id: string) => Promise<{ success: boolean; error?: string }>;
    };


    // Video (Local Asset Management)
    video: {
        saveAsset: (url: string, filename: string) => Promise<string>;
        openFolder: (filePath?: string) => Promise<void>;
    };

    // Credentials
    credentials: {
        save: (id: string, creds: unknown) => Promise<void>;
        get: (id: string) => Promise<unknown | null>;
        delete: (id: string) => Promise<boolean>;
    };

    // Distribution (DDEX Packaging)
    distribution: {
        stageRelease: (releaseId: string, files: { type: 'content' | 'path' | 'metadata'; data: string; name: string }[]) => Promise<DistributionTypes.PackageResponse>;
        runForensics: (filePath: string) => Promise<DistributionTypes.IPCResponse<DistributionTypes.ForensicsReport>>;
        packageITMSP: (releaseId: string) => Promise<DistributionTypes.PackageResponse>;
        calculateTax: (data: DistributionTypes.TaxCalculationData) => Promise<DistributionTypes.IPCResponse<DistributionTypes.TaxReport>>;
        certifyTax: (userId: string, data: DistributionTypes.TaxCertificationData) => Promise<DistributionTypes.IPCResponse<DistributionTypes.TaxReport>>;
        executeWaterfall: (data: DistributionTypes.WaterfallData) => Promise<DistributionTypes.IPCResponse<DistributionTypes.WaterfallReport>>;
        validateMetadata: (metadata: DistributionTypes.DDEXMetadata) => Promise<DistributionTypes.IPCResponse<DistributionTypes.ValidationReport>>;
        generateISRC: (options?: DistributionTypes.ISRCGenerationOptions) => Promise<DistributionTypes.ISRCResponse>;
        generateUPC: (options?: DistributionTypes.UPCGenerationOptions) => Promise<DistributionTypes.UPCResponse>;
        registerRelease: (metadata: unknown, releaseId?: string) => Promise<DistributionTypes.IPCResponse<unknown>>;
        generateDDEX: (metadata: DistributionTypes.DDEXMetadata) => Promise<DistributionTypes.DDEXResponse>;
        generateContentIdCSV: (data: DistributionTypes.ContentIdData) => Promise<DistributionTypes.CSVResponse<DistributionTypes.ContentIdReport>>;
        generateBWARM: (data: DistributionTypes.BWarmData) => Promise<DistributionTypes.CSVResponse<unknown>>;
        checkMerlinStatus: (data: DistributionTypes.MerlinCheckData) => Promise<DistributionTypes.IPCResponse<DistributionTypes.MerlinReport>>;
        transmit: (config: DistributionTypes.SFTPConfig) => Promise<DistributionTypes.IPCResponse<DistributionTypes.SFTPReport>>;
        packageSpotify: (releaseId: string, stagingPath: string, outputPath?: string) => Promise<DistributionTypes.IPCResponse<{ status: string; batchId?: string; packagePath?: string; trackCount?: number }>>;
        deliverApple: (command: string, bundlePath: string) => Promise<DistributionTypes.IPCResponse<{ status: string; action?: string; output?: string }>>;
        validateXSD: (xmlContent: string) => Promise<DistributionTypes.IPCResponse<{ valid: boolean; mode: string; errors: string[]; warnings: string[]; summary: string }>>;
        listRemoteFiles: (config: Omit<DistributionTypes.SFTPConfig, 'localPath'>) => Promise<string[]>;
        downloadRemoteFile: (config: Omit<DistributionTypes.SFTPConfig, 'localPath'>) => Promise<string>;
        // Item 350: Typed submitRelease + onSubmitProgress (replaces `as any` casts)
        submitRelease: (releaseData: unknown) => Promise<{ success: boolean; error?: string; report?: { sftp_skipped?: boolean } }>;
        onSubmitProgress: (callback: (progress: number) => void) => () => void;
    };
    on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
    // Item 351: Explicit invoke signature to remove @ts-ignore in usePowerState and UpdaterMonitor
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    updater: {
        check: () => Promise<{ available: boolean; version?: string; error?: string }>;
        install: () => Promise<void>;
    };

    // Security IPC bridge (Electron-only)
    security?: {
        rotateCredentials: (options: { serviceName: string }) => Promise<{ success: boolean; error?: string }>;
        scanVulnerabilities: (options: { scope: string }) => Promise<{ success: boolean; scan?: { scope: string; vulnerabilities: unknown[]; score: number }; error?: string }>;
    };

    // Brand analysis IPC bridge (Electron-only)
    brand?: {
        analyzeConsistency: (assetPath: string, brandKit: Record<string, unknown>) => Promise<{ success: boolean; report?: unknown; issues?: unknown[]; error?: string }>;
    };
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
        MSStream?: unknown; // Legacy iOS detection

        // Vendor-prefixed Web APIs
        webkitSpeechRecognition?: new () => any;
        SpeechRecognition?: new () => any;
        webkitAudioContext?: typeof AudioContext;

        // Google Maps auth failure callback
        gm_authFailure?: () => void;

        // Google Analytics
        gtag?: (...args: unknown[]) => void;

        // Legacy browser detection
        opera?: unknown;

        // Dev-only debug exposure (see store/index.ts, AudioIntelligenceService.ts)
        audioIntelligence?: unknown;
        useStore?: unknown;
    }

    interface Navigator {
        standalone?: boolean; // iOS PWA detection
        wakeLock?: {
            request: (type: 'screen') => Promise<unknown>;
        };
        getBattery?: () => Promise<unknown>;
    }
}

export { };
