import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';

// Item 404: Added 'restarting' state for auto-restart overlay
export type SidecarStatus = 'online' | 'offline' | 'checking' | 'restarting';

export interface SidecarSlice {
    sidecarStatus: SidecarStatus;
    setSidecarStatus: (status: SidecarStatus) => void;
    triggerSidecarRestart: () => void;
}

export const createSidecarSlice: StateCreator<SidecarSlice> = (set) => ({
    sidecarStatus: 'checking',
    setSidecarStatus: (status) => set({ sidecarStatus: status }),
    triggerSidecarRestart: () => {
        // Sidecar restart IPC handler was removed from the main process.
        // The sidecar now auto-restarts via docker-compose health checks.
        logger.warn('[SidecarSlice] Manual sidecar restart is no longer supported. The sidecar auto-recovers via health checks.');
        set({ sidecarStatus: 'checking' });
    },
});
