import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { AudioWaveform } from './AudioWaveform';
import * as audioPeaks from '@/utils/audioPeaks';

// Mock getAudioData
vi.mock('@/utils/audioPeaks', () => ({
    fetchAudioData: vi.fn(),
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

        const getAudioDataSpy = vi.mocked(audioPeaks.fetchAudioData).mockResolvedValue(mockAudioData as any);

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
        const getAudioDataSpy = vi.mocked(audioPeaks.fetchAudioData).mockResolvedValue(mockAudioData as any);
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

    describe('Feature 21: Trim-Aware Audio Waveform Rendering', () => {
        it('slices audio channel samples based on sourceInUs and sourceOutUs', async () => {
            // Create 1000 samples: first 500 are 0.2, last 500 are 0.8
            const sampleArray = new Float32Array(1000);
            for (let i = 0; i < 500; i++) sampleArray[i] = 0.2;
            for (let i = 500; i < 1000; i++) sampleArray[i] = 0.8;

            const mockAudioData = {
                channelWaveforms: [sampleArray],
                sampleRate: 44100,
                durationInSeconds: 10, // 10,000,000 us
                numberOfChannels: 1,
            };

            vi.mocked(audioPeaks.fetchAudioData).mockResolvedValue(mockAudioData as any);

            const fillRectCalls: { x: number; y: number; w: number; h: number }[] = [];
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
                clearRect: vi.fn(),
                fillRect: (x: number, y: number, w: number, h: number) => {
                    fillRectCalls.push({ x, y, w, h });
                },
                fillStyle: '',
            }) as any;

            try {
                // Render trimmed to first half (0 to 5s = 0 to 5,000,000 us)
                const { rerender } = render(
                    <AudioWaveform
                        src="trim-test.mp3"
                        width={10}
                        height={100}
                        sourceInUs={0}
                        sourceOutUs={5_000_000}
                    />
                );

                await waitFor(() => {
                    expect(fillRectCalls.length).toBe(10);
                });

                // All bars should have height approx 0.2 * 100 = 20
                for (const call of fillRectCalls) {
                    expect(call.h).toBeCloseTo(20, 1);
                }

                fillRectCalls.length = 0;

                // Re-render trimmed to second half (5s to 10s = 5,000,000 us to 10,000,000 us)
                rerender(
                    <AudioWaveform
                        src="trim-test.mp3"
                        width={10}
                        height={100}
                        sourceInUs={5_000_000}
                        sourceOutUs={10_000_000}
                    />
                );

                await waitFor(() => {
                    expect(fillRectCalls.length).toBe(10);
                });

                // All bars should now have height approx 0.8 * 100 = 80
                for (const call of fillRectCalls) {
                    expect(call.h).toBeCloseTo(80, 1);
                }
            } finally {
                HTMLCanvasElement.prototype.getContext = originalGetContext;
            }
        });

        it('derives sourceOutUs from durationInFrames and fps when sourceOutUs is not specified', async () => {
            const sampleArray = new Float32Array(1000);
            for (let i = 0; i < 500; i++) sampleArray[i] = 0.3;
            for (let i = 500; i < 1000; i++) sampleArray[i] = 0.9;

            const mockAudioData = {
                channelWaveforms: [sampleArray],
                sampleRate: 44100,
                durationInSeconds: 10, // 10s total
                numberOfChannels: 1,
            };

            vi.mocked(audioPeaks.fetchAudioData).mockResolvedValue(mockAudioData as any);

            const fillRectCalls: { x: number; y: number; w: number; h: number }[] = [];
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
                clearRect: vi.fn(),
                fillRect: (x: number, y: number, w: number, h: number) => {
                    fillRectCalls.push({ x, y, w, h });
                },
                fillStyle: '',
            }) as any;

            try {
                // sourceInUs = 0, durationInFrames = 150 at fps = 30 -> 5 seconds -> first half
                render(
                    <AudioWaveform
                        src="derived-trim.mp3"
                        width={10}
                        height={100}
                        sourceInUs={0}
                        durationInFrames={150}
                        fps={30}
                    />
                );

                await waitFor(() => {
                    expect(fillRectCalls.length).toBe(10);
                });

                for (const call of fillRectCalls) {
                    expect(call.h).toBeCloseTo(30, 1);
                }
            } finally {
                HTMLCanvasElement.prototype.getContext = originalGetContext;
            }
        });

        it('resamples correctly without flat/blank bars when width exceeds sample count (high zoom)', async () => {
            // Only 5 samples
            const sampleArray = new Float32Array([0.1, 0.4, 0.7, 0.5, 0.9]);
            const mockAudioData = {
                channelWaveforms: [sampleArray],
                sampleRate: 44100,
                durationInSeconds: 1,
                numberOfChannels: 1,
            };

            vi.mocked(audioPeaks.fetchAudioData).mockResolvedValue(mockAudioData as any);

            const fillRectCalls: { x: number; y: number; w: number; h: number }[] = [];
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
                clearRect: vi.fn(),
                fillRect: (x: number, y: number, w: number, h: number) => {
                    fillRectCalls.push({ x, y, w, h });
                },
                fillStyle: '',
            }) as any;

            try {
                // width = 20 > samples.length = 5
                render(
                    <AudioWaveform
                        src="zoom-test.mp3"
                        width={20}
                        height={100}
                    />
                );

                await waitFor(() => {
                    expect(fillRectCalls.length).toBe(20);
                });

                // All bars should have non-zero height
                for (const call of fillRectCalls) {
                    expect(call.h).toBeGreaterThan(0);
                    expect(Number.isNaN(call.h)).toBe(false);
                }
            } finally {
                HTMLCanvasElement.prototype.getContext = originalGetContext;
            }
        });
    });
});
