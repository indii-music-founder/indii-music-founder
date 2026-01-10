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

        // Prevent concurrent initialization
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            try {
                // Loading Essentia.js audio analysis engine...

                // WASM path configuration: Essentia's UMD module looks for a global 'EssentiaWASM' object to use as the Module config.
                // We provide 'locateFile' to point it to the correct location of the .wasm file.
                // The .wasm file is in 'public/', so it's served at root '/'.
                (window as unknown as { EssentiaWASM: any }).EssentiaWASM = {
                    locateFile: (path: string, prefix: string) => {
                        if (path.endsWith('.wasm')) {
                            const baseUrl = import.meta.env.BASE_URL || '/';
                            // Ensure the path is absolute relative to the base URL
                            return new URL(path, window.location.origin + baseUrl).href;
                        }
                        return prefix + path;
                    }
                };

                // Dynamic import - only loads when this method is called
                const { Essentia, EssentiaWASM } = await import('essentia.js') as EssentiaModule;

                let moduleInstance;
                if (typeof EssentiaWASM === 'function') {
                    // It's a factory function (standard Emscripten MODULARIZE=1)
                    // We can pass the config here as well to be safe
                    moduleInstance = await (EssentiaWASM as any)({
                        locateFile: (path: string, prefix: string) => {
                            if (path.endsWith('.wasm')) {
                                const baseUrl = import.meta.env.BASE_URL || '/';
                                return new URL(path, window.location.origin + baseUrl).href;
                            }
                            return prefix + path;
                        }
                    });
                } else {
                    // It's already an initialized object (maybe via UMD auto-run)
                    // In this case, we hope the `window.EssentiaWASM` pre-configuration worked.
                    moduleInstance = EssentiaWASM;
                }

                this.essentia = new Essentia(moduleInstance);
            } catch (error) {
                this.initPromise = null; // Allow retry on failure
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

        // We iterate through channels, but usually just taking the first channel (mono mix) is enough for feature extraction
        const signal = this.essentia.arrayToVector(audioBuffer.getChannelData(0));

        // 1. Rhythm (BPM)
        const rhythm = this.essentia.RhythmExtractor2013(signal);
        const bpm = rhythm.bpm;

        // 2. Tonal (Key/Scale)
        const keyData = this.essentia.KeyExtractor(signal);
        const key = keyData.key;
        const scale = keyData.scale;

        // 3. Energy / Loudness
        const rms = this.essentia.RMS(signal);
        const energy = rms.rms;

        // 4. Danceability
        const danceabilty = this.essentia.Danceability(signal).danceability;

        // Cleanup isn't strictly necessary for JS-managed vectors in some wrappers, 
        // but explicit deleteVector might be needed if using the raw C++ binding. 
        // The essentia.js wrapper usually handles this or returns JS objects.
        // If 'signal' is a std::vector proxy, it should be deleted.
        // this.essentia.deleteVector(signal); 

        return {
            bpm: Math.round(bpm),
            key: key,
            scale: scale,
            energy: energy,
            duration: audioBuffer.duration,
            danceability: danceabilty,
            loudness: -1
        };
    }
}

export const audioAnalysisService = new AudioAnalysisService();
