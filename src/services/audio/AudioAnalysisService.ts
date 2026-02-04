// Lazy-load essentia.js (2.6MB) only when audio analysis is needed
type EssentiaModule = typeof import('essentia.js');
// import * as tf from '@tensorflow/tfjs'; // Removed per memory/architecture rules
import JSZip from 'jszip';
import { musicLibraryService } from '@/services/music/MusicLibraryService';

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

export interface DeepAudioFeatures extends AudioFeatures {
    genre?: { [key: string]: number };
    moods?: {
        happy: number;
        aggressive: number;
        relaxed: number;
        sad: number;
    };
    voice_instrumental?: number; // >0.5 instrumental
    danceability_ml?: number;
}

// const MODEL_URLS = { ... }; // Removed

// Genre labels for Rosamerica model
const GENRE_LABELS = ['Classical', 'Dance', 'Hip-Hop', 'Jazz', 'Metal', 'Pop', 'Reggae', 'Rock'];

export class AudioAnalysisService {
    private essentia: InstanceType<EssentiaModule['Essentia']> | null = null;
    private initPromise: Promise<void> | null = null;

    // private models: { [key: string]: any } = {}; // Removed

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

    /*
    private async loadModel(key: string): Promise<any> {
        // Implementation removed
        throw new Error("TensorFlow.js not available");
    }
    */

    /**
     * Analyzes an audio file/blob to extract high-level features.
     * Checks MusicLibraryService cache first to avoid expensive re-computation.
     */
    async analyze(file: File): Promise<{ features: DeepAudioFeatures, fromCache: boolean }> {
        // 1. Generate a robust hash for the file
        const fileHash = await this.generateFileHash(file);

        // 2. Check Cache
        try {
            const cached = await musicLibraryService.getAnalysis(fileHash);
            if (cached) {
                console.info(`[AudioAnalysis] Cache hit for ${file.name}`);
                // Safely cast cached features to DeepAudioFeatures if compatible, or just return as is
                return { features: cached.features as DeepAudioFeatures, fromCache: true };
            }
        } catch (e) {
            console.warn("[AudioAnalysis] Cache check failed, proceeding with fresh analysis", e);
        }

        // 3. Perform Fresh Analysis (Deep)
        return this.analyzeDeep(file, fileHash);
    }

    /**
     * Deep Analysis (Downgraded to Basic due to architecture constraints)
     */
    async analyzeDeep(file: File | Blob, precalculatedHash?: string): Promise<{ features: DeepAudioFeatures, fromCache: boolean }> {
        await this.init();
        if (!this.essentia) throw new Error("Essentia not initialized");

        // Decode Audio
        const audioContext = new (window.AudioContext || (window as unknown as Window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Close context immediately after decoding to prevent resource leaks
        await audioContext.close();

        // 1. Basic Features (BPM, Key, Energy)
        const basicFeatures = await this.analyzeBuffer(audioBuffer);
        const features: DeepAudioFeatures = basicFeatures;

        // 2. Deep Learning Features (SKIPPED)
        console.warn("[AudioAnalysis] Deep analysis skipped: TensorFlow.js is not available in this environment.");

        // 4. Save to Cache and Firestore
        const fileHash = precalculatedHash || await this.generateFileHash(file instanceof File ? file : new File([file], "blob"));
        try {
            await musicLibraryService.saveAnalysis(fileHash, (file as File).name || 'audio', features, fileHash);
            // Also save to Firestore
            if ((file as File).name) {
                await this.saveAnalysisToFirestore(features, (file as File).name);
            }
        } catch (e) {
            console.warn("[AudioAnalysis] Failed to save analysis to cache", e);
        }

        return { features, fromCache: false };
    }

    /**
     * Helper: Extract Log-Mel Spectrogram using Essentia (Removed)
     */
    /*
    private extractMelSpectrogram(signal: any): number[][] {
        // ...
        return [];
    }
    */

    /*
    private async getResampledSignal(audioBuffer: AudioBuffer, targetRate: number) {
        // ...
    }
    */

    public async generateFileHash(file: Blob): Promise<string> {
        const CHUNK_SIZE = 1024 * 1024; // 1MB
        const blob = file.slice(0, CHUNK_SIZE);
        const arrayBuffer = await blob.arrayBuffer();

        const metadata = `${(file as File).name || 'blob'}-${file.size}`;
        const encoder = new TextEncoder();
        const metadataBuffer = encoder.encode(metadata);

        const combinedBuffer = new Uint8Array(metadataBuffer.length + arrayBuffer.byteLength);
        combinedBuffer.set(metadataBuffer, 0);
        combinedBuffer.set(new Uint8Array(arrayBuffer), metadataBuffer.length);

        const hashBuffer = await crypto.subtle.digest('SHA-256', combinedBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Analyzes an already decoded AudioBuffer.
     */
    async analyzeBuffer(audioBuffer: AudioBuffer): Promise<AudioFeatures> {
        await this.init();
        if (!this.essentia) throw new Error("Essentia not initialized");

        console.info(`[AudioAnalysis] Analyzing buffer: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz`);

        const channelData = audioBuffer.getChannelData(0);

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
            const rhythm = this.essentia.RhythmExtractor2013(signal);
            const bpm = rhythm.bpm;

            const keyData = this.essentia.KeyExtractor(signal);
            const key = keyData.key;
            const scale = keyData.scale;

            const rms = this.essentia.RMS(signal);
            const energyValue = rms.rms;

            const danceabilityValue = this.essentia.Danceability(signal).danceability;

            console.info(`[AudioAnalysis] Success: ${Math.round(bpm)} BPM, ${key} ${scale}, Energy: ${energyValue.toFixed(3)}`);

            return {
                bpm: Math.round(bpm),
                key: key,
                scale: scale,
                energy: Math.min(1, Math.max(0, energyValue * 3.5)),
                duration: audioBuffer.duration,
                danceability: danceabilityValue,
                valence: scale === 'major'
                    ? 0.6 + (Math.min(1, energyValue * 3.5) * 0.3)
                    : 0.2 + (Math.min(1, energyValue * 3.5) * 0.2),
                loudness: -1
            };
        } finally {
            if ((this.essentia as any).deleteVector && signal) {
                (this.essentia as any).deleteVector(signal);
            }
        }
    }

    /**
     * Saves analysis result to Firestore
     */
    async saveAnalysisToFirestore(analysis: DeepAudioFeatures, filename: string): Promise<void> {
        try {
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
            const { db, auth } = await import('@/services/firebase');

            const user = auth.currentUser;
            if (!user) {
                console.warn("[AudioAnalysis] Cannot save analysis: User not authenticated");
                throw new Error("User must be logged in to save analysis.");
            }

            const docData = {
                userId: user.uid,
                filename,
                features: analysis, // Nest features to match schema expectation if needed, or spread if schema allows
                ...analysis, // Spreading at top level for backward compat/flexibility
                analyzedAt: serverTimestamp(), // Match schema 'analyzedAt'
                createdAt: serverTimestamp(),
            };

            // Write to User-Scoped Collection
            await addDoc(collection(db, `users/${user.uid}/analyzed_tracks`), docData);
            console.info(`[AudioAnalysis] Saved analysis for ${filename} to users/${user.uid}/analyzed_tracks`);
        } catch (error) {
            console.error("[AudioAnalysis] Failed to save to Firestore", error);
            throw error;
        }
    }
}

export const audioAnalysisService = new AudioAnalysisService();
