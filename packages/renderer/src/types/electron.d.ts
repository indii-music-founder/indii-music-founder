

import * as DistributionTypes from './distribution';
import * as SchedulerTypes from '../services/scheduler/types';

/** Shape of the payload delivered by the Electron P2P IPC bridge to the renderer. */
export interface RemoteMobilePayload {
    type: string;
    ts?: number;
    command?: {
        id?: string;
        text: string;
        targetAgentId?: string;
        metadata?: Record<string, unknown>;
        executionTarget?: 'cloud' | 'studio';
    };
}
export interface AuthTokenData {
    idToken: string;
    accessToken?: string | null;
    source?: string | null;
}

export interface DAWState {
    bpm: number;
    isPlaying: boolean;
    currentTime: number;
    trackNames: string[];
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
    features?: {
        bpm: number;
        key: string;
        scale: string;
        energy: number;
        duration: number;
        danceability: number;
        valence: number;
        loudness: number;
        genre: Record<string, number>;
        moods: {
            happy: number;
            aggressive: number;
            relaxed: number;
            sad: number;
        };
        audit?: {
            peakLevel: number;
            truePeakDb: number;
            integratedLoudness: number;
            sampleRate: number;
            isStereo: boolean;
            rejectionRisks: string[];
            measurementMethod?: 'measured';
            bitDepth?: number;
        };
    } | null;
    proxyBase64?: string | null;
    error?: string;
}

export interface ElectronAPI {
    // General
    getPlatform: () => Promise<string>;
    getAppVersion: () => Promise<string>;
    setPrivacyMode: (enabled: boolean) => Promise<void>;
    selectFile: (options?: { title?: string, filters?: { name: string, extensions: string[] }[] }) => Promise<string | null>;
    selectDirectory: (options?: { title?: string }) => Promise<string | null>;
    searchApprovedAssets: (dirPath: string, options?: { query?: string; extensions?: string[]; maxResults?: number }) => Promise<Array<{
        name: string;
        relativePath: string;
        extension: string;
        sizeBytes: number;
        modifiedAt: number;
    }>>;
    showNotification: (title: string, body: string) => void;

    // System Info (Mobile Remote, Device Detection)
    system?: {
        getMobileRemoteInfo?: () => Promise<{ localIp: string; port: number; passcode?: string } | null>;
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
        onError: (callback: (data: { message: string }) => void) => () => void;
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
        fetchUrlBase64: (url: string) => Promise<{ base64: string; contentType: string }>;
    };

    // SFTP (Distribution)
    sftp: {
        connect: (config: unknown) => Promise<{ success: boolean; error?: string }>;
        connectDistributor: (distributorId: string) => Promise<{ success: boolean; error?: string }>;
        uploadDirectory: (localPath: string, remotePath: string) => Promise<{ success: boolean; files?: string[]; error?: string }>;
        disconnect: () => Promise<{ success: boolean }>;
        isConnected: () => Promise<boolean>;
        listDirectory: (remotePath: string) => Promise<{ success: boolean; files?: { name: string; isDirectory: boolean; size: number; modifyTime: number }[]; error?: string }>;
        readFile: (remotePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    };

    // Agent Capabilities
    agent: {
        navigateAndExtract: (url: string) => Promise<{ success: boolean; title?: string; url?: string; text?: string; screenshotBase64?: string; error?: string }>;
        performAction: (action: 'click' | 'type' | 'scroll' | 'wait', selector: string, text?: string) => Promise<{ success: boolean; error?: string }>;
        captureState: () => Promise<{ success: boolean; title?: string; url?: string; text?: string; screenshotBase64?: string; error?: string }>;
        saveHistory: (id: string, data: unknown) => Promise<{ success: boolean; error?: string }>;
        getHistory: (id: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
        deleteHistory: (id: string) => Promise<{ success: boolean; error?: string }>;
        listArtifacts: () => Promise<{ success: boolean; data?: { filename: string }[]; error?: string }>;
        readArtifact: (filename: string) => Promise<{ success: boolean; data?: string; error?: string }>;
        createArtifact: (filename: string, content: string, options?: { artifactType?: string, requestFeedback?: boolean }) => Promise<{ success: boolean; error?: string }>;
        multiReplaceFileContent: (args: unknown) => Promise<{ success: boolean; error?: string }>;
        scanDirectory: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
        updateKnowledge: (filePath: string, action: string, knowledge: unknown) => Promise<{ success: boolean; error?: string }>;
    };

    // Computer Capability (CE-1: read path, ISSUE-1110. CE-2: input control + kill switch, ISSUE-1111)
    computer?: {
        checkPermissions: () => Promise<{ success: boolean; data?: { platform: string; supported: boolean; screenRecording: string; accessibility: string; guidance: string[] }; error?: string }>;
        screenshot: (options?: { displayId?: number }) => Promise<{ success: boolean; data?: { base64: string; width: number; height: number; displayId: number }; error?: string }>;
        listApps: () => Promise<{ success: boolean; data?: { apps: string[] }; error?: string }>;
        openApp: (app: string) => Promise<{ success: boolean; data?: { app: string }; error?: string }>;
        click: (x: number, y: number, button?: 'left' | 'right' | 'double') => Promise<{ success: boolean; data?: { x: number; y: number; button: string }; error?: string }>;
        type: (text: string) => Promise<{ success: boolean; data?: { length: number }; error?: string }>;
        key: (combo: string) => Promise<{ success: boolean; data?: { combo: string }; error?: string }>;
        scroll: (dx: number, dy: number) => Promise<{ success: boolean; data?: { dx: number; dy: number }; error?: string }>;
        abort: () => Promise<{ success: boolean; data?: { aborted: boolean }; error?: string }>;
        resetAbort: () => Promise<{ success: boolean; data?: { aborted: boolean }; error?: string }>;
        getAbortState: () => Promise<{ success: boolean; data?: { aborted: boolean }; error?: string }>;
        allowlistGet: () => Promise<{ success: boolean; data?: { apps: string[] }; error?: string }>;
        allowlistAdd: (app: string) => Promise<{ success: boolean; data?: { apps: string[] }; error?: string }>;
        allowlistRemove: (app: string) => Promise<{ success: boolean; data?: { apps: string[] }; error?: string }>;
        grantSession: (sessionId: string, ttlMs?: number) => Promise<{ success: boolean; data?: { sessionId: string; grantedAt: number; expiresAt: number }; error?: string }>;
        revokeGrant: (sessionId: string) => Promise<{ success: boolean; data?: { sessionId: string }; error?: string }>;
        hasGrant: (sessionId: string) => Promise<{ success: boolean; data?: { hasGrant: boolean }; error?: string }>;
    };


    // Autonomous Sidecar (Docker container management — restart handled by health checks)
    sidecar?: {
        onStatusUpdate?: (callback: (status: string) => void) => () => void;
    };

    // Power Monitor
    power?: {
        getState: () => Promise<string>;
        onBattery: (callback: () => void) => () => void;
        onAC: (callback: () => void) => () => void;
    };

    // Window control (Sleep/Wake) — hide to tray / show window
    window?: {
        show: () => Promise<void>;
        hide: () => Promise<void>;
    };

    // Menu events
    menu?: {
        onSaveTriggered: (callback: () => void) => () => void;
    };

    // Video (Local Asset Management)
    video: {
        saveAsset: (url: string, filename: string) => Promise<string>;
        openFolder: (filePath?: string) => Promise<void>;
        render: (config: { compositionId: string; outputLocation: string; inputProps?: Record<string, unknown> }) => Promise<string>;
        getDefaultPath: (filename?: string) => Promise<string>;
    };

    // Credentials
    credentials: {
        save: (id: string, creds: unknown) => Promise<void>;
        get: (id: string) => Promise<unknown | null>;
        delete: (id: string) => Promise<boolean>;
    };

    // Distribution (Proprietary Ingestion IP)
    distribution: {
        stageRelease: (releaseId: string, files: { type: 'content' | 'path' | 'metadata'; data: string; name: string }[]) => Promise<DistributionTypes.PackageResponse>;
        runForensics: (filePath: string) => Promise<DistributionTypes.IPCResponse<DistributionTypes.ForensicsReport>>;
        packageITMSP: (releaseId: string) => Promise<DistributionTypes.PackageResponse>;
        calculateTax: (data: DistributionTypes.TaxCalculationData) => Promise<DistributionTypes.IPCResponse<DistributionTypes.TaxReport>>;
        certifyTax: (userId: string, data: DistributionTypes.TaxCertificationData) => Promise<DistributionTypes.IPCResponse<DistributionTypes.TaxReport>>;
        executeWaterfall: (data: DistributionTypes.WaterfallData) => Promise<DistributionTypes.IPCResponse<DistributionTypes.WaterfallReport>>;
        validateMetadata: (metadata: DistributionTypes.IngestionMetadata) => Promise<DistributionTypes.IPCResponse<DistributionTypes.ValidationReport>>;
        generateISRC: (options?: DistributionTypes.ISRCGenerationOptions) => Promise<DistributionTypes.ISRCResponse>;
        generateUPC: (options?: DistributionTypes.UPCGenerationOptions) => Promise<DistributionTypes.UPCResponse>;
        registerRelease: (metadata: unknown, releaseId?: string) => Promise<DistributionTypes.IPCResponse<unknown>>;
        generateDDEX: (metadata: DistributionTypes.IngestionMetadata) => Promise<DistributionTypes.IngestionResponse>;
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
        onSubmitProgress: (callback: (event: { step?: string; status?: string; progress?: number; detail?: string; log?: string }) => void) => () => void;
        onTransmitProgress: (callback: (event: { step?: string; status?: string; progress?: number; detail?: string; log?: string; percentage?: number }) => void) => () => void;
    };
    updater?: {
        check: () => Promise<{ available: boolean; version?: string; error?: string }>;
        install: () => Promise<void>;
        setChannel: (channel: 'stable' | 'beta') => Promise<void>;
        setSource: (source: 'github' | 'firebase') => Promise<void>;
        getConfig: () => Promise<{
            channel: 'stable' | 'beta';
            source: 'github' | 'firebase';
            isAvailable: boolean;
            releaseName?: string;
            releaseNumber?: number;
            technicalVersion?: string;
        }>;
        onChecking: (callback: () => void) => () => void;
        onAvailable: (callback: (info: { version: string }) => void) => () => void;
        onNotAvailable: (callback: () => void) => () => void;
        onProgress: (callback: (data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => () => void;
        onDownloaded: (callback: (info: { version: string }) => void) => () => void;
        onError: (callback: (err: { message: string }) => void) => () => void;
    };

    // Security IPC bridge (Electron-only)
    security?: {
        rotateCredentials: (options: { serviceName: string }) => Promise<{ success: boolean; error?: string }>;
        scanVulnerabilities: (options: { scope: string }) => Promise<{ success: boolean; scan?: { scope: string; vulnerabilities: unknown[]; score: number }; error?: string }>;
        applyWatermark?: (options: { fileId: string; text: string; invisible?: boolean }) => Promise<{ success: boolean; watermarkedFileId?: string; error?: string }>;
    };

    // Brand analysis IPC bridge (Electron-only)
    brand?: {
        analyzeConsistency: (assetPath: string, brandKit: Record<string, unknown>) => Promise<{ success: boolean; report?: unknown; issues?: unknown[]; error?: string }>;
    };

    // Built-in Task Scheduler (Neural Sync + background jobs)
    scheduler?: {
        register: (request: SchedulerTypes.CreateTaskRequest) => Promise<{ success: boolean; task?: SchedulerTypes.ScheduledTask; error?: string }>;
        cancel: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        setEnabled: (taskId: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
        status: () => Promise<{ success: boolean; status?: SchedulerTypes.SchedulerStatus; error?: string }>;
        get: (taskId: string) => Promise<{ success: boolean; task?: SchedulerTypes.ScheduledTask; error?: string }>;
        onTick: (callback: (event: SchedulerTypes.SchedulerTickEvent) => void) => () => void;
        onNeuralSync: (callback: (payload: unknown) => void) => () => void;
    };
    // Mobile Remote — P2P Local WebSocket IPC bridge (Electron-only)
    remote?: {
        onMessageFromMobile: (cb: (payload: RemoteMobilePayload) => void) => (() => void);
        broadcast: (msg: Record<string, unknown>) => void;
    };
    // DAW Integration (Ableton/Logic/FL Studio Link)
    daw?: {
        start: () => Promise<boolean>;
        stop: () => Promise<boolean>;
        getState: () => Promise<DAWState | null>;
        onStateChanged: (callback: (state: DAWState) => void) => () => void;
    };
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
        MSStream?: unknown; // Legacy iOS detection

        // Vendor-prefixed Web APIs
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
    }
}

export { };
