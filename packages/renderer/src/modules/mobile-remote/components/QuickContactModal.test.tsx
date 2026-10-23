/**
 * Structural UI checks only. Existing auth/image-generation doubles below do
 * not establish capture, persistence, extraction or avatar service acceptance.
 * Actual manual-save acceptance is tracked in docs/REMOTE_MANUAL_CONTACT_ACCEPTANCE.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuickContactModal from './QuickContactModal';

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
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
            expect(screen.getByText('Generate AI Avatar from Photo')).toBeDefined();
        });

        fireEvent.click(screen.getByText('Generate AI Avatar from Photo'));

        await waitFor(() => {
            expect(ImageGeneration.generateImages).toHaveBeenCalled();
            expect(screen.getByText('AI Avatar Ready')).toBeDefined();
        });
    });
});
