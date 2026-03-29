import { audioAnalysisService } from './AudioAnalysisService';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AudioIntelligenceProfile, AudioSemanticData } from './types';
import { Schema } from 'firebase/ai';
import { fingerprintService } from './FingerprintService';
import { AI_MODELS } from '@/core/config/ai-models';
import { musicLibraryService } from '@/services/music/MusicLibraryService';
import { neuralCortex } from '@/services/ai/NeuralCortexService';
import { Logger } from '@/core/logger/Logger';
import { withServiceError } from '@/lib/errors';

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
     * 2. Semantic (Gemini 3 Pro - AI_MODELS.TEXT.AGENT)
     */
    async analyze(file: File): Promise<AudioIntelligenceProfile> {
        return withServiceError('AudioIntelligence', 'analyze', async () => {
            Logger.info('AudioIntelligence', `Starting analysis for ${file.name}`);

            // 1. Generate ID (Fingerprint)
            const id = await fingerprintService.generateFingerprint(file);
            if (!id) {
                throw new Error('Failed to generate audio fingerprint');
            }

            // 2. Check Cache
            const cachedAnalysis = await musicLibraryService.getAnalysisByHash(id);

            if (cachedAnalysis && cachedAnalysis.semantic) {
                Logger.info('AudioIntelligence', `Cache hit for ${file.name}. Returning cached profile.`);
                return {
                    id,
                    technical: cachedAnalysis.features,
                    semantic: cachedAnalysis.semantic,
                    analyzedAt: new Date(cachedAnalysis.analyzedAt).getTime(),
                    modelVersion: AI_MODELS.TEXT.AGENT
                };
            }

            // 3. Technical Analysis (Cache miss or partial hit)

            // 2. Run Technical Analysis (Parallelizable but fast enough to await)
            Logger.info('AudioIntelligence', 'Running technical analysis...');
            const analysisResult = await audioAnalysisService.analyze(file);
            const technical = analysisResult.features;

            // 3. Run Semantic Analysis
            Logger.info('AudioIntelligence', 'Running semantic analysis...');
            const semantic = await this.analyzeSemantic(file, technical.bpm, technical.key);

            const profile: AudioIntelligenceProfile = {
                id,
                technical,
                semantic,
                analyzedAt: Date.now(),
                modelVersion: AI_MODELS.TEXT.AGENT
            };

            // 5. Save to Firestore/Music Library Cache
            await musicLibraryService.saveAnalysis(id, file.name, technical, id, semantic);

            // 6. Auto-register in Neural Cortex (non-blocking, fail-safe)
            //    Generates embeddings for targetPrompts and stores for visual drift detection.
            neuralCortex.ingest(profile, file.name).catch((cortexErr) => {
                Logger.warn('AudioIntelligence', `Neural Cortex ingest failed (non-fatal): ${String(cortexErr)}`);
            });

            return profile;
        });
    }

    /**
     * Uses Gemini to "listen" to the track and generate semantic metadata.
     */
    private async analyzeSemantic(file: File, bpm: number, key: string): Promise<AudioSemanticData> {
        // Convert file to base64 for Gemini
        const base64Audio = await this.fileToBase64(file);

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
   - 'productionValue.aiArtifacts': true if you detect unnatural quantization, robotic phrasing, or clear signs of AI-generated audio. This is a GOAL 3 COMPLIANCE check.

3. Creative Direction (For Visual Agents):
   - 'visualImagery.abstract': Abstract visual for a motion visualizer.
   - 'visualImagery.narrative': Scene description for stock footage or AI video generation.
   - 'visualImagery.lighting': Specific lighting (e.g., "Red neon backlight through rain-soaked glass").
   - 'targetPrompts.image': A render-ready prompt for Gemini Image 3.1 that captures this song's visual soul.
   - 'targetPrompts.veo': A scene-ready prompt for Veo 3.1 with camera movement and atmosphere.

CRITICAL RULES:
- If it's dark, tag it dark. If it's happy, tag it happy. Do NOT hallucinate tone.
- Do NOT produce generic output. Every field must be specific to THIS track.
- 'aiArtifacts' must be based on audio evidence, not assumption.
`;

        const response = await firebaseAI.generateStructuredData<AudioSemanticData>(
            [
                { text: systemPrompt },
                {
                    inlineData: {
                        mimeType: file.type || 'audio/mp3',
                        data: base64Audio
                    }
                }
            ],
            SEMANTIC_SCHEMA,
            8192, // Maps to thinkingLevel: 'HIGH' for Gemini 3.x (deep musicology analysis)
            "You are an expert musicologist and audio analyst.",
            AI_MODELS.TEXT.AGENT // Explicitly require Gemini 3 Pro
        );

        return response;
    }

    private fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                // Remove data URL prefix (e.g., "data:audio/mp3;base64,")
                const base64 = result.split(',')[1]!;
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }
}

export const audioIntelligence = new AudioIntelligenceService();

if (typeof window !== 'undefined' && import.meta.env.DEV) {
    window.audioIntelligence = audioIntelligence;
}
