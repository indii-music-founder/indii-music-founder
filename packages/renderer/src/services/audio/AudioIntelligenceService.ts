import { audioAnalysisService } from './AudioAnalysisService';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { AudioIntelligenceProfile, AudioSemanticData } from './types';
import { Schema } from 'firebase/ai';
import { fingerprintService } from './FingerprintService';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { musicLibraryService } from '@/services/music/MusicLibraryService';
import { neuralCortex } from '@/services/intelligence/NeuralCortexService';
import { Logger } from '@/core/logger/Logger';
import { withServiceError } from '@/lib/errors';
import { styleMemoryStore } from './StyleMemoryStore';
import { energyMapService } from './EnergyMapService';
import { autoCopywriter } from '@/services/marketing/AutoCopywriter';


const SEMANTIC_SCHEMA: Schema = {
    type: 'OBJECT' as const,
    properties: {
        mood: { type: 'ARRAY', items: { type: 'STRING' } },
        genre: { type: 'ARRAY', items: { type: 'STRING' } },
        instruments: { type: 'ARRAY', items: { type: 'STRING' } },
        ddexGenre: { type: 'STRING' },
        ddexSubGenre: { type: 'STRING' },
        language: { type: 'STRING' },
        isExplicit: { type: 'BOOLEAN' },
        marketingComment: { type: 'STRING' },
        timbre: {
            type: 'OBJECT',
            properties: {
                texture: { type: 'STRING' },
                brightness: { type: 'STRING' },
                saturation: { type: 'STRING' },
                spaceDepth: { type: 'STRING' }
            },
            required: ['texture', 'brightness', 'saturation', 'spaceDepth']
        },
        productionValue: {
            type: 'OBJECT',
            properties: {
                era: { type: 'STRING' },
                quality: { type: 'STRING' },
                mixBalance: { type: 'STRING' },
                aiArtifacts: { type: 'BOOLEAN' }
            },
            required: ['era', 'quality', 'mixBalance', 'aiArtifacts']
        },
        visualImagery: {
            type: 'OBJECT',
            properties: {
                abstract: { type: 'STRING' },
                narrative: { type: 'STRING' },
                lighting: { type: 'STRING' }
            },
            required: ['abstract', 'narrative', 'lighting']
        },
        marketingHooks: {
            type: 'OBJECT',
            properties: {
                keywords: { type: 'ARRAY', items: { type: 'STRING' } },
                oneLiner: { type: 'STRING' }
            },
            required: ['keywords', 'oneLiner']
        },
        targetPrompts: {
            type: 'OBJECT',
            properties: {
                image: { type: 'STRING' },
                veo: { type: 'STRING' }
            },
            required: ['image', 'veo']
        }
    },
    required: [
        'mood', 'genre', 'instruments',
        'ddexGenre', 'ddexSubGenre', 'language', 'isExplicit', 'marketingComment',
        'timbre', 'productionValue',
        'visualImagery', 'marketingHooks', 'targetPrompts'
    ]
} as unknown as Schema;

export class AudioIntelligenceService {

    /**
     * Orchestrates full audio analysis:
     * 1. Technical (local WASM)
     * 2. Semantic (Gemini 3 Pro - INTELLIGENCE_MODELS.TEXT.AGENT)
     */
    async analyze(file: File | string): Promise<AudioIntelligenceProfile> {
        return withServiceError('AudioIntelligence', 'analyze', async () => {
            const filename = typeof file === 'string'
                ? file.split(/[/\\]/).pop() || 'audio'
                : file.name;

            Logger.info('AudioIntelligence', `Starting analysis for ${filename}`);

            // 1. Generate ID (Fingerprint)
            let id = '';
            const filePath = typeof file === 'string' ? file : (file as { path?: string }).path;

            if (window.electronAPI && filePath) {
                // In Electron, call analyze first to get hash
                const result = await window.electronAPI.audio.analyze(filePath);
                if (result.status === 'success') {
                    id = result.hash;
                }
            }

            if (!id && typeof file !== 'string') {
                id = await fingerprintService.generateFingerprint(file);
            }

            if (!id) {
                throw new Error('Failed to generate audio fingerprint');
            }

            // 2. Check Cache
            const cachedAnalysis = await musicLibraryService.getAnalysisByHash(id);

            if (cachedAnalysis && cachedAnalysis.semantic) {
                Logger.info('AudioIntelligence', `Cache hit for ${filename}. Returning cached profile.`);
                return {
                    id,
                    technical: cachedAnalysis.features,
                    semantic: cachedAnalysis.semantic,
                    analyzedAt: new Date(cachedAnalysis.analyzedAt).getTime(),
                    modelVersion: INTELLIGENCE_MODELS.TEXT.AGENT
                };
            }

            // 3. Technical Analysis
            Logger.info('AudioIntelligence', 'Running technical analysis...');
            const analysisResult = await audioAnalysisService.analyze(file);
            const technical = analysisResult.features;
            const proxyBase64 = analysisResult.proxyBase64; // Extracted via Electron/FFmpeg

            // 4. Run Semantic & Energy Map Analysis in Parallel (Session 1 & Session 2)
            Logger.info('AudioIntelligence', 'Running semantic and energy map analysis in parallel...');

            let semanticPromise: Promise<AudioSemanticData>;
            let energyMapPromise: Promise<any>;

            const isOnline = navigator.onLine;
            if (!isOnline) {
                Logger.info('AudioIntelligence', 'Offline detected. Full semantic profile requires internet.');
                throw new Error('You are currently offline. Semantic musicology analysis requires an internet connection.');
            }

            if (proxyBase64) {
                Logger.info('AudioIntelligence', 'Online Electron detected. Running synthesis using compressed proxy MP3...');
                semanticPromise = this.analyzeSemanticWithProxy(proxyBase64, technical.bpm, technical.key);
                energyMapPromise = energyMapService.mapEmotionalArcWithProxy(proxyBase64, typeof file === 'string' ? 'audio/mp3' : file.type || 'audio/mp3', technical)
                    .catch(e => {
                        Logger.warn('AudioIntelligence', `EnergyMap failed (non-fatal): ${String(e)}`);
                        return undefined;
                    });
            } else {
                if (typeof file === 'string') {
                    throw new Error('Cannot run browser base64 audio upload with a file path string. Must be a File object.');
                }
                semanticPromise = this.analyzeSemantic(file, technical.bpm, technical.key);
                energyMapPromise = energyMapService.mapEmotionalArc(file, technical)
                    .catch(e => {
                        Logger.warn('AudioIntelligence', `EnergyMap failed (non-fatal): ${String(e)}`);
                        return undefined;
                    });
            }

            const [semantic, emotionalNarrative] = await Promise.all([semanticPromise, energyMapPromise]);

            // 5. Run Auto Copywriter & Style Comparison in Parallel (Session 4 & Session 5)
            Logger.info('AudioIntelligence', 'Running copywriter and style comparison in parallel...');

            const copywriterPromise = autoCopywriter.generateCopyPackage({
                trackTitle: filename,
                artistName: 'Unknown Artist', // In a real app this would be extracted from ID3 or user input
                semantic,
                emotionalNarrative
            }).catch(e => {
                Logger.warn('AudioIntelligence', `AutoCopywriter failed (non-fatal): ${String(e)}`);
                return undefined;
            });

            const stylePromise = styleMemoryStore.compareToDiscography(semantic, filename)
                .catch(e => {
                    Logger.warn('AudioIntelligence', `StyleComparison failed (non-fatal): ${String(e)}`);
                    return null;
                });

            const [marketingCopy, styleComparisonResult] = await Promise.all([copywriterPromise, stylePromise]);
            const styleComparison = styleComparisonResult ?? undefined;

            const profile: AudioIntelligenceProfile = {
                id,
                technical,
                semantic,
                emotionalNarrative,
                marketingCopy,
                styleComparison,
                analyzedAt: Date.now(),
                modelVersion: INTELLIGENCE_MODELS.TEXT.AGENT
            };

            // 8. Save to Firestore/Music Library Cache
            // (Note: We pass profile.semantic here for backward compatibility, but ideally we'd pass the whole profile or update MusicLibraryService)
            await musicLibraryService.saveAnalysis(id, filename, technical, id, semantic);

            // 9. Auto-register in Neural Cortex (non-blocking, fail-safe)
            //    Generates embeddings for targetPrompts and stores for visual drift detection.
            neuralCortex.ingest(profile, filename).catch((cortexErr) => {
                Logger.warn('AudioIntelligence', `Neural Cortex ingest failed (non-fatal): ${String(cortexErr)}`);
            });

            // 10. Auto-register in StyleMemoryStore (non-blocking, fail-safe)
            //    Records the stylistic markers for discography comparison.
            styleMemoryStore.recordTrack(id, filename, semantic).catch((styleErr) => {
                Logger.warn('AudioIntelligence', `StyleMemoryStore record failed (non-fatal): ${String(styleErr)}`);
            });

            return profile;
        });
    }

    /**
     * Converts a File/Blob to a base64-encoded string.
     * Used to send audio as inlineData to avoid the Gemini Files API
     * upload endpoint, which is CORS-blocked in browser environments.
     */
    private async fileToBase64(file: File | Blob): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                // Strip the "data:audio/...;base64," prefix — the SDK wants raw base64.
                const base64 = dataUrl.split(',')[1];
                if (!base64) {
                    reject(new Error('FileReader produced an empty base64 payload'));
                    return;
                }
                resolve(base64);
            };
            reader.onerror = () => reject(new Error('FileReader failed to read audio file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Uses Gemini to "listen" to the track and generate semantic metadata.
     *
     * ARCHITECTURE NOTE (2026-04-18):
     * Previously used the Gemini Files API (resumable upload → poll → delete) via
     * GeminiFileService.uploadFile(). That endpoint
     * (generativelanguage.googleapis.com/upload/v1beta/files) does NOT return
     * CORS headers, so every browser-based fetch was blocked with:
     *   "No 'Access-Control-Allow-Origin' header is present"
     *
     * The fix: convert the audio to base64 and send it as `inlineData` in the
     * generateContent request. The generateContent endpoint IS CORS-safe.
     * Trade-off: ~33% larger payload over the wire, but eliminates the
     * upload → poll → cleanup lifecycle and the CORS failure mode entirely.
     * For typical masters (5-10 MB), the base64 overhead is negligible.
     */
    private async analyzeSemantic(file: File, bpm: number, key: string): Promise<AudioSemanticData> {
        Logger.info('AudioIntelligence', 'Converting audio to base64 for inline Gemini analysis...');

        const mimeType = file.type || this.inferAudioMimeType(file.name);
        const base64Data = await this.fileToBase64(file);
        Logger.info('AudioIntelligence', `Audio converted: ${(base64Data.length * 0.75 / 1024 / 1024).toFixed(1)} MB original, sending as inlineData`);

        const systemPrompt = `
You are a world-class Musicologist, A&R Director, and Mastering Engineer with 20 years of experience at major labels.
PHYSICALLY LISTEN to this audio track. Every field below must be derived from what you ACTUALLY HEAR — not assumptions.

Technical Context (Do NOT override this with your assumptions):
- BPM: ${Math.round(bpm)}
- Key: ${key}

=== OUTPUT TARGETS ===

1. DDEX Industry Metadata:
   - 'ddexGenre': Exact primary genre (Hip-Hop, R&B, Electronic, Rock, Pop, Jazz, Country, etc.). Be precise — do NOT default.
   - 'ddexSubGenre': Exact sub-genre (Trap, Boom Bap, Nu-Soul, Ambient, etc.).
   - 'language': ISO 639-2 code ('eng', 'spa', etc.). Use 'zxx' if purely instrumental.
   - 'isExplicit': true if you can clearly hear explicit language.
   - 'marketingComment': Write 2-3 sentences of high-conversion DSP pitch copy (as if pitching to Spotify Editorial). Capture the emotional hook, reference points, and who this is for. Be specific — no generic phrases.

2. Sonic Soul — Timbre & Production Texture (Session 1 Calibration):
   - 'timbre.texture': The single most accurate descriptor of the sonic texture (e.g., "Analog Warmth", "Digital Quantization", "Gritty Lo-Fi", "Glassy & Clean", "Saturated Tape").
   - 'timbre.brightness': High-frequency character (e.g., "Dark & Muddy", "Crisp & Airy", "Harsh & Bright", "Midrange-Heavy").
   - 'timbre.saturation': Dynamic range / compression character (e.g., "Heavily Brick-Walled", "Lightly Compressed", "Punchy with Headroom", "Dynamic & Unprocessed").
   - 'timbre.spaceDepth': Reverb/stereo field (e.g., "Cavernous Hall Reverb", "Dry & Intimate", "Wide Stereo Field", "Mono Club Sound").
   - 'productionValue.era': What era does the production most accurately evoke? (e.g., "Late 90s Boom Bap", "2010s Trap", "Modern Hyperpop", "70s Soul", "80s Synthwave").
   - 'productionValue.quality': Production tier (e.g., "Bedroom Producer", "Independent Pro Studio", "Major Label Mastered", "Lo-Fi Aesthetic — Intentional").
   - 'productionValue.mixBalance': Dominant frequency/element focus (e.g., "Bass-Forward", "Vocal-Forward", "Balanced", "Mid-Heavy", "High-End Shimmer").
   - 'productionValue.aiArtifacts': true if you detect unnatural quantization, robotic phrasing, or clear signs of Intelligence-generated audio. This is a GOAL 3 COMPLIANCE check.

3. Creative Direction (For Visual Agents):
   - 'visualImagery.abstract': Abstract visual for a motion visualizer.
   - 'visualImagery.narrative': Scene description for stock footage or Intelligence video generation.
   - 'visualImagery.lighting': Specific lighting (e.g., "Red neon backlight through rain-soaked glass").
   - 'targetPrompts.image': A render-ready prompt for Gemini Image 3.1 that captures this song's visual soul.
   - 'targetPrompts.veo': A scene-ready prompt for Veo 3.1 with camera movement and atmosphere.

CRITICAL RULES:
- If it's dark, tag it dark. If it's happy, tag it happy. Do NOT hallucinate tone.
- Do NOT produce generic output. Every field must be specific to THIS track.
- 'aiArtifacts' must be based on audio evidence, not assumption.
`;

        const response = await AutonomousIntelligence.generateStructuredData<AudioSemanticData>(
            [
                { text: systemPrompt },
                {
                    inlineData: {
                        mimeType,
                        data: base64Data
                    }
                }
            ],
            SEMANTIC_SCHEMA,
            8192, // Maps to thinkingLevel: 'HIGH' for Gemini 3.x (deep musicology analysis)
            "You are an expert musicologist and audio analyst.",
            INTELLIGENCE_MODELS.TEXT.AGENT // Explicitly require Gemini 3 Pro
        );
        return response;
    }


    /**
     * Infers MIME type from file extension when file.type is empty.
     * Prevents mislabeling WAV/FLAC/M4A files as audio/mpeg.
     */
    private inferAudioMimeType(fileName: string): string {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const mimeByExtension: Record<string, string> = {
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            flac: 'audio/flac',
            m4a: 'audio/mp4',
            aac: 'audio/aac',
            ogg: 'audio/ogg',
            aiff: 'audio/aiff',
            alac: 'audio/mp4',
        };

        return mimeByExtension[ext ?? ''] ?? 'application/octet-stream';
    }

    private async analyzeSemanticWithProxy(
        proxyBase64: string,
        bpm: number,
        key: string
    ): Promise<AudioSemanticData> {
        Logger.info('AudioIntelligence', `Sending FFmpeg proxy to Gemini...`);

        const systemPrompt = `
You are a world-class Musicologist, A&R Director, and Mastering Engineer with 20 years of experience at major labels.
PHYSICALLY LISTEN to this audio track proxy. Every field below must be derived from what you ACTUALLY HEAR — not assumptions.

Technical Context (Do NOT override this with your assumptions):
- BPM: ${Math.round(bpm)}
- Key: ${key}

=== OUTPUT TARGETS ===

1. DDEX Industry Metadata:
   - 'ddexGenre': Exact primary genre (Hip-Hop, R&B, Electronic, Rock, Pop, Jazz, Country, etc.). Be precise — do NOT default.
   - 'ddexSubGenre': Exact sub-genre (Trap, Boom Bap, Nu-Soul, Ambient, etc.).
   - 'language': ISO 639-2 code ('eng', 'spa', etc.). Use 'zxx' if purely instrumental.
   - 'isExplicit': true if you can clearly hear explicit language.
   - 'marketingComment': Write 2-3 sentences of high-conversion DSP pitch copy (as if pitching to Spotify Editorial). Capture the emotional hook, reference points, and who this is for. Be specific — no generic phrases.

2. Sonic Soul — Timbre & Production Texture:
   - 'timbre.texture': The single most accurate descriptor of the sonic texture (e.g., "Analog Warmth", "Digital Quantization", "Gritty Lo-Fi", "Glassy & Clean", "Saturated Tape").
   - 'timbre.brightness': High-frequency character (e.g., "Dark & Muddy", "Crisp & Airy", "Harsh & Bright", "Midrange-Heavy").
   - 'timbre.saturation': Dynamic range / compression character (e.g., "Heavily Brick-Walled", "Lightly Compressed", "Punchy with Headroom", "Dynamic & Unprocessed").
   - 'timbre.spaceDepth': Reverb/stereo field (e.g., "Cavernous Hall Reverb", "Dry & Intimate", "Wide Stereo Field", "Mono Club Sound").
   - 'productionValue.era': What era does the production most accurately evoke? (e.g., "Late 90s Boom Bap", "2010s Trap", "Modern Hyperpop", "70s Soul", "80s Synthwave").
   - 'productionValue.quality': Production tier (e.g., "Bedroom Producer", "Independent Pro Studio", "Major Label Mastered", "Lo-Fi Aesthetic — Intentional").
   - 'productionValue.mixBalance': Dominant frequency/element focus (e.g., "Bass-Forward", "Vocal-Forward", "Balanced", "Mid-Heavy", "High-End Shimmer").
   - 'productionValue.aiArtifacts': true if you detect unnatural quantization, robotic phrasing, or clear signs of Intelligence-generated audio. This is a GOAL 3 COMPLIANCE check.

3. Creative Direction (For Visual Agents):
   - 'visualImagery.abstract': Abstract visual for a motion visualizer.
   - 'visualImagery.narrative': Scene description for stock footage or Intelligence video generation.
   - 'visualImagery.lighting': Specific lighting (e.g., "Red neon backlight through rain-soaked glass").
   - 'targetPrompts.image': A render-ready prompt for Gemini Image 3.1 that captures this song's visual soul.
   - 'targetPrompts.veo': A scene-ready prompt for Veo 3.1 with camera movement and atmosphere.

CRITICAL RULES:
- If it's dark, tag it dark. If it's happy, tag it happy. Do NOT hallucinate tone.
- Do NOT produce generic output. Every field must be specific to THIS track.
- 'aiArtifacts' must be based on audio evidence, not assumption.
`;

        const response = await AutonomousIntelligence.generateStructuredData<AudioSemanticData>(
            [
                { text: systemPrompt },
                {
                    inlineData: {
                        mimeType: 'audio/mpeg', // Proxy is always MP3
                        data: proxyBase64
                    }
                }
            ],
            SEMANTIC_SCHEMA,
            8192,
            "You are an expert musicologist and audio analyst.",
            INTELLIGENCE_MODELS.TEXT.AGENT
        );
        return response;
    }
}

export const audioIntelligence = new AudioIntelligenceService();

if (typeof window !== 'undefined' && import.meta.env.DEV) {
    window.audioIntelligence = audioIntelligence;
}
