import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CameraViewfinderModal, { cropToRatio } from './CameraViewfinderModal';

describe('camera viewfinder', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('crops the actual image pixels to the selected social frame', () => {
        expect(cropToRatio(1920, 1080, '9:16')).toEqual({ sx: 656, sy: 0, width: 608, height: 1080 });
        expect(cropToRatio(1920, 1080, '1:1')).toEqual({ sx: 420, sy: 0, width: 1080, height: 1080 });
        expect(cropToRatio(1080, 1920, '16:9')).toEqual({ sx: 0, sy: 656, width: 1080, height: 608 });
    });

    it('opens the camera only while mounted, applies supported torch, and stops tracks on close', async () => {
        const track = {
            stop: vi.fn(),
            getCapabilities: () => ({ torch: true, zoom: { min: 1, max: 3 }, exposureCompensation: { min: -2, max: 2 } }),
            getSettings: () => ({ zoom: 1, exposureCompensation: 0 }),
            applyConstraints: vi.fn().mockResolvedValue(undefined),
        };
        const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
        const getUserMedia = vi.fn().mockResolvedValue(stream);
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
        const onClose = vi.fn();
        const view = render(<CameraViewfinderModal onClose={onClose} onFallback={vi.fn()} onPhoto={vi.fn()} />);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Capture photo' })).toBeEnabled());
        expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
        fireEvent.click(screen.getByRole('button', { name: 'Toggle torch' }));
        await waitFor(() => expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] }));
        fireEvent.click(screen.getByRole('button', { name: 'Close camera' }));
        view.unmount();
        expect(track.stop).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('records video with microphone and returns the real captured bytes', async () => {
        const track = {
            stop: vi.fn(),
            getCapabilities: () => ({}),
            getSettings: () => ({}),
            applyConstraints: vi.fn(),
        };
        const stream = { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [track] };
        const getUserMedia = vi.fn().mockResolvedValue(stream);
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
        class Recorder {
            static isTypeSupported = () => true;
            state: 'inactive' | 'recording' = 'inactive';
            mimeType = 'video/mp4';
            ondataavailable: ((event: { data: Blob }) => void) | null = null;
            onstop: (() => void) | null = null;
            onerror: (() => void) | null = null;
            start() { this.state = 'recording'; }
            stop() {
                this.state = 'inactive';
                this.ondataavailable?.({ data: new Blob(['real video bytes'], { type: 'video/mp4' }) });
                this.onstop?.();
            }
        }
        vi.stubGlobal('MediaRecorder', Recorder);
        const onVideo = vi.fn();
        const view = render(<CameraViewfinderModal mode="video" onClose={vi.fn()} onFallback={vi.fn()} onPhoto={vi.fn()} onVideo={onVideo} />);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording video' })).toBeEnabled());
        expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Start recording video' }));
        fireEvent.click(screen.getByRole('button', { name: 'Stop recording video' }));
        expect(onVideo).toHaveBeenCalledOnce();
        expect(onVideo.mock.calls[0]?.[0]).toMatchObject({ name: expect.stringMatching(/\.mp4$/), type: 'video/mp4' });
        view.unmount();
        expect(track.stop).toHaveBeenCalled();
    });

    it('passes a cropped JPEG file into the existing review flow', async () => {
        const track = { stop: vi.fn(), getCapabilities: () => ({}), getSettings: () => ({}) };
        const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
        vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(1920);
        vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(1080);
        const drawImage = vi.fn();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as GPUCanvasContext);
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['jpeg pixels'], { type: 'image/jpeg' })));
        const onPhoto = vi.fn();
        const view = render(<CameraViewfinderModal onClose={vi.fn()} onFallback={vi.fn()} onPhoto={onPhoto} />);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Capture photo' })).toBeEnabled());
        fireEvent.click(screen.getByRole('button', { name: 'Capture photo' }));
        await waitFor(() => expect(onPhoto).toHaveBeenCalledOnce());
        expect(drawImage).toHaveBeenCalledWith(expect.any(HTMLVideoElement), 656, 0, 608, 1080, 0, 0, 608, 1080);
        expect(onPhoto.mock.calls[0]?.[0]).toMatchObject({ type: 'image/jpeg', size: 11 });
        view.unmount();
    });
});
