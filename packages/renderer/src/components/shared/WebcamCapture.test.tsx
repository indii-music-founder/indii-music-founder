import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebcamCapture from './WebcamCapture';

describe('WebcamCapture media lifecycle', () => {
    const stopTrack = vi.fn();
    const stream = {
        getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;

    beforeEach(() => {
        stopTrack.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('stops the active camera when the dialog unmounts', async () => {
        const getUserMedia = vi.fn().mockResolvedValue(stream);
        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: { getUserMedia },
        });
        const view = render(<WebcamCapture onCapture={vi.fn()} onClose={vi.fn()} />);
        await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());

        view.unmount();

        expect(stopTrack).toHaveBeenCalledOnce();
    });

    it('stops a camera stream that resolves after the dialog has closed', async () => {
        let resolveStream!: (value: MediaStream) => void;
        const getUserMedia = vi.fn().mockReturnValue(new Promise<MediaStream>(resolve => {
            resolveStream = resolve;
        }));
        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: { getUserMedia },
        });
        const view = render(<WebcamCapture onCapture={vi.fn()} onClose={vi.fn()} />);
        await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
        view.unmount();

        await act(async () => resolveStream(stream));

        expect(stopTrack).toHaveBeenCalledOnce();
    });
});
