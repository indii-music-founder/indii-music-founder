export interface DAWState {
    bpm: number;
    isPlaying: boolean;
    currentTime: number;
    trackNames: string[];
}

class DawIntegrationService {
    public isAvailable(): boolean {
        return typeof window !== 'undefined' && 'electronAPI' in window && 'daw' in (window as any).electronAPI;
    }

    public async start(): Promise<boolean> {
        if (!this.isAvailable()) return false;
        return (window as any).electronAPI.daw.start();
    }

    public async stop(): Promise<boolean> {
        if (!this.isAvailable()) return false;
        return (window as any).electronAPI.daw.stop();
    }

    public async getState(): Promise<DAWState | null> {
        if (!this.isAvailable()) return null;
        return (window as any).electronAPI.daw.getState();
    }

    public onStateChanged(callback: (state: DAWState) => void): () => void {
        if (!this.isAvailable()) return () => {};
        return (window as any).electronAPI.daw.onStateChanged(callback);
    }
}

export const dawIntegrationService = new DawIntegrationService();
