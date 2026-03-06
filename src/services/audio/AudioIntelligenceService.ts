import { audioAnalysisService } from './AudioAnalysisService';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AudioIntelligenceProfile, AudioSemanticData } from './types';
import { Schema } from 'firebase/ai';
import { fingerprintService } from './FingerprintService';
import { AI_MODELS } from '@/core/config/ai-models';
import { musicLibraryService } from '@/services/music/MusicLibraryService'; // Import library service
import { Logger } from '@/core/logger/Logger';
import { withServiceError } from '@/lib/errors';

const SEMANTIC_SCHEMA: Schema = {
    type: 'OBJECT' as const, // Cast to const to satisfy strict typing
    properties: {
        mood: { type: 'ARRAY', items: { type: 'STRING' } },
        genre: { type: 'ARRAY', items: { type: 'STRING' } },
        instruments: { type: 'ARRAY', items: { type: 'STRING' } },
        ddexGenre: { type: 'STRING' },
        ddexSubGenre: { type: 'STRING' },
        language: { type: 'STRING' },
        isExplicit: { type: 'BOOLEAN' },
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
    required: ['mood', 'genre', 'instruments', 'ddexGenre', 'ddexSubGenre', 'language', 'isExplicit', 'visualImagery', 'marketingHooks', 'targetPrompts']
} as unknown as Schema; // Cast to unknown then Schema to bypass deep type strictness if needed

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

            // 5. Save to Cache
            await musicLibraryService.saveAnalysis(id, file.name, technical, id, semantic);

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
You are a world-class Musicologist, A&R Director, and Audio Engineer. 
Your primary task is to physically LISTEN to this audio track and generate highly accurate, structured metadata for music industry distribution (DDEX) and creative expression agents.

Technical Context (Do NOT ignore this):
- BPM: ${Math.round(bpm)}
- Key: ${key}

Output Targets:
1. DDEX Metadata (Industry Standard):
   - 'ddexGenre': Choose the exact primary genre (e.g., Rock, Hip-Hop, R&B, Electronic, Country, Pop, Jazz). Be extremely precise. DO NOT default to a genre.
   - 'ddexSubGenre': Choose the exact sub-genre (e.g., Grunge, Nu-Metal, Trap, Ambient).
   - 'language': The ISO 639-2 code for the language of performance (e.g., 'eng', 'spa'). Use 'zxx' if purely instrumental.
   - 'isExplicit': True if the lyrics contain explicit content, False otherwise.

2. Creative Direction (For Agents):
   - 'targetPrompts.image': A highly visual rendering prompt optimized for Google Gemini Image 3.1. What does this song LOOK like? Focus on lighting, texture, and cinematic composition matching the exact emotional vibe of the song.
   - 'targetPrompts.veo': A video prompt optimized for Google Veo. What camera movement, atmosphere, and narrative perfectly fit the timbre and genre?

Listen deeply to the instrumentation, vocal delivery, and mix. If it is aggressive, tag it aggressive. If it is sad, tag it sad. Do NOT hallucinate happiness if the tone is dark.
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
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }
}

export const audioIntelligence = new AudioIntelligenceService();

if (typeof window !== 'undefined' && import.meta.env.DEV) {
    (window as any).audioIntelligence = audioIntelligence;
}
