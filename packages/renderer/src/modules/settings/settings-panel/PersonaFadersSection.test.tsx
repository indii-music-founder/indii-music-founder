import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PERSONA_FADER_DEFAULT } from '@indii/shared';

const mockToast = vi.fn();
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ showToast: mockToast }),
}));

const mockLoadFaders = vi.fn();
const mockSaveFaders = vi.fn();
const mockResetFaders = vi.fn();

vi.mock('@/services/persona/PersonaFaderRepository', () => ({
    loadPersonaFaderValues: (personaId: string) => mockLoadFaders(personaId),
    savePersonaFaderValues: (personaId: string, values: any) => mockSaveFaders(personaId, values),
    resetPersonaFaderValues: (personaId: string) => mockResetFaders(personaId),
}));

import { PersonaFadersSection } from './PersonaFadersSection';

describe('PersonaFadersSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLoadFaders.mockResolvedValue({ ...PERSONA_FADER_DEFAULT });
        mockSaveFaders.mockResolvedValue(undefined);
        mockResetFaders.mockResolvedValue(undefined);
    });

    it('renders persona selector and all 5 posture sliders', async () => {
        render(<PersonaFadersSection />);

        expect(screen.getByTestId('persona-faders-section')).toBeInTheDocument();
        expect(screen.getByText('AI Persona & Personality Sliders')).toBeInTheDocument();

        // Check persona tabs
        expect(screen.getAllByText('Manager (Conductor)').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Contract Reader')).toBeInTheDocument();
        expect(screen.getByText('A&R Specialist')).toBeInTheDocument();

        // Check slider labels
        await waitFor(() => {
            expect(screen.getByText('Risk Tolerance')).toBeInTheDocument();
            expect(screen.getByText('Brevity & Conciseness')).toBeInTheDocument();
            expect(screen.getByText('Directness & Candor')).toBeInTheDocument();
            expect(screen.getByText('Formality & Register')).toBeInTheDocument();
            expect(screen.getByText('Reasoning Transparency')).toBeInTheDocument();
        });
    });

    it('allows changing sliders and saving posture to repository', async () => {
        render(<PersonaFadersSection />);

        await waitFor(() => {
            expect(screen.getByLabelText(/Risk Tolerance/)).toBeInTheDocument();
        });

        const riskSlider = screen.getByLabelText(/Risk Tolerance/);
        fireEvent.change(riskSlider, { target: { value: '85' } });

        const saveButton = screen.getByRole('button', { name: /Save Posture/i });
        expect(saveButton).not.toBeDisabled();

        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(mockSaveFaders).toHaveBeenCalledWith(
                'manager',
                expect.objectContaining({ riskTolerance: 85 })
            );
            expect(mockToast).toHaveBeenCalledWith(
                expect.stringContaining('Saved Manager'),
                'success'
            );
        });
    });

    it('switches personas and loads their saved fader values', async () => {
        mockLoadFaders.mockImplementation(async (id: string) => {
            if (id === 'contractReader') {
                return { ...PERSONA_FADER_DEFAULT, formality: 90 };
            }
            return { ...PERSONA_FADER_DEFAULT };
        });

        render(<PersonaFadersSection />);

        const contractReaderTab = screen.getByText('Contract Reader');
        fireEvent.click(contractReaderTab);

        await waitFor(() => {
            expect(mockLoadFaders).toHaveBeenCalledWith('contractReader');
        });
    });

    it('resets persona posture back to defaults on click', async () => {
        render(<PersonaFadersSection />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Reset Defaults/i })).toBeInTheDocument();
        });

        const resetButton = screen.getByRole('button', { name: /Reset Defaults/i });
        fireEvent.click(resetButton);

        await waitFor(() => {
            expect(mockResetFaders).toHaveBeenCalledWith('manager');
            expect(mockToast).toHaveBeenCalledWith(
                expect.stringContaining('Reset'),
                'info'
            );
        });
    });

    it('applies archetype preset and updates posture sliders', async () => {
        render(<PersonaFadersSection />);

        await waitFor(() => {
            expect(screen.getByText('Major Label Shark')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Major Label Shark'));

        await waitFor(() => {
            const riskSlider = screen.getByLabelText(/Risk Tolerance/) as HTMLInputElement;
            expect(riskSlider.value).toBe('90');
            expect(mockToast).toHaveBeenCalledWith(
                expect.stringContaining('Applied MAJOR LABEL SHARK posture'),
                'info'
            );
        });
    });

    it('synchronizes all 40 sliders across all 8 personas in batch', async () => {
        render(<PersonaFadersSection />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Sync to All 8 Personas/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Sync to All 8 Personas/i }));

        await waitFor(() => {
            expect(mockSaveFaders).toHaveBeenCalledTimes(8);
            expect(mockToast).toHaveBeenCalledWith(
                expect.stringContaining('Synchronized all 40 sliders'),
                'success'
            );
        });
    });

    it('toggles autonomous agent personality evolution', async () => {
        render(<PersonaFadersSection />);

        await waitFor(() => {
            expect(screen.getByText('Autonomous Agent Personality Evolution')).toBeInTheDocument();
        });

        const toggleBtn = screen.getByRole('button', { name: /Disabled/i });
        fireEvent.click(toggleBtn);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Enabled/i })).toBeInTheDocument();
            expect(mockToast).toHaveBeenCalledWith(
                expect.stringContaining('Autonomous personality evolution enabled'),
                'info'
            );
        });
    });
});

