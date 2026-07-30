import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/core/store', () => ({ useStore: vi.fn() }));
vi.mock('../store/videoEditorStore', () => ({ useVideoEditorStore: vi.fn() }));
vi.mock('@/services/video/VideoGenerationService', () => ({ VideoGeneration: {} }));
vi.mock('@/core/context/ToastContext', () => ({ useToast: vi.fn() }));
vi.mock('@/services/video/RenderService', () => ({ renderService: {} }));
vi.mock('@/hooks/useResolvedStorageUrl', () => ({ useResolvedStorageUrl: vi.fn() }));
vi.mock('@/services/storage/resolveStorageUrl', () => ({ resolveStorageUrl: vi.fn() }));
vi.mock('@/core/config/intelligence-models', () => ({
    INTELLIGENCE_MODELS: { VIDEO: { PRO: 'pro' } },
}));

import { StoryboardRenderReceiptView } from './StoryboardTimeline';

describe('Storyboard render receipt UI', () => {
    it.each([
        ['queued' as const, 0],
        ['running' as const, 55],
        ['failed' as const, 55],
    ])('shows %s status without Copy or Download', (status, progress) => {
        const receipt = status === 'failed'
            ? { status, renderId: 'render-1', projectId: 'project-1', progress, error: 'failed' }
            : { status, renderId: 'render-1', projectId: 'project-1', progress };

        render(<StoryboardRenderReceiptView receipt={receipt} />);

        expect(screen.getByTestId('storyboard-render-receipt')).toHaveTextContent(status);
        expect(screen.queryByRole('button', { name: /copy authorized/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /download completed/i })).not.toBeInTheDocument();
    });

    it('offers Copy and Download only for a completed authorized asset', () => {
        render(<StoryboardRenderReceiptView receipt={{
            status: 'completed',
            renderId: 'render-1',
            projectId: 'project-1',
            progress: 100,
            asset: {
                url: 'https://signed.example/private-output',
                expiresAt: Date.now() + 300_000,
                generation: '123456789',
                mimeType: 'video/mp4',
            },
        }} />);

        expect(screen.getByRole('button', { name: /copy authorized/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /download completed/i })).toHaveAttribute(
            'href',
            'https://signed.example/private-output',
        );
    });
});
