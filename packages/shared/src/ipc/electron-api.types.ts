/**
 * @indii/shared — ElectronAPI IPC Type Contracts
 *
 * These interfaces define the complete IPC surface area exposed by the
 * Electron Main process via contextBridge.exposeInMainWorld('electronAPI', {...}).
 *
 * Consumed by:
 *   - packages/main/src/preload.ts (implementation)
 *   - packages/renderer/src/ (window.electronAPI usage in 57+ files)
 */

// ── Shared Data Types ─────────────────────────────────────────────────────

export interface Credentials {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    [key: string]: string | undefined;
}

export interface SFTPConfig {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
}

// ── Namespace Interfaces ──────────────────────────────────────────────────

export interface ElectronAuthAPI {
    logout: () => Promise<void>;
}

export interface ElectronCredentialsAPI {
    save: (id: string, creds: Credentials) => Promise<void>;
    get: (id: string) => Promise<Credentials | null>;
    delete: (id: string) => Promise<void>;
}

export interface ElectronAudioAPI {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    analyze: (filePath: string) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getMetadata: (hash: string) => Promise<any>;
    transcode: (options: unknown) => Promise<{ success: boolean; error?: string }>;
    master: (options: unknown) => Promise<{ success: boolean; path?: string; error?: string }>;
}

export interface ElectronNetworkAPI {
    fetchUrl: (url: string) => Promise<unknown>;
}

export interface ElectronSFTPAPI {
    connect: (config: SFTPConfig) => Promise<{ success: boolean; error?: string }>;
    connectDistributor: (distributorId: string) => Promise<{ success: boolean; error?: string }>;
    uploadDirectory: (localPath: string, remotePath: string) => Promise<{ success: boolean; error?: string; files?: string[] }>;
    disconnect: () => Promise<unknown>;
    isConnected: () => Promise<boolean>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listDirectory: (remotePath: string) => Promise<{ success: boolean; files?: any[]; error?: string }>;
    readFile: (remotePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
}

export interface ElectronBrandAPI {
    analyzeConsistency: (assetPath: string, brandKit: unknown) => Promise<unknown>;
}

export interface ElectronPublicistAPI {
    generatePdf: (data: unknown) => Promise<unknown>;
}

export interface ElectronMarketingAPI {
    analyzeTrends: (data: unknown) => Promise<unknown>;
}

export interface ElectronSecurityAPI {
    rotateCredentials: (data: { serviceName: string }) => Promise<{ success: boolean; error?: string }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scanVulnerabilities: (data: { scope: string }) => Promise<{ success: boolean; scan?: { scope: string; vulnerabilities: any[]; score: number }; error?: string }>;
}

export interface ElectronAgentAPI {
    navigateAndExtract: (url: string) => Promise<{ success: boolean; title?: string; url?: string; text?: string; screenshotBase64?: string; error?: string }>;
    performAction: (action: string, selector: string, text?: string) => Promise<{ success: boolean; error?: string }>;
    captureState: () => Promise<{ success: boolean; title?: string; url?: string; text?: string; screenshotBase64?: string; error?: string }>;
    saveHistory: (id: string, data: unknown) => Promise<{ success: boolean; error?: string }>;
    getHistory: (id: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    deleteHistory: (id: string) => Promise<{ success: boolean; error?: string }>;
    listArtifacts: () => Promise<{ success: boolean; data?: { filename: string }[]; error?: string }>;
    readArtifact: (filename: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createArtifact: (filename: string, content: string, options?: { artifactType?: string, requestFeedback?: boolean }) => Promise<{ success: boolean; error?: string; data?: any }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    multiReplaceFileContent: (args: unknown) => Promise<{ success: boolean; error?: string; data?: any }>;
    scanDirectory: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
    updateKnowledge: (filePath: string, action: string, knowledge: unknown) => Promise<{ success: boolean; error?: string }>;
}

export interface ElectronVideoAPI {
    saveAsset: (url: string, filename: string) => Promise<unknown>;
    openFolder: (filePath?: string) => Promise<unknown>;
}

export interface ElectronDistributionAPI {
    stageRelease: (releaseId: string, files: { type: string; data: string; name: string }[]) => Promise<{ success: boolean; error?: string; itmspPath?: string; packagePath?: string; files?: string[]; message?: string }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    runForensics: (filePath: string) => Promise<{ success: boolean; error?: string; report?: any }>;
    packageITMSP: (releaseId: string) => Promise<{ success: boolean; error?: string; packagePath?: string; itmspPath?: string; files?: string[]; message?: string }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    calculateTax: (data: unknown) => Promise<{ success: boolean; error?: string; report?: any }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    certifyTax: (userId: string, data: unknown) => Promise<{ success: boolean; error?: string; report?: any }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executeWaterfall: (data: unknown) => Promise<{ success: boolean; error?: string; report?: any }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validateMetadata: (metadata: unknown) => Promise<{ success: boolean; error?: string; report?: any }>;
    generateISRC: (options?: unknown) => Promise<{ success: boolean; error?: string; isrc?: string }>;
    generateUPC: (options?: unknown) => Promise<{ success: boolean; error?: string; upc?: string }>;
    registerRelease: (metadata: unknown, releaseId?: string) => Promise<{ success: boolean; error?: string }>;
    generateDDEX: (metadata: unknown) => Promise<{ success: boolean; error?: string; xml?: string }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generateIngestionNotification: (metadata: any) => Promise<{ success: boolean; error?: string; xml?: string }>;
    generateContentIdCSV: (data: unknown) => Promise<{ success: boolean; error?: string; csvData?: string; csv?: string }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generateBWARM: (data: unknown) => Promise<{ success: boolean; error?: string; csv?: string; report?: any }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    checkMerlinStatus: (data: unknown) => Promise<{ success: boolean; error?: string; report?: any }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transmit: (config: unknown) => Promise<{ success: boolean; error?: string; report?: any }>;
    submitRelease: (releaseData: unknown) => Promise<{ success: boolean; error?: string; report?: { sftp_skipped?: boolean } }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSubmitProgress: (callback: (data: any) => void) => () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onTransmitProgress: (callback: (data: any) => void) => () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    packageSpotify: (releaseId: string, stagingPath: string, outputPath?: string) => Promise<{ success: boolean; error?: string; report?: any }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deliverApple: (command: string, bundlePath: string) => Promise<{ success: boolean; error?: string; report?: any }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validateXSD: (xmlContent: string) => Promise<{ success: boolean; error?: string; report?: any }>;
}

export interface ElectronRemoteAPI {
    onMessageFromMobile: (callback: (data: unknown) => void) => () => void;
    onStatusUpdated: (callback: (status: unknown) => void) => () => void;
}

export interface ElectronUpdaterAPI {
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
    onAvailable: (callback: (info: unknown) => void) => () => void;
    onNotAvailable: (callback: () => void) => () => void;
    onProgress: (callback: (data: unknown) => void) => () => void;
    onDownloaded: (callback: (info: unknown) => void) => () => void;
    onError: (callback: (err: unknown) => void) => () => void;
}

export interface ElectronSchedulerAPI {
    register: (request: unknown) => Promise<unknown>;
    cancel: (taskId: string) => Promise<unknown>;
    setEnabled: (taskId: string, enabled: boolean) => Promise<unknown>;
    status: () => Promise<unknown>;
    get: (taskId: string) => Promise<unknown>;
    onTick: (callback: (event: unknown) => void) => () => void;
    onNeuralSync: (callback: (payload: unknown) => void) => () => void;
}

export interface ElectronSidecarAPI {
    restart: () => Promise<unknown>;
    onStatusUpdate: (callback: (status: string) => void) => () => void;
}

export interface ElectronPowerAPI {
    getState: () => Promise<unknown>;
    onBattery: (callback: () => void) => () => void;
    onAC: (callback: () => void) => () => void;
}

// ── Root ElectronAPI Interface ─────────────────────────────────────────────

export interface ElectronAPI {
    // General
    getPlatform: () => Promise<string>;
    getAppVersion: () => Promise<string>;
    setPrivacyMode: (enabled: boolean) => Promise<void>;
    selectFile: (options?: unknown) => Promise<unknown>;
    selectDirectory: (options?: unknown) => Promise<unknown>;
    getDirectoryContents: (dirPath: string, options?: { recursive?: boolean; extensions?: string[] }) => Promise<unknown>;
    getGpuInfo: () => Promise<unknown>;
    showNotification: (title: string, body: string) => void;

    // Namespaced APIs
    auth: ElectronAuthAPI;
    credentials: ElectronCredentialsAPI;
    audio: ElectronAudioAPI;
    network: ElectronNetworkAPI;
    sftp: ElectronSFTPAPI;
    brand: ElectronBrandAPI;
    publicist: ElectronPublicistAPI;
    marketing: ElectronMarketingAPI;
    security: ElectronSecurityAPI;
    agent: ElectronAgentAPI;
    video: ElectronVideoAPI;
    distribution: ElectronDistributionAPI;
    remote: ElectronRemoteAPI;
    updater: ElectronUpdaterAPI;
    scheduler: ElectronSchedulerAPI;
    sidecar: ElectronSidecarAPI;
    power: ElectronPowerAPI;

    // Top-level test
    testAgent: (query?: string) => Promise<unknown>;
}

// ── Window Augmentation ───────────────────────────────────────────────────

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
