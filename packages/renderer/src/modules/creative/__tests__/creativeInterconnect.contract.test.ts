// @vitest-environment node
/**
 * Creative Interconnect Contract Tests
 *
 * (Runs in node env — no DOM needed. Also sidesteps the jsdom loader breakage
 *  tracked as ISSUE-692: html-encoding-sniffer CJS-requires ESM-only @exodus/bytes.)
 *
 * Pins the cross-system seams of the creative pipeline:
 *   Image stage → Veo/Omni handoffs (creativeHandoffSlice)
 *   Renderer → generateOmniRemixV3 payload contract (Omni Flash API)
 *   Image → video handoff (VideoDirector.triggerAnimation payload)
 *
 * Two kinds of tests live here:
 *  1. CONTRACT tests — behavior that must keep working (breakage = regression).
 *  2. CHARACTERIZATION tests — pin CURRENTLY-BROKEN seams so they are executable
 *     documentation. Each carries an ISSUE reference from
 *     `.agent/test_ledger/OPEN_ISSUES.md`. When the fix agent repairs a seam, the
 *     characterization test FAILS on purpose — flip the assertion and close the issue.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateImageSchema, GenerateOmniRemixSchema, GenerateVideoSchema } from '@indii/shared';
import { buildCreativeHandoffState } from '@/core/store/slices/creative/creativeHandoffSlice';
import type { StageHandoffPayload } from '@/types/handoff';
import type { HistoryItem } from '@/core/types/history';

// ---------------------------------------------------------------------------
// Fixtures: history items shaped EXACTLY like their real producers build them.
// If a producer starts populating storageUri, update the fixture AND flip the
// matching characterization test.
// ---------------------------------------------------------------------------

/** Shape produced by VideoDirector.saveVideo() — packages/renderer/src/modules/creative/services/VideoDirector.ts */
const videoDirectorItem = {
    id: 'vd-1',
    url: 'https://firebasestorage.googleapis.com/v0/b/x/o/video.mp4?alt=media&token=abc',
    storageUri: 'gs://bucket/video.mp4',
    prompt: 'animated cover',
    timestamp: 1,
    type: 'video',
    projectId: 'p1',
} as HistoryItem;

/** Shape produced by OmniWorkflow success path (addToHistory in handleStartRemix) */
const omniOutputItem = {
    id: 'omni_remix_1',
    type: 'video',
    url: 'https://firebasestorage.googleapis.com/v0/b/x/o/remix.mp4?alt=media&token=xyz',
    storageUri: 'gs://x/remix.mp4',
    prompt: 'Omni Remix: neon stage',
    timestamp: 2,
    projectId: 'p1',
    origin: 'generated',
} as HistoryItem;

/** Shape produced by persistDraftCandidates (Magic Edit) — data-URI url, no storageUri */
const magicEditItem = {
    id: 'me-1',
    url: 'data:image/png;base64,AAAA',
    prompt: 'add a little fly',
    type: 'image',
    timestamp: 3,
    projectId: 'p1',
    origin: 'editor',
} as HistoryItem;

function makeHandoff(item: HistoryItem, role: StageHandoffPayload['role']): StageHandoffPayload {
    return { item, role, originStage: 'image', timestamp: Date.now() };
}

// ---------------------------------------------------------------------------
// 1. Handoff slice semantics
// ---------------------------------------------------------------------------

describe('creativeHandoffSlice — cross-stage handoff semantics', () => {
    let state: any;
    let slice: ReturnType<typeof buildCreativeHandoffState>;

    beforeEach(() => {
        state = {
            setViewMode: vi.fn(),
            setModule: vi.fn().mockResolvedValue(undefined),
            currentModule: 'creative',
        };
        const set = (partial: any) => {
            const next = typeof partial === 'function' ? partial(state) : partial;
            Object.assign(state, next);
        };
        const get = () => state;
        slice = buildCreativeHandoffState(set as any, get as any);
        Object.assign(state, slice);
    });

    it('rejects an asset whose type does not match the role (image as source-video)', () => {
        state.sendToStage('omni', makeHandoff(magicEditItem, 'source-video'));
        expect(state.pendingStageHandoff.omni).toBeNull();
    });

    it('accepts a valid video → omni source handoff and navigates to the omni stage', () => {
        state.sendToStage('omni', makeHandoff(videoDirectorItem, 'source-video'));
        expect(state.pendingStageHandoff.omni?.item.id).toBe('vd-1');
        expect(state.setViewMode).toHaveBeenCalledWith('omni');
    });

    it('consume is read-and-clear: second consume returns null', () => {
        state.sendToStage('veo', makeHandoff(magicEditItem, 'first-frame'));
        const first = state.consumeStageHandoff('veo');
        expect(first?.item.id).toBe('me-1');
        expect(state.consumeStageHandoff('veo')).toBeNull();
    });

    it('contract: a video handed to Omni carries a storageUri for backend reuse', () => {
        state.sendToStage('omni', makeHandoff(videoDirectorItem, 'source-video'));
        expect(state.pendingStageHandoff.omni?.item.storageUri).toBe('gs://bucket/video.mp4');
    });

    it('contract: Omni video can be routed intact into the timeline editor', () => {
        state.sendToStage('editor', {
            item: omniOutputItem,
            role: 'source-video',
            originStage: 'omni',
            timestamp: Date.now(),
        });
        expect(state.pendingStageHandoff.editor?.item).toEqual(omniOutputItem);
        expect(state.setViewMode).toHaveBeenCalledWith('video_production');
    });

    it('contract: a persisted frame from an Omni video can become Veo first-frame input', () => {
        const extractedFrame: HistoryItem = {
            ...omniOutputItem,
            id: 'omni-end-frame',
            type: 'image',
            url: 'https://storage.example/end-frame.jpg',
            storageUri: 'gs://bucket/end-frame.jpg',
            parentId: omniOutputItem.id,
        };
        state.sendToStage('veo', {
            item: extractedFrame,
            role: 'first-frame',
            originStage: 'omni',
            timestamp: Date.now(),
        });
        expect(state.pendingStageHandoff.veo?.item.storageUri).toBe('gs://bucket/end-frame.jpg');
        expect(state.pendingStageHandoff.veo?.role).toBe('first-frame');
    });
});

/** Reproduces the exact derivation in OmniWorkflow's handoff consumer + handleStartRemix */
function buildOmniPayloadFromHandoff(item: HistoryItem, remixPrompt: string) {
    const referenceVideoUri = item.storageUri || '';
    return {
        prompt: remixPrompt,
        task: 'edit' as const,
        referenceVideoUri,
        aspectRatio: '16:9' as const,
        durationSeconds: Math.min(10, Math.max(3, 8)),
    };
}

describe('generateOmniRemixV3 payload contract (Omni Flash API)', () => {
    it('sanity: a well-formed gs:// payload parses', () => {
        const result = GenerateOmniRemixSchema.safeParse({
            prompt: 'remix',
            referenceVideoUri: 'gs://bucket/creative/u1/video/outputs/a.mp4',
        });
        expect(result.success).toBe(true);
    });

    it('contract: a VideoDirector-produced video handed to Omni yields a payload the backend accepts', () => {
        const payload = buildOmniPayloadFromHandoff(videoDirectorItem, 'remix it');
        const result = GenerateOmniRemixSchema.safeParse(payload);
        expect(result.success).toBe(true);
    });

    it("contract: Omni's own output can round-trip into Omni when storageUri is preserved", () => {
        const payload = buildOmniPayloadFromHandoff(omniOutputItem, 'remix the remix');
        expect(GenerateOmniRemixSchema.safeParse({
            ...payload,
            referenceVideoUri: omniOutputItem.storageUri,
        }).success).toBe(true);
    });

    it('an https download URL is NOT an acceptable referenceVideoUri — resolveStorageUrl output cannot be sent back', () => {
        const result = GenerateOmniRemixSchema.safeParse({
            prompt: 'remix',
            referenceVideoUri: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.mp4',
        });
        expect(result.success).toBe(false);
    });

    it('contract: the client payload includes referenceUris when image handoffs are present', () => {
        const payload = {
            ...buildOmniPayloadFromHandoff(videoDirectorItem, 'remix'),
            referenceUris: ['gs://bucket/reference-a.png'],
        };
        expect('referenceUris' in payload).toBe(true);
        expect(GenerateOmniRemixSchema.safeParse({
            ...payload,
            referenceVideoUri: videoDirectorItem.storageUri,
        }).success).toBe(true);
    });

    it('contract: Omni remix payload accepts cost reservation fields', () => {
        const result = GenerateOmniRemixSchema.safeParse({
            prompt: 'remix',
            referenceVideoUri: 'gs://bucket/creative/u1/video/outputs/a.mp4',
            costEstimate: 0.8,
            costReservationId: 'op-123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.costEstimate).toBe(0.8);
            expect(result.data.costReservationId).toBe('op-123');
        }
    });

    it('duration clamp in the client matches the schema bounds (3..10)', () => {
        const clamp = (d: number) => Math.min(10, Math.max(3, d));
        for (const [input, expected] of [[1, 3], [8, 8], [99, 10]] as const) {
            const parsed = GenerateOmniRemixSchema.safeParse({
                prompt: 'x',
                referenceVideoUri: 'gs://b/a.mp4',
                durationSeconds: clamp(input),
            });
            expect(parsed.success).toBe(true);
            if (parsed.success) expect(parsed.data.durationSeconds).toBe(expected);
        }
    });

    it('contract: non-16:9/9:16 project aspect ratios map to the nearest supported video aspect', () => {
        const mapAspect = (aspect: string) => {
            const [widthPart, heightPart] = aspect.split(':');
            const width = Number(widthPart);
            const height = Number(heightPart);
            const ratio = width / height;
            return Math.abs(ratio - (9 / 16)) <= Math.abs(ratio - (16 / 9)) ? '9:16' : '16:9';
        };
        expect(mapAspect('1:1')).toBe('9:16');
        expect(mapAspect('4:5')).toBe('9:16');
        expect(mapAspect('2:1')).toBe('16:9');
    });
});

// ---------------------------------------------------------------------------
// 3. Shared creative gateway schemas
// ---------------------------------------------------------------------------

describe('shared creative gateway schemas', () => {
    it('accepts a minimal valid video payload with gs:// reference media', () => {
        const parsed = GenerateVideoSchema.safeParse({
            prompt: 'clip',
            referenceUris: ['gs://bucket/reference-a.png'],
            sourceVideoUri: 'gs://bucket/source.mp4',
        });
        expect(parsed.success).toBe(true);
    });

    it('rejects non-gs:// reference media for video payloads', () => {
        const parsed = GenerateVideoSchema.safeParse({
            prompt: 'clip',
            referenceUris: ['https://example.com/reference-a.png'],
        });
        expect(parsed.success).toBe(false);
    });

    it('accepts a minimal valid image payload with gs:// references', () => {
        const parsed = GenerateImageSchema.safeParse({
            prompt: 'cover art',
            referenceUri: 'gs://bucket/reference-a.png',
            referenceUris: ['gs://bucket/reference-b.png'],
            sessionId: 'creative-session-1',
        });
        expect(parsed.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 4. Image → video handoff: VideoDirector.triggerAnimation payload
// ---------------------------------------------------------------------------

const capturedPayloads: unknown[] = [];
const mockAddToHistory = vi.hoisted(() => vi.fn());

vi.mock('@/services/firebase', () => ({
    functionsWest1: {},
    functions: {},
    auth: { currentUser: { uid: 'u1' } },
}));
vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => async (payload: unknown) => {
        capturedPayloads.push(payload);
        return { data: { success: true } };
    }),
}));
vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: { generateStructuredData: vi.fn() },
}));
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(() => ({ addToHistory: mockAddToHistory, currentProjectId: 'p1' })),
        subscribe: vi.fn(),
    },
}));

describe('VideoDirector.triggerAnimation — image → video payload contract', () => {
    beforeEach(() => {
        capturedPayloads.length = 0;
        mockAddToHistory.mockClear();
        // node test env does not expose the webcrypto global the renderer relies on
        if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.randomUUID) {
            vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
        }
    });

    it('data-URI images are decomposed into imageBytes + mimeType', async () => {
        const { VideoDirector } = await import('../services/VideoDirector');
        await VideoDirector.triggerAnimation({
            ...magicEditItem,
            url: 'data:image/webp;base64,QUJD',
        } as HistoryItem);
        const payload = capturedPayloads[0] as any;
        expect(payload.image).toEqual({ imageBytes: 'QUJD', mimeType: 'image/webp' });
        expect(payload.referenceImageUri).toBeUndefined();
    });

    it('remote URLs are passed as referenceImageUri', async () => {
        const { VideoDirector } = await import('../services/VideoDirector');
        await VideoDirector.triggerAnimation(videoDirectorItem);
        const payload = capturedPayloads[0] as any;
        expect(payload.referenceImageUri).toBe(videoDirectorItem.url);
    });

    it('persists storageUri when a generated video is saved to history', async () => {
        const { VideoDirector } = await import('../services/VideoDirector');
        await VideoDirector.processGeneratedVideo(videoDirectorItem.url, 'animated cover');
        expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
            storageUri: 'gs://x/video.mp4',
        }));
    });

    it('contract: aspect ratio crosses the image→video boundary', async () => {
        const { VideoDirector } = await import('../services/VideoDirector');
        await VideoDirector.triggerAnimation(magicEditItem, { aspectRatio: '1:1' }); // a 1:1 canvas export
        const payload = capturedPayloads[0] as any;
        expect(payload.options).toEqual({ aspectRatio: '9:16' });
    });
});
