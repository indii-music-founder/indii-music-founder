import { ipcRenderer } from 'electron';

// @ts-ignore
window.electronAPI = {
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
};
