import { describe, it, expect } from 'vitest';
import { AnalyzeAudioRequestSchema } from './audio';

describe('Audio Analysis Logic', () => {
    it('should validate valid audio URLs', () => {
        const valid = AnalyzeAudioRequestSchema.safeParse({
            audioUrl: "https://example.com/song.mp3",
            mimeType: "audio/mpeg"
        });
        expect(valid.success).toBe(true);

        const gcsValid = AnalyzeAudioRequestSchema.safeParse({
            audioUrl: "gs://my-bucket/audio.wav"
        });
        expect(gcsValid.success).toBe(true);
    });

    it('should fail on invalid URLs', () => {
        const invalid = AnalyzeAudioRequestSchema.safeParse({
            audioUrl: "not-a-url"
        });
        expect(invalid.success).toBe(false);
    });

    it('should enforce default mimeType', () => {
        const data = AnalyzeAudioRequestSchema.parse({
            audioUrl: "https://example.com/song.mp3"
        });
        expect(data.mimeType).toBe("audio/mpeg");
    });
});
