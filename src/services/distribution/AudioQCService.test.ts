import { describe, it, expect } from 'vitest';
import { AudioQCService } from '@/services/distribution/AudioQCService';

describe('AudioQCService', () => {

    const createMockAudioBuffer = (sampleRate: number, duration: number, peak: number): AudioBuffer => {
        const length = sampleRate * duration;
        const buffer = {
            sampleRate,
            duration,
            numberOfChannels: 2,
            getChannelData: vi.fn(() => {
                const data = new Float32Array(length);
                data[0] = peak; // Set peak
                return data;
            })
        } as unknown as AudioBuffer;
        return buffer;
    };

    it('should pass valid professional audio', async () => {
        const buffer = createMockAudioBuffer(44100, 40, 0.8);
        const result = await AudioQCService.performQC(buffer);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should fail low sample rate audio', async () => {
        const buffer = createMockAudioBuffer(22050, 40, 0.8);
        const result = await AudioQCService.performQC(buffer);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'QC_LOW_SAMPLE_RATE')).toBe(true);
    });

    it('should fail short duration audio', async () => {
        const buffer = createMockAudioBuffer(44100, 10, 0.8);
        const result = await AudioQCService.performQC(buffer);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'QC_SHORT_DURATION')).toBe(true);
    });

    it('should detect clipping', async () => {
        const buffer = createMockAudioBuffer(44100, 40, 1.1);
        const result = await AudioQCService.performQC(buffer);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'QC_CLIPPING_DETECTED')).toBe(true);
    });
});
