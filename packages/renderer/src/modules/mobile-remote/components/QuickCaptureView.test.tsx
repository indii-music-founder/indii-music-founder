import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import QuickCaptureView, { pickSupportedAudioMimeType, audioExtensionForMimeType } from './QuickCaptureView';

/**
 * ISSUE-985: minimal fakes for the Web Audio recording APIs jsdom doesn't
 * implement, sized to exercise the mic lifecycle fix — stop must always be
 * reachable, and every track must actually stop on unmount/page-hide/permission-loss.
 */
class FakeTrack {
    readyState: 'live' | 'ended' = 'live';
    onended: (() => void) | null = null;
    stop = vi.fn(() => { this.readyState = 'ended'; });
}

class FakeMediaStream {
    private tracks: FakeTrack[];
    constructor(tracks: FakeTrack[] = [new FakeTrack()]) { this.tracks = tracks; }
    getTracks() { return this.tracks; }
}

class FakeMediaRecorder {
    static instances: FakeMediaRecorder[] = [];
    static isTypeSupported = (_type: string) => true;
    state: 'inactive' | 'recording' = 'inactive';
    mimeType: string;
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    constructor(public stream: FakeMediaStream, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? '';
        FakeMediaRecorder.instances.push(this);
    }
    start() { this.state = 'recording'; }
    stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        // Real MediaRecorder finalizes asynchronously — defer onstop to a
        // microtask so tests can observe the gap between "stop tapped" and
        // "audio blob actually landed" (ISSUE-986).
        Promise.resolve().then(() => this.onstop?.());
    }
    emitData(data: Blob) {
        this.ondataavailable?.({ data });
    }
}

const { mockError } = vi.hoisted(() => ({
    mockError: vi.fn(),
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: mockError,
        info: vi.fn(),
    }),
}));

vi.mock('@/services/agent/RemoteRelayService', () => ({
    remoteRelayService: {
        dispatchTask: vi.fn(),
    },
}));

vi.mock('@/services/StorageService', () => ({
    StorageService: {
        uploadFile: vi.fn(),
    },
}));

vi.mock('../MobileRemote', () => ({
    triggerHaptic: vi.fn(),
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
        button: ({ children, whileTap, ...props }: React.PropsWithChildren<Record<string, unknown>> & { whileTap?: unknown }) => <button {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('QuickCaptureView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, 'geolocation', {
            configurable: true,
            value: undefined,
        });
    });

    it('shows an in-app unavailable message when geolocation is missing', () => {
        render(<QuickCaptureView isPaired={true} />);

        expect(screen.getByRole('button', { name: /pin n\/a/i })).toBeDisabled();
        expect(screen.getByText('Location capture is unavailable in this browser.')).toBeInTheDocument();
        expect(mockError).not.toHaveBeenCalled();
    });
});

describe('QuickCaptureView — voice memo mic lifecycle (ISSUE-985)', () => {
    let getUserMedia: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        FakeMediaRecorder.instances = [];
        Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });

        getUserMedia = vi.fn(async () => new FakeMediaStream());
        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: { getUserMedia },
        });
        (globalThis as unknown as { MediaRecorder: typeof FakeMediaRecorder }).MediaRecorder = FakeMediaRecorder;
    });

    async function startRecording() {
        const startBtn = screen.getByRole('button', { name: /start recording a voice memo/i });
        await act(async () => {
            fireEvent.click(startBtn);
            await Promise.resolve();
            await Promise.resolve();
        });
    }

    it('keeps Stop clickable and functional after pairing drops mid-recording', async () => {
        const { rerender } = render(<QuickCaptureView isPaired={true} />);
        await startRecording();

        const stopBtn = await screen.findByRole('button', { name: /stop recording/i });
        expect(stopBtn).not.toBeDisabled();

        // Pairing drops mid-record — this was the exact trap: !isPaired used
        // to disable the only stop control, stranding the mic live.
        rerender(<QuickCaptureView isPaired={false} />);
        const stopBtnAfterUnpair = screen.getByRole('button', { name: /stop recording/i });
        expect(stopBtnAfterUnpair).not.toBeDisabled();

        const recorder = FakeMediaRecorder.instances[0]!;
        act(() => {
            fireEvent.click(stopBtnAfterUnpair);
        });

        expect(recorder.state).toBe('inactive');
        expect(recorder.stream.getTracks()[0]!.stop).toHaveBeenCalled();

        // Flush the deferred onstop microtask so it can't leak into the next test.
        await act(async () => { await Promise.resolve(); });
    });

    it('stops every track when the component unmounts mid-recording', async () => {
        const { unmount } = render(<QuickCaptureView isPaired={true} />);
        await startRecording();

        const recorder = FakeMediaRecorder.instances[0]!;
        const track = recorder.stream.getTracks()[0]!;
        expect(track.readyState).toBe('live');

        unmount();

        expect(track.stop).toHaveBeenCalled();
        expect(track.readyState).toBe('ended');
    });

    it('stops recording when the page is hidden mid-recording', async () => {
        render(<QuickCaptureView isPaired={true} />);
        await startRecording();

        const recorder = FakeMediaRecorder.instances[0]!;
        const track = recorder.stream.getTracks()[0]!;

        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        expect(recorder.state).toBe('inactive');
        expect(track.stop).toHaveBeenCalled();
        expect(await screen.findByRole('button', { name: /start recording a voice memo/i })).toBeInTheDocument();
    });

    it('treats an externally-ended track (permission revoked) as a stop', async () => {
        render(<QuickCaptureView isPaired={true} />);
        await startRecording();

        const recorder = FakeMediaRecorder.instances[0]!;
        const track = recorder.stream.getTracks()[0]!;

        await act(async () => {
            track.onended?.();
        });

        expect(recorder.state).toBe('inactive');
        expect(await screen.findByRole('button', { name: /start recording a voice memo/i })).toBeInTheDocument();
    });

    it('ISSUE-986: blocks photo/doc/video replacement until the delayed audio blob finalizes, then unblocks', async () => {
        render(<QuickCaptureView isPaired={true} />);
        await startRecording();

        const photoBtn = screen.getByRole('button', { name: /photo/i });
        const docBtn = screen.getByRole('button', { name: /^doc$/i });
        const videoBtn = screen.getByRole('button', { name: /video/i });
        expect(photoBtn).toBeDisabled();

        const stopBtn = screen.getByRole('button', { name: /stop recording/i });
        act(() => {
            fireEvent.click(stopBtn);
        });

        // isRecording already flipped false (mic button reads "Speak" again)
        // but the audio blob hasn't landed yet — replacement must stay blocked.
        // Checked BEFORE any await: an awaited query would let the deferred
        // onstop microtask drain early and defeat the point of this test.
        expect(screen.getByRole('button', { name: /start recording a voice memo/i })).toBeInTheDocument();
        expect(photoBtn).toBeDisabled();
        expect(docBtn).toBeDisabled();
        expect(videoBtn).toBeDisabled();

        // Flush the deferred onstop microtask — finalization completes.
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(photoBtn).not.toBeDisabled();
        expect(docBtn).not.toBeDisabled();
        expect(videoBtn).not.toBeDisabled();
    });
});

describe('QuickCaptureView — voice memo MIME/validity guards (ISSUE-987)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        FakeMediaRecorder.instances = [];
        FakeMediaRecorder.isTypeSupported = () => true;
        Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });

        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: { getUserMedia: vi.fn(async () => new FakeMediaStream()) },
        });
        (globalThis as unknown as { MediaRecorder: typeof FakeMediaRecorder }).MediaRecorder = FakeMediaRecorder;
        URL.createObjectURL = vi.fn(() => 'blob:fake-url');
        URL.revokeObjectURL = vi.fn();
    });

    async function startRecording() {
        const startBtn = screen.getByRole('button', { name: /start recording a voice memo/i });
        await act(async () => {
            fireEvent.click(startBtn);
            await Promise.resolve();
        });
    }

    it('picks the first browser-supported MIME candidate in priority order', () => {
        FakeMediaRecorder.isTypeSupported = (type: string) => type === 'audio/ogg';
        expect(pickSupportedAudioMimeType()).toBe('audio/ogg');
    });

    it('returns undefined when nothing on the candidate list is supported (browser picks its own default)', () => {
        FakeMediaRecorder.isTypeSupported = () => false;
        expect(pickSupportedAudioMimeType()).toBeUndefined();
    });

    it('derives the filename extension from the actual, possibly codec-qualified, mimeType', () => {
        expect(audioExtensionForMimeType('audio/webm;codecs=opus')).toBe('webm');
        expect(audioExtensionForMimeType('audio/mp4')).toBe('m4a');
        expect(audioExtensionForMimeType('audio/ogg;codecs=opus')).toBe('ogg');
        expect(audioExtensionForMimeType('audio/unknown-thing')).toBe('webm');
    });

    it('rejects a zero-byte recording instead of saving a silent note', async () => {
        render(<QuickCaptureView isPaired={true} />);
        await startRecording();

        const stopBtn = screen.getByRole('button', { name: /stop recording/i });
        await act(async () => {
            fireEvent.click(stopBtn);
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(mockError).toHaveBeenCalledWith(expect.stringMatching(/no audio was captured/i));
        expect(screen.queryByText(/review before saving/i)).not.toBeInTheDocument();
    });

    // These two use vi.setSystemTime (NOT vi.useFakeTimers' timer-faking —
    // no setTimeout/interval in this path) so Date.now() reads a controlled
    // clock regardless of incidental extra calls (e.g. from React internals)
    // between start and stop — counting exact call order was flaky.
    it('rejects a recording shorter than the minimum duration even when data arrived', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000);
        try {
            render(<QuickCaptureView isPaired={true} />);
            await startRecording();

            const recorder = FakeMediaRecorder.instances[0]!;
            recorder.emitData(new Blob(['audio-bytes'], { type: 'audio/webm' }));

            vi.setSystemTime(1_100); // 100ms later — below the 300ms floor

            const stopBtn = screen.getByRole('button', { name: /stop recording/i });
            await act(async () => {
                fireEvent.click(stopBtn);
                await Promise.resolve();
                await Promise.resolve();
            });

            expect(mockError).toHaveBeenCalledWith(expect.stringMatching(/too short/i));
            expect(screen.queryByText(/review before saving/i)).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('saves a valid, non-empty, sufficiently long recording using the recorder\'s real mimeType', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000);
        try {
            render(<QuickCaptureView isPaired={true} />);
            await startRecording();

            const recorder = FakeMediaRecorder.instances[0]!;
            recorder.mimeType = 'audio/mp4';
            recorder.emitData(new Blob(['audio-bytes'], { type: 'audio/mp4' }));

            vi.setSystemTime(2_000); // 1000ms later — comfortably above the floor

            const stopBtn = screen.getByRole('button', { name: /stop recording/i });
            await act(async () => {
                fireEvent.click(stopBtn);
                await Promise.resolve();
                await Promise.resolve();
            });

            expect(mockError).not.toHaveBeenCalled();
            expect(screen.getByText(/review before saving/i)).toBeInTheDocument();
            expect(screen.getByText(/captured voice memo/i)).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('QuickCaptureView — venue pin geolocation (ISSUE-988)', () => {
    let getCurrentPosition: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        getCurrentPosition = vi.fn();
        Object.defineProperty(navigator, 'geolocation', {
            configurable: true,
            value: { getCurrentPosition },
        });
    });

    it('requests location with an explicit timeout so a stalled provider cannot hang forever', () => {
        render(<QuickCaptureView isPaired={true} />);
        const pinBtn = screen.getByRole('button', { name: /^pin$/i });
        fireEvent.click(pinBtn);

        expect(getCurrentPosition).toHaveBeenCalledTimes(1);
        const options = getCurrentPosition.mock.calls[0]![2];
        expect(options.timeout).toEqual(expect.any(Number));
        expect(options.timeout).toBeGreaterThan(0);
    });

    it('unlocks capture and shows a clear message when the provider times out', async () => {
        getCurrentPosition.mockImplementation((_success, error) => {
            error({ code: 3, TIMEOUT: 3, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, message: 'Timeout' });
        });

        render(<QuickCaptureView isPaired={true} />);
        const pinBtn = screen.getByRole('button', { name: /^pin$/i });

        await act(async () => {
            fireEvent.click(pinBtn);
        });

        expect(mockError).toHaveBeenCalledWith(expect.stringMatching(/timed out/i));
        expect(pinBtn).not.toBeDisabled();
    });

    it('unlocks capture on a non-timeout location error too', async () => {
        getCurrentPosition.mockImplementation((_success, error) => {
            error({ code: 2, TIMEOUT: 3, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, message: 'Unavailable' });
        });

        render(<QuickCaptureView isPaired={true} />);
        const pinBtn = screen.getByRole('button', { name: /^pin$/i });

        await act(async () => {
            fireEvent.click(pinBtn);
        });

        expect(mockError).toHaveBeenCalledWith('Location capture failed. Please try again.');
        expect(pinBtn).not.toBeDisabled();
    });
});
