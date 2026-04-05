/**
 * @indiios/shared — ElectronAPI IPC Type Contracts
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
    analyze: (filePath: string) => Promise<unknown>;
    getMetadata: (hash: string) => Promise<unknown>;
    transcode: (options: unknown) => Promise<unknown>;
    master: (options: unknown) => Promise<unknown>;
}

export interface ElectronNetworkAPI {
    fetchUrl: (url: string) => Promise<unknown>;
}

export interface ElectronSFTPAPI {
    connect: (config: SFTPConfig) => Promise<unknown>;
    connectDistributor: (distributorId: string) => Promise<unknown>;
    uploadDirectory: (localPath: string, remotePath: string) => Promise<unknown>;
    disconnect: () => Promise<unknown>;
    isConnected: () => Promise<boolean>;
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
    rotateCredentials: (data: unknown) => Promise<unknown>;
    scanVulnerabilities: (data: unknown) => Promise<unknown>;
}

export interface ElectronAgentAPI {
    navigateAndExtract: (url: string) => Promise<unknown>;
    performAction: (action: string, selector: string, text?: string) => Promise<unknown>;
    captureState: () => Promise<unknown>;
    saveHistory: (id: string, data: unknown) => Promise<unknown>;
    getHistory: (id: string) => Promise<unknown>;
    deleteHistory: (id: string) => Promise<unknown>;
}

export interface ElectronVideoAPI {
    saveAsset: (url: string, filename: string) => Promise<unknown>;
    openFolder: (filePath?: string) => Promise<unknown>;
}

export interface ElectronDistributionAPI {
    stageRelease: (releaseId: string, files: { type: string; data: string; name: string }[]) => Promise<unknown>;
    runForensics: (filePath: string) => Promise<unknown>;
    packageITMSP: (releaseId: string) => Promise<unknown>;
    calculateTax: (data: unknown) => Promise<unknown>;
    certifyTax: (userId: string, data: unknown) => Promise<unknown>;
    executeWaterfall: (data: unknown) => Promise<unknown>;
    validateMetadata: (metadata: unknown) => Promise<unknown>;
    generateISRC: (options?: unknown) => Promise<unknown>;
    generateUPC: (options?: unknown) => Promise<unknown>;
    registerRelease: (metadata: unknown, releaseId?: string) => Promise<unknown>;
    generateDDEX: (metadata: unknown) => Promise<unknown>;
    generateContentIdCSV: (data: unknown) => Promise<unknown>;
    generateBWARM: (data: unknown) => Promise<unknown>;
    checkMerlinStatus: (data: unknown) => Promise<unknown>;
    transmit: (config: unknown) => Promise<unknown>;
    submitRelease: (releaseData: unknown) => Promise<unknown>;
    onSubmitProgress: (callback: (data: unknown) => void) => () => void;
    onTransmitProgress: (callback: (data: unknown) => void) => () => void;
    packageSpotify: (releaseId: string, stagingPath: string, outputPath?: string) => Promise<unknown>;
    deliverApple: (command: string, bundlePath: string) => Promise<unknown>;
    validateXSD: (xmlContent: string) => Promise<unknown>;
}

export interface ElectronRemoteAPI {
    onMessageFromMobile: (callback: (data: unknown) => void) => () => void;
    onStatusUpdated: (callback: (status: unknown) => void) => () => void;
}

export interface ElectronUpdaterAPI {
    check: () => Promise<unknown>;
    install: () => Promise<unknown>;
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
