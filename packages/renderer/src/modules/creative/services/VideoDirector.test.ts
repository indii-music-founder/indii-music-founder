import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoDirector } from './VideoDirector';
import type { SessionChunkEvidence } from '@/config/typesafeJudgments';

describe('VideoDirector.triageSessionChunks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty map for empty chunk array', async () => {
        const verdicts = await VideoDirector.triageSessionChunks([]);
        expect(verdicts.size).toBe(0);
    });

    it('triages session chunks into kept performance vs camera drop discards', async () => {
        const chunks: SessionChunkEvidence[] = [
            {
                chunkId: 'chunk-chorus-1',
                startTimeSeconds: 15.0,
                endTimeSeconds: 22.0,
                transcriptSnippet: 'Detroit nights glowing under neon lights',
                cameraMotionEnergy: 'moderate',
                audioClarityScore: 0.88,
                matchingSongSection: 'CHORUS',
            },
            {
                chunkId: 'chunk-drop-1',
                startTimeSeconds: 45.0,
                endTimeSeconds: 49.0,
                transcriptSnippet: '',
                cameraMotionEnergy: 'erratic',
                audioClarityScore: 0.12,
                matchingSongSection: 'NONE',
            },
            {
                chunkId: 'chunk-broll-1',
                startTimeSeconds: 60.0,
                endTimeSeconds: 65.0,
                transcriptSnippet: '',
                cameraMotionEnergy: 'low',
                audioClarityScore: 0.55,
                matchingSongSection: 'NONE',
            },
        ];

        const verdicts = await VideoDirector.triageSessionChunks(chunks);

        expect(verdicts.size).toBe(3);

        const chorusVerdict = verdicts.get('chunk-chorus-1');
        expect(chorusVerdict).toBeDefined();
        expect(chorusVerdict?.action).toBe('KEEP_PERFORMANCE');
        expect(chorusVerdict?.isUsable).toBe(true);
        expect(chorusVerdict?.visualHookEnergy).toBe(5);

        const dropVerdict = verdicts.get('chunk-drop-1');
        expect(dropVerdict).toBeDefined();
        expect(dropVerdict?.action).toBe('DISCARD_CAMERA_DROP');
        expect(dropVerdict?.isUsable).toBe(false);

        const brollVerdict = verdicts.get('chunk-broll-1');
        expect(brollVerdict).toBeDefined();
        expect(brollVerdict?.action).toBe('KEEP_B_ROLL');
        expect(brollVerdict?.isUsable).toBe(true);
    });
});
