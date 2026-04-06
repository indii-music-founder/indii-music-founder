import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ── Mocks ────────────────────────────────────────────────────────

let mockStoreState: Record<string, unknown> = {};

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mockStoreState),
}));

vi.mock('zustand/react/shallow', () => ({
    useShallow: (fn: unknown) => fn,
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: { generateImages: vi.fn(), remixImage: vi.fn() },
}));

vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: { generateVideo: vi.fn() },
}));

vi.mock('@/utils/logger', () => ({
    logger: { error: vi.fn() },
}));

vi.mock('@/components/ui/card', () => ({
    Card: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <button {...props}>{children}</button>,
}));

// ── Imports Under Test ───────────────────────────────────────────

import MultimodalGauntlet from './MultimodalGauntlet';
import { GauntletStep } from './components/GauntletStep';
import { GauntletPreview } from './components/GauntletPreview';

// ── Tests ────────────────────────────────────────────────────────

describe('MultimodalGauntlet', () => {
    beforeEach(() => {
        mockStoreState = {
            userProfile: { id: 'user-1', uid: 'user-1' },
        };
    });

    it('renders the gauntlet title and subtitle', () => {
        render(<MultimodalGauntlet />);
        expect(screen.getByText('MULTIMODAL GAUNTLET')).toBeInTheDocument();
        expect(screen.getByText('PROVING CONSISTENT AI GENERATION & LOOPING LOGIC')).toBeInTheDocument();
    });

    it('renders all 4 gauntlet steps', () => {
        render(<MultimodalGauntlet />);
        expect(screen.getByText('Primary Image Generation')).toBeInTheDocument();
        expect(screen.getByText('Derivative Reference (Consistency)')).toBeInTheDocument();
        expect(screen.getByText('Temporal Interpolation (Video)')).toBeInTheDocument();
        expect(screen.getByText('Loop Synchronization')).toBeInTheDocument();
    });

    it('renders the start button', () => {
        render(<MultimodalGauntlet />);
        expect(screen.getByText('START PROOF OF LIFE')).toBeInTheDocument();
    });
});

describe('GauntletStep', () => {
    it('renders in pending state', () => {
        render(<GauntletStep num={1} title="Test Step" status="pending" detail="Some detail" />);
        const step = screen.getByTestId('gauntlet-step-1');
        expect(step).toHaveAttribute('data-status', 'pending');
    });

    it('renders in active state', () => {
        render(<GauntletStep num={2} title="Active Step" status="active" detail="Running" />);
        const step = screen.getByTestId('gauntlet-step-2');
        expect(step).toHaveAttribute('data-status', 'active');
    });

    it('renders in complete state', () => {
        render(<GauntletStep num={3} title="Done Step" status="complete" detail="Completed" />);
        const step = screen.getByTestId('gauntlet-step-3');
        expect(step).toHaveAttribute('data-status', 'complete');
    });
});

describe('GauntletPreview', () => {
    it('shows waiting state when no image', () => {
        render(<GauntletPreview loading={false} step={0} resultImage={undefined} videoJobId={undefined} />);
        expect(screen.getByText('Waiting for Execution')).toBeInTheDocument();
    });

    it('shows loading overlay when loading', () => {
        render(<GauntletPreview loading={true} step={2} resultImage={undefined} videoJobId={undefined} />);
        expect(screen.getByText('IF IT WORKED...')).toBeInTheDocument();
        expect(screen.getByText('PROCESSING STEP 2')).toBeInTheDocument();
    });

    it('shows video job ID when present', () => {
        render(<GauntletPreview loading={false} step={5} resultImage="data:image/png;base64,test" videoJobId="job-abc-123" />);
        expect(screen.getByText('Job ID Detected')).toBeInTheDocument();
        expect(screen.getByText('job-abc-123')).toBeInTheDocument();
    });
});
