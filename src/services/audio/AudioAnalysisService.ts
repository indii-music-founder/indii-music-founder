/* eslint-disable @typescript-eslint/no-explicit-any -- Service layer uses dynamic types for external API responses */
// Lazy-load essentia.js (2.6MB) only when audio analysis is needed
type EssentiaModule = typeof import('essentia.js');
// import * as tf from '@tensorflow/tfjs'; // Removed per memory/architecture rules
import JSZip from 'jszip';
import { musicLibraryService } from '@/services/music/MusicLibraryService';
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService';
import { logger } from '@/utils/logger';

/**
 * Types for Essentia.js WASM module interop.
 * The library has inconsistent exports across build targets (ESM vs CJS vs Vite),
 * so we model the various shapes it can take at runtime.
 */
interface EssentiaWASMConfig {
    locateFile: (path: string) => string;
}

/** The WASM module can be a factory function or an already-instantiated object */
type EssentiaWASMFactory = (config: EssentiaWASMConfig) => Promise<EssentiaWASMInstance>;

interface EssentiaWASMInstance {
    EssentiaWASM?: EssentiaWASMInstance;
    [key: string]: unknown;
}

interface EssentiaImport {
    Essentia: EssentiaModule['Essentia'];
    EssentiaWASM?: EssentiaWASMFactory | EssentiaWASMInstance;
    default?: {
        EssentiaWASM?: EssentiaWASMFactory | EssentiaWASMInstance;
    };
}

/** Extended essentia instance with optional vector cleanup */
interface EssentiaInstance extends InstanceType<EssentiaModule['Essentia']> {
    deleteVector?: (vector: unknown) => void;
}

declare global {
    interface Window {
        EssentiaWASM?: EssentiaWASMConfig;
    }
}

export interface TechnicalAudit {
    peakLevel: number;
    integratedLoudness: number;
    sampleRate: number;
    isStereo: boolean;
    rejectionRisks: string[];
}

export interface AudioFeatures {
    bpm: number;
    key: string;
    scale: string;
    energy: number;
    duration: number;
    danceability: number;
    loudness: number;
    valence?: number; // Happiness/Sadness
    audit?: TechnicalAudit;
    segments?: { start: number; label: string; energy: number }[];
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
    private essentia: EssentiaInstance | null = null;
    private initPromise: Promise<void> | null = null;

    // private models: { [key: string]: any } = {}; // Removed

    private async init(): Promise<void> {
        if (this.essentia) return;

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            try {
                logger.info("[AudioAnalysis] Initializing Essentia.js WASM engine...");

                const baseUrl = import.meta.env.BASE_URL || '/';
                const wasmUrl = new URL('essentia-wasm.web.wasm', window.location.origin + baseUrl).href;

                logger.debug(`[AudioAnalysis] WASM URL: ${wasmUrl}`);

                (window).EssentiaWASM = {
                    locateFile: (path: string) => {
                        if (path.endsWith('.wasm')) return wasmUrl;
                        return path;
                    }
                };

                const imported: EssentiaImport = await import('essentia.js');
                const { Essentia } = imported;
                let EssentiaWASM = imported.EssentiaWASM;

                // Handle Vite/Rollup interop for EssentiaWASM import
                if (!EssentiaWASM && imported.default?.EssentiaWASM) {
                    EssentiaWASM = imported.default.EssentiaWASM;
                }

                let moduleInstance: EssentiaWASMInstance | undefined;
                if (typeof EssentiaWASM === 'function') {
                    moduleInstance = await EssentiaWASM({
                        locateFile: (path: string) => {
                            if (path.endsWith('.wasm')) return wasmUrl;
                            return path;
                        }
                    });
                } else if (EssentiaWASM) {
                    // Check if EssentiaWASM is nested (common in some builds)
                    if (EssentiaWASM.EssentiaWASM) {
                        moduleInstance = EssentiaWASM.EssentiaWASM;
                    } else {
                        moduleInstance = EssentiaWASM;
                    }
                }

                if (!moduleInstance) {
                    throw new Error("Failed to resolve EssentiaWASM instance");
                }

                this.essentia = new Essentia(moduleInstance);
                logger.info("[AudioAnalysis] Essentia.js WASM engine ready.");
            } catch (error) {
                logger.error("[AudioAnalysis] Failed to initialize Essentia.js:", error);
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
                logger.info(`[AudioAnalysis] Cache hit for ${file.name}`);
                // Safely cast cached features to DeepAudioFeatures if compatible, or just return as is
                return { features: cached.features as DeepAudioFeatures, fromCache: true };
            }
        } catch (e) {
            logger.warn("[AudioAnalysis] Cache check failed, proceeding with fresh analysis", e);
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
        logger.warn("[AudioAnalysis] Deep analysis skipped: TensorFlow.js is not available in this environment.");

        // 3. Save to Cache only (local IndexedDB)
        const fileHash = precalculatedHash || await this.generateFileHash(file instanceof File ? file : new File([file], "blob"));
        const filename = (file as File).name || 'audio';

        try {
            await musicLibraryService.saveAnalysis(fileHash, filename, features, fileHash);
        } catch (e) {
            logger.warn("[AudioAnalysis] Failed to save to local cache", e);
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
    async analyzeBuffer(audioBuffer: AudioBuffer): Promise<DeepAudioFeatures> {
        await this.init();
        if (!this.essentia) throw new Error("Essentia not initialized");

        logger.info(`[AudioAnalysis] Analyzing buffer: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz`);

        const channelData = audioBuffer.getChannelData(0);

        let hasSignal = false;
        for (let i = 0; i < Math.min(channelData.length, 1000); i++) {
            if (Math.abs(channelData[i]!) > 0.0001) {
                hasSignal = true;
                break;
            }
        }

        if (!hasSignal) {
            logger.warn("[AudioAnalysis] Input buffer appears to be silent (or extremely low volume).");
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

            // TECHNICAL AUDIT
            let maxPeak = 0;
            for (let i = 0; i < channelData.length; i++) {
                const abs = Math.abs(channelData[i]!);
                if (abs > maxPeak) maxPeak = abs;
            }

            const rejectionRisks: string[] = [];
            if (maxPeak > 0.99) rejectionRisks.push('Peak levels too high (risk of clipping/distortion)');
            if (audioBuffer.sampleRate < 44100) rejectionRisks.push('Sample rate below industry standard (44.1kHz)');

            const loudnessLUFS = -20 + (energyValue * 100); // Approximation
            if (loudnessLUFS > -10) rejectionRisks.push('Integrated loudness too high (risk of DSP normalization)');
            if (loudnessLUFS < -18) rejectionRisks.push('Integrated loudness too low');

            const audit: TechnicalAudit = {
                peakLevel: 20 * Math.log10(maxPeak || 0.00001),
                integratedLoudness: loudnessLUFS,
                sampleRate: audioBuffer.sampleRate,
                isStereo: audioBuffer.numberOfChannels > 1,
                rejectionRisks
            };

            // BASIC SEGMENTATION (Viral DNA)
            const segments: { start: number; label: string; energy: number }[] = [];
            const windowSize = audioBuffer.sampleRate * 2; // 2 second windows
            for (let i = 0; i < channelData.length; i += windowSize) {
                const subArr = channelData.slice(i, i + windowSize);
                let subEnergy = 0;
                for (let j = 0; j < subArr.length; j++) subEnergy += subArr[j]! * subArr[j]!;
                subEnergy = Math.sqrt(subEnergy / subArr.length);

                if (subEnergy > energyValue * 1.5) {
                    segments.push({ start: i / audioBuffer.sampleRate, label: 'High Energy / Hook candidate', energy: subEnergy });
                }
            }

            logger.info(`[AudioAnalysis] Success: ${Math.round(bpm)} BPM, ${key} ${scale}, Energy: ${energyValue.toFixed(3)}`);

            // Mapping RMS to dynamic energy (0-1)
            const energy = Math.min(1, Math.max(0, energyValue * 4.0));
            const isMinor = scale === 'minor';

            return {
                bpm: Math.round(bpm),
                key: key,
                scale: scale,
                energy: energy,
                duration: audioBuffer.duration,
                danceability: danceabilityValue,
                valence: isMinor
                    ? 0.3 + (energy * 0.2)
                    : 0.6 + (energy * 0.3),
                loudness: loudnessLUFS,
                audit,
                segments: segments.slice(0, 5), // Return top 5 interesting spots
                // Simulated Deep Features for UI Metadata Matrix
                genre: {},
                moods: {
                    happy: 0,
                    aggressive: 0,
                    relaxed: 0,
                    sad: 0
                },
                danceability_ml: danceabilityValue
            };
        } finally {
            if (this.essentia?.deleteVector && signal) {
                this.essentia.deleteVector(signal);
            }
        }
    }

    /**
     * Saves analysis result to Firestore using the centralized persistence service.
     */
    async saveAnalysisToFirestore(analysis: DeepAudioFeatures, filename: string, semantic?: Record<string, unknown>): Promise<void> {
        const result = await metadataPersistenceService.save('audio', {
            filename,
            features: analysis,
            semantic,
            ...analysis,
            analyzedAt: new Date().toISOString(),
        }, {
            showToasts: true,
            maxRetries: 2,
            queueOnFailure: true,
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to save analysis');
        }

        logger.info(`[AudioAnalysis] Saved full profile for ${filename} via MetadataPersistenceService`);
    }
}

export const audioAnalysisService = new AudioAnalysisService();
