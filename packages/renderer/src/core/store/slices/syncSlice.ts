import { StateCreator } from 'zustand';

export interface SyncSlice {
    isOffline: boolean;
    pendingCount: number;
    isSyncing: boolean;
    lastSyncError: string | null;
    /**
     * Desktop sleep state (Electron). When true, the window is hidden to the
     * tray but the process keeps listening to the relay queue. Written by
     * useAutoSleep; read by useRemoteCommandListener's heartbeat loop so the
     * phone can show "Sleeping" vs "Active". Always false in the web/PWA build.
     */
    isSleeping: boolean;
    setIsOffline: (offline: boolean) => void;
    setPendingCount: (count: number) => void;
    setIsSyncing: (syncing: boolean) => void;
    setLastSyncError: (error: string | null) => void;
    setIsSleeping: (sleeping: boolean) => void;
}

export const createSyncSlice: StateCreator<SyncSlice> = (set) => ({
    isOffline: !navigator.onLine,
    pendingCount: 0,
    isSyncing: false,
    lastSyncError: null,
    isSleeping: false,
    setIsOffline: (offline) => set({ isOffline: offline }),
    setPendingCount: (count) => set({ pendingCount: count }),
    setIsSyncing: (syncing) => set({ isSyncing: syncing }),
    setLastSyncError: (error) => set({ lastSyncError: error }),
    setIsSleeping: (sleeping) => set({ isSleeping: sleeping }),
});
