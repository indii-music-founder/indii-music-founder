import { StateCreator } from 'zustand';

export interface SyncSlice {
    isOffline: boolean;
    /**
     * Desktop sleep state (Electron). When true, the window is hidden to the
     * tray but the process keeps listening to the relay queue. Written by
     * useAutoSleep; read by useRemoteCommandListener's heartbeat loop so the
     * phone can show "Sleeping" vs "Active". Always false in the web/PWA build.
     */
    isSleeping: boolean;
    setIsOffline: (offline: boolean) => void;
    setIsSleeping: (sleeping: boolean) => void;
}

export const createSyncSlice: StateCreator<SyncSlice> = (set) => ({
    isOffline: !navigator.onLine,
    isSleeping: false,
    setIsOffline: (offline) => set({ isOffline: offline }),
    setIsSleeping: (sleeping) => set({ isSleeping: sleeping }),
});
