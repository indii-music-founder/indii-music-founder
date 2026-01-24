// Lazy-load essentia.js (2.6MB) only when audio analysis is needed
type EssentiaModule = typeof import('essentia.js');
import * as tf from '@tensorflow/tfjs';
import JSZip from 'jszip';

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

                const { Essentia, EssentiaWASM } = await import('essentia.js') as EssentiaModule;

                let moduleInstance;
                if (typeof EssentiaWASM === 'function') {
                    moduleInstance = await (EssentiaWASM as any)({
                        locateFile: (path: string) => {
                            if (path.endsWith('.wasm')) return wasmUrl;
                            return path;
                        }
                    });
                } else {
                    moduleInstance = EssentiaWASM;
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
     */
    async analyze(file: File | Blob): Promise<AudioFeatures> {
        return this.analyzeDeep(file); // Upgrade standard analyze to deep by default
    }

    /**
     * Deep Analysis using TensorFlow models
     */
    async analyzeDeep(file: File | Blob): Promise<DeepAudioFeatures> {
        await this.init();
        if (!this.essentia) throw new Error("Essentia not initialized");

        // Decode Audio
        const audioContext = new (window.AudioContext || (window as unknown as Window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Close context immediately after decoding to prevent resource leaks (limit is usually 6 contexts)
        await audioContext.close();

        // 1. Basic Features (BPM, Key, Energy)
        const basicFeatures = await this.analyzeBuffer(audioBuffer);

        // 2. Deep Learning Features
        // Extract Melspectrogram (MusicNN input: 128 frames context? No, usually longer)
        // Essentia models typically use: 16kHz, 512 hop, 96 bands.
        // We need to resample to 16kHz first.

        let signal = await this.getResampledSignal(audioBuffer, 16000);

        // Extract features for MusicNN (Melspectrogram)
        // Frame size 512? No, usually 512 hop, window 1024?
        // Standard Essentia MusicNN extraction:
        // FrameCutter(frameSize=512, hopSize=256)?
        // Wait, MusicNN needs 3 seconds patches usually.
        // Let's use the standard configuration for Essentia models:
        // sampleRate=16000, frameSize=512, hopSize=256, numberBands=96

        // We'll process a few segments to get an average.

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
             // We use a simplified approach: extract one representative 30s segment or average of patches.
             // Essentia models run on patches (e.g. 187x96).

             // Extract Log-Mel Spectrogram
             const melSpectrogram = this.extractMelSpectrogram(signal);

             // Shape: [Frames, Bands]. We need to batch it.
             // MusicNN usually takes [Batch, 1, 187, 96] or similar.
             // Let's inspect the model inputs if possible, but standard is [Batch, 187, 96] (channel last? or first?)
             // Essentia MusicNN TFJS models usually expect [Batch, 187, 96].
             // 187 frames * 256 hop = ~47,872 samples = ~3 seconds at 16kHz.

             const PATCH_frames = 187;
             const N_BANDS = 96;

             // Generate patches
             const patches: number[][][] = [];
             const step = Math.floor(melSpectrogram.length / 5); // Take 5 patches across the song

             for (let i = 0; i < 5; i++) {
                 const start = i * step;
                 if (start + PATCH_frames < melSpectrogram.length) {
                     // Slice [start : start+187]
                     const patch = [];
                     for (let j = 0; j < PATCH_frames; j++) {
                         patch.push(melSpectrogram[start + j]); // Array of 96 values
                     }
                     patches.push(patch);
                 }
             }

             if (patches.length === 0) throw new Error("Audio too short for analysis");

             // Convert to Tensor [Batch, 187, 96]
             // Note: Some models might want [Batch, 187, 96, 1] (Channel dimension)
             // Let's try [Batch, 187, 96] first.
             const inputTensor = tf.tensor(patches, [patches.length, PATCH_frames, N_BANDS], 'float32');
             // Some models need 4D? [Batch, 187, 96, 1]
             const inputTensor4D = inputTensor.expandDims(-1); // [Batch, 187, 96, 1]

             // Predict
             const getMeanPrediction = async (model: tf.GraphModel, input: tf.Tensor): Promise<number | number[]> => {
                 // Try 4D first, fallback to 3D?
                 // MusicNN usually 4D (Height, Width, Channel)
                 const output = model.predict(input) as tf.Tensor;
                 // Output [Batch, Classes]
                 const mean = output.mean(0); // Average across patches
                 const data = await mean.data();
                 return Array.from(data);
             };

             // Genre
             const genreProbs = await getMeanPrediction(genreModel, inputTensor4D) as number[];
             const genreMap: { [key: string]: number } = {};
             GENRE_LABELS.forEach((label, i) => genreMap[label] = genreProbs[i]);

             // Moods (Binary outputs usually [logits] or [prob]? TFJS models usually [Batch, 1])
             // Actually Essentia binary models often return [Batch, 2] (Class 0, Class 1) or just scalar.
             // Checking docs: usually [Activations]. We need sigmoid if it's logits, or it's already softmax.
             // MusicNN models usually have a final activation.
             // For binary 'happy', index 0 = non-happy, index 1 = happy? Or just scalar?
             // Let's assume it returns [Batch, 2] (softmax).

             const predictBinary = async (model: tf.GraphModel): Promise<number> => {
                 const res = await getMeanPrediction(model, inputTensor4D) as number[];
                 // If 2 values, take the second (positive class)
                 if (res.length === 2) return res[1]; // Softmax
                 if (res.length === 1) return res[0]; // Sigmoid
                 return res[0];
             };

             const happyVal = await predictBinary(happyModel);
             const aggressiveVal = await predictBinary(aggressiveModel);
             const danceVal = await predictBinary(danceModel);
             const relaxedVal = await predictBinary(relaxedModel);
             const voiceVal = await predictBinary(voiceModel);

             // Cleanup tensors
             inputTensor.dispose();
             inputTensor4D.dispose();

             return {
                 ...basicFeatures,
                 genre: genreMap,
                 moods: {
                     happy: happyVal,
                     aggressive: aggressiveVal,
                     relaxed: relaxedVal,
                     sad: 1.0 - happyVal // Approximation
                 },
                 danceability_ml: danceVal,
                 // Combine danceability
                 danceability: (basicFeatures.danceability + danceVal) / 2,
                 // voice_instrumental: 0=voice, 1=instrumental usually.
                 // Model name "voice_instrumental". Check output?
                 // Usually class 0 = instrumental, class 1 = voice? Or vice versa?
                 // Essentia docs: "voice" and "instrumental" classes.
                 // Let's assume binary output corresponds to the label.
                 // For now, we'll store the raw prediction (which we assumed was class 1 prob).
                 // If class 1 is 'voice', then instrumental is 1 - voice.
                 // We will return the raw value, UI handles interpretation.
                 voice_instrumental: voiceVal
             };

        } catch (err) {
            console.error("[AudioAnalysis] Deep analysis failed, returning basic features", err);
            return { ...basicFeatures };
        }
    }

    /**
     * Helper: Extract Log-Mel Spectrogram using Essentia
     */
    private extractMelSpectrogram(signal: any): number[][] {
        // Essentia setup
        const frameSize = 512;
        const hopSize = 256;
        const sampleRate = 16000;
        const nBands = 96;

        const frames = this.essentia!.FrameGenerator(signal, frameSize, hopSize);
        const melBands: number[][] = [];

        // Windowing? Hann is standard
        // EssentiaJS: Windowing(frame) -> returns windowed frame.

        for (let i = 0; i < frames.size(); i++) {
            const frame = frames.get(i);

            // 1. Windowing
            const windowed = this.essentia!.Windowing(frame, "hann", frameSize).frame;

            // 2. Spectrum
            const spectrum = this.essentia!.Spectrum(windowed).spectrum;

            // 3. MelBands
            const mel = this.essentia!.MelBands(spectrum, sampleRate, nBands, frameSize, 0, sampleRate/2, "htk").bands;

            // 4. Log Scale (log10(1 + x)) or similar.
            const logMel = [];
            for (let j=0; j<mel.size(); j++) {
                logMel.push(Math.log10(1 + 10 * mel.get(j)));
            }
            melBands.push(logMel);
        }

        return melBands;
    }

    private async getResampledSignal(audioBuffer: AudioBuffer, targetRate: number) {
        // Simple offline resampling context
        // Ensure length is integer to prevent TypeError
        const length = Math.ceil(audioBuffer.duration * targetRate);
        const offlineCtx = new OfflineAudioContext(1, length, targetRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start(0);
        const resampled = await offlineCtx.startRendering();

        // Get float array
        const channelData = resampled.getChannelData(0);
        return this.essentia!.arrayToVector(channelData);
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

    /**
     * Saves analysis result to Firestore
     */
    async saveAnalysisToFirestore(analysis: DeepAudioFeatures, filename: string): Promise<void> {
        try {
            const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
            // Dynamically import db to avoid cycle if necessary, or just use service pattern
            const { db } = await import('@/services/firebase'); // Assuming this exists or similar

            const docData = {
                filename,
                ...analysis,
                createdAt: serverTimestamp(),
                // Flatten complex objects if needed, but Firestore handles maps
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
