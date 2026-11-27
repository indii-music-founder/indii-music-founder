import { describe, it, expect, vi, beforeEach } from 'vitest';

const analyze = vi.hoisted(() => vi.fn());
const updateProjectMetadata = vi.hoisted(() => vi.fn());
const storeState = vi.hoisted(() => ({ currentProjectId: 'p1' as string | null, updateProjectMetadata }));

vi.mock('@/services/audio/AudioIntelligenceService', () => ({ audioIntelligence: { analyze } }));
vi.mock('@/core/store', () => ({ useStore: { getState: () => storeState } }));

import { MediaTools } from '@/services/agent/tools/MediaTools';

const profile = {
    technical: { bpm: 120, key: 'C', energy: 0.7 },
    semantic: { mood: ['dark'], genre: ['hip hop'] },
};
const run = () => (MediaTools.analyze_audio_dna as (a: unknown) => Promise<any>)({ audioUrl: 'https://cdn.example/a.mp3' });

describe('analyze_audio_dna project save', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        storeState.currentProjectId = 'p1';
        analyze.mockResolvedValue(profile);
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x'], { type: 'audio/mpeg' }) })));
    });

    it('reports the analysis as saved only after the project write succeeded', async () => {
        updateProjectMetadata.mockResolvedValue(undefined);
        const result = await run();
        expect(result.success).toBe(true);
        expect(result.data.savedToProject).toBe(true);
        expect(updateProjectMetadata).toHaveBeenCalledWith('p1', { audioDna: profile });
    });

    it('still returns the analysis, flagged unsaved, when the project write fails', async () => {
        updateProjectMetadata.mockRejectedValue(new Error('PERMISSION_DENIED'));
        const result = await run();
        expect(result.success).toBe(true);
        expect(result.data.dna.bpm).toBe(120);
        expect(result.data.savedToProject).toBe(false);
    });

    it('does not attempt a save without an open project', async () => {
        storeState.currentProjectId = null;
        const result = await run();
        expect(result.data.savedToProject).toBe(false);
        expect(updateProjectMetadata).not.toHaveBeenCalled();
    });
});
