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
        getMetadata: (hash: string) => ipcRenderer.invoke('audio:lookup-metadata', hash)
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
    // Agent Capabilities
    agent: {
        navigateAndExtract: (url: string) => ipcRenderer.invoke('agent:navigate-and-extract', url),
        performAction: (action: string, selector: string, text?: string) => ipcRenderer.invoke('agent:perform-action', action, selector, text),
        captureState: () => ipcRenderer.invoke('agent:capture-state'),
    },
    testAgent: (query?: string) => ipcRenderer.invoke('test:browser-agent', query),
});
