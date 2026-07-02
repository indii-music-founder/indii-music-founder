import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScreenwriterDashboard from './ScreenwriterDashboard';
import { useStore } from '@/core/store';

const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockCreateArtifact = vi.fn();
const mockSetModule = vi.fn().mockResolvedValue(undefined);
const mockSetGenerationMode = vi.fn();
const mockSetViewMode = vi.fn();
const mockSetCreativePrompt = vi.fn();

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: mockSuccess,
        error: mockError,
        info: vi.fn(),
    }),
}));

vi.mock('@/components/layout/ThreePanelDashboard', () => ({
    ThreePanelDashboard: ({ leftPanel, rightPanel, children }: {
        leftPanel: React.ReactNode;
        rightPanel?: React.ReactNode;
        children: React.ReactNode;
    }) => (
        <div>
            <div data-testid="left-panel">{leftPanel}</div>
            <div data-testid="right-panel">{rightPanel}</div>
            <div data-testid="center-panel">{children}</div>
        </div>
    ),
}));

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('ScreenwriterDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(useStore.getState() as any, {
            setModule: mockSetModule,
            setGenerationMode: mockSetGenerationMode,
            setViewMode: mockSetViewMode,
            setCreativePrompt: mockSetCreativePrompt,
        });
        (window as any).electronAPI = {
            agent: {
                createArtifact: mockCreateArtifact.mockResolvedValue({ success: true }),
            },
        };
    });

    it('exports the storyboard as a real artifact', async () => {
        render(<ScreenwriterDashboard />);

        fireEvent.click(screen.getByRole('button', { name: /export script/i }));

        await waitFor(() => {
            expect(mockCreateArtifact).toHaveBeenCalledTimes(1);
        });

        const [filename, content, options] = mockCreateArtifact.mock.calls[0]!;
        expect(filename).toMatch(/^screenwriter-script-\d+\.md$/);
        expect(content).toContain('# Screenwriter Draft');
        expect(content).toContain('## Scene List');
        expect(options).toEqual({ artifactType: 'walkthrough' });
        expect(mockSuccess).toHaveBeenCalledWith('Script exported to an artifact.');
    });

    it('loads the storyboard into Creative Studio instead of faking a send', async () => {
        render(<ScreenwriterDashboard />);

        fireEvent.click(screen.getByRole('button', { name: /open creative studio/i }));

        await waitFor(() => {
            expect(mockSetCreativePrompt).toHaveBeenCalled();
        });

        expect(mockSetGenerationMode).toHaveBeenCalledWith('video');
        expect(mockSetViewMode).toHaveBeenCalledWith('video_production');
        expect(mockSetModule).toHaveBeenCalledWith('creative');
        expect(mockSuccess).toHaveBeenCalledWith('Storyboard loaded into Creative Studio.');
    });
});
