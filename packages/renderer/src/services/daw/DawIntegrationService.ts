import type { DAWState } from '@/types/electron';

class DawIntegrationService {
    private isElectron(): boolean {
        return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';
    }

    public isAvailable(): boolean {
        return this.isElectron() && typeof window.electronAPI!.daw !== 'undefined';
    }

    public async start(): Promise<boolean> {
        if (!this.isAvailable()) return false;
        return window.electronAPI!.daw!.start() as Promise<boolean>;
    }

    public async stop(): Promise<boolean> {
        if (!this.isAvailable()) return false;
        return window.electronAPI!.daw!.stop() as Promise<boolean>;
    }

    public async getState(): Promise<DAWState | null> {
        if (!this.isAvailable()) return null;
        return window.electronAPI!.daw!.getState() as Promise<DAWState | null>;
    }

    public onStateChanged(callback: (state: DAWState) => void): () => void {
        if (!this.isAvailable()) return () => {};
        return window.electronAPI!.daw!.onStateChanged(callback as (state: unknown) => void);
    }
}

export const dawIntegrationService = new DawIntegrationService();
