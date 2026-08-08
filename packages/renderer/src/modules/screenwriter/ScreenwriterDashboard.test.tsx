import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScreenwriterDashboard, { screenwriterDraftStorageKey } from './ScreenwriterDashboard';
import { useStore } from '@/core/store';
import { useVideoEditorStore } from '@/modules/creative/video/store/videoEditorStore';

const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockCreateArtifact = vi.fn();
const mockSetModule = vi.fn().mockResolvedValue(undefined);
const mockSetGenerationMode = vi.fn();
const mockSetViewMode = vi.fn();
const DRAFT_KEY = screenwriterDraftStorageKey('test-user', 'test-project');

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
        window.localStorage.removeItem(DRAFT_KEY);
        Object.assign(useStore.getState() as any, {
            setModule: mockSetModule,
            setGenerationMode: mockSetGenerationMode,
            setViewMode: mockSetViewMode,
            userProfile: { id: 'test-user' },
            currentProjectId: 'test-project',
        });
        useVideoEditorStore.getState().setStoryboardProject(null);
        useVideoEditorStore.getState().setViewMode('director');
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

    it('opens a typed, scene-preserving storyboard in Creative Studio', async () => {
        render(<ScreenwriterDashboard />);

        fireEvent.click(screen.getByRole('button', { name: /open creative studio/i }));

        await waitFor(() => expect(mockSetModule).toHaveBeenCalledWith('creative'));

        const editorState = useVideoEditorStore.getState();
        expect(editorState.viewMode).toBe('storyboard');
        expect(editorState.storyboardProject).toMatchObject({
            source: 'screenwriter',
            durationSeconds: 20,
            tone: 'cinematic',
        });
        expect(editorState.storyboardProject?.slots).toHaveLength(3);
        expect(editorState.storyboardProject?.slots[0]).toMatchObject({
            sourceSceneNumber: 1,
            heading: 'EXT. CITY ALLEY - NIGHT',
            cameraAngle: 'Extreme Wide Shot - Slow tracking lateral pan',
            durationSeconds: 5,
            startSeconds: 0,
            prompt: expect.stringContaining('rainy neon alley'),
        });
        expect(editorState.storyboardProject?.slots[1]).toMatchObject({
            sourceSceneNumber: 2,
            durationSeconds: 8,
            startSeconds: 5,
        });
        expect(mockSetGenerationMode).toHaveBeenCalledWith('video');
        expect(mockSetViewMode).toHaveBeenCalledWith('video_production');
        expect(mockSuccess).toHaveBeenCalledWith('3 storyboard scenes opened in Creative Studio.');
    });

    it('persists the draft locally across remounts', async () => {
        const { unmount } = render(<ScreenwriterDashboard />);

        fireEvent.click(screen.getByRole('button', { name: /visual storyboarder/i }));

        const sceneDescription = screen.getByDisplayValue(
            'Neon glowing signs flicker. Slick puddles on concrete reflect vibrant magenta and cyan lights. Rain droplets splash slowly on the pavement.'
        );
        fireEvent.change(sceneDescription, { target: { value: 'Reloaded scene description' } });

        await waitFor(() => {
            expect(window.localStorage.getItem(DRAFT_KEY)).toContain('Reloaded scene description');
        });

        unmount();
        render(<ScreenwriterDashboard />);

        await waitFor(() => {
            expect(screen.getByText('Edit Scene Board')).toBeInTheDocument();
        });

        expect(screen.getByDisplayValue('Reloaded scene description')).toBeInTheDocument();
    });

    it('adds an editable blank scene without pretending AI generated it', async () => {
        render(<ScreenwriterDashboard />);

        expect(screen.getByRole('button', { name: /ai expansion unavailable/i })).toBeDisabled();
        expect(screen.getByText(/ai expansion is not connected/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /add blank scene/i }));

        expect(screen.getByText('Edit Scene Board')).toBeInTheDocument();
        expect(screen.getByDisplayValue('UNTITLED SCENE')).toBeInTheDocument();
        expect(screen.getByText('4 scene boards')).toBeInTheDocument();
        await waitFor(() => {
            expect(window.localStorage.getItem(DRAFT_KEY)).toContain('UNTITLED SCENE');
        });
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
        window.localStorage.setItem(DRAFT_KEY, rawDraft);

        render(<ScreenwriterDashboard />);

        expect(screen.getByRole('alert')).toHaveTextContent('invalid duration');
        const durationInput = screen.getByDisplayValue('-7');
        expect(window.localStorage.getItem(DRAFT_KEY)).toBe(rawDraft);

        fireEvent.click(screen.getByRole('button', { name: /open creative studio/i }));
        expect(mockSetModule).not.toHaveBeenCalled();
        expect(useVideoEditorStore.getState().storyboardProject).toBeNull();
        expect(mockError).toHaveBeenCalledWith(expect.stringContaining('invalid saved duration'));

        fireEvent.change(durationInput, { target: { value: '9' } });

        await waitFor(() => {
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            expect(window.localStorage.getItem(DRAFT_KEY)).toContain('"duration":9');
        });
    });
});
