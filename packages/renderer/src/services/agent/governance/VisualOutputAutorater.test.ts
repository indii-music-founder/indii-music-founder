import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    VisualOutputAutorater,
    type VisualEvaluationScore,
    type VisualEvaluationInput,
    VISUAL_THRESHOLDS,
    MAX_CORRECTION_ATTEMPTS,
    IMAGE_TOOL_NAMES,
} from './VisualOutputAutorater';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateStructuredData: vi.fn(),
    },
}));

// Use vi.hoisted to define the addDoc spy before vi.mock hoists
const { addDocMock } = vi.hoisted(() => ({
    addDocMock: vi.fn((..._args: any[]) => Promise.resolve({ id: 'mock-doc-id' })),
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({ id: 'mock-coll-id' })),
    addDoc: addDocMock,
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'test-uid' },
    },
}));

import { GenAI } from '@/services/ai/GenAI';


// ============================================================================
// Fixtures
// ============================================================================

const makeInput = (overrides?: Partial<VisualEvaluationInput>): VisualEvaluationInput => ({
    imageBytes: 'base64-stub-image-data',
    originalBrief: 'A red car on a beach at sunset',
    agentId: 'creative',
    traceId: 'trace-vis-001',
    originalImageId: 'img-001',
    mimeType: 'image/png',
    ...overrides,
});

const passingScore: VisualEvaluationScore = {
    subjectMatch: 9,
    sceneMatch: 9,
    moodMatch: 8,
    technicalAdherence: 8,
    overallPass: true,
    gapsFound: 'None',
    correctivePrompt: '',
};

const failingScore: VisualEvaluationScore = {
    subjectMatch: 4,
    sceneMatch: 3,
    moodMatch: 5,
    technicalAdherence: 7,
    overallPass: false,
    gapsFound: 'Image shows a blue motorcycle in a forest instead of a red car on a beach.',
    correctivePrompt: 'The image must show a RED CAR (not motorcycle) on a BEACH (not forest) at SUNSET. Fix subject and scene.',
};

const edgeCaseScoreSubjectLow: VisualEvaluationScore = {
    subjectMatch: 7, // Below threshold of 8
    sceneMatch: 9,
    moodMatch: 9,
    technicalAdherence: 9,
    overallPass: true,
    gapsFound: 'Subject is slightly off — car color appears orange rather than red.',
    correctivePrompt: 'Ensure the car is clearly RED, not orange.',
};

const edgeCaseScoreSceneLow: VisualEvaluationScore = {
    subjectMatch: 9,
    sceneMatch: 7, // Below threshold of 8
    moodMatch: 8,
    technicalAdherence: 9,
    overallPass: true,
    gapsFound: 'Scene shows a parking lot instead of a beach.',
    correctivePrompt: 'The scene must be a BEACH, not a parking lot.',
};

const edgeCaseOverallFalseHighScores: VisualEvaluationScore = {
    subjectMatch: 10,
    sceneMatch: 10,
    moodMatch: 10,
    technicalAdherence: 10,
    overallPass: false, // LLM judge says fail despite high scores
    gapsFound: 'Image contains NSFW content not aligned with the brand.',
    correctivePrompt: 'Regenerate without any inappropriate content.',
};

// ============================================================================
// Tests
// ============================================================================

describe('VisualOutputAutorater', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        VisualOutputAutorater.clearAllAttempts();
    });

    // ── 1. Pass on first try ──────────────────────────────────────────────
    describe('evaluateImage', () => {
        it('returns structured score from GenAI on successful evaluation', async () => {
            vi.mocked(GenAI.generateStructuredData).mockResolvedValue(passingScore);
            const result = await VisualOutputAutorater.evaluateImage(makeInput());
            expect(result).toEqual(passingScore);
            expect(GenAI.generateStructuredData).toHaveBeenCalledOnce();
        });

        it('returns null when GenAI returns null', async () => {
            vi.mocked(GenAI.generateStructuredData).mockResolvedValue(null);
            const result = await VisualOutputAutorater.evaluateImage(makeInput());
            expect(result).toBeNull();
        });

        it('returns null and does not throw when GenAI rejects', async () => {
            vi.mocked(GenAI.generateStructuredData).mockRejectedValue(new Error('model overloaded'));
            const result = await VisualOutputAutorater.evaluateImage(makeInput());
            expect(result).toBeNull();
        });

        it('embeds the original brief into the evaluation prompt', async () => {
            vi.mocked(GenAI.generateStructuredData).mockResolvedValue(passingScore);
            await VisualOutputAutorater.evaluateImage(makeInput({ originalBrief: 'A purple dragon flying over Tokyo' }));
            const prompt = vi.mocked(GenAI.generateStructuredData).mock.calls[0]?.[0] as string;
            expect(prompt).toContain('A purple dragon flying over Tokyo');
        });
    });

    // ── 2. doesPass threshold logic ──────────────────────────────────────
    describe('doesPass', () => {
        it('returns true when all thresholds are met', () => {
            expect(VisualOutputAutorater.doesPass(passingScore)).toBe(true);
        });

        it('returns false when overallPass is false (even with high scores)', () => {
            expect(VisualOutputAutorater.doesPass(edgeCaseOverallFalseHighScores)).toBe(false);
        });

        it('returns false when subjectMatch is below threshold', () => {
            expect(VisualOutputAutorater.doesPass(edgeCaseScoreSubjectLow)).toBe(false);
        });

        it('returns false when sceneMatch is below threshold', () => {
            expect(VisualOutputAutorater.doesPass(edgeCaseScoreSceneLow)).toBe(false);
        });

        it('returns false when the complete failing score is provided', () => {
            expect(VisualOutputAutorater.doesPass(failingScore)).toBe(false);
        });

        it('returns true at exact threshold boundary (subject=8, scene=8)', () => {
            const boundaryScore: VisualEvaluationScore = {
                ...passingScore,
                subjectMatch: 8,
                sceneMatch: 8,
            };
            expect(VisualOutputAutorater.doesPass(boundaryScore)).toBe(true);
        });
    });

    // ── 3. Retry cap tracking ────────────────────────────────────────────
    describe('correction attempt tracking', () => {
        it('starts at 0 attempts for a new image', () => {
            expect(VisualOutputAutorater.getAttemptCount('img-new')).toBe(0);
        });

        it('increments attempt count on recordAttempt', () => {
            VisualOutputAutorater.recordAttempt('img-retry');
            expect(VisualOutputAutorater.getAttemptCount('img-retry')).toBe(1);
            VisualOutputAutorater.recordAttempt('img-retry');
            expect(VisualOutputAutorater.getAttemptCount('img-retry')).toBe(2);
        });

        it('hasReachedCap returns false before max attempts', () => {
            VisualOutputAutorater.recordAttempt('img-cap');
            expect(VisualOutputAutorater.hasReachedCap('img-cap')).toBe(false);
        });

        it('hasReachedCap returns true at max attempts', () => {
            for (let i = 0; i < MAX_CORRECTION_ATTEMPTS; i++) {
                VisualOutputAutorater.recordAttempt('img-max');
            }
            expect(VisualOutputAutorater.hasReachedCap('img-max')).toBe(true);
        });

        it('resetAttempts clears the counter for a specific image', () => {
            VisualOutputAutorater.recordAttempt('img-reset');
            VisualOutputAutorater.recordAttempt('img-reset');
            VisualOutputAutorater.resetAttempts('img-reset');
            expect(VisualOutputAutorater.getAttemptCount('img-reset')).toBe(0);
            expect(VisualOutputAutorater.hasReachedCap('img-reset')).toBe(false);
        });

        it('clearAllAttempts resets everything', () => {
            VisualOutputAutorater.recordAttempt('img-a');
            VisualOutputAutorater.recordAttempt('img-b');
            VisualOutputAutorater.clearAllAttempts();
            expect(VisualOutputAutorater.getAttemptCount('img-a')).toBe(0);
            expect(VisualOutputAutorater.getAttemptCount('img-b')).toBe(0);
        });
    });

    // ── 4. isImageTool helper ────────────────────────────────────────────
    describe('isImageTool', () => {
        it('returns true for all registered image tool names', () => {
            for (const toolName of IMAGE_TOOL_NAMES) {
                expect(VisualOutputAutorater.isImageTool(toolName)).toBe(true);
            }
        });

        it('returns false for non-image tools', () => {
            expect(VisualOutputAutorater.isImageTool('generate_video')).toBe(false);
            expect(VisualOutputAutorater.isImageTool('delegate_task')).toBe(false);
            expect(VisualOutputAutorater.isImageTool('save_memory')).toBe(false);
        });
    });

    // ── 5. Audit logging ─────────────────────────────────────────────────
    describe('logAuditRecord', () => {
        it('writes audit record to Firestore when user is authenticated', async () => {
            await VisualOutputAutorater.logAuditRecord(makeInput(), passingScore, true, 1);
            expect(addDocMock).toHaveBeenCalled();
            const lastCall = addDocMock.mock.calls[addDocMock.mock.calls.length - 1] as any[];
            const payload = lastCall?.[1] as Record<string, unknown>;
            expect(payload.traceId).toBe('trace-vis-001');
            expect(payload.passed).toBe(true);
            expect(payload.attemptNumber).toBe(1);
            expect(payload.score).toBeDefined();
            expect((payload.score as Record<string, unknown>).subjectMatch).toBe(9);
        });

        it('does not throw when Firestore write fails', async () => {
            addDocMock.mockRejectedValueOnce(new Error('firestore down'));
            await expect(
                VisualOutputAutorater.logAuditRecord(makeInput(), failingScore, false, 2)
            ).resolves.toBeUndefined();
        });

        it('logs null score when score is null', async () => {
            await VisualOutputAutorater.logAuditRecord(makeInput(), null, false, 1);
            const lastCall = addDocMock.mock.calls[addDocMock.mock.calls.length - 1] as any[];
            const payload = lastCall?.[1] as Record<string, unknown>;
            expect(payload.score).toBeNull();
            expect(payload.correctivePrompt).toBeNull();
        });
    });

    // ── 6. Constants are sane ────────────────────────────────────────────
    describe('constants', () => {
        it('VISUAL_THRESHOLDS has expected shape and values', () => {
            expect(VISUAL_THRESHOLDS.SUBJECT_MATCH_MIN).toBe(8);
            expect(VISUAL_THRESHOLDS.SCENE_MATCH_MIN).toBe(8);
            expect(VISUAL_THRESHOLDS.REQUIRE_OVERALL_PASS).toBe(true);
        });

        it('MAX_CORRECTION_ATTEMPTS is 2', () => {
            expect(MAX_CORRECTION_ATTEMPTS).toBe(2);
        });

        it('IMAGE_TOOL_NAMES includes core image tools', () => {
            expect(IMAGE_TOOL_NAMES).toContain('generate_image');
            expect(IMAGE_TOOL_NAMES).toContain('edit_image_with_annotations');
            expect(IMAGE_TOOL_NAMES).toContain('batch_edit_images');
        });
    });
});


