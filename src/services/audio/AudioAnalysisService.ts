// Lazy-load essentia.js (2.6MB) only when audio analysis is needed
type EssentiaModule = typeof import('essentia.js');
import * as tf from '@tensorflow/tfjs';
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

const MODEL_URLS = {
    genre: "https://essentia.upf.edu/models/classifiers/genre_rosamerica/genre_rosamerica-musicnn-msd-2-tfjs.zip",
    mood_happy: "https://essentia.upf.edu/models/classifiers/mood_happy/mood_happy-musicnn-msd-2-tfjs.zip",
    danceability: "https://essentia.upf.edu/models/classifiers/danceability/danceability-musicnn-msd-2-tfjs.zip",
    mood_aggressive: "https://essentia.upf.edu/models/classifiers/mood_aggressive/mood_aggressive-musicnn-msd-2-tfjs.zip",
    mood_relaxed: "https://essentia.upf.edu/models/classifiers/mood_relaxed/mood_relaxed-musicnn-msd-2-tfjs.zip",
    voice_instrumental: "https://essentia.upf.edu/models/classifiers/voice_instrumental/voice_instrumental-musicnn-msd-2-tfjs.zip"
};

// Genre labels for Rosamerica model
const GENRE_LABELS = ['Classical', 'Dance', 'Hip-Hop', 'Jazz', 'Metal', 'Pop', 'Reggae', 'Rock'];

export class AudioAnalysisService {
    private essentia: InstanceType<EssentiaModule['Essentia']> | null = null;
    private initPromise: Promise<void> | null = null;

    // Model Cache
    private models: { [key: string]: tf.GraphModel } = {};

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
     * Loads a TFJS model from a zipped URL (Essentia standard format)
     */
    private async loadModel(key: keyof typeof MODEL_URLS): Promise<tf.GraphModel> {
        if (this.models[key]) return this.models[key];

        console.info(`[AudioAnalysis] Downloading model: ${key}...`);
        const url = MODEL_URLS[key];

        try {
            // 1. Fetch Zip
            const response = await fetch(url);
            const blob = await response.blob();
            const zip = await JSZip.loadAsync(blob);

            // 2. Extract model.json and weights
            const jsonFile = Object.keys(zip.files).find(name => name.endsWith('model.json'));
            if (!jsonFile) throw new Error(`model.json not found in zip for ${key}`);

            const jsonStr = await zip.file(jsonFile)?.async('string');
            if (!jsonStr) throw new Error("Failed to read model.json");

            const modelTopology = JSON.parse(jsonStr);

            // 3. Create Blob URLs for weights
            const weightFiles = modelTopology.weightsManifest[0].paths;
            const weightBlobs = await Promise.all(weightFiles.map(async (path: string) => {
                // The path in manifest might be relative, e.g. "./group1-shard1of1.bin"
                // We need to find the matching file in zip (ignoring directory structure if flat)
                const fileName = path.split('/').pop()!;
                const zipFileName = Object.keys(zip.files).find(name => name.endsWith(fileName));

                if (!zipFileName) throw new Error(`Weight file ${fileName} not found in zip`);

                const weightBlob = await zip.file(zipFileName)?.async('blob');
                return URL.createObjectURL(weightBlob!);
            }));

            // 4. Update manifest to point to Blob URLs
            modelTopology.weightsManifest[0].paths = weightBlobs;

            // 5. Load model using tf.io.fromMemory or just a Blob URL for the JSON
            const modelBlob = new Blob([JSON.stringify(modelTopology)], { type: 'application/json' });
            const modelUrl = URL.createObjectURL(modelBlob);

            // 6. Load
            const model = await tf.loadGraphModel(modelUrl);
            this.models[key] = model;

            // Cleanup URLs? No, we need them for the model to work. Browser cleans up eventually or we can track them.

            console.info(`[AudioAnalysis] Model loaded: ${key}`);
            return model;

        } catch (error) {
            console.error(`[AudioAnalysis] Failed to load model ${key}:`, error);
            throw error;
        }
    }

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
     * Deep Analysis using TensorFlow models
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
        let features: DeepAudioFeatures = basicFeatures;

        // 2. Deep Learning Features
        // We'll process a few segments to get an average.
        let signal = await this.getResampledSignal(audioBuffer, 16000);

        try {
            // Load models in parallel
            const [genreModel, happyModel, aggressiveModel, danceModel, relaxedModel, voiceModel] = await Promise.all([
                this.loadModel('genre'),
                this.loadModel('mood_happy'),
                this.loadModel('mood_aggressive'),
                this.loadModel('danceability'),
                this.loadModel('mood_relaxed'),
                this.loadModel('voice_instrumental')
            ]);

            // Prepare Input (Melspectrogram)
            const melSpectrogram = this.extractMelSpectrogram(signal);
            const PATCH_frames = 187; // ~3 seconds
            const N_BANDS = 96;

            // Generate patches
            const patches: number[][][] = [];
            const step = Math.floor(melSpectrogram.length / 5); // Take 5 patches across the song

            for (let i = 0; i < 5; i++) {
                const start = i * step;
                if (start + PATCH_frames < melSpectrogram.length) {
                    const patch = [];
                    for (let j = 0; j < PATCH_frames; j++) {
                        patch.push(melSpectrogram[start + j]); // Array of 96 values
                    }
                    patches.push(patch);
                }
            }

            if (patches.length > 0) {
                // Convert to Tensor [Batch, 187, 96]
                const inputTensor = tf.tensor(patches, [patches.length, PATCH_frames, N_BANDS], 'float32');
                const inputTensor4D = inputTensor.expandDims(-1); // [Batch, 187, 96, 1]

                // Predict Helper
                const getMeanPrediction = async (model: tf.GraphModel, input: tf.Tensor): Promise<number | number[]> => {
                    const output = model.predict(input) as tf.Tensor;
                    const mean = output.mean(0);
                    const data = await mean.data();
                    return Array.from(data);
                };

                // Genre
                const genreProbs = await getMeanPrediction(genreModel, inputTensor4D) as number[];
                const genreMap: { [key: string]: number } = {};
                GENRE_LABELS.forEach((label, i) => genreMap[label] = genreProbs[i]);

                // Moods
                const predictBinary = async (model: tf.GraphModel): Promise<number> => {
                    const res = await getMeanPrediction(model, inputTensor4D) as number[];
                    if (res.length === 2) return res[1]; // Softmax
                    if (res.length === 1) return res[0]; // Sigmoid
                    return res[0];
                };

                const happyVal = await predictBinary(happyModel);
                const aggressiveVal = await predictBinary(aggressiveModel);
                const danceVal = await predictBinary(danceModel);
                const relaxedVal = await predictBinary(relaxedModel);
                const voiceVal = await predictBinary(voiceModel);

                // Cleanup
                inputTensor.dispose();
                inputTensor4D.dispose();

                features = {
                    ...basicFeatures,
                    genre: genreMap,
                    moods: {
                        happy: happyVal,
                        aggressive: aggressiveVal,
                        relaxed: relaxedVal,
                        sad: 1.0 - happyVal
                    },
                    danceability_ml: danceVal,
                    danceability: (basicFeatures.danceability + danceVal) / 2,
                    voice_instrumental: voiceVal
                };
            }

        } catch (err) {
            console.error("[AudioAnalysis] Deep analysis failed, returning basic features", err);
            // features remains basicFeatures
        }

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
     * Helper: Extract Log-Mel Spectrogram using Essentia
     */
    private extractMelSpectrogram(signal: any): number[][] {
        const frameSize = 512;
        const hopSize = 256;
        const sampleRate = 16000;
        const nBands = 96;

        const frames = this.essentia!.FrameGenerator(signal, frameSize, hopSize);
        const melBands: number[][] = [];

        for (let i = 0; i < frames.size(); i++) {
            const frame = frames.get(i);
            const windowed = this.essentia!.Windowing(frame, "hann", frameSize).frame;
            const spectrum = this.essentia!.Spectrum(windowed).spectrum;
            const mel = this.essentia!.MelBands(spectrum, sampleRate, nBands, frameSize, 0, sampleRate / 2, "htk").bands;
            const logMel = [];
            for (let j = 0; j < mel.size(); j++) {
                logMel.push(Math.log10(1 + 10 * mel.get(j)));
            }
            melBands.push(logMel);
        }

        return melBands;
    }

    private async getResampledSignal(audioBuffer: AudioBuffer, targetRate: number) {
        const length = Math.ceil(audioBuffer.duration * targetRate);
        const offlineCtx = new OfflineAudioContext(1, length, targetRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start(0);
        const resampled = await offlineCtx.startRendering();

        const channelData = resampled.getChannelData(0);
        return this.essentia!.arrayToVector(channelData);
    }

    private async generateFileHash(file: Blob): Promise<string> {
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
            const { db } = await import('@/services/firebase');

            const docData = {
                filename,
                ...analysis,
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, 'audio_analyses'), docData);
            console.info(`[AudioAnalysis] Saved analysis for ${filename}`);
        } catch (error) {
            console.error("[AudioAnalysis] Failed to save to Firestore", error);
            throw error;
        }
    }
}

export const audioAnalysisService = new AudioAnalysisService();
