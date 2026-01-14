// Lazy-load essentia.js (2.6MB) only when audio analysis is needed
type EssentiaModule = typeof import('essentia.js');

export interface AudioFeatures {
    bpm: number;
    key: string;
    scale: string;
    energy: number;
    duration: number;
    danceability: number;
    loudness: number;
    valence?: number; // Happiness/Sadness
}

export class AudioAnalysisService {
    private essentia: InstanceType<EssentiaModule['Essentia']> | null = null;
    private initPromise: Promise<void> | null = null;

    private async init(): Promise<void> {
        if (this.essentia) return;

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            try {
                console.info("[AudioAnalysis] Initializing Essentia.js WASM engine...");

                const baseUrl = import.meta.env.BASE_URL || '/';
                const wasmUrl = new URL('essentia-wasm.web.wasm', window.location.origin + baseUrl).href;

                console.debug(`[AudioAnalysis] WASM URL: ${wasmUrl}`);

                (window as any).EssentiaWASM = {
                    locateFile: (path: string) => {
                        if (path.endsWith('.wasm')) return wasmUrl;
                        return path;
                    }
                };

                const imported = await import('essentia.js') as any;
                const { Essentia } = imported;
                let { EssentiaWASM } = imported;

                // Handle Vite/Rollup interop for EssentiaWASM import
                if (!EssentiaWASM && imported.default?.EssentiaWASM) {
                    EssentiaWASM = imported.default.EssentiaWASM;
                }

                let moduleInstance;
                if (typeof EssentiaWASM === 'function') {
                    moduleInstance = await (EssentiaWASM as any)({
                        locateFile: (path: string) => {
                            if (path.endsWith('.wasm')) return wasmUrl;
                            return path;
                        }
                    });
                } else {
                    // Check if EssentiaWASM is nested (common in some builds)
                    if ((EssentiaWASM as any).EssentiaWASM) {
                        moduleInstance = (EssentiaWASM as any).EssentiaWASM;
                    } else {
                        moduleInstance = EssentiaWASM;
                    }
                }

                if (!moduleInstance) {
                    throw new Error("Failed to resolve EssentiaWASM instance");
                }

                this.essentia = new Essentia(moduleInstance);
                console.info("[AudioAnalysis] Essentia.js WASM engine ready.");
            } catch (error) {
                console.error("[AudioAnalysis] Failed to initialize Essentia.js:", error);
                this.initPromise = null;
                throw error;
            }
        })();

        return this.initPromise;
    }

    /**
     * Analyzes an audio file/blob to extract high-level features.
     */
    async analyze(file: File | Blob): Promise<AudioFeatures> {
        await this.init(); // Ensure init
        if (!this.essentia) throw new Error("Essentia not initialized");

        const audioContext = new (window.AudioContext || (window as unknown as Window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        return this.analyzeBuffer(audioBuffer);
    }

    /**
     * Analyzes an already decoded AudioBuffer.
     * Useful for analyzing segments/regions without re-decoding.
     */
    async analyzeBuffer(audioBuffer: AudioBuffer): Promise<AudioFeatures> {
        await this.init();
        if (!this.essentia) throw new Error("Essentia not initialized");

        console.info(`[AudioAnalysis] Analyzing buffer: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz`);

        // Convert to Essentia-compatible vector (first channel)
        const channelData = audioBuffer.getChannelData(0);

        // Basic sanity check: is the buffer actually containing data?
        let hasSignal = false;
        for (let i = 0; i < Math.min(channelData.length, 1000); i++) {
            if (Math.abs(channelData[i]) > 0.0001) {
                hasSignal = true;
                break;
            }
        }

        if (!hasSignal) {
            console.warn("[AudioAnalysis] Input buffer appears to be silent (or extremely low volume).");
        }

        const signal = this.essentia.arrayToVector(channelData);

        try {
            // 1. Rhythm (BPM)
            const rhythm = this.essentia.RhythmExtractor2013(signal);
            const bpm = rhythm.bpm;

            // 2. Tonal (Key/Scale)
            const keyData = this.essentia.KeyExtractor(signal);
            const key = keyData.key;
            const scale = keyData.scale;

            // 3. Energy / Loudness
            const rms = this.essentia.RMS(signal);
            const energyValue = rms.rms;

            // 4. Danceability
            const danceabilityValue = this.essentia.Danceability(signal).danceability;

            console.info(`[AudioAnalysis] Success: ${Math.round(bpm)} BPM, ${key} ${scale}, Energy: ${energyValue.toFixed(3)}`);

            return {
                bpm: Math.round(bpm),
                key: key,
                scale: scale,
                // Normalize RMS to 0-1 range
                energy: Math.min(1, Math.max(0, energyValue * 3.5)),
                duration: audioBuffer.duration,
                danceability: danceabilityValue,
                valence: scale === 'major'
                    ? 0.6 + (Math.min(1, energyValue * 3.5) * 0.3)
                    : 0.2 + (Math.min(1, energyValue * 3.5) * 0.2),
                loudness: -1
            };
        } finally {
            // If using the official WASM build, memory management is important.
            // Some versions of essentia.js require explicit deletion of vectors.
            if ((this.essentia as any).deleteVector && signal) {
                (this.essentia as any).deleteVector(signal);
            }
        }
    }
}

export const audioAnalysisService = new AudioAnalysisService();
