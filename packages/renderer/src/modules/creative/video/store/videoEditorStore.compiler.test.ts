import { describe, expect, it } from 'vitest';
import { compileApprovalToTimeline, TimelineCompileError, VideoProject } from './videoEditorStore';

const OWNER_UID = 'user-1';

describe('compileApprovalToTimeline', () => {
    const mockProject: VideoProject = {
        id: 'proj-1',
        name: 'Test Project',
        fps: 30,
        durationInFrames: 0,
        width: 1920,
        height: 1080,
        tracks: [
            { id: 'track-v1', name: 'Video Track', type: 'video' },
        ],
        clips: [],
    };

    const mockApproval = {
        approvalReceiptId: 'app-receipt-1',
        planId: 'plan-1',
        ownerUid: 'user-1',
        projectId: 'proj-1',
        decisions: [
            { segmentId: 'seg-1', action: 'keep' },
            { segmentId: 'seg-2', action: 'reject' },
            { segmentId: 'seg-3', action: 'blooper' },
        ],
    };

    const mockPlan = {
        segments: [
            {
                segmentId: 'seg-1',
                classification: 'spoken',
                proxyStartUs: 0,
                proxyEndUs: 2_000_000, // 2 seconds = 60 frames at 30fps
                originalStartUs: 10_000_000,
                originalEndUs: 12_000_000,
                transcriptText: 'First announcement attempt',
                syncAlignmentId: 'sync-1',
            },
            {
                segmentId: 'seg-2',
                classification: 'failed_take',
                proxyStartUs: 2_000_000,
                proxyEndUs: 5_000_000,
                originalStartUs: 12_000_000,
                originalEndUs: 15_000_000,
                transcriptText: 'Coughing and mistake',
            },
            {
                segmentId: 'seg-3',
                classification: 'candid',
                proxyStartUs: 5_000_000,
                proxyEndUs: 8_000_000, // 3 seconds = 90 frames at 30fps
                originalStartUs: 15_000_000,
                originalEndUs: 18_000_000,
                transcriptText: 'Behind the scenes laugh',
            },
        ],
    };

    const mockSession = {
        original: { bucket: 'b', path: 'p', generation: '1001' },
        proxyManifest: { proxy: { bucket: 'b', path: 'p_proxy', generation: '1002' } },
    };

    it('compiles only approved keep and blooper segments into timeline clips', () => {
        const compiled = compileApprovalToTimeline(mockApproval, mockPlan, mockSession, mockProject, OWNER_UID);

        expect(compiled.clips.length).toBe(2);
        expect(compiled.clips[0]?.approvalReceiptId).toBe('app-receipt-1');
        expect(compiled.clips[0]?.sourceInUs).toBe(10_000_000);
        expect(compiled.clips[0]?.sourceOutUs).toBe(12_000_000);
        expect(compiled.clips[0]?.startFrame).toBe(0);
        expect(compiled.clips[0]?.durationInFrames).toBe(60);

        expect(compiled.clips[1]?.sourceInUs).toBe(15_000_000);
        expect(compiled.clips[1]?.sourceOutUs).toBe(18_000_000);
        expect(compiled.clips[1]?.startFrame).toBe(60);
        expect(compiled.clips[1]?.durationInFrames).toBe(90);

        expect(compiled.durationInFrames).toBe(150);
    });

    // Regression: ISSUE-1196 — authorization
    // Found by /qa on 2026-07-22. `ownerUid` and `projectId` were declared on the
    // parameter type and read by nothing.
    describe('authorization (ISSUE-1196)', () => {
        it('refuses an approval belonging to another user', () => {
            expect(() =>
                compileApprovalToTimeline(mockApproval, mockPlan, mockSession, mockProject, 'someone-else')
            ).toThrow(TimelineCompileError);
        });

        it('refuses an approval targeting a different project', () => {
            const foreign = { ...mockApproval, projectId: 'proj-OTHER' };
            expect(() =>
                compileApprovalToTimeline(foreign, mockPlan, mockSession, mockProject, OWNER_UID)
            ).toThrow(/targets project proj-OTHER/);
        });

        it('refuses a session with no original media generation, rather than severing lineage', () => {
            const noGeneration = { proxyManifest: mockSession.proxyManifest };
            expect(() =>
                compileApprovalToTimeline(mockApproval, mockPlan, noGeneration, mockProject, OWNER_UID)
            ).toThrow(/source lineage/);
        });

        it('refuses a session with no proxy generation', () => {
            const noProxy = { original: mockSession.original };
            expect(() =>
                compileApprovalToTimeline(mockApproval, mockPlan, noProxy, mockProject, OWNER_UID)
            ).toThrow(/proxy lineage/);
        });

        it('mutates nothing when it refuses', () => {
            const before = JSON.stringify(mockProject);
            try {
                compileApprovalToTimeline(mockApproval, mockPlan, mockSession, mockProject, 'someone-else');
            } catch {
                /* expected */
            }
            expect(JSON.stringify(mockProject)).toBe(before);
        });
    });

    // Regression: ISSUE-1180 acceptance 4 — idempotency
    // Found by /qa on 2026-07-22. Clips used uuidv4() and were appended, so
    // recompiling the same approval duplicated the whole timeline with no key to
    // dedupe on.
    describe('idempotency (ISSUE-1180 acceptance 4)', () => {
        it('produces identical clips when run twice for the same approval', () => {
            const once = compileApprovalToTimeline(mockApproval, mockPlan, mockSession, mockProject, OWNER_UID);
            const twice = compileApprovalToTimeline(mockApproval, mockPlan, mockSession, once, OWNER_UID);

            expect(twice.clips).toHaveLength(once.clips.length);
            expect(twice.clips).toEqual(once.clips);
        });

        it('gives compiled clips deterministic ids derived from the approval and segment', () => {
            const a = compileApprovalToTimeline(mockApproval, mockPlan, mockSession, mockProject, OWNER_UID);
            const b = compileApprovalToTimeline(mockApproval, mockPlan, mockSession, mockProject, OWNER_UID);
            expect(a.clips.map(c => c.id)).toEqual(b.clips.map(c => c.id));
            expect(a.clips[0]?.id).toBe('compiled:app-receipt-1:seg-1');
        });

        it('replaces only its own approval’s clips, preserving hand edits and other approvals', () => {
            const withOtherWork: VideoProject = {
                ...mockProject,
                clips: [
                    { id: 'hand-edit-1', type: 'text', text: 'title', startFrame: 0, durationInFrames: 30, trackId: 'track-v1', name: 'Title' },
                    { id: 'compiled:other-receipt:seg-9', type: 'video', startFrame: 0, durationInFrames: 30, trackId: 'track-v1', name: 'Other', approvalReceiptId: 'other-receipt' },
                ],
            };

            const compiled = compileApprovalToTimeline(mockApproval, mockPlan, mockSession, withOtherWork, OWNER_UID);
            const ids = compiled.clips.map(c => c.id);

            expect(ids).toContain('hand-edit-1');
            expect(ids).toContain('compiled:other-receipt:seg-9');
            expect(compiled.clips).toHaveLength(4); // 2 preserved + 2 compiled

            // Recompiling still leaves the unrelated work alone.
            const again = compileApprovalToTimeline(mockApproval, mockPlan, mockSession, compiled, OWNER_UID);
            expect(again.clips).toHaveLength(4);
        });
    });

    // Regression: unclamped source in-point. An override earlier than the segment
    // start drove originalStartUs negative, which no decoder can seek to.
    it('clamps a negative source in-point to zero', () => {
        const earlyOverride = {
            ...mockApproval,
            decisions: [{ segmentId: 'seg-1', action: 'keep', overrideProxyStartUs: -20_000_000, overrideProxyEndUs: 1_000_000 }],
        };
        const compiled = compileApprovalToTimeline(earlyOverride, mockPlan, mockSession, mockProject, OWNER_UID);
        expect(compiled.clips[0]?.sourceInUs).toBe(0);
        expect(compiled.clips[0]?.sourceInUs).toBeGreaterThanOrEqual(0);
    });
});
