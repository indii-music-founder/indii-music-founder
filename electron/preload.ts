import { contextBridge, ipcRenderer } from 'electron';

interface AuthTokenData {
    idToken: string;
    accessToken?: string | null;
}

contextBridge.exposeInMainWorld('electronAPI', {
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
    onAuthToken: (callback: (tokenData: AuthTokenData) => void) =>
        ipcRenderer.on('auth-token', (_: unknown, tokenData: AuthTokenData) => callback(tokenData)),
});
