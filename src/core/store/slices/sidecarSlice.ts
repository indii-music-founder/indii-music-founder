import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';

export type SidecarStatus = 'online' | 'offline' | 'checking';

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window.electronAPI as any)?.sidecar?.restart) {
            (window.electronAPI as any).sidecar.restart();

        } else {
            logger.warn('[SidecarSlice] Sidecar restart IPC not available');
        }
    },
});
