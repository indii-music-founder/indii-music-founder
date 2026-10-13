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
import type { IndiiVideoProject } from '../types/videoProject';
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
export interface ElectronAuthTokenData {
    idToken: string;
    accessToken?: string | null;
    source?: string | null;
}
export interface ElectronAuthAPI {
    logout: () => Promise<void>;
    onUserUpdate: (callback: (user: ElectronAuthTokenData | null) => void) => () => void;
    onError: (callback: (data: {
        message: string;
    }) => void) => () => void;
}
export interface ElectronCredentialsAPI {
    save: (id: string, creds: Credentials) => Promise<void>;
    get: (id: string) => Promise<Credentials | null>;
    delete: (id: string) => Promise<void>;
    list: () => Promise<string[]>;
}
export interface ElectronAudioAPI {
    analyze: (filePath: string) => Promise<any>;
    getMetadata: (hash: string) => Promise<any>;
    transcode: (options: unknown) => Promise<{
        success: boolean;
        error?: string;
    }>;
    master: (options: unknown) => Promise<{
        success: boolean;
        path?: string;
        error?: string;
    }>;
}
export interface ElectronNetworkAPI {
    fetchUrl: (url: string) => Promise<unknown>;
}
export interface ElectronSFTPAPI {
    connect: (config: SFTPConfig) => Promise<{
        success: boolean;
        error?: string;
    }>;
    connectDistributor: (distributorId: string) => Promise<{
        success: boolean;
        error?: string;
    }>;
    uploadDirectory: (localPath: string, remotePath: string) => Promise<{
        success: boolean;
        error?: string;
        files?: string[];
    }>;
    disconnect: () => Promise<unknown>;
    isConnected: () => Promise<boolean>;
    listDirectory: (remotePath: string) => Promise<{
        success: boolean;
        files?: any[];
        error?: string;
    }>;
    readFile: (remotePath: string) => Promise<{
        success: boolean;
        content?: string;
        error?: string;
    }>;
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
    rotateCredentials: (data: {
        serviceName: string;
    }) => Promise<{
        success: boolean;
        error?: string;
    }>;
    scanVulnerabilities: (data: {
        scope: string;
    }) => Promise<{
        success: boolean;
        scan?: {
            scope: string;
            vulnerabilities: any[];
            score: number;
        };
        error?: string;
    }>;
}
export interface ElectronAgentAPI {
    extractWebPage: (url: string) => Promise<{
        success: boolean;
        data?: {
            finalUrl: string;
            title: string;
            text: string;
            fetchedAt: string;
        };
        error?: string;
    }>;
    saveHistory: (id: string, data: unknown) => Promise<{
        success: boolean;
        error?: string;
    }>;
    getHistory: (id: string) => Promise<{
        success: boolean;
        data?: unknown;
        error?: string;
    }>;
    deleteHistory: (id: string) => Promise<{
        success: boolean;
        error?: string;
    }>;
    listArtifacts: () => Promise<{
        success: boolean;
        data?: {
            filename: string;
        }[];
        error?: string;
    }>;
    readArtifact: (filename: string) => Promise<{
        success: boolean;
        data?: string;
        error?: string;
    }>;
    createArtifact: (filename: string, content: string, options?: {
        artifactType?: string;
        requestFeedback?: boolean;
    }) => Promise<{
        success: boolean;
        error?: string;
        data?: any;
    }>;
    multiReplaceFileContent: (args: unknown) => Promise<{
        success: boolean;
        error?: string;
        data?: any;
    }>;
    scanDirectory: () => Promise<{
        success: boolean;
        data?: unknown;
        error?: string;
    }>;
    updateKnowledge: (filePath: string, action: string, knowledge: unknown) => Promise<{
        success: boolean;
        error?: string;
    }>;
}
export interface ComputerPermissionStatusData {
    platform: string;
    supported: boolean;
    screenRecording: string;
    accessibility: string;
    guidance: string[];
}
export interface ComputerScreenshotData {
    base64: string;
    width: number;
    height: number;
    displayId: number;
}
export interface ElectronComputerAPI {
    checkPermissions: () => Promise<{
        success: boolean;
        data?: ComputerPermissionStatusData;
        error?: string;
    }>;
    authorizeApproval: (args: {
        idToken: string;
        approvalId: string;
        rendererSessionId: string;
    }) => Promise<{
        success: boolean;
        data?: {
            token: string;
            expiresAt: number;
        };
        error?: string;
    }>;
    beginDrive: (goal: string, maxSteps: number, authorization: ComputerActionAuthorization) => Promise<{
        success: boolean;
        data?: {
            sessionToken: string;
            expiresAt: number;
        };
        error?: string;
    }>;
    endDrive: (sessionToken: string) => Promise<{
        success: boolean;
        error?: string;
    }>;
    screenshot: (options: {
        displayId?: number;
        authorization?: ComputerActionAuthorization;
        driveSessionToken?: string;
    }) => Promise<{
        success: boolean;
        data?: ComputerScreenshotData;
        error?: string;
    }>;
    listApps: () => Promise<{
        success: boolean;
        data?: {
            apps: string[];
        };
        error?: string;
    }>;
    openApp: (app: string, authorization?: ComputerActionAuthorization) => Promise<{
        success: boolean;
        data?: {
            app: string;
        };
        error?: string;
    }>;
    click: (x: number, y: number, button?: 'left' | 'right' | 'double', authorization?: ComputerActionAuthorization, driveSessionToken?: string) => Promise<{
        success: boolean;
        data?: {
            x: number;
            y: number;
            button: string;
        };
        error?: string;
    }>;
    type: (text: string) => Promise<{
        success: boolean;
        data?: {
            length: number;
        };
        error?: string;
    }>;
    key: (combo: string, authorization?: ComputerActionAuthorization, driveSessionToken?: string) => Promise<{
        success: boolean;
        data?: {
            combo: string;
        };
        error?: string;
    }>;
    scroll: (dx: number, dy: number, authorization?: ComputerActionAuthorization, driveSessionToken?: string) => Promise<{
        success: boolean;
        data?: {
            dx: number;
            dy: number;
        };
        error?: string;
    }>;
    abort: () => Promise<{
        success: boolean;
        data?: {
            aborted: boolean;
        };
        error?: string;
    }>;
    getAbortState: () => Promise<{
        success: boolean;
        data?: {
            aborted: boolean;
        };
        error?: string;
    }>;
    allowlistGet: () => Promise<{
        success: boolean;
        data?: {
            apps: string[];
        };
        error?: string;
    }>;
}
export interface ComputerActionAuthorization {
    token: string;
    rendererSessionId: string;
    agentId: string;
}
export interface ElectronVideoProbeResult {
    streams: Array<{
        codec_type?: 'video' | 'audio' | string;
        codec_name?: string;
        width?: number;
        height?: number;
        pix_fmt?: string;
        color_space?: string;
        avg_frame_rate?: string;
        r_frame_rate?: string;
        sample_rate?: string | number;
        channels?: number;
        channel_layout?: string;
        duration?: string | number;
    }>;
    frames?: Array<{
        key_frame?: number;
        pkt_pts?: string | number;
        pkt_pts_time?: string | number;
    }>;
}
export interface ElectronVideoAPI {
    saveAsset: (url: string, filename: string) => Promise<unknown>;
    openFolder: (filePath?: string) => Promise<unknown>;
    render: (config: unknown) => Promise<string>;
    getDefaultPath: (filename?: string) => Promise<string>;
    compilePreview: (project: IndiiVideoProject) => Promise<string>;
    /** Reads a locally rendered artifact as a data URL for cloud upload (relay path). */
    readArtifact?: (filePath: string) => Promise<string>;
    /** Native pre-flight media probe inspecting streams, CFR/VFR, audio rate, and keyframe PTS. */
    probeMedia?: (filePath: string) => Promise<ElectronVideoProbeResult>;
}
export interface ElectronDawAPI {
    start: () => Promise<unknown>;
    stop: () => Promise<unknown>;
    getState: () => Promise<unknown>;
    onStateChanged: (callback: (state: unknown) => void) => () => void;
}
/** A new audio file detected in a watched DAW bounce folder. */
export interface SonicBridgeBounce {
    /** Absolute path on the user's machine. */
    path: string;
    /** Filename only, e.g. "final_mix_v3.wav". */
    name: string;
    /** Detection time (epoch ms). */
    timestamp: number;
}
/**
 * Sonic Bridge — watches a DAW bounce folder and pushes new audio to the app.
 * ISSUE-1283: main-process handlers existed but were never exposed via preload.
 */
export interface ElectronSonicBridgeAPI {
    /** Opens a native folder picker, then watches the chosen folder. */
    watchFolder: () => Promise<{
        success: boolean;
        path?: string;
        error?: string;
    }>;
    stopWatching: () => Promise<{
        success: boolean;
    }>;
    /** Subscribe to new-bounce events. Returns an unsubscribe function. */
    onNewBounce: (callback: (bounce: SonicBridgeBounce) => void) => (() => void);
}
export interface ElectronDistributionAPI {
    stageRelease: (releaseId: string, files: {
        type: string;
        data: string;
        name: string;
    }[]) => Promise<{
        success: boolean;
        error?: string;
        itmspPath?: string;
        packagePath?: string;
        files?: string[];
        message?: string;
    }>;
    runForensics: (filePath: string) => Promise<{
        success: boolean;
        error?: string;
        report?: any;
    }>;
    packageITMSP: (releaseId: string) => Promise<{
        success: boolean;
        error?: string;
        packagePath?: string;
        itmspPath?: string;
        files?: string[];
        message?: string;
    }>;
    calculateTax: (data: unknown) => Promise<{
        success: boolean;
        error?: string;
        report?: any;
    }>;
    certifyTax: (userId: string, data: unknown) => Promise<{
        success: boolean;
        error?: string;
        report?: any;
    }>;
    executeWaterfall: (data: unknown) => Promise<{
        success: boolean;
        error?: string;
        report?: any;
    }>;
    validateMetadata: (metadata: unknown) => Promise<{
        success: boolean;
        error?: string;
        report?: any;
    }>;
    generateISRC: (options?: unknown) => Promise<{
        success: boolean;
        error?: string;
        isrc?: string;
    }>;
    generateUPC: (options?: unknown) => Promise<{
        success: boolean;
        error?: string;
        upc?: string;
    }>;
    registerRelease: (metadata: unknown, releaseId?: string) => Promise<{
        success: boolean;
        error?: string;
    }>;
    generateDDEX: (metadata: unknown) => Promise<{
        success: boolean;
        error?: string;
        xml?: string;
    }>;
    generateContentIdCSV: (data: unknown) => Promise<{
        success: boolean;
        error?: string;
        csvData?: string;
        csv?: string;
    }>;
    generateBWARM: (data: unknown) => Promise<{
        success: boolean;
        error?: string;
        csv?: string;
        report?: any;
    }>;
    checkMerlinStatus: (data: unknown) => Promise<{
        success: boolean;
        error?: string;
        report?: any;
    }>;
    transmit: (config: unknown) => Promise<{
        success: boolean;
        error?: string;
        report?: any;
    }>;
    submitRelease: (releaseData: unknown) => Promise<{
        success: boolean;
        error?: string;
        report?: {
            sftp_skipped?: boolean;
        };
    }>;
    onSubmitProgress: (callback: (data: any) => void) => () => void;
    onTransmitProgress: (callback: (data: any) => void) => () => void;
    packageSpotify: (releaseId: string, stagingPath: string, outputPath?: string) => Promise<{
        success: boolean;
        error?: string;
        report?: any;
    }>;
    deliverApple: (command: string, bundlePath: string) => Promise<{
        success: boolean;
        error?: string;
        report?: any;
    }>;
    validateXSD: (xmlContent: string) => Promise<{
        success: boolean;
        error?: string;
        report?: any;
    }>;
}
export interface ElectronRemoteAPI {
    onMessageFromMobile: (callback: (data: unknown) => void) => () => void;
    onStatusUpdated: (callback: (status: unknown) => void) => () => void;
    broadcast: (payload: unknown) => void;
    getMobileRemoteInfo: () => Promise<{
        isRunning: boolean;
        url: string | null;
        clientCount: number;
    }>;
    stop: () => Promise<{
        success: boolean;
    }>;
}
export interface ElectronWeb3API {
    executeTransaction: (data: unknown) => Promise<unknown>;
    getProviderMetadata: () => Promise<unknown>;
    setRpcUrl: (rpcUrl: string | null) => Promise<unknown>;
    getBalance: (address: string) => Promise<{
        success: boolean;
        balance: string;
        unit: string;
        isSimulated: boolean;
    }>;
}
export interface ElectronPinataAPI {
    uploadFile: (file: number[], filename: string) => Promise<{
        success: boolean;
        IpfsHash?: string;
        PinSize?: number;
        Timestamp?: string;
        error?: string;
    }>;
}
export interface ElectronUpdaterAPI {
    check: () => Promise<{
        available: boolean;
        version?: string;
        error?: string;
    }>;
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
    onStatusUpdate: (callback: (status: string) => void) => () => void;
}
export interface ElectronPowerAPI {
    getState: () => Promise<unknown>;
    onBattery: (callback: () => void) => () => void;
    onAC: (callback: () => void) => () => void;
}
export interface ElectronWindowAPI {
    show: () => Promise<void>;
    hide: () => Promise<void>;
}
export interface ApprovedAssetMetadata {
    name: string;
    relativePath: string;
    extension: string;
    sizeBytes: number;
    modifiedAt: number;
}
export interface ElectronTrashAPI {
    move: (req: {
        approvedFolderId: string;
        dirPath: string;
        relativePath: string;
        trashId: string;
    }) => Promise<{
        success: boolean;
        trashId: string;
        relativePath: string;
        name: string;
        sizeBytes: number;
        isDirectory: boolean;
    }>;
    restore: (req: {
        dirPath: string;
        trashId: string;
        relativePath: string;
        targetRelativePath?: string;
    }) => Promise<{
        success: boolean;
        restoredPath?: string;
        conflict?: boolean;
        error?: string;
    }>;
    purge: (req: {
        dirPath: string;
        trashId: string;
    }) => Promise<{
        success: boolean;
        purgedTrashId?: string;
        cancelled?: boolean;
        message?: string;
    }>;
}
export interface ElectronFsAPI {
    listFiles: (dirPath: string) => Promise<{
        name: string;
        path: string;
        extension: string;
        sizeBytes: number;
    }[]>;
    readTextFile: (filePath: string) => Promise<string>;
    readBinaryFile: (filePath: string) => Promise<Uint8Array>;
    mkdir: (dirPath: string) => Promise<void>;
}
export interface ElectronFoundryAPI {
    readFile: (filePath: string) => Promise<{
        success: boolean;
        content?: string;
        sha256?: string;
        sizeBytes?: number;
        error?: string;
    }>;
    getMetadata: (filePath: string) => Promise<{
        success: boolean;
        size?: number;
        modifiedAt?: string;
        error?: string;
    }>;
}
export interface ElectronRawAPI {
    inspect: (filePath: string) => Promise<unknown>;
    convert: (options: unknown) => Promise<unknown>;
    batchConvert: (options: unknown) => Promise<unknown>;
    cancel: (jobId: string) => Promise<unknown>;
    verify: (dngPath: string, sourcePath?: string) => Promise<unknown>;
    onProgress: (callback: (progress: unknown) => void) => () => void;
}
export interface ElectronRightsCopilotAPI {
    launchSession: (req: {
        portalTarget: string;
        manifestId: string;
        targetUrl?: string;
        workTitle?: string;
        artistLegalName?: string;
        isrc?: string;
        depositFilename?: string;
        depositChecksum?: string;
    }) => Promise<{
        success: boolean;
        sessionId?: string;
        portalUrl?: string;
        error?: string;
    }>;
    executeStep?: (req: {
        action: {
            id: string;
            type: string;
            description: string;
            targetSelector?: string;
            targetFieldKey?: string;
            value?: string | number | boolean;
            requiresUserAction: boolean;
        };
    }) => Promise<{
        success: boolean;
        status?: string;
        requiresUserAction?: boolean;
        extractedValue?: string;
        error?: string;
    }>;
    closeSession: (req?: {
        sessionId?: string;
    }) => Promise<{
        success: boolean;
        error?: string;
    }>;
    getSessionStatus: () => Promise<{
        success: boolean;
        data?: {
            isActive: boolean;
            sessionId?: string;
            portalTarget?: string;
            manifestId?: string;
            status?: string;
        };
        error?: string;
    }>;
    onSessionStatusChanged: (callback: (status: unknown) => void) => () => void;
}
export interface ElectronAPI {
    getPlatform: () => Promise<string>;
    getAppVersion: () => Promise<string>;
    setPrivacyMode: (enabled: boolean) => Promise<void>;
    selectFile: (options?: unknown) => Promise<unknown>;
    selectDirectory: (options?: {
        title?: string;
    }) => Promise<string | null>;
    getDirectoryContents: (dirPath: string, options?: {
        recursive?: boolean;
        extensions?: string[];
    }) => Promise<unknown>;
    searchApprovedAssets: (dirPath: string, options?: {
        query?: string;
        extensions?: string[];
        maxResults?: number;
    }) => Promise<ApprovedAssetMetadata[]>;
    getGpuInfo: () => Promise<unknown>;
    showNotification: (title: string, body: string) => void;
    probeMedia?: (filePath: string) => Promise<ElectronVideoProbeResult>;
    fs?: ElectronFsAPI;
    foundry?: ElectronFoundryAPI;
    raw?: ElectronRawAPI;
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
    computer: ElectronComputerAPI;
    video: ElectronVideoAPI;
    daw: ElectronDawAPI;
    distribution: ElectronDistributionAPI;
    remote?: ElectronRemoteAPI;
    trash?: ElectronTrashAPI;
    /**
     * Optional: only present in builds where the Sonic Bridge preload block is
     * exposed. Callers must feature-detect (`window.electronAPI?.sonicBridge`)
     * rather than assume it — the browser build has no Electron bridge at all.
     */
    sonicBridge?: ElectronSonicBridgeAPI;
    web3?: ElectronWeb3API;
    pinata?: ElectronPinataAPI;
    updater: ElectronUpdaterAPI;
    scheduler: ElectronSchedulerAPI;
    sidecar?: ElectronSidecarAPI;
    power: ElectronPowerAPI;
    window: ElectronWindowAPI;
    menu?: {
        onSaveTriggered: (callback: () => void) => () => void;
    };
    upscale?: {
        ensureEngine: () => Promise<{
            enginePath: string;
            version: string;
            fromCache: boolean;
        }>;
        probe: () => Promise<{
            enginePresent: boolean;
            gpuReady: boolean;
            detail: string;
        }>;
        run: (req: {
            requestId: string;
            dataUrl: string;
            scale: 2 | 4;
            model?: string;
            tilePx?: number;
        }) => Promise<{
            outputDataUrl: string;
            durationMs: number;
        }>;
        onProgress: (callback: (progress: {
            requestId: string;
            fraction: number;
        }) => void) => () => void;
    };
    blender?: {
        cancelRender: (requestId: string) => Promise<boolean>;
        getStatus: () => Promise<any>;
        listTemplates: () => Promise<any[]>;
        renderMusicVideo: (req: any) => Promise<{
            success: boolean;
            outputPath: string;
            error?: string;
        }>;
        sendLiveCommand: (action: string, params?: Record<string, unknown>) => Promise<unknown>;
        onProgress: (callback: (progress: any) => void) => () => void;
    };
    rightsCopilot?: ElectronRightsCopilotAPI;
}
declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
//# sourceMappingURL=electron-api.types.d.ts.map