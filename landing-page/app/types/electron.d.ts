export interface AuthTokenData {
    idToken: string;
    accessToken?: string | null;
}

export interface ElectronAPI {
    getPlatform: () => Promise<string>;
    getAppVersion: () => Promise<string>;
    openExternal: (url: string) => Promise<void>;
    onAuthToken: (callback: (tokenData: AuthTokenData) => void) => void;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}
