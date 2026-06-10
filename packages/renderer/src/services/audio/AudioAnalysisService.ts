
import { musicLibraryService } from '@/services/music/MusicLibraryService';
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService';
import { logger } from '@/utils/logger';

import { DSPComplianceValidator } from './DSPComplianceValidator';
import type { DeepAudioFeatures, TechnicalAudit } from './types';
import type { AudioAnalysisResult } from '@/types/electron';


export class AudioAnalysisService {
    private initialized = false;


    private async init(): Promise<void> {
        if (this.initialized) return;

        // Keep the browser analysis path CSP-clean. The previous Essentia.js
        // wrapper used string evaluation during Emscripten startup, which is
        // blocked by production CSP and would require global `unsafe-eval`.
        this.initialized = true;
        logger.info("[AudioAnalysis] Initialized CSP-safe Web Audio analyzer.");
    }


    /**
     * Analyzes an audio file/blob to extract high-level features.
     * Checks MusicLibraryService cache first to avoid expensive re-computation.
     */
    async analyze(file: File | string): Promise<{ features: DeepAudioFeatures, semantic?: AudioAnalysisResult['semantic'], fromCache: boolean }> {
        let fileHash = '';
        let filename = '';

        if (typeof file === 'string') {
            filename = file.split(/[/\\]/).pop() || 'audio';
            if (window.electronAPI) {
                try {
                    const result = await window.electronAPI.audio.analyze(file);
                    if (result.status === 'success') {
                        fileHash = result.hash;
                        const cached = await musicLibraryService.getAnalysis(fileHash);
                        if (cached) {
                            logger.info(`[AudioAnalysis] Cache hit for ${filename}`);
                            return { features: cached.features as DeepAudioFeatures, semantic: cached.semantic as unknown as AudioAnalysisResult['semantic'], fromCache: true };
                        }
                        const features = this.mapElectronResultToFeatures(result);
                        await musicLibraryService.saveAnalysis(fileHash, filename, features, fileHash);
                        return { features, semantic: result.semantic, fromCache: false };
                    } else {
                        throw new Error(result.error || 'Electron analysis failed');
                    }
                } catch (e) {
                    logger.error('[AudioAnalysis] Electron analysis failed', e);
                    throw e;
                }
            } else {
                throw new Error('Paths are only supported in Electron environment');
            }
        }

        // It is a File object
        filename = file.name;
        const filePath = (file as { path?: string }).path;

        if (window.electronAPI && filePath) {
            try {
                const result = await window.electronAPI.audio.analyze(filePath);
                if (result.status === 'success') {
                    fileHash = result.hash;
                    const cached = await musicLibraryService.getAnalysis(fileHash);
                    if (cached) {
                        logger.info(`[AudioAnalysis] Cache hit for ${filename}`);
                        return { features: cached.features as DeepAudioFeatures, semantic: cached.semantic as unknown as AudioAnalysisResult['semantic'], fromCache: true };
                    }
                    const features = this.mapElectronResultToFeatures(result);
                    await musicLibraryService.saveAnalysis(fileHash, filename, features, fileHash);
                    return { features, semantic: result.semantic, fromCache: false };
                }
            } catch (e) {
                logger.warn('[AudioAnalysis] Electron path analysis failed, falling back to Web Audio', e);
            }
        }

        // Web browser / fallback path
        fileHash = await this.generateFileHash(file);
        try {
            const cached = await musicLibraryService.getAnalysis(fileHash);
            if (cached) {
                logger.info(`[AudioAnalysis] Cache hit for ${filename}`);
                return { features: cached.features as DeepAudioFeatures, semantic: cached.semantic as unknown as AudioAnalysisResult['semantic'], fromCache: true };
            }
        } catch (e) {
            logger.warn("[AudioAnalysis] Cache check failed, proceeding with fresh analysis", e);
        }

        return this.analyzeDeep(file, fileHash);
    }

    async analyzeDeep(file: File | Blob, precalculatedHash?: string): Promise<{ features: DeepAudioFeatures, semantic?: AudioAnalysisResult['semantic'], fromCache: boolean }> {
        await this.init();

        // Decode Audio
        const audioContext = new (window.AudioContext || (window as unknown as Window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Close context immediately after decoding to prevent resource leaks
        await audioContext.close();

        // 1. Basic Features (BPM, Key, Energy)
        const basicFeatures = await this.analyzeBuffer(audioBuffer);
        const features: DeepAudioFeatures = { ...basicFeatures };

        // 3. Save to Cache only (local IndexedDB)
        const fileHash = precalculatedHash || await this.generateFileHash(file instanceof File ? file : new File([file], "blob"));
        const filename = (file as File).name || 'audio';

        try {
            await musicLibraryService.saveAnalysis(fileHash, filename, features, fileHash);
        } catch (e: unknown) {
            logger.warn("[AudioAnalysis] Failed to save to local cache", e);
        }

        return { features, semantic: null, fromCache: false };
    }

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

        let sumSquares = 0;
        let maxPeak = 0;
        let zeroCrossings = 0;
        let previous = channelData[0] ?? 0;

        for (let i = 0; i < channelData.length; i++) {
            const sample = channelData[i] ?? 0;
            const abs = Math.abs(sample);
            sumSquares += sample * sample;
            if (abs > maxPeak) maxPeak = abs;
            if (i > 0 && ((previous < 0 && sample >= 0) || (previous >= 0 && sample < 0))) {
                zeroCrossings += 1;
            }
            previous = sample;
        }

        const energyValue = Math.sqrt(sumSquares / Math.max(channelData.length, 1));
        const energy = Math.min(1, Math.max(0, energyValue * 4.0));
        const loudnessLUFS = -20 + (energyValue * 100); // Approximation
        const truePeakDb = 20 * Math.log10(maxPeak || 0.00001);

        await new Promise(r => setTimeout(r, 0)); // Yield to unblock UI

        const segments: { start: number; label: string; energy: number }[] = [];
        const windowSize = Math.max(1, Math.floor(audioBuffer.sampleRate * 2)); // 2 second windows
        const segmentEnergies: number[] = [];

        for (let i = 0; i < channelData.length; i += windowSize) {
            const end = Math.min(i + windowSize, channelData.length);
            let subEnergy = 0;
            for (let j = i; j < end; j++) {
                const sample = channelData[j] ?? 0;
                subEnergy += sample * sample;
            }
            subEnergy = Math.sqrt(subEnergy / Math.max(end - i, 1));
            segmentEnergies.push(subEnergy);

            if (subEnergy > energyValue * 1.5) {
                segments.push({ start: i / audioBuffer.sampleRate, label: 'High Energy / Hook candidate', energy: subEnergy });
            }
        }

        const bpm = this.estimateTempo(segmentEnergies, windowSize / audioBuffer.sampleRate);
        const { key, scale } = this.estimateKeyAndScale(channelData, audioBuffer.sampleRate);
        const danceabilityValue = Math.min(1, Math.max(0, (energy * 0.65) + (this.estimateRhythmicStability(segmentEnergies) * 0.35)));

        const rejectionRisks: string[] = [];
        if (maxPeak > 0.99) rejectionRisks.push('Peak levels too high (risk of clipping/distortion)');
        if (audioBuffer.sampleRate < 44100) rejectionRisks.push('Sample rate below industry standard (44.1kHz)');

        const compliance = DSPComplianceValidator.validateAudio(loudnessLUFS, truePeakDb, audioBuffer.sampleRate, 16);
        if (compliance.flags.length > 0) {
            rejectionRisks.push(...compliance.flags);
        }

        if (loudnessLUFS > -10) rejectionRisks.push('Integrated loudness too high (risk of DSP normalization)');
        if (loudnessLUFS < -18) rejectionRisks.push('Integrated loudness too low');

        const audit: TechnicalAudit = {
            peakLevel: truePeakDb,
            truePeakDb,
            integratedLoudness: loudnessLUFS,
            sampleRate: audioBuffer.sampleRate,
            isStereo: audioBuffer.numberOfChannels > 1,
            rejectionRisks,
            compliance
        };

        logger.info(`[AudioAnalysis] Success: ${Math.round(bpm)} BPM, ${key} ${scale}, Energy: ${energyValue.toFixed(3)}`);

        const isMinor = scale === 'minor';
        const brightness = Math.min(1, zeroCrossings / Math.max(channelData.length, 1) * 80);

        return {
            bpm: Math.round(bpm),
            key,
            scale,
            energy,
            duration: audioBuffer.duration,
            danceability: danceabilityValue,
            valence: isMinor
                ? 0.3 + (energy * 0.2)
                : 0.55 + (energy * 0.25) + (brightness * 0.1),
            loudness: loudnessLUFS,
            audit,
            segments: segments.slice(0, 5), // Return top 5 interesting spots
            // Deep feature slots remain empty until the semantic Gemini pass runs.
            genre: {},
            moods: {
                happy: 0,
                aggressive: 0,
                relaxed: 0,
                sad: 0
            },
            danceability_ml: danceabilityValue
        };
    }

    private estimateTempo(segmentEnergies: number[], secondsPerSegment: number): number {
        if (segmentEnergies.length < 3 || secondsPerSegment <= 0) {
            return 120;
        }

        const mean = segmentEnergies.reduce((sum, value) => sum + value, 0) / segmentEnergies.length;
        const peaks = segmentEnergies
            .map((energy, index) => ({ energy, index }))
            .filter(({ energy, index }) => index > 0 && index < segmentEnergies.length - 1 && energy > mean && energy >= segmentEnergies[index - 1]! && energy >= segmentEnergies[index + 1]!);

        if (peaks.length < 2) {
            return 120;
        }

        const intervals: number[] = [];
        for (let i = 1; i < peaks.length; i++) {
            intervals.push((peaks[i]!.index - peaks[i - 1]!.index) * secondsPerSegment);
        }

        const averageInterval = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
        if (!Number.isFinite(averageInterval) || averageInterval <= 0) {
            return 120;
        }

        let bpm = 60 / averageInterval;
        while (bpm < 70) bpm *= 2;
        while (bpm > 180) bpm /= 2;
        return Math.min(180, Math.max(70, bpm));
    }

    private estimateRhythmicStability(segmentEnergies: number[]): number {
        if (segmentEnergies.length < 2) return 0.5;

        const mean = segmentEnergies.reduce((sum, value) => sum + value, 0) / segmentEnergies.length;
        if (mean <= 0) return 0;

        const variance = segmentEnergies.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / segmentEnergies.length;
        const coefficient = Math.sqrt(variance) / mean;
        return Math.min(1, Math.max(0, coefficient));
    }

    private estimateKeyAndScale(channelData: Float32Array, sampleRate: number): { key: string; scale: string } {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const chroma = new Array<number>(12).fill(0);
        const crossings: number[] = [];
        let previous = channelData[0] ?? 0;

        for (let i = 1; i < channelData.length; i++) {
            const sample = channelData[i] ?? 0;
            if ((previous < 0 && sample >= 0) || (previous >= 0 && sample < 0)) {
                crossings.push(i);
                if (crossings.length > 1200) break;
            }
            previous = sample;
        }

        for (let i = 1; i < crossings.length; i++) {
            const periodSamples = (crossings[i]! - crossings[i - 1]!) * 2;
            if (periodSamples <= 0) continue;

            const frequency = sampleRate / periodSamples;
            if (frequency < 55 || frequency > 1760) continue;

            const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
            chroma[((midi % 12) + 12) % 12] += 1;
        }

        const root = chroma.indexOf(Math.max(...chroma));
        if (root < 0) {
            return { key: 'C', scale: 'major' };
        }

        const majorThird = chroma[(root + 4) % 12] ?? 0;
        const minorThird = chroma[(root + 3) % 12] ?? 0;
        return {
            key: noteNames[root] ?? 'C',
            scale: minorThird > majorThird ? 'minor' : 'major',
        };
    }

    private mapElectronResultToFeatures(result: AudioAnalysisResult): DeepAudioFeatures {
        const technical = result.features;
        const audit = result.features?.audit || {
            peakLevel: 0,
            truePeakDb: 0,
            integratedLoudness: result.features?.loudness ?? -14,
            sampleRate: result.streams?.[0]?.sample_rate ? parseInt(result.streams[0].sample_rate) : 44100,
            isStereo: result.streams?.[0]?.channels ? result.streams[0].channels > 1 : true,
            rejectionRisks: []
        };

        return {
            bpm: technical?.bpm ?? 120,
            key: technical?.key ?? 'C',
            scale: technical?.scale ?? 'major',
            energy: technical?.energy ?? 0.5,
            duration: result.metadata.duration,
            danceability: technical?.danceability ?? 0.5,
            loudness: technical?.loudness ?? -14,
            valence: technical?.valence ?? 0.5,
            genre: technical?.genre ?? {},
            moods: technical?.moods ?? { happy: 0, aggressive: 0, relaxed: 0, sad: 0 },
            audit
        };
    }

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
