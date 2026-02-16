import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { AudioWaveform } from './AudioWaveform';
import * as mediaUtils from '@remotion/media-utils';

// Mock getAudioData
vi.mock('@remotion/media-utils', () => ({
    getAudioData: vi.fn(),
}));

describe('AudioWaveform', () => {
    it('should fetch audio data only once when width changes', async () => {
        // Setup mock return value
        const mockAudioData = {
            channelWaveforms: [new Float32Array(1000).fill(0.5)], // Mock 1000 samples
            sampleRate: 44100,
            durationInSeconds: 10,
            numberOfChannels: 1,
            resultId: 'test-id',
            isRemote: false,
        };

        const getAudioDataSpy = vi.mocked(mediaUtils.getAudioData).mockResolvedValue(mockAudioData as any);

        // Initial render
        const { rerender } = render(
            <AudioWaveform src="test-audio.mp3" width={100} height={50} />
        );

        // Wait for first fetch
        await waitFor(() => {
            expect(getAudioDataSpy).toHaveBeenCalledTimes(1);
        });

        // Re-render with new width (simulating resize)
        rerender(
            <AudioWaveform src="test-audio.mp3" width={200} height={50} />
        );

        // Wait a bit to ensure effects run
        await new Promise(resolve => setTimeout(resolve, 100));

        // Assert that getAudioData was NOT called again
        // With current unoptimized code, this assertion should FAIL (it will be called 2 times)
        // I will assert 1 time to demonstrate the failure (and later success).
        expect(getAudioDataSpy).toHaveBeenCalledTimes(1);
    });

    it('should re-fetch audio data when src changes', async () => {
        const mockAudioData = {
            channelWaveforms: [new Float32Array(100).fill(0.5)],
            sampleRate: 44100,
            durationInSeconds: 10,
            numberOfChannels: 1,
            resultId: 'test-id',
            isRemote: false,
        };
        const getAudioDataSpy = vi.mocked(mediaUtils.getAudioData).mockResolvedValue(mockAudioData as any);
        getAudioDataSpy.mockClear();

        const { rerender } = render(
            <AudioWaveform src="track1.mp3" width={100} height={50} />
        );

        await waitFor(() => {
            expect(getAudioDataSpy).toHaveBeenCalledWith('track1.mp3');
        });

        // Change src
        rerender(
            <AudioWaveform src="track2.mp3" width={100} height={50} />
        );

        await waitFor(() => {
            expect(getAudioDataSpy).toHaveBeenCalledWith('track2.mp3');
            expect(getAudioDataSpy).toHaveBeenCalledTimes(2);
        });
    });
});
