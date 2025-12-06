import { ipcRenderer } from 'electron';

// @ts-ignore
window.electronAPI = {
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
    onAuthToken: (callback: (token: string) => void) => ipcRenderer.on('auth-token', (_, token) => callback(token)),
};
