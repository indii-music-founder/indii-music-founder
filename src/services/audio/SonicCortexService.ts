import { AI } from '@/services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { logger } from '@/utils/logger';
import { AppException, AppErrorCode } from '@/shared/types/errors';

export interface SonicDescription {
    timbre: string;
    mood: string;
    productionStyle: string;
    melodicMotifs: string[];
    emotionalTrajectory: string;
    aiArtifactProbability: number; // 0 to 1
    aiArtifactNotes?: string;
    suggestedMarketingCopy: string;
    suggestedKeywords: string[];
}

/**
 * SonicCortexService
 * Bridges the "Soul DNA" (Fingerprint) with "Sonic Reasoning" (Gemini 3 Pro).
 * Teaching the machine how to hear and feel the music.
 */
export class SonicCortexService {
    /**
     * Analyzes audio via Gemini 3 Pro multimodal modality.
     * @param audioBase64 Base64 encoded audio data
     * @param mimeType Mime type of the audio (e.g., 'audio/mpeg', 'audio/wav')
     */
    async describeSoul(audioBase64: string, mimeType: string = 'audio/mpeg'): Promise<SonicDescription | null> {
        try {
            logger.info('[SonicCortex] Initiating Deep Sonic Reasoning via Gemini 3 Pro...');

            const systemInstruction = `You are a world-class musicologist and production analyst. 
            You are part of the indiiOS "Sonic Cortex" engine. Your mission is to describe the "Soul" of the music.
            Analyze the provided audio for timbre, emotional trajectory, production style, and melodic motifs.
            Also, perform a forensic audit for AI-generated artifacts or hallucinations.`;

            const prompt = `Please provide a deep analysis of this track. 
            Focus on the emotional impact, the analog vs digital characteristics of the mix, 
            and specifically flag any sonic textures that suggest AI generation.
            
            Return the result in the following JSON format:
            {
                "timbre": "description of the sound quality",
                "mood": "overall mood",
                "productionStyle": "details on mix/mastering style",
                "melodicMotifs": ["motif 1", "motif 2"],
                "emotionalTrajectory": "how the feeling shifts throughout",
                "aiArtifactProbability": 0.0,
                "aiArtifactNotes": "forensic notes on AI textures",
                "suggestedMarketingCopy": "a punchy description for DSPs",
                "suggestedKeywords": ["keyword1", "keyword2"]
            }`;

            // Create multimodal content part for audio
            // Strip data URL prefix if present (Gemini expects raw base64)
            const base64Data = audioBase64.includes('base64,') ? audioBase64.split('base64,')[1] : audioBase64;

            const audioPart = {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            };

            const response = await AI.generateContent({
                contents: [{ role: 'user', parts: [audioPart, { text: prompt }] }],
                model: AI_MODELS.TEXT.AGENT, // Ensure this maps to Gemini 3 Pro
                systemInstruction,
                config: {
                    responseMimeType: 'application/json',
                    mediaResolution: 'MEDIA_RESOLUTION_HIGH' // Fix: Correct enum casing
                } as any
            });

            const text = response.text();
            if (!text) throw new Error('Empty response from Sonic Cortex');

            return AI.parseJSON<SonicDescription>(text) as SonicDescription;

        } catch (error) {
            logger.error('[SonicCortex] Reasoning Failure:', error);
            return null;
        }
    }
}

export const sonicCortexService = new SonicCortexService();
