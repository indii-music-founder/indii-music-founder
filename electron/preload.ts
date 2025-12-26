import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

console.log('[Preload] Initializing context bridge...');

interface AuthTokenData {
    idToken: string;
    accessToken?: string | null;
}

contextBridge.exposeInMainWorld('electronAPI', {
    // General
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    setPrivacyMode: (enabled: boolean) => ipcRenderer.invoke('privacy:toggle-protection', enabled),

    // Auth (Secure Main Process Flow)
    auth: {
        login: () => ipcRenderer.invoke('auth:login-google'),
        logout: () => ipcRenderer.invoke('auth:logout'),
        onUserUpdate: (callback: (user: AuthTokenData | null) => void) => {
            const handler = (_event: IpcRendererEvent, user: AuthTokenData | null) => callback(user);
            ipcRenderer.on('auth:user-update', handler);
            // Return unsubscribe function to prevent memory leaks
            return () => {
                ipcRenderer.removeListener('auth:user-update', handler);
            };
        }
    },

    // Credentials (Secure Main Process Storage)
    credentials: {
        save: (id: string, creds: any) => ipcRenderer.invoke('credentials:save', id, creds),
        get: (id: string) => ipcRenderer.invoke('credentials:get', id),
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
    testAgent: (query?: string) => ipcRenderer.invoke('test:browser-agent', query),
});
