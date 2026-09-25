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

describe('VideoDirector.auditVideoContinuity', () => {
    it('audits music video continuity across timeline cuts', async () => {
        const cuts = [
            { order: 0, chunkId: 'cut-1', startTimeSeconds: 0, shotScale: 'WIDE' as const, durationSeconds: 3.5, isPerformance: false },
            { order: 1, chunkId: 'cut-2', startTimeSeconds: 3.5, shotScale: 'MEDIUM' as const, durationSeconds: 2.5, isPerformance: true },
            { order: 2, chunkId: 'cut-3', startTimeSeconds: 6.0, shotScale: 'CLOSEUP' as const, durationSeconds: 2.0, isPerformance: true },
        ];

        const verdict = await VideoDirector.auditVideoContinuity(cuts);

        expect(verdict.status).toBe('READY_TO_RENDER');
        expect(verdict.flowScore).toBe(4);
        expect(verdict.hasAdequateCoverage).toBe(true);
    });
});

describe('VideoDirector.auditCameraAngleContinuity', () => {
    it('audits camera angle transitions and flags jump-angle violation', async () => {
        const repetitiveCuts = [
            { shotIndex: 0, angle: 'EYE_LEVEL' as const, durationSeconds: 3.0, focalDescription: 'Singer at mic' },
            { shotIndex: 1, angle: 'EYE_LEVEL' as const, durationSeconds: 3.0, focalDescription: 'Singer looking at camera' },
        ];

        const verdict = await VideoDirector.auditCameraAngleContinuity(repetitiveCuts);

        expect(verdict.hasJumpAngleViolation).toBe(true);
        expect(verdict.recommendedNextAngle).toBe('LOW_ANGLE_HEROIC');
        expect(verdict.compositionDiversityScore).toBeLessThanOrEqual(4);
    });

    it('returns high diversity score for varied camera angles', async () => {
        const dynamicCuts = [
            { shotIndex: 0, angle: 'EYE_LEVEL' as const, durationSeconds: 2.5, focalDescription: 'Establishing band' },
            { shotIndex: 1, angle: 'LOW_ANGLE_HEROIC' as const, durationSeconds: 2.0, focalDescription: 'Lead guitarist solo' },
            { shotIndex: 2, angle: 'POINT_OF_VIEW' as const, durationSeconds: 1.8, focalDescription: 'Drummer perspective' },
            { shotIndex: 3, angle: 'DUTCH_TILT_TENSION' as const, durationSeconds: 2.2, focalDescription: 'Bass drop intensity' },
        ];

        const verdict = await VideoDirector.auditCameraAngleContinuity(dynamicCuts);

        expect(verdict.hasJumpAngleViolation).toBe(false);
        expect(verdict.compositionDiversityScore).toBe(5);
        expect(verdict.recommendedNextAngle).toBe('HIGH_ANGLE_VULNERABLE');
    });
});

describe('VideoDirector.recommendColorGrade', () => {
    it('recommends neon cyber nocturne for electronic synthwave', async () => {
        const verdict = await VideoDirector.recommendColorGrade({
            trackTitle: 'Midnight Grid Runner',
            genre: 'Synthwave',
            energyLevel: 'HIGH',
            moodTags: ['futuristic', 'neon', 'cyberpunk'],
            intendedVibe: 'Night driving through Tokyo neon reflections',
        });

        expect(verdict.recommendedPreset).toBe('NEON_CYBER_NOCTURNE');
        expect(verdict.clashingGradeHazard).toBe(false);
        expect(verdict.aestheticSynergyScore).toBeGreaterThanOrEqual(4);
    });

    it('recommends warm golden hour for acoustic indie track', async () => {
        const verdict = await VideoDirector.recommendColorGrade({
            trackTitle: 'Porch Swing Memories',
            genre: 'Acoustic Folk',
            energyLevel: 'LOW',
            moodTags: ['nostalgic', 'organic', 'peaceful'],
            intendedVibe: 'Sunset porch guitar strumming',
        });

        expect(verdict.recommendedPreset).toBe('WARM_GOLDEN_HOUR');
        expect(verdict.clashingGradeHazard).toBe(false);
    });
});
