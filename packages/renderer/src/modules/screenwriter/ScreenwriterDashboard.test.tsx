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
        window.localStorage.removeItem('indii-screenwriter-draft-v1');
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
        expect(content).toContain('## Timing Manifest');
        expect(content).toContain('"totalDurationSeconds": 20');
        expect(content).toContain('"durationSeconds": 5');
        expect(options).toEqual({ artifactType: 'walkthrough' });
        expect(mockSuccess).toHaveBeenCalledWith('Script exported to an artifact.');
    });

    it('loads the storyboard into Creative Studio instead of faking a send', async () => {
        render(<ScreenwriterDashboard />);

        fireEvent.click(screen.getByRole('button', { name: /open creative studio/i }));

        await waitFor(() => {
            expect(mockSetCreativePrompt).toHaveBeenCalled();
        });

        expect(mockSetCreativePrompt).toHaveBeenCalledWith(expect.stringContaining(
            'Storyboard timing manifest: {"totalDurationSeconds":20,"scenes":[{"sceneNumber":1,"durationSeconds":5}'
        ));
        expect(mockSetCreativePrompt).toHaveBeenCalledWith(expect.stringContaining('(5s)'));
        expect(mockSetGenerationMode).toHaveBeenCalledWith('video');
        expect(mockSetViewMode).toHaveBeenCalledWith('video_production');
        expect(mockSetModule).toHaveBeenCalledWith('creative');
        expect(mockSuccess).toHaveBeenCalledWith('Storyboard loaded into Creative Studio.');
    });

    it('persists the draft locally across remounts', async () => {
        const { unmount } = render(<ScreenwriterDashboard />);

        fireEvent.click(screen.getByRole('button', { name: /visual storyboarder/i }));

        const sceneDescription = screen.getByDisplayValue(
            'Neon glowing signs flicker. Slick puddles on concrete reflect vibrant magenta and cyan lights. Rain droplets splash slowly on the pavement.'
        );
        fireEvent.change(sceneDescription, { target: { value: 'Reloaded scene description' } });

        await waitFor(() => {
            expect(window.localStorage.getItem('indii-screenwriter-draft-v1')).toContain('Reloaded scene description');
        });

        unmount();
        render(<ScreenwriterDashboard />);

        await waitFor(() => {
            expect(screen.getByText('Edit Scene Board')).toBeInTheDocument();
        });

        expect(screen.getByDisplayValue('Reloaded scene description')).toBeInTheDocument();
    });

    it('rejects invalid scene timing without corrupting the draft', () => {
        render(<ScreenwriterDashboard />);
        fireEvent.click(screen.getByRole('button', { name: /visual storyboarder/i }));

        const durationInput = screen.getByDisplayValue('5');
        fireEvent.change(durationInput, { target: { value: '-1' } });

        expect(mockError).toHaveBeenCalledWith(expect.stringContaining('between 1 and 60 seconds'));
        expect(durationInput).toHaveValue(5);
    });

    it('preserves a corrupt legacy duration for visible repair and blocks persistence and handoff', async () => {
        const corruptDraft = {
            activeTab: 'storyboard',
            songConcept: 'Legacy concept',
            selectedTone: 'cinematic',
            selectedSceneId: 'legacy-scene',
            scenes: [{
                id: 'legacy-scene',
                sceneNumber: 1,
                heading: 'INT. LEGACY ROOM - NIGHT',
                description: 'A recovered scene.',
                cameraAngle: 'Wide shot',
                duration: '-7',
                veoPrompt: 'Recovered prompt',
            }],
        };
        const rawDraft = JSON.stringify(corruptDraft);
        window.localStorage.setItem('indii-screenwriter-draft-v1', rawDraft);

        render(<ScreenwriterDashboard />);

        expect(screen.getByRole('alert')).toHaveTextContent('invalid duration');
        const durationInput = screen.getByDisplayValue('-7');
        expect(window.localStorage.getItem('indii-screenwriter-draft-v1')).toBe(rawDraft);

        fireEvent.click(screen.getByRole('button', { name: /open creative studio/i }));
        expect(mockSetModule).not.toHaveBeenCalled();
        expect(mockError).toHaveBeenCalledWith(expect.stringContaining('invalid saved duration'));

        fireEvent.change(durationInput, { target: { value: '9' } });

        await waitFor(() => {
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            expect(window.localStorage.getItem('indii-screenwriter-draft-v1')).toContain('"duration":9');
        });
    });
});
