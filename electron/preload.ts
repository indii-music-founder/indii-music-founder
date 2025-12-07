import { contextBridge, ipcRenderer } from 'electron';



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
        onUserUpdate: (callback: (user: any) => void) =>
            ipcRenderer.on('auth:user-update', (_, user) => callback(user))
    },

    // Audio (Native Processing)
    audio: {
        analyze: (filePath: string) => ipcRenderer.invoke('audio:analyze', filePath),
        getMetadata: (hash: string) => ipcRenderer.invoke('audio:lookup-metadata', hash)
    }
});
