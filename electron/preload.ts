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
    selectFile: (options?: any) => ipcRenderer.invoke('system:select-file', options),
    selectDirectory: (options?: any) => ipcRenderer.invoke('system:select-directory', options),
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
        uploadDirectory: (localPath: string, remotePath: string) => ipcRenderer.invoke('sftp:upload-directory', localPath, remotePath),
        disconnect: () => ipcRenderer.invoke('sftp:disconnect'),
        isConnected: () => ipcRenderer.invoke('sftp:is-connected'),
    },
    // Brand Capabilities
    brand: {
        analyzeConsistency: (assetPath: string, brandKit: any) => ipcRenderer.invoke('brand:analyze-consistency', assetPath, brandKit),
    },
    publicist: {
        generatePdf: (data: any) => ipcRenderer.invoke('publicist:generate-pdf', data),
    },
    marketing: {
        analyzeTrends: (data: any) => ipcRenderer.invoke('marketing:analyze-trends', data),
    },
    security: {
        rotateCredentials: (data: any) => ipcRenderer.invoke('security:rotate-credentials', data),
        scanVulnerabilities: (data: any) => ipcRenderer.invoke('security:scan-vulnerabilities', data),
    },
    // Agent Capabilities
    agent: {
        navigateAndExtract: (url: string) => ipcRenderer.invoke('agent:navigate-and-extract', url),
        performAction: (action: string, selector: string, text?: string) => ipcRenderer.invoke('agent:perform-action', action, selector, text),
        captureState: () => ipcRenderer.invoke('agent:capture-state'),
        saveHistory: (id: string, data: any) => ipcRenderer.invoke('agent:save-history', id, data),
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
        calculateTax: (data: any) => ipcRenderer.invoke('distribution:calculate-tax', data),
        certifyTax: (userId: string, data: any) => ipcRenderer.invoke('distribution:certify-tax', userId, data),
        executeWaterfall: (data: any) => ipcRenderer.invoke('distribution:execute-waterfall', data),
        validateMetadata: (metadata: any) => ipcRenderer.invoke('distribution:validate-metadata', metadata),
        generateISRC: (options?: any) => ipcRenderer.invoke('distribution:generate-isrc', options),
        generateUPC: (options?: any) => ipcRenderer.invoke('distribution:generate-upc', options),
        registerRelease: (metadata: any, releaseId?: string) => ipcRenderer.invoke('distribution:register-release', metadata, releaseId),
        generateDDEX: (metadata: any) => ipcRenderer.invoke('distribution:generate-ddex', metadata),
        generateContentIdCSV: (data: any) => ipcRenderer.invoke('distribution:generate-content-id-csv', data),
        generateBWARM: (data: any) => ipcRenderer.invoke('distribution:generate-bwarm', data),
        checkMerlinStatus: (data: any) => ipcRenderer.invoke('distribution:check-merlin-status', data),
        transmit: (config: any) => ipcRenderer.invoke('distribution:transmit', config),
        packageSpotify: (releaseId: string, stagingPath: string, outputPath?: string) => ipcRenderer.invoke('distribution:package-spotify', releaseId, stagingPath, outputPath),
        deliverApple: (command: string, bundlePath: string) => ipcRenderer.invoke('distribution:deliver-apple', command, bundlePath),
        validateXSD: (xmlContent: string) => ipcRenderer.invoke('distribution:validate-xsd', xmlContent),
    },

    // Auto-Updater
    updater: {
        check: () => ipcRenderer.invoke('updater:check'),
        install: () => ipcRenderer.invoke('updater:install'),
    },

    testAgent: (query?: string) => ipcRenderer.invoke('test:browser-agent', query),
    on: (channel: string, callback: (...args: any[]) => void) => {
        const subscription = (_event: any, ...args: any[]) => callback(...args);
        ipcRenderer.on(channel, subscription);
        return () => ipcRenderer.removeListener(channel, subscription);
    }
});
