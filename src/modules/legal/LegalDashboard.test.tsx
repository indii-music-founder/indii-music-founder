import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LegalDashboard from './LegalDashboard';

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn().mockResolvedValue({
            text: () => JSON.stringify({
                score: 85,
                summary: 'Test Summary',
                risks: ['Risk 1', 'Risk 2']
            })
        }),
        parseJSON: (text: string) => JSON.parse(text),
    },
}));

vi.mock('@/services/agent/tools/LegalTools', () => ({
    LegalTools: {
        generate_nda: vi.fn().mockResolvedValue('Mock NDA Content'),
        draft_contract: vi.fn().mockResolvedValue('Mock IP Assignment Content'),
    },
}));

vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: {
        TEXT: {
            FAST: 'fast-model',
            AGENT: 'agent-model',
        },
    },
}));

describe('LegalDashboard', () => {
    it('renders the dashboard title', () => {
        render(<LegalDashboard />);
        expect(screen.getByText('Legal Dashboard')).toBeInTheDocument();
    });

    it('renders upload options', () => {
        render(<LegalDashboard />);
        expect(screen.getByText('Drop contract here')).toBeInTheDocument();
        expect(screen.getByText('Scan Document')).toBeInTheDocument();
    });

    it('shows analysis loading state when file is uploaded', async () => {
        const { container } = render(<LegalDashboard />);

        const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });

        // Find the first file input (Drop zone)
        const fileInput = container.querySelectorAll('input[type="file"]')[0];

        fireEvent.change(fileInput, { target: { files: [file] } });

        expect(await screen.findByText('Analysis Report')).toBeInTheDocument();
        expect(screen.getByText('Test Summary')).toBeInTheDocument();
    });

    it('handles scan document button click', () => {
        const { container } = render(<LegalDashboard />);

        // The scan document input is the second file input
        const scanInput = container.querySelectorAll('input[type="file"]')[1];
        expect(scanInput).toBeInTheDocument();
        expect(scanInput).toHaveAttribute('capture', 'environment');
    });
});
