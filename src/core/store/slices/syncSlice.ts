import { StateCreator } from 'zustand';

export interface SyncSlice {
    pendingCount: number;
    isSyncing: boolean;
    lastSyncError: string | null;
    setPendingCount: (count: number) => void;
    setIsSyncing: (syncing: boolean) => void;
    setLastSyncError: (error: string | null) => void;
}

export const createSyncSlice: StateCreator<SyncSlice> = (set) => ({
    pendingCount: 0,
    isSyncing: false,
    lastSyncError: null,
    setPendingCount: (count) => set({ pendingCount: count }),
    setIsSyncing: (syncing) => set({ isSyncing: syncing }),
    setLastSyncError: (error) => set({ lastSyncError: error }),
});
