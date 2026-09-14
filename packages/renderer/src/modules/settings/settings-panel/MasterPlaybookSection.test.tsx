import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MasterPlaybookSection from './MasterPlaybookSection';
import { DEFAULT_ARTIST_MASTER_DIRECTIVE } from '@indii/shared';

const successMock = vi.fn();
const errorMock = vi.fn();
const infoMock = vi.fn();

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: successMock,
        error: errorMock,
        info: infoMock,
    }),
}));

const mockGetDirective = vi.fn();
const mockSaveDirective = vi.fn();
const mockSubscribeToDirective = vi.fn((_uid, _cb) => {
    return () => {};
});

vi.mock('@/core/store', () => ({
    useStore: (selector: any) =>
        selector({
            userProfile: {
                brandKit: {
                    colors: ['Neon Cyan (#00f0ff)', 'Electric Purple (#8a2be2)'],
                },
            },
        }),
}));

vi.mock('@/services/agent/skills/ArtistDirectiveService', () => ({
    artistDirectiveService: {
        getDirective: () => mockGetDirective(),
        saveDirective: (...args: unknown[]) => mockSaveDirective(...args),
        subscribeToDirective: (uid: unknown, cb: unknown) => mockSubscribeToDirective(uid, cb),
    },
}));

describe('MasterPlaybookSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDirective.mockResolvedValue(DEFAULT_ARTIST_MASTER_DIRECTIVE);
        mockSaveDirective.mockResolvedValue({ success: true });
    });

    it('renders the directive header and sections', async () => {
        render(<MasterPlaybookSection />);

        expect(await screen.findByText('Artist Master Directive')).toBeInTheDocument();
        expect(screen.getByText('Sonic & Mastering')).toBeInTheDocument();
        expect(screen.getByText('Business & Legal')).toBeInTheDocument();
        expect(screen.getByText('Brand & Aesthetics')).toBeInTheDocument();
        expect(screen.getByText('Release & Distribution')).toBeInTheDocument();
        expect(screen.getByText('Custom Playbook')).toBeInTheDocument();
    });

    it('displays the sonic specs rules by default', async () => {
        render(<MasterPlaybookSection />);

        expect(await screen.findByText('Sonic & Mastering Standards')).toBeInTheDocument();
        expect(
            screen.getByText('Target integrated loudness: -14 LUFS (streaming baseline)')
        ).toBeInTheDocument();
    });

    it('allows adding a new rule', async () => {
        render(<MasterPlaybookSection />);

        await screen.findByText('Sonic & Mastering Standards');
        const input = screen.getByPlaceholderText('Add instruction to Sonic & Mastering Standards...');
        fireEvent.change(input, { target: { value: 'Export 96kHz 32-bit float master' } });

        const addBtn = screen.getByRole('button', { name: /Add Rule/i });
        fireEvent.click(addBtn);

        expect(screen.getByText('Export 96kHz 32-bit float master')).toBeInTheDocument();
    });

    it('allows removing a rule', async () => {
        render(<MasterPlaybookSection />);

        await screen.findByText('Sonic & Mastering Standards');
        const ruleText = 'True Peak ceiling: -1.0 dBTP';
        expect(screen.getByText(ruleText)).toBeInTheDocument();

        const removeBtn = screen.getByRole('button', { name: `Remove rule: ${ruleText}` });
        fireEvent.click(removeBtn);

        expect(screen.queryByText(ruleText)).not.toBeInTheDocument();
    });

    it('saves directive changes when clicking Save Directive button', async () => {
        render(<MasterPlaybookSection />);

        await screen.findByText('Artist Master Directive');
        const saveBtn = screen.getByRole('button', { name: /Save Directive/i });
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(mockSaveDirective).toHaveBeenCalled();
            expect(successMock).toHaveBeenCalledWith('Artist Master Directive saved successfully');
        });
    });

    it('toggles to markdown view', async () => {
        render(<MasterPlaybookSection />);

        await screen.findByText('Artist Master Directive');
        const markdownTab = screen.getByRole('button', { name: /Markdown View/i });
        fireEvent.click(markdownTab);

        expect(screen.getByText('Direct Playbook Document')).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders live visual DNA palette swatches when selecting Brand & Aesthetics tab', async () => {
        render(<MasterPlaybookSection />);

        await screen.findByText('Artist Master Directive');
        const brandTab = screen.getByRole('button', { name: /Brand & Aesthetics/i });
        fireEvent.click(brandTab);

        expect(await screen.findByTestId('live-brand-swatch-bar')).toBeInTheDocument();
        expect(screen.getByText('Active Visual DNA Palette')).toBeInTheDocument();
        expect(screen.getByText('Neon Cyan')).toBeInTheDocument();
        expect(screen.getByText('Electric Purple')).toBeInTheDocument();
    });
});

