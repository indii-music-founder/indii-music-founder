import { contextBridge, ipcRenderer } from 'electron';

console.log('[Preload] Initializing context bridge...');

// Type definitions for IPC communication
interface Credentials {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    [key: string]: string | undefined;
}

interface SFTPConfig {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
    // General
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    setPrivacyMode: (enabled: boolean) => ipcRenderer.invoke('privacy:toggle-protection', enabled),
    selectFile: (options?: unknown) => ipcRenderer.invoke('system:select-file', options),
    selectDirectory: (options?: unknown) => ipcRenderer.invoke('system:select-directory', options),
    getDirectoryContents: (dirPath: string, options?: { recursive?: boolean, extensions?: string[] }) => ipcRenderer.invoke('system:get-directory-contents', dirPath, options),
    getGpuInfo: () => ipcRenderer.invoke('system:get-gpu-info'),
    showNotification: (title: string, body: string) => ipcRenderer.send('show-notification', { title, body }),

    // Auth (Simplified - login handled via Firebase SDK in renderer)
    auth: {
        // Login is now handled directly via Firebase signInWithPopup in the renderer
        // No need for IPC - it works natively in Electron's Chromium
        logout: () => ipcRenderer.invoke('auth:logout'),
    },

    // Credentials (Secure Main Process Storage)
    credentials: {
        save: (id: string, creds: Credentials) => ipcRenderer.invoke('credentials:save', id, creds),
        get: (id: string): Promise<Credentials | null> => ipcRenderer.invoke('credentials:get', id),
        delete: (id: string) => ipcRenderer.invoke('credentials:delete', id)
    },

    // Audio (Native Processing)
    audio: {
        analyze: (filePath: string) => ipcRenderer.invoke('audio:analyze', filePath),
        getMetadata: (hash: string) => ipcRenderer.invoke('audio:lookup-metadata', hash),
        transcode: (options: unknown) => ipcRenderer.invoke('audio:transcode', options),
        master: (options: unknown) => ipcRenderer.invoke('audio:master', options)
    },

    // Network (Main Process Fetching)
    network: {
        fetchUrl: (url: string) => ipcRenderer.invoke('net:fetch-url', url)
    },

    // SFTP (Distribution)
    sftp: {
        connect: (config: SFTPConfig) => ipcRenderer.invoke('sftp:connect', config),
        connectDistributor: (distributorId: string) => ipcRenderer.invoke('sftp:connect-distributor', distributorId),
        uploadDirectory: (localPath: string, remotePath: string) => ipcRenderer.invoke('sftp:upload-directory', localPath, remotePath),
        disconnect: () => ipcRenderer.invoke('sftp:disconnect'),
        isConnected: () => ipcRenderer.invoke('sftp:is-connected'),
    },
    // Brand Capabilities
    brand: {
        analyzeConsistency: (assetPath: string, brandKit: unknown) => ipcRenderer.invoke('brand:analyze-consistency', assetPath, brandKit),
    },
    publicist: {
        generatePdf: (data: unknown) => ipcRenderer.invoke('publicist:generate-pdf', data),
    },
    marketing: {
        analyzeTrends: (data: unknown) => ipcRenderer.invoke('marketing:analyze-trends', data),
    },
    security: {
        rotateCredentials: (data: unknown) => ipcRenderer.invoke('security:rotate-credentials', data),
        scanVulnerabilities: (data: unknown) => ipcRenderer.invoke('security:scan-vulnerabilities', data),
    },
    // Agent Capabilities
    agent: {
        navigateAndExtract: (url: string) => ipcRenderer.invoke('agent:navigate-and-extract', url),
        performAction: (action: string, selector: string, text?: string) => ipcRenderer.invoke('agent:perform-action', action, selector, text),
        captureState: () => ipcRenderer.invoke('agent:capture-state'),
        saveHistory: (id: string, data: unknown) => ipcRenderer.invoke('agent:save-history', id, data),
        getHistory: (id: string) => ipcRenderer.invoke('agent:get-history', id),
        deleteHistory: (id: string) => ipcRenderer.invoke('agent:delete-history', id),
    },

    // Video (Local Asset Management)
    video: {
        saveAsset: (url: string, filename: string) => ipcRenderer.invoke('video:save-asset', url, filename),
        openFolder: (filePath?: string) => ipcRenderer.invoke('video:open-folder', filePath),
    },



    // Distribution
    distribution: {
        stageRelease: (releaseId: string, files: { type: string, data: string, name: string }[]) => ipcRenderer.invoke('distribution:stage-release', releaseId, files),
        runForensics: (filePath: string) => ipcRenderer.invoke('distribution:run-forensics', filePath),
        packageITMSP: (releaseId: string) => ipcRenderer.invoke('distribution:package-itmsp', releaseId),
        calculateTax: (data: unknown) => ipcRenderer.invoke('distribution:calculate-tax', data),
        certifyTax: (userId: string, data: unknown) => ipcRenderer.invoke('distribution:certify-tax', userId, data),
        executeWaterfall: (data: unknown) => ipcRenderer.invoke('distribution:execute-waterfall', data),
        validateMetadata: (metadata: unknown) => ipcRenderer.invoke('distribution:validate-metadata', metadata),
        generateISRC: (options?: unknown) => ipcRenderer.invoke('distribution:generate-isrc', options),
        generateUPC: (options?: unknown) => ipcRenderer.invoke('distribution:generate-upc', options),
        registerRelease: (metadata: unknown, releaseId?: string) => ipcRenderer.invoke('distribution:register-release', metadata, releaseId),
        generateDDEX: (metadata: unknown) => ipcRenderer.invoke('distribution:generate-ddex', metadata),
        generateContentIdCSV: (data: unknown) => ipcRenderer.invoke('distribution:generate-content-id-csv', data),
        generateBWARM: (data: unknown) => ipcRenderer.invoke('distribution:generate-bwarm', data),
        checkMerlinStatus: (data: unknown) => ipcRenderer.invoke('distribution:check-merlin-status', data),
        transmit: (config: unknown) => ipcRenderer.invoke('distribution:transmit', config),
        submitRelease: (releaseData: unknown) => ipcRenderer.invoke('distribution:submit-release', releaseData),
        onSubmitProgress: (callback: (data: unknown) => void) => {
            const handler = (_event: unknown, data: unknown) => callback(data);
            ipcRenderer.on('distribution:submit-progress', handler);
            return () => ipcRenderer.removeListener('distribution:submit-progress', handler);
        },
        onTransmitProgress: (callback: (data: unknown) => void) => {
            const handler = (_event: unknown, data: unknown) => callback(data);
            ipcRenderer.on('distribution:transmit-progress', handler);
            return () => ipcRenderer.removeListener('distribution:transmit-progress', handler);
        },
        packageSpotify: (releaseId: string, stagingPath: string, outputPath?: string) => ipcRenderer.invoke('distribution:package-spotify', releaseId, stagingPath, outputPath),
        deliverApple: (command: string, bundlePath: string) => ipcRenderer.invoke('distribution:deliver-apple', command, bundlePath),
        validateXSD: (xmlContent: string) => ipcRenderer.invoke('distribution:validate-xsd', xmlContent),
    },

    // IndiiRemote
    remote: {
        onMessageFromMobile: (callback: (data: unknown) => void) => {
            const handler = (_event: unknown, data: unknown) => callback(data);
            ipcRenderer.on('indii-remote:message-from-mobile', handler);
            return () => ipcRenderer.removeListener('indii-remote:message-from-mobile', handler);
        },
        onStatusUpdated: (callback: (status: unknown) => void) => {
            const handler = (_event: unknown, status: unknown) => callback(status);
            ipcRenderer.on('indii-remote:status-updated', handler);
            return () => ipcRenderer.removeListener('indii-remote:status-updated', handler);
        }
    },

    // Auto-Updater
    updater: {
        check: () => ipcRenderer.invoke('updater:check'),
        install: () => ipcRenderer.invoke('updater:install'),
        onChecking: (callback: () => void) => {
            ipcRenderer.on('updater:checking', callback);
            return () => ipcRenderer.removeListener('updater:checking', callback);
        },
        onAvailable: (callback: (info: unknown) => void) => {
            const handle = (_e: unknown, info: unknown) => callback(info);
            ipcRenderer.on('updater:available', handle);
            return () => ipcRenderer.removeListener('updater:available', handle);
        },
        onNotAvailable: (callback: () => void) => {
            ipcRenderer.on('updater:not-available', callback);
            return () => ipcRenderer.removeListener('updater:not-available', callback);
        },
        onProgress: (callback: (data: unknown) => void) => {
            const handle = (_e: unknown, data: unknown) => callback(data);
            ipcRenderer.on('updater:progress', handle);
            return () => ipcRenderer.removeListener('updater:progress', handle);
        },
        onDownloaded: (callback: (info: unknown) => void) => {
            const handle = (_e: unknown, info: unknown) => callback(info);
            ipcRenderer.on('updater:downloaded', handle);
            return () => ipcRenderer.removeListener('updater:downloaded', handle);
        },
        onError: (callback: (err: unknown) => void) => {
            const handle = (_e: unknown, err: unknown) => callback(err);
            ipcRenderer.on('updater:error', handle);
            return () => ipcRenderer.removeListener('updater:error', handle);
        }
    },

    testAgent: (query?: string) => ipcRenderer.invoke('test:browser-agent', query),

    // Built-in Task Scheduler
    scheduler: {
        register: (request: unknown) => ipcRenderer.invoke('scheduler:register', request),
        cancel: (taskId: string) => ipcRenderer.invoke('scheduler:cancel', taskId),
        setEnabled: (taskId: string, enabled: boolean) => ipcRenderer.invoke('scheduler:set-enabled', taskId, enabled),
        status: () => ipcRenderer.invoke('scheduler:status'),
        get: (taskId: string) => ipcRenderer.invoke('scheduler:get', taskId),
        /** Subscribe to scheduler tick events (all tasks). Returns an unsubscribe fn. */
        onTick: (callback: (event: unknown) => void) => {
            const handler = (_e: unknown, event: unknown) => callback(event);
            ipcRenderer.on('scheduler:tick', handler);
            return () => ipcRenderer.removeListener('scheduler:tick', handler);
        },
        /** Subscribe to Neural Sync pulses specifically. Returns an unsubscribe fn. */
        onNeuralSync: (callback: (payload: unknown) => void) => {
            const handler = (_e: unknown, payload: unknown) => callback(payload);
            ipcRenderer.on('scheduler:neural-sync', handler);
            return () => ipcRenderer.removeListener('scheduler:neural-sync', handler);
        },
    },

    // AI Sidecar
    sidecar: {
        restart: () => ipcRenderer.invoke('sidecar:restart'),
        onStatusUpdate: (callback: (status: string) => void) => {
            const handle = (_e: unknown, status: string) => callback(status);
            ipcRenderer.on('sidecar:status-update', handle);
            return () => ipcRenderer.removeListener('sidecar:status-update', handle);
        }
    },

    // Power Monitor
    power: {
        getState: () => ipcRenderer.invoke('power:get-state'),
        onBattery: (callback: () => void) => {
            ipcRenderer.on('power:on-battery', callback);
            return () => ipcRenderer.removeListener('power:on-battery', callback);
        },
        onAC: (callback: () => void) => {
            ipcRenderer.on('power:on-ac', callback);
            return () => ipcRenderer.removeListener('power:on-ac', callback);
        }
    }
});
