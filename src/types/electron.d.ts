export interface ElectronAPI {
    getPlatform: () => Promise<string>;
    getAppVersion: () => Promise<string>;
    openExternal: (url: string) => Promise<void>;
    onAuthToken: (callback: (token: string) => void) => void;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
