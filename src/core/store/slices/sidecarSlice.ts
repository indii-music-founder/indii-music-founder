import { StateCreator } from 'zustand';

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
        // @ts-ignore - window.electronAPI is injected via preload in the Electron process
        if (window.electronAPI?.sidecar?.restart) {
            window.electronAPI.sidecar.restart();

        } else {
            console.warn('[SidecarSlice] Sidecar restart IPC not available');
        }
    },
});
