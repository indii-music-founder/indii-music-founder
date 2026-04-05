import { z } from "zod";

/**
 * Sonic Profile represents the semantic and acoustic characteristics of an audio track.
 * Extracted via indii_audio_ear (Gemini 1.5/3 Multimodal).
 */
export const SonicProfileSchema = z.object({
    bpm: z.number().describe("Beats per minute (tempo)"),
    key: z.string().describe("Musical key (e.g., 'F# Minor')"),
    mood: z.string().describe("Overall emotional tone (e.g., 'Melancholic', 'Aggressive')"),
    texture: z.string().describe("Sonic texture (e.g., 'Gritty', 'Smooth', 'Distorted')"),
    instrumentation: z.array(z.string()).describe("Dominant instruments detected"),
    vocalPresence: z.boolean().describe("True if vocals are detected"),
    intensity: z.number().min(1).max(10).describe("Energy level from 1-10"),
    genre: z.string().optional().describe("Primary genre detected"),
    timestamp_markers: z.array(z.object({
        time: z.string().describe("Timestamp (e.g., '0:15')"),
        event: z.string().describe("Event description (e.g., 'Beat drop', 'Chorus start')")
    })).optional().describe("Key timestamps for visual synchronization")
});

export type SonicProfile = z.infer<typeof SonicProfileSchema>;

/**
 * Mapping logic for Cross-Modal Translation.
 * Translates auditory adjectives to visual parameters.
 */
export interface VisualConstraintMapping {
    palette: string[];
    lightingStyle: string;
    motionIntensity: number;
    cutFrequency: number;
    glitchProbability: number;
}
