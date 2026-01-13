import { audioAnalysisService } from './AudioAnalysisService';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AudioIntelligenceProfile, AudioSemanticData } from './types';
import { Schema } from 'firebase/ai';
import { fingerprintService } from './FingerprintService';
import { AI_MODELS } from '@/core/config/ai-models';

const SEMANTIC_SCHEMA: Schema = {
    type: 'OBJECT' as const, // Cast to const to satisfy strict typing
    properties: {
        mood: { type: 'ARRAY', items: { type: 'STRING' } },
        genre: { type: 'ARRAY', items: { type: 'STRING' } },
        instruments: { type: 'ARRAY', items: { type: 'STRING' } },
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
                imagen: { type: 'STRING' },
                veo: { type: 'STRING' }
            },
            required: ['imagen', 'veo']
        }
    },
    required: ['mood', 'genre', 'instruments', 'visualImagery', 'marketingHooks', 'targetPrompts']
} as unknown as Schema; // Cast to unknown then Schema to bypass deep type strictness if needed

export class AudioIntelligenceService {

    /**
     * Orchestrates full audio analysis:
     * 1. Technical (local WASM)
     * 2. Semantic (Gemini 1.5 Pro)
     */
    async analyze(file: File): Promise<AudioIntelligenceProfile> {
        console.log(`[AudioIntelligence] Starting analysis for ${file.name}`);

        // 1. Generate ID (Fingerprint)
        const id = await fingerprintService.generateFingerprint(file);
        if (!id) {
            throw new Error('Failed to generate audio fingerprint');
        }

        // TODO: Check cache here

        // 2. Run Technical Analysis (Parallelizable but fast enough to await)
        console.log('[AudioIntelligence] Running technical analysis...');
        const technical = await audioAnalysisService.analyze(file);

        // 3. Run Semantic Analysis
        console.log('[AudioIntelligence] Running semantic analysis...');
        const semantic = await this.analyzeSemantic(file, technical.bpm, technical.key);

        const profile: AudioIntelligenceProfile = {
            id,
            technical,
            semantic,
            analyzedAt: Date.now(),
            modelVersion: AI_MODELS.TEXT.AGENT
        };

        // TODO: Save to cache here

        return profile;
    }

    /**
     * Uses Gemini to "listen" to the track and generate semantic metadata.
     */
    private async analyzeSemantic(file: File, bpm: number, key: string): Promise<AudioSemanticData> {
        // Convert file to base64 for Gemini
        const base64Audio = await this.fileToBase64(file);

        const systemPrompt = `
You are an expert Creative Director and Audio Engineer. 
Your task is to listen to this audio track and generate structured metadata to drive AI art and video generation.

Technical Context (Use these to inform your vibe):
- BPM: ${bpm}
- Key: ${key}

Output Targets:
1. 'targetPrompts.imagen': A visual prompt optimized for Google Imagen 3. Focus on lighting, texture, and composition.
2. 'targetPrompts.veo': A video prompt optimized for Google Veo. Focus on motion, camera movement, and atmosphere.

Describe the audio's "Visual Vibe" — if this song was a scene in a movie, what would it look like?
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
            undefined, // No thinking budget for standard analysis
            "You are an expert audio analyst."
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
