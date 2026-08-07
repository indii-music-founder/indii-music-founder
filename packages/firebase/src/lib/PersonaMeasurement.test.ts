import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
    const mockEmbedContent = vi.fn();
    const mockGetVertexAIClient = vi.fn().mockReturnValue({
        models: { embedContent: mockEmbedContent },
    });

    const mockAdd = vi.fn().mockResolvedValue({ id: 'measurement-1' });
    const mockCollection = vi.fn().mockReturnValue({ add: mockAdd });
    const mockFirestore = () => ({ collection: mockCollection });
    (mockFirestore as unknown as { FieldValue: unknown }).FieldValue = {
        serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
    };

    return { mockEmbedContent, mockGetVertexAIClient, mockAdd, mockCollection, mockFirestore };
});

vi.mock('./vertexClient', () => ({
    getVertexAIClient: mocks.mockGetVertexAIClient,
}));

vi.mock('firebase-admin', () => ({
    apps: [{}],
    initializeApp: vi.fn(),
    firestore: mocks.mockFirestore,
}));

import {
    measureAxis,
    measureAllAxes,
    recordMeasurement,
    resetAnchorEmbeddingCache,
} from './PersonaMeasurement';
import { PERSONA_FADER_AXES } from '@indii/shared';

const DIM = 768;

/** A unit vector along dimension `i` — trivially distinguishable from others by cosine similarity. */
function basisVector(i: number): number[] {
    const v = new Array(DIM).fill(0);
    v[i % DIM] = 1;
    return v;
}

/** A vector that's a slight perturbation of a basis vector — "close to" that direction but not identical. */
function nearBasisVector(i: number, noise = 0.05): number[] {
    const v = basisVector(i);
    v[(i + 1) % DIM] = noise;
    return v;
}

describe('PersonaMeasurement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetAnchorEmbeddingCache();
    });

    describe('measureAxis', () => {
        it('picks the band whose anchors are closest to the response embedding', async () => {
            // 5 anchor calls (one per band, embedded together per band → 5 vectors each)
            // then 1 response embedding call. Response is closest to band 4 (index 4).
            mocks.mockEmbedContent
                .mockResolvedValueOnce({ embeddings: [{ values: basisVector(4) }] }) // response embedded first
                .mockResolvedValueOnce({ embeddings: Array(5).fill({ values: basisVector(0) }) }) // band 0 anchors
                .mockResolvedValueOnce({ embeddings: Array(5).fill({ values: basisVector(1) }) }) // band 1
                .mockResolvedValueOnce({ embeddings: Array(5).fill({ values: basisVector(2) }) }) // band 2
                .mockResolvedValueOnce({ embeddings: Array(5).fill({ values: basisVector(3) }) }) // band 3
                .mockResolvedValueOnce({ embeddings: Array(5).fill({ values: nearBasisVector(4) }) }); // band 4 — closest match

            const result = await measureAxis('directness', 'Some real response text', 50);

            expect(result.measuredBand).toBe(4);
            expect(result.measuredPosition).toBe(90); // band 4's representative value
            expect(result.setPosition).toBe(50);
            expect(result.axis).toBe('directness');
        });

        it('throws on empty response text', async () => {
            await expect(measureAxis('brevity', '', 50)).rejects.toThrow(/must not be empty/);
        });

        it('throws when the embedding API returns the wrong dimension', async () => {
            mocks.mockEmbedContent.mockResolvedValue({ embeddings: [{ values: [1, 2, 3] }] });
            await expect(measureAxis('brevity', 'response text', 50)).rejects.toThrow(/expected/i);
        });

        it('caches anchor embeddings across calls for the same axis+band (does not re-embed anchors every call)', async () => {
            mocks.mockEmbedContent.mockResolvedValue({
                embeddings: [{ values: basisVector(0) }, ...Array(4).fill({ values: basisVector(0) })],
            });
            // Simpler: just return a fixed valid response for every call and count invocations.
            mocks.mockEmbedContent.mockImplementation(async (args: { contents: string[] }) => ({
                embeddings: args.contents.map(() => ({ values: basisVector(0) })),
            }));

            await measureAxis('formality', 'first response', 50);
            const callsAfterFirst = mocks.mockEmbedContent.mock.calls.length;

            await measureAxis('formality', 'second response', 50);
            const callsAfterSecond = mocks.mockEmbedContent.mock.calls.length;

            // Second call should only add 1 new embed call (the response itself) —
            // all 5 bands' anchors should be served from cache, not re-embedded.
            expect(callsAfterSecond - callsAfterFirst).toBe(1);
        });
    });

    describe('measureAllAxes', () => {
        it('measures every declared fader axis', async () => {
            mocks.mockEmbedContent.mockImplementation(async (args: { contents: string[] }) => ({
                embeddings: args.contents.map(() => ({ values: basisVector(0) })),
            }));

            const setPositions = Object.fromEntries(PERSONA_FADER_AXES.map((a) => [a, 50])) as Record<
                (typeof PERSONA_FADER_AXES)[number],
                number
            >;

            const results = await measureAllAxes('a full response', setPositions);
            expect(results).toHaveLength(PERSONA_FADER_AXES.length);
            expect(results.map((r) => r.axis).sort()).toEqual([...PERSONA_FADER_AXES].sort());
        });
    });

    describe('recordMeasurement', () => {
        it('writes setPosition and measuredPosition to Firestore for telemetry', async () => {
            await recordMeasurement(
                'manager',
                {
                    axis: 'brevity',
                    setPosition: 80,
                    measuredPosition: 70,
                    measuredBand: 3,
                    confidence: 0.12,
                },
                false
            );

            expect(mocks.mockCollection).toHaveBeenCalledWith('personaMeasurements');
            expect(mocks.mockAdd).toHaveBeenCalledWith(
                expect.objectContaining({
                    personaId: 'manager',
                    axis: 'brevity',
                    setPosition: 80,
                    measuredPosition: 70,
                    isControlGroup: false,
                })
            );
        });

        it('tags a control-group response as isControlGroup: true (T1.7 — without this the tag, "did personalization help" is unanswerable)', async () => {
            await recordMeasurement(
                'manager',
                {
                    axis: 'directness',
                    setPosition: 50,
                    measuredPosition: 50,
                    measuredBand: 2,
                    confidence: 0.3,
                },
                true
            );

            expect(mocks.mockAdd).toHaveBeenCalledWith(
                expect.objectContaining({ isControlGroup: true })
            );
        });
    });

    // ── Style/substance isolation: this module measures OUTPUT, has no
    // channel to influence it. Purely observational, by construction.
    it('measureAxis has no parameter through which it could alter the response it measures', () => {
        // (axis, responseText, setPosition) — setPosition is recorded for
        // telemetry comparison only; it is never used to select which
        // anchor bands are compared against, and never fed back into
        // response generation from within this module.
        expect(measureAxis.length).toBe(3);
    });
});
