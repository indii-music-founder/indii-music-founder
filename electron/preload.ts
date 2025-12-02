import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});
