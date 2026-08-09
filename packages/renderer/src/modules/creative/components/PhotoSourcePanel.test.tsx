import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/core/context/ToastContext';
import { PhotoSourcePanel } from './PhotoSourcePanel';

describe('PhotoSourcePanel camera lifecycle', () => {
    const stopTrack = vi.fn();
    const stream = {
        getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;

    beforeEach(() => stopTrack.mockClear());
    afterEach(() => vi.restoreAllMocks());

    it('stops a late camera stream after the panel unmounts', async () => {
        let resolveStream!: (value: MediaStream) => void;
        const getUserMedia = vi.fn().mockReturnValue(new Promise<MediaStream>(resolve => {
            resolveStream = resolve;
        }));
        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: { getUserMedia },
        });
        const view = render(
            <ToastProvider>
                <PhotoSourcePanel onCapture={vi.fn()} />
            </ToastProvider>,
        );
        fireEvent.click(screen.getByRole('button', { name: /take photo/i }));
        await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
        view.unmount();

        await act(async () => resolveStream(stream));

        expect(stopTrack).toHaveBeenCalledOnce();
    });
});
