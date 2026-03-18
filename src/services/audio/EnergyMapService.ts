/**
 * EnergyMapService — Brain Calibration Session 2: The Emotional Narrative
 *
 * Maps the emotional trajectory of a track across time.
 * Goal: Can indii identify where the "Soul" peaks in a 4-minute journey?
 *
 * Takes audio segments (from AudioAnalysisService) + the full audio file,
 * then uses Gemini to produce a time-stamped emotional arc with tension peaks,
 * release moments, and narrative phase labels.
 */
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { Schema } from 'firebase/ai';
import { Logger } from '@/core/logger/Logger';
import { withServiceError } from '@/lib/errors';
import type { AudioFeatures } from './AudioAnalysisService';

export interface EmotionalBeat {
    /** Timestamp in seconds where this emotional beat occurs */
    timestamp: number;
    /** Normalized energy at this moment (0.0–1.0) */
    energy: number;
    /** Human-readable phase label (e.g., "Intro", "Build", "Drop", "Breakdown", "Outro") */
    phase: string;
    /** Core emotion at this beat (e.g., "Tension", "Release", "Euphoria", "Grief", "Resolve") */
    emotion: string;
    /** One-sentence description of what's happening sonically */
    sonicNote: string;
}

export interface EmotionalNarrative {
    /** Ordered emotional beats across the track */
    arc: EmotionalBeat[];
    /** Index of the arc entry where the soul peaks (highest combined emotional + sonic intensity) */
    soulPeakIndex: number;
    /** Overall trajectory shape */
    trajectoryShape: 'Gradual Build' | 'Explosive Open' | 'Rollercoaster' | 'Slow Burn' | 'Plateau' | 'Declining';
    /** What makes this track emotionally distinct */
    emotionalSignature: string;
    /** Tension-to-release ratio (0 = all release, 1 = all tension) */
    tensionRatio: number;
}

const ENERGY_MAP_SCHEMA: Schema = {
    type: 'OBJECT' as const,
    properties: {
        arc: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    timestamp: { type: 'NUMBER' },
                    energy: { type: 'NUMBER' },
                    phase: { type: 'STRING' },
                    emotion: { type: 'STRING' },
                    sonicNote: { type: 'STRING' }
                },
                required: ['timestamp', 'energy', 'phase', 'emotion', 'sonicNote']
            }
        },
        soulPeakIndex: { type: 'NUMBER' },
        trajectoryShape: { type: 'STRING' },
        emotionalSignature: { type: 'STRING' },
        tensionRatio: { type: 'NUMBER' }
    },
    required: ['arc', 'soulPeakIndex', 'trajectoryShape', 'emotionalSignature', 'tensionRatio']
} as unknown as Schema;

export class EnergyMapService {
    /**
     * Generates a full emotional arc map for an audio file.
     * Combines local segment data with Gemini's deep listening.
     */
    async mapEmotionalArc(
        file: File,
        technicalFeatures: AudioFeatures
    ): Promise<EmotionalNarrative> {
        return withServiceError('EnergyMap', 'mapEmotionalArc', async () => {
            Logger.info('EnergyMap', `Mapping emotional arc for ${file.name}`);

            const base64Audio = await this.fileToBase64(file);
            const duration = technicalFeatures.duration;
            const segmentContext = this.formatSegments(technicalFeatures.segments);

            const prompt = `
You are a master music therapist and narrative composer.
LISTEN to this track from start to finish — ${Math.round(duration)}s total — and map its emotional journey.

Technical Context:
- BPM: ${Math.round(technicalFeatures.bpm)}
- Key: ${technicalFeatures.key} ${technicalFeatures.scale}
- Overall Energy: ${(technicalFeatures.energy * 100).toFixed(0)}%
- Danceability: ${(technicalFeatures.danceability * 100).toFixed(0)}%
${segmentContext ? `- Detected Segments (local analysis): ${segmentContext}` : ''}

=== YOUR TASK ===

Produce an 'arc' of 6–12 EmotionalBeats that capture the track's journey.
Each beat needs a timestamp (in seconds from 0 to ${Math.round(duration)}),
a normalized energy (0.0–1.0), a phase label, an emotion, and a sonic note.

Then identify:
- 'soulPeakIndex': Which arc index holds the highest combined emotional intensity?
  This is where the track HITS. Trust the audio, not the math.
- 'trajectoryShape': The macro shape of the emotional journey.
- 'emotionalSignature': What makes THIS track's emotional arc unique in 1–2 sentences?
- 'tensionRatio': Float from 0.0 (pure release/joy) to 1.0 (pure tension/darkness).

RULES:
- Do not cluster all beats in the first 30 seconds. Spread them across the full duration.
- Timestamps must be strictly ascending.
- 'soulPeakIndex' must be a valid index into the 'arc' array.
- Listen for dynamics — a quiet moment AFTER a peak is emotionally significant.
- If the track doesn't peak emotionally, say so via trajectoryShape = 'Plateau'.
`;

            const narrative = await firebaseAI.generateStructuredData<EmotionalNarrative>(
                [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: file.type || 'audio/mp3',
                            data: base64Audio
                        }
                    }
                ],
                ENERGY_MAP_SCHEMA,
                4096,
                'You are an expert in music emotion analysis and narrative arc mapping.',
                AI_MODELS.TEXT.AGENT
            );

            Logger.info('EnergyMap', `Arc mapped: ${narrative.arc.length} beats, soul peak at index ${narrative.soulPeakIndex}, shape: ${narrative.trajectoryShape}`);
            return narrative;
        });
    }

    private formatSegments(segments?: AudioFeatures['segments']): string {
        if (!segments?.length) return '';
        return segments
            .map(s => `${s.start.toFixed(0)}s: ${s.label} (energy ${(s.energy * 100).toFixed(0)}%)`)
            .join(', ');
    }

    private fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]);
            };
            reader.onerror = error => reject(error);
        });
    }
}

export const energyMapService = new EnergyMapService();
