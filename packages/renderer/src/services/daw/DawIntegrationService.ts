export interface DAWState {
    bpm: number;
    isPlaying: boolean;
    currentTime: number;
    trackNames: string[];
}

class DawIntegrationService {
    public isAvailable(): boolean {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return typeof window !== 'undefined' && 'electronAPI' in window && 'daw' in (window as any).electronAPI;
    }

    public async start(): Promise<boolean> {
        if (!this.isAvailable()) return false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).electronAPI.daw.start();
    }

    public async stop(): Promise<boolean> {
        if (!this.isAvailable()) return false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).electronAPI.daw.stop();
    }

    public async getState(): Promise<DAWState | null> {
        if (!this.isAvailable()) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).electronAPI.daw.getState();
    }

    public onStateChanged(callback: (state: DAWState) => void): () => void {
        if (!this.isAvailable()) return () => {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).electronAPI.daw.onStateChanged(callback);
    }
}

export const dawIntegrationService = new DawIntegrationService();
