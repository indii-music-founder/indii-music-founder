"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SonicProfileSchema = void 0;
const zod_1 = require("zod");
/**
 * Sonic Profile represents the semantic and acoustic characteristics of an audio track.
 * Extracted via indii_audio_ear (Gemini 1.5/3 Multimodal).
 */
exports.SonicProfileSchema = zod_1.z.object({
    bpm: zod_1.z.number().describe("Beats per minute (tempo)"),
    key: zod_1.z.string().describe("Musical key (e.g., 'F# Minor')"),
    mood: zod_1.z.string().describe("Overall emotional tone (e.g., 'Melancholic', 'Aggressive')"),
    texture: zod_1.z.string().describe("Sonic texture (e.g., 'Gritty', 'Smooth', 'Distorted')"),
    instrumentation: zod_1.z.array(zod_1.z.string()).describe("Dominant instruments detected"),
    vocalPresence: zod_1.z.boolean().describe("True if vocals are detected"),
    intensity: zod_1.z.number().min(1).max(10).describe("Energy level from 1-10"),
    genre: zod_1.z.string().optional().describe("Primary genre detected"),
    timestamp_markers: zod_1.z.array(zod_1.z.object({
        time: zod_1.z.string().describe("Timestamp (e.g., '0:15')"),
        event: zod_1.z.string().describe("Event description (e.g., 'Beat drop', 'Chorus start')")
    })).optional().describe("Key timestamps for visual synchronization")
});
//# sourceMappingURL=sonic_profile.js.map