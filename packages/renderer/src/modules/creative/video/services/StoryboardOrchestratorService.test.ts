import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'uid_storyboard_1' } },
    db: { type: 'firestore' },
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn((_db, col, id) => ({ col, id })),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));

vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn(),
        waitForJob: vi.fn(),
    },
}));

import {
    loadStoryboardProject,
    renderPendingStoryboardSlots,
    saveStoryboardProject,
} from './StoryboardOrchestratorService';
import type { StoryboardProject } from '../schemas/storyboard';

const BASE_STORYBOARD: StoryboardProject = {
    id: 'sb_1',
    name: 'Midnight Storyboard',
    bpm: 96,
    durationSeconds: 32,
    source: 'audio-grid',
    slots: [
        {
            id: 'slot_0',
            barIndex: 0,
            startBar: 0,
            durationBars: 4,
            prompt: 'Opening skyline shot',
            videoUrl: 'https://cdn.example/slot_0.mp4',
            isGenerating: false,
            progress: 100,
            useVocalSync: false,
            useDaisyChain: true,
        },
        {
            id: 'slot_1',
            barIndex: 1,
            startBar: 4,
            durationBars: 4,
            prompt: 'Verse neon corridor',
            isGenerating: false,
            progress: 0,
            useVocalSync: false,
            useDaisyChain: true,
        },
        {
            id: 'slot_2',
            barIndex: 2,
            startBar: 8,
            durationBars: 4,
            prompt: 'Chorus rooftop reveal',
            isGenerating: false,
            progress: 0,
            useVocalSync: false,
            useDaisyChain: true,
        },
        {
            id: 'slot_3',
            barIndex: 3,
            startBar: 12,
            durationBars: 4,
            prompt: '   ',
            isGenerating: false,
            progress: 0,
            useVocalSync: false,
            useDaisyChain: true,
        },
    ],
};

describe('StoryboardOrchestratorService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        mockGetDoc.mockResolvedValue({ exists: () => false });
        mockSetDoc.mockResolvedValue(undefined);
    });

    it('renders pending slots sequentially with daisy-chain frame continuity and skips empty prompts', async () => {
        const updates: Array<{ slotId: string; videoUrl?: string; isGenerating?: boolean }> = [];
        const extractLastFrame = vi.fn(async (url: string) => `frame_from:${url}`);
        const generateVideo = vi.fn(async (opts: { prompt: string }) => [
            { id: `job_${opts.prompt.slice(0, 5)}`, url: '', prompt: opts.prompt },
        ]);
        const waitForJob = vi.fn()
            .mockResolvedValueOnce({
                status: 'completed',
                videoUrl: 'https://cdn.example/slot_1.mp4',
                resultUri: 'gs://bucket/slot_1.mp4',
            })
            .mockResolvedValueOnce({
                status: 'completed',
                videoUrl: 'https://cdn.example/slot_2.mp4',
                resultUri: 'gs://bucket/slot_2.mp4',
            });

        const summary = await renderPendingStoryboardSlots({
            storyboard: BASE_STORYBOARD,
            onSlotUpdate: (slotId, patch) => updates.push({ slotId, ...patch }),
            extractLastFrame,
            generateVideo: generateVideo as never,
            waitForJob: waitForJob as never,
        });

        expect(summary.alreadyCompletedCount).toBe(1);
        expect(summary.skippedEmptyPromptCount).toBe(1);
        expect(summary.renderedSlotIds).toEqual(['slot_1', 'slot_2']);
        expect(summary.failedSlots).toHaveLength(0);

        expect(extractLastFrame).toHaveBeenNthCalledWith(1, 'https://cdn.example/slot_0.mp4');
        expect(extractLastFrame).toHaveBeenNthCalledWith(2, 'https://cdn.example/slot_1.mp4');
        expect(generateVideo).toHaveBeenNthCalledWith(1, expect.objectContaining({
            firstFrame: 'frame_from:https://cdn.example/slot_0.mp4',
        }));
        expect(generateVideo).toHaveBeenNthCalledWith(2, expect.objectContaining({
            firstFrame: 'frame_from:https://cdn.example/slot_1.mp4',
        }));
    });

    it('records per-slot failures honestly and resets generating state', async () => {
        const updates: Array<{ slotId: string; isGenerating?: boolean; progress?: number }> = [];
        const generateVideo = vi.fn().mockRejectedValueOnce(new Error('Quota exceeded'));

        const summary = await renderPendingStoryboardSlots({
            storyboard: {
                ...BASE_STORYBOARD,
                slots: [BASE_STORYBOARD.slots[1]!],
            },
            onSlotUpdate: (slotId, patch) => updates.push({ slotId, ...patch }),
            extractLastFrame: vi.fn(),
            generateVideo: generateVideo as never,
            waitForJob: vi.fn() as never,
        });

        expect(summary.renderedSlotIds).toHaveLength(0);
        expect(summary.failedSlots).toEqual([
            { slotId: 'slot_1', index: 0, error: 'Quota exceeded' },
        ]);
        expect(updates.at(-1)).toEqual({ slotId: 'slot_1', isGenerating: false, progress: 0 });
    });

    it('persists and rehydrates storyboard projects with bpm, slots, and daisy-chain flags', async () => {
        await saveStoryboardProject('proj_alpha', BASE_STORYBOARD);
        expect(mockSetDoc).toHaveBeenCalledTimes(1);

        const loaded = await loadStoryboardProject('proj_alpha');
        expect(loaded).not.toBeNull();
        expect(loaded?.bpm).toBe(96);
        expect(loaded?.slots).toHaveLength(4);
        expect(loaded?.slots[1]?.useDaisyChain).toBe(true);
    });
});
