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
        set({ sidecarStatus: 'checking' });
        if (window.electronAPI?.sidecar?.restart) {
            window.electronAPI.sidecar.restart();
        } else {
            logger.warn('[SidecarSlice] Sidecar restart IPC not available');
        }
    },
});
