/**
 * Structural UI checks only. Existing auth/image-generation doubles below do
 * not establish capture, persistence, extraction or avatar service acceptance.
 * Actual manual-save acceptance is tracked in docs/REMOTE_MANUAL_CONTACT_ACCEPTANCE.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuickContactModal from '@/modules/mobile-remote/components/QuickContactModal';

const mockToast = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
}));

const mockUploadFile = vi.hoisted(() => vi.fn());
const mockCreateEncounter = vi.hoisted(() => vi.fn());
const mockSaveManualContact = vi.hoisted(() => vi.fn());
const mockDispatchTask = vi.hoisted(() => vi.fn());

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast,
}));

vi.mock('@/services/StorageService', () => ({
    StorageService: {
        uploadFile: mockUploadFile,
    },
}));

vi.mock('@/services/encounters/EncounterService', () => ({
    EncounterService: {
        createEncounter: mockCreateEncounter,
        saveManualContact: mockSaveManualContact,
    },
}));

vi.mock('@/services/agent/RemoteRelayService', () => ({
    remoteRelayService: {
        dispatchTask: mockDispatchTask,
    },
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user-123' } },
    remoteConfig: {},
    functionsWest1: {},
    storage: {},
    db: {},
    ai: {},
}));

vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: {
        generateImages: vi.fn(() => Promise.resolve([{ id: 'img-1', url: 'https://cdn.test/avatar.png', prompt: 'test' }])),
    },
}));

describe('QuickContactModal Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not render when isOpen is false', () => {
        const { container } = render(
            <QuickContactModal isOpen={false} onClose={vi.fn()} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders voice-first interface by default with no keyboard-triggering inputs', () => {
        render(<QuickContactModal isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByText('Voice Contact')).toBeDefined();
        expect(screen.getByText('Tap to Speak')).toBeDefined();
        expect(screen.getByText('Speak Contact Information')).toBeDefined();
        expect(screen.getByText(/Say: "Alex Morgan/)).toBeDefined();
        expect(screen.getByText('Snap Photo')).toBeDefined();
        expect(screen.queryByPlaceholderText('Jane Doe / DJ Shadow')).toBeNull();
    });

    it('switches to manual entry mode and displays form inputs', () => {
        render(<QuickContactModal isOpen={true} onClose={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Manual' }));

        expect(screen.getByText('Manual Contact')).toBeDefined();
        expect(screen.getByPlaceholderText('Jane Doe / DJ Shadow')).toBeDefined();
        expect(screen.getByPlaceholderText('555-0199')).toBeDefined();
        expect(screen.getByPlaceholderText('jane@mgmt.com')).toBeDefined();
        expect(screen.getByText('Promoter')).toBeDefined();
        expect(screen.getByText('Artist')).toBeDefined();
        expect(screen.getByRole('button', { name: 'Save Contact' })).toBeDefined();
    });

    it('retains every manually entered field when changing modes before saving (structural only)', () => {
        render(<QuickContactModal isOpen={true} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
        const entries = [
            ['Jane Doe / DJ Shadow', 'Example Artist'],
            ['555-0199', '+1 555 0100'],
            ['jane@mgmt.com', 'artist@example.com'],
            ['@instagram or Atlantic Records', 'Independent label'],
            ['Met at show, wants unreleased demo...', 'Meet after soundcheck.\nBring release artwork.'],
        ] as const;
        for (const [placeholder, value] of entries) {
            fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
        }
        // Every field is identified by its visible placeholder above;
        // preserve those values across the same mode toggle available in the UI.
        fireEvent.click(screen.getByRole('button', { name: 'Voice' }));
        fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
        for (const [placeholder, value] of entries) {
            expect((screen.getByPlaceholderText(placeholder) as HTMLInputElement | HTMLTextAreaElement).value).toBe(value);
        }
    });

    it('renders avatar generation trigger when photo preview exists', async () => {
        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
        vi.spyOn(ImageGeneration, 'generateImages').mockResolvedValue([
            { id: 'img-1', url: 'https://cdn.test/avatar.png', prompt: 'test' },
        ]);

        render(<QuickContactModal isOpen={true} onClose={vi.fn()} />);

        // Simulate choosing a card photo
        const file = new File(['fake-image-bytes'], 'portrait.jpg', { type: 'image/jpeg' });
        // JSDOM File might not have arrayBuffer implemented
        if (!file.arrayBuffer) {
            file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(8));
        } else {
            vi.spyOn(file, 'arrayBuffer').mockResolvedValue(new ArrayBuffer(8));
        }

        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        expect(input).toBeDefined();

        fireEvent.change(input, { target: { files: [file] } });

        // Verify the generate avatar button renders
        await waitFor(() => {
            expect(screen.getByText('Generate Avatar from Photo')).toBeDefined();
        });

        fireEvent.click(screen.getByText('Generate Avatar from Photo'));

        await waitFor(() => {
            expect(ImageGeneration.generateImages).toHaveBeenCalled();
            expect(screen.getByText('Avatar Ready')).toBeDefined();
        });
    });

    it('reverts playback state, surfaces an error toast when audio.play() rejects, and recreates Audio after Redo', async () => {
        const stopTrack = vi.fn();
        const stream = { getTracks: () => [{ stop: stopTrack }] };
        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
        });

        let blobCounter = 0;
        const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:take-${++blobCounter}`);
        const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

        class MockRecorder {
            static isTypeSupported = () => true;
            state: 'inactive' | 'recording' = 'inactive';
            mimeType = 'audio/webm';
            ondataavailable: ((event: { data: Blob }) => void) | null = null;
            onstop: (() => void) | null = null;
            start() { this.state = 'recording'; }
            stop() {
                this.state = 'inactive';
                this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: 'audio/webm' }) });
                this.onstop?.();
            }
        }
        vi.stubGlobal('MediaRecorder', MockRecorder);

        const createdAudioUrls: string[] = [];
        const audioInstances: Array<{ src: string; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; onended: (() => void) | null; onerror: (() => void) | null }> = [];
        class MockAudio {
            src: string;
            onended: (() => void) | null = null;
            onerror: (() => void) | null = null;
            pause = vi.fn();
            play: ReturnType<typeof vi.fn>;
            constructor(src: string) {
                this.src = src;
                createdAudioUrls.push(src);
                this.play = vi.fn(() =>
                    createdAudioUrls.length === 1
                        ? Promise.reject(new DOMException('NotAllowedError'))
                        : Promise.resolve(undefined)
                );
                audioInstances.push(this);
            }
        }
        vi.stubGlobal('Audio', MockAudio);

        try {
            render(<QuickContactModal isOpen={true} onClose={vi.fn()} />);

            // Record take 1
            fireEvent.click(screen.getByRole('button', { name: /Tap to Speak/i }));
            await waitFor(() => expect(screen.getByText('Listening...')).toBeDefined());
            fireEvent.click(screen.getByRole('button', { name: /0:00/i }));
            await waitFor(() => expect(screen.getByText('Audio Recorded')).toBeDefined());

            // Click Play — first Audio.play() rejects
            const playBtn = screen.getByRole('button', { name: /Play recording/i });
            fireEvent.click(playBtn);
            await waitFor(() => {
                expect(mockToast.error).toHaveBeenCalledWith('Unable to play recording. Please try again.');
            });
            expect(screen.getByRole('button', { name: /Play recording/i })).toBeDefined();

            // Click Redo to record take 2
            fireEvent.click(screen.getByRole('button', { name: /Redo/i }));
            await waitFor(() => expect(screen.getByText('Listening...')).toBeDefined());
            fireEvent.click(screen.getByRole('button', { name: /0:00/i }));
            await waitFor(() => expect(screen.getByText('Audio Recorded')).toBeDefined());

            // Play take 2 — must construct a fresh Audio instance for blob:take-2, not reuse revoked blob:take-1
            fireEvent.click(screen.getByRole('button', { name: /Play recording/i }));
            await waitFor(() => {
                expect(createdAudioUrls).toEqual(['blob:take-1', 'blob:take-2']);
                expect(audioInstances[0]!.pause).toHaveBeenCalled();
                expect(revokeObjectURL).toHaveBeenCalledWith('blob:take-1');
            });
            expect(createObjectURL).toHaveBeenCalledTimes(2);
        } finally {
            vi.unstubAllGlobals();
            createObjectURL.mockRestore();
            revokeObjectURL.mockRestore();
        }
    });

    it('guards voice submit against rapid double-click and does not call onClose/onSaved after unmount', async () => {
        const stopTrack = vi.fn();
        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) },
        });
        const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:voice-1');
        const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

        class MockRecorder {
            static isTypeSupported = () => true;
            state: 'inactive' | 'recording' = 'inactive';
            mimeType = 'audio/webm';
            ondataavailable: ((event: { data: Blob }) => void) | null = null;
            onstop: (() => void) | null = null;
            start() { this.state = 'recording'; }
            stop() {
                this.state = 'inactive';
                this.ondataavailable?.({ data: new Blob(['voice-bytes'], { type: 'audio/webm' }) });
                this.onstop?.();
            }
        }
        vi.stubGlobal('MediaRecorder', MockRecorder);

        let resolveUpload!: (url: string) => void;
        mockUploadFile.mockImplementation(() => new Promise<string>((resolve) => {
            resolveUpload = resolve;
        }));
        mockCreateEncounter.mockResolvedValue({ id: 'enc-1' });
        mockDispatchTask.mockResolvedValue(undefined);

        const onClose = vi.fn();
        const onSaved = vi.fn();

        try {
            const view = render(<QuickContactModal isOpen={true} onClose={onClose} onSaved={onSaved} />);

            // Record audio
            fireEvent.click(screen.getByRole('button', { name: /Tap to Speak/i }));
            await waitFor(() => expect(screen.getByText('Listening...')).toBeDefined());
            fireEvent.click(screen.getByRole('button', { name: /0:00/i }));
            await waitFor(() => expect(screen.getByText('Audio Recorded')).toBeDefined());

            // Double-click save synchronously before state settles
            const saveBtn = screen.getByRole('button', { name: /Save & Extract Contact/i });
            fireEvent.click(saveBtn);
            fireEvent.click(saveBtn);

            expect(mockUploadFile).toHaveBeenCalledTimes(1);
            // Close button must be disabled while saving
            expect(screen.getByRole('button', { name: 'Close contact modal' })).toBeDisabled();

            // Unmount while upload is still pending
            view.unmount();
            resolveUpload('https://storage.test/voice.webm');
            await new Promise((r) => setTimeout(r, 20));

            expect(onClose).not.toHaveBeenCalled();
            expect(onSaved).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
            createObjectURL.mockRestore();
            revokeObjectURL.mockRestore();
        }
    });

    it('dismisses on backdrop click when idle', () => {
        const onClose = vi.fn();
        render(<QuickContactModal isOpen={true} onClose={onClose} />);

        fireEvent.click(screen.getByRole('dialog'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
