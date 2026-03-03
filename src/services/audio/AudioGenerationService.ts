/**
 * AudioGenerationService
 * 
 * Handles AI-powered audio generation including:
 * - SoundFX synthesis (short sound effects from text prompts)
 * - Music generation (instrumental tracks with genre/mood/tempo controls)
 * - Text-to-Speech (voice synthesis via gemini-2.5-pro-preview-tts)
 * 
 * Uses the Gemini API via FirebaseAIService for all generation tasks.
 */
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { CloudStorageService } from '@/services/CloudStorageService';
import { auth } from '@/services/firebase';
import { useStore } from '@/core/store';
import { audioAnalysisService } from '@/services/audio/AudioAnalysisService';
import { audioPersistenceService } from '@/services/audio/AudioPersistenceService';

// ============================================================================
// Types
// ============================================================================

export type AudioGenerationType = 'soundfx' | 'music' | 'tts';

export interface SoundFXOptions {
    prompt: string;
    durationSeconds?: number; // 1-30 seconds
    analyze?: boolean;
}

export interface MusicGenerationOptions {
    prompt: string;
    genre?: string;
    mood?: string;
    tempo?: 'slow' | 'medium' | 'fast';
    durationSeconds?: number; // 15-60 seconds
    instruments?: string[];
    key?: string;
    analyze?: boolean;
}

export interface TTSOptions {
    text: string;
    voicePreset?: TTSVoicePreset;
    language?: string;
    speed?: number; // 0.5 - 2.0
    analyze?: boolean;
}

export type TTSVoicePreset =
    | 'Puck'    // Upbeat male
    | 'Charon'  // Deep male  
    | 'Kore'    // Warm female
    | 'Fenrir'  // Authoritative male
    | 'Aoede'   // Bright female
    | 'Leda'    // Calm female
    | 'Orus'    // Firm male
    | 'Zephyr'; // Breezy neutral

export const TTS_VOICE_PRESETS: { id: TTSVoicePreset; label: string; description: string }[] = [
    { id: 'Puck', label: 'Puck', description: 'Upbeat, youthful male voice' },
    { id: 'Charon', label: 'Charon', description: 'Deep, resonant male voice' },
    { id: 'Kore', label: 'Kore', description: 'Warm, friendly female voice' },
    { id: 'Fenrir', label: 'Fenrir', description: 'Authoritative, steady male voice' },
    { id: 'Aoede', label: 'Aoede', description: 'Bright, energetic female voice' },
    { id: 'Leda', label: 'Leda', description: 'Calm, soothing female voice' },
    { id: 'Orus', label: 'Orus', description: 'Firm, clear male voice' },
    { id: 'Zephyr', label: 'Zephyr', description: 'Breezy, neutral voice' },
];

export interface AudioGenerationResult {
    id: string;
    audioData: string;       // base64-encoded audio (local preview)
    mimeType: string;        // audio/wav, audio/mp3, etc.
    durationSeconds: number;
    type: AudioGenerationType;
    prompt: string;
    dataUri: string;         // Full playable data URI
    storageUrl?: string;     // Cloud URL
    metadata: Record<string, unknown>;
    bpm?: number;            // Analyzed BPM
    key?: string;            // Analyzed Key
}

// ============================================================================
// Service
// ============================================================================

class AudioGenerationService {

    /**
     * Generate a sound effect from a text prompt.
     */
    async generateSoundFX(options: SoundFXOptions): Promise<AudioGenerationResult> {
        const { prompt, durationSeconds = 5, analyze = false } = options;

        console.log('[AudioGen] Generating SoundFX:', prompt);

        const systemInstruction = [
            'You are a professional sound design AI.',
            'Generate a high-quality sound effect based on the user\'s description.',
            `Target duration: approximately ${durationSeconds} seconds.`,
            'Output ONLY the audio. Do not include any text response.',
            'Make the sound effect crisp, clean, and production-ready.',
        ].join('\n');

        const result = await firebaseAI.rawGenerateContent(
            prompt,
            AI_MODELS.AUDIO.TTS,
            {
                responseModalities: ['AUDIO'] as unknown as undefined,
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: 'Puck'
                        }
                    }
                }
            } as Record<string, unknown>,
            systemInstruction
        );

        return this.processAudioResult(result, 'soundfx', prompt, {
            durationTarget: durationSeconds,
        }, analyze);
    }

    /**
     * Generate an instrumental music track.
     */
    async generateMusic(options: MusicGenerationOptions): Promise<AudioGenerationResult> {
        const {
            prompt,
            genre = 'Electronic',
            mood = 'Energetic',
            tempo = 'medium',
            durationSeconds = 30,
            instruments = [],
            key,
            analyze = false,
        } = options;

        console.log('[AudioGen] Generating Music:', { prompt, genre, mood, tempo });

        const tempoMap = { slow: '60-80 BPM', medium: '100-120 BPM', fast: '140-170 BPM' };

        const fullPrompt = [
            `Generate an instrumental ${genre} music track.`,
            `Mood: ${mood}.`,
            `Tempo: ${tempoMap[tempo]}.`,
            instruments.length > 0 ? `Instruments: ${instruments.join(', ')}.` : '',
            key ? `Musical key: ${key}.` : '',
            `Duration: approximately ${durationSeconds} seconds.`,
            `Additional direction: ${prompt}`,
        ].filter(Boolean).join('\n');

        const systemInstruction = [
            'You are a professional music producer AI.',
            'Generate a high-quality instrumental music track based on the specifications.',
            'Output ONLY the audio. Do not include any text.',
            'Ensure the track has a clear structure with intro, body, and outro.',
            'Make it sound professional and production-ready.',
        ].join('\n');

        const result = await firebaseAI.rawGenerateContent(
            fullPrompt,
            AI_MODELS.AUDIO.TTS,
            {
                responseModalities: ['AUDIO'] as unknown as undefined,
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: 'Puck'
                        }
                    }
                }
            } as Record<string, unknown>,
            systemInstruction
        );

        return this.processAudioResult(result, 'music', prompt, {
            genre,
            mood,
            tempo,
            durationTarget: durationSeconds,
            instruments,
            key,
        }, analyze);
    }

    /**
     * Generate speech from text using Gemini TTS.
     */
    async generateTTS(options: TTSOptions): Promise<AudioGenerationResult> {
        const {
            text,
            voicePreset = 'Kore',
            language = 'en',
            speed = 1.0,
            analyze = false,
        } = options;

        console.log('[AudioGen] Generating TTS:', { voicePreset, language, textLength: text.length });

        const systemInstruction = [
            'You are a professional voice-over artist.',
            `Speak in ${language} with a natural, expressive tone.`,
            speed !== 1.0 ? `Adjust speaking pace to ${speed}x normal speed.` : '',
            'Deliver the text clearly and professionally.',
            'Output ONLY the audio speech. Do not add any extra sounds or music.',
        ].filter(Boolean).join('\n');

        const result = await firebaseAI.rawGenerateContent(
            `Please read the following text aloud:\n\n${text}`,
            AI_MODELS.AUDIO.TTS,
            {
                responseModalities: ['AUDIO'] as unknown as undefined,
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: voicePreset
                        }
                    }
                }
            } as Record<string, unknown>,
            systemInstruction
        );

        return this.processAudioResult(result, 'tts', text.substring(0, 100), {
            voicePreset,
            language,
            speed,
            fullText: text,
        }, analyze);
    }

    // ========================================================================
    // Private Helpers
    // ========================================================================

    /**
     * Process a raw Gemini response into an AudioGenerationResult.
     */
    private async processAudioResult(
        result: { response: { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> } },
        type: AudioGenerationType,
        prompt: string,
        metadata: Record<string, unknown>,
        shouldAnalyze: boolean = false
    ): Promise<AudioGenerationResult> {
        const candidates = result.response?.candidates;
        if (!candidates || candidates.length === 0) {
            throw new Error('[AudioGen] No audio generated — empty response from model.');
        }

        const parts = candidates[0]?.content?.parts;
        if (!parts || parts.length === 0) {
            throw new Error('[AudioGen] No audio parts in response.');
        }

        const audioPart = parts.find(p => p.inlineData?.mimeType?.startsWith('audio/'));
        if (!audioPart?.inlineData?.data) {
            throw new Error('[AudioGen] No audio data found in response parts.');
        }

        const mimeType = audioPart.inlineData.mimeType || 'audio/wav';
        const audioData = audioPart.inlineData.data; // base64
        const dataUri = `data:${mimeType};base64,${audioData}`;
        const id = crypto.randomUUID();
        const userId = auth.currentUser?.uid;

        // Estimate duration
        const rawBytes = (audioData.length * 3) / 4;
        const estimatedDuration = Math.max(1, Math.round(rawBytes / 176400));

        let storageUrl: string | undefined;
        let analysisResults: Record<string, unknown> = {};

        // 1. Persist to Cloud Storage
        if (userId) {
            try {
                storageUrl = await CloudStorageService.uploadAudio(dataUri, id, userId, mimeType);
            } catch (err) {
                console.warn('[AudioGen] Cloud upload failed, will fallback to local storage only:', err);
            }
        }

        // 2. Optional Analysis
        if (shouldAnalyze) {
            try {
                const blob = await CloudStorageService.dataURItoBlob(dataUri);
                const file = new File([blob], `${id}.wav`, { type: mimeType });
                const analysis = await audioAnalysisService.analyzeDeep(file);
                analysisResults = {
                    bpm: analysis.features.bpm,
                    key: analysis.features.key,
                    energy: analysis.features.energy,
                    loudness: analysis.features.loudness,
                };
            } catch (err) {
                console.warn('[AudioGen] Audio analysis failed:', err);
            }
        }

        const finalMetadata = {
            id,
            userId: userId || 'anonymous',
            type,
            prompt,
            mimeType,
            estimatedDuration,
            storageUrl,
            generatedAt: new Date().toISOString(),
            ...metadata,
            ...analysisResults,
        };

        // 3. Persist to Firestore
        try {
            await audioPersistenceService.saveAudioMetadata(finalMetadata as any);
            const store = useStore.getState();
            store.addGeneratedAsset(finalMetadata as any);
        } catch (err) {
            console.warn('[AudioGen] Failed to update persistence/store:', err);
        }

        return {
            id,
            audioData,
            mimeType,
            durationSeconds: estimatedDuration,
            type,
            prompt,
            dataUri,
            storageUrl,
            metadata: finalMetadata,
            bpm: analysisResults.bpm as number,
            key: analysisResults.key as string,
        };
    }
}

export const audioGenerationService = new AudioGenerationService();
