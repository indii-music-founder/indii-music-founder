import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MainPromptBar from '../MainPromptBar';
import { useStore } from '@/core/store';
import { AI } from '@/services/ai/AIService';
import { useToast } from '@/core/context/ToastContext';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/core/context/ToastContext');
vi.mock('@/services/ai/AIService');

describe('MainPromptBar', () => {
    const mockSetPrompt = vi.fn();
    const mockSetPendingPrompt = vi.fn();
    const mockToastSuccess = vi.fn();
    const mockToastError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        (useToast as any).mockReturnValue({
            success: mockToastSuccess,
            error: mockToastError
        });

        (useStore as any).mockReturnValue({
            prompt: '',
            setPrompt: mockSetPrompt,
            setPendingPrompt: mockSetPendingPrompt,
            whiskState: {
                subjects: [],
                scenes: [],
                styles: []
            }
        });
    });

    it('renders correctly', () => {
        render(<MainPromptBar />);
        expect(screen.getByPlaceholderText(/Describe the action or context/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generate/i })).toBeInTheDocument();
    });

    it('updates prompt on input change', () => {
        render(<MainPromptBar />);
        const input = screen.getByPlaceholderText(/Describe the action or context/i);
        fireEvent.change(input, { target: { value: 'A new prompt' } });
        expect(mockSetPrompt).toHaveBeenCalledWith('A new prompt');
    });

    it('triggers generation on button click', () => {
        (useStore as any).mockReturnValue({
            prompt: 'Valid prompt',
            setPrompt: mockSetPrompt,
            setPendingPrompt: mockSetPendingPrompt,
            whiskState: { subjects: [], scenes: [], styles: [] }
        });

        render(<MainPromptBar />);
        const button = screen.getByRole('button', { name: /Generate/i });
        fireEvent.click(button);
        expect(mockSetPendingPrompt).toHaveBeenCalledWith('Valid prompt');
    });

    it('shows locked items count', () => {
        (useStore as any).mockReturnValue({
            prompt: '',
            setPrompt: mockSetPrompt,
            whiskState: {
                subjects: [{ checked: true }, { checked: false }],
                scenes: [{ checked: true }],
                styles: []
            }
        });

        render(<MainPromptBar />);
        expect(screen.getByText('2 Locked')).toBeInTheDocument();
    });

    it('handles prompt enhancement', async () => {
        (useStore as any).mockReturnValue({
            prompt: 'simple prompt',
            setPrompt: mockSetPrompt,
            whiskState: { subjects: [], scenes: [], styles: [] }
        });

        const mockAIResponse = {
            text: () => 'enhanced prompt'
        };
        (AI.generateContent as any).mockResolvedValue(mockAIResponse);

        render(<MainPromptBar />);
        const enhanceBtn = screen.getByTitle('Enhance with AI');
        fireEvent.click(enhanceBtn);

        await waitFor(() => {
            expect(AI.generateContent).toHaveBeenCalled();
            expect(mockSetPrompt).toHaveBeenCalledWith('enhanced prompt');
            expect(mockToastSuccess).toHaveBeenCalledWith('Prompt enhanced!');
        });
    });

    it('handles enhancement failure', async () => {
        (useStore as any).mockReturnValue({
            prompt: 'simple prompt',
            setPrompt: mockSetPrompt,
            whiskState: { subjects: [], scenes: [], styles: [] }
        });

        (AI.generateContent as any).mockRejectedValue(new Error('AI failed'));

        render(<MainPromptBar />);
        const enhanceBtn = screen.getByTitle('Enhance with AI');
        fireEvent.click(enhanceBtn);

        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith('Enhance failed');
        });
    });
});
