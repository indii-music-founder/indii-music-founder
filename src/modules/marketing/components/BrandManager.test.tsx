import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BrandManager from './BrandManager';

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

// Mock AI Service
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn().mockResolvedValue({
            text: () => JSON.stringify({
                isConsistent: true,
                score: 95,
                issues: [],
                suggestions: ['Great job!']
            })
        })
    }
}));

// Mock Firebase Functions (still needed for saveGuidelines potentially)
vi.mock('@/services/firebase', () => ({
    functions: {},
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    updateDoc: vi.fn()
}));

// Mock AIService
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn().mockResolvedValue({
            text: () => JSON.stringify({
                isConsistent: true,
                score: 95,
                issues: [],
                suggestions: ['Great job!']
            })
        })
    }
}));

describe('BrandManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders input fields', () => {
        render(<BrandManager />);
        expect(screen.getByPlaceholderText(/Paste your brand guidelines here/)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Paste the content you want to review/)).toBeInTheDocument();
    });

    it('disables analyze button when inputs are empty', () => {
        render(<BrandManager />);
        const button = screen.getByText('Analyze Consistency');
        expect(button).toBeDisabled();
    });

    it('enables analyze button when inputs are filled', () => {
        render(<BrandManager />);
        const guidelinesInput = screen.getByPlaceholderText(/Paste your brand guidelines here/);
        const contentInput = screen.getByPlaceholderText(/Paste the content you want to review/);

        fireEvent.change(guidelinesInput, { target: { value: 'Guidelines' } });
        fireEvent.change(contentInput, { target: { value: 'Content' } });

        const button = screen.getByText('Analyze Consistency');
        expect(button).not.toBeDisabled();
    });

    it('displays analysis results after execution', async () => {
        render(<BrandManager />);
        const guidelinesInput = screen.getByPlaceholderText(/Paste your brand guidelines here/);
        const contentInput = screen.getByPlaceholderText(/Paste the content you want to review/);

        fireEvent.change(guidelinesInput, { target: { value: 'Guidelines' } });
        fireEvent.change(contentInput, { target: { value: 'Content' } });

        const button = screen.getByText('Analyze Consistency');
        fireEvent.click(button);

        expect(screen.getByText('Analyzing...')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('95/100')).toBeInTheDocument();
            expect(screen.getByText('Great job!')).toBeInTheDocument();
        });
    });
});
