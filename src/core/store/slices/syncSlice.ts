import { StateCreator } from 'zustand';

export interface SyncSlice {
    isOffline: boolean;
    pendingCount: number;
    isSyncing: boolean;
    lastSyncError: string | null;
    setIsOffline: (offline: boolean) => void;
    setPendingCount: (count: number) => void;
    setIsSyncing: (syncing: boolean) => void;
    setLastSyncError: (error: string | null) => void;
}

export const createSyncSlice: StateCreator<SyncSlice> = (set) => ({
    isOffline: !navigator.onLine,
    pendingCount: 0,
    isSyncing: false,
    lastSyncError: null,
    setIsOffline: (offline) => set({ isOffline: offline }),
    setPendingCount: (count) => set({ pendingCount: count }),
    setIsSyncing: (syncing) => set({ isSyncing: syncing }),
    setLastSyncError: (error) => set({ lastSyncError: error }),
});
