/**
 * TimelineOrchestratorService.test.ts
 *
 * Unit tests for the Timeline Orchestrator progressive campaign engine.
 * Tests cover:
 * - Template-based timeline creation
 * - Phase & milestone generation
 * - Lifecycle management (activate, pause, resume, cancel)
 * - Phase advancement and skipping
 * - Cadence adjustment
 * - Progress calculation
 * - Template listing
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { TimelineOrchestratorService } from './TimelineOrchestratorService';
import type { TimelineBrief, Timeline, TimelinePhase, TimelineMilestone } from './TimelineTypes';

// ============================================================================
// Mocks
// ============================================================================

// Mock Firebase Auth
const mockUserId = 'test-user-123';
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'test-user-123' },
    },
}));

// Mock Firestore operations
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
    collection: vi.fn((...args: string[]) => args.join('/')),
    doc: vi.fn((...args: string[]) => args.join('/')),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    updateDoc: vi.fn(),
    query: vi.fn((...args: unknown[]) => args),
    where: vi.fn(),
    orderBy: vi.fn(),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

// Mock GenAI for AI-generated timelines
vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateStructuredData: vi.fn().mockResolvedValue({
            phases: [
                { name: 'Tease', startDay: 0, endDay: 14, cadence: 'sparse', agentId: 'marketing', description: 'Build anticipation' },
                { name: 'Launch', startDay: 14, endDay: 35, cadence: 'intense', agentId: 'marketing', description: 'Full launch push' },
                { name: 'Sustain', startDay: 35, endDay: 56, cadence: 'moderate', agentId: 'social', description: 'Maintain momentum' },
            ],
            milestones: [
                { phaseIndex: 0, dayOffset: 2, type: 'post', instruction: 'Post teaser image', assetStrategy: 'create_new', platform: 'Instagram' },
                { phaseIndex: 0, dayOffset: 7, type: 'post', instruction: 'Share behind-the-scenes', assetStrategy: 'auto', platform: 'TikTok' },
                { phaseIndex: 1, dayOffset: 14, type: 'post', instruction: 'Release day announcement', assetStrategy: 'create_new' },
                { phaseIndex: 1, dayOffset: 21, type: 'analytics_check', instruction: 'Review first week metrics', assetStrategy: 'auto' },
                { phaseIndex: 2, dayOffset: 42, type: 'post', instruction: 'Fan engagement post', assetStrategy: 'use_existing', platform: 'Twitter' },
            ],
        }),
    },
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// ============================================================================
// Helpers
// ============================================================================

function createMockBrief(overrides: Partial<TimelineBrief> = {}): TimelineBrief {
    return {
        goal: 'Release my single "Midnight Sun" on April 15',
        domain: 'marketing',
        durationWeeks: 8,
        startDate: '2026-04-01',
        templateId: 'single_release_8w',
        platforms: ['Instagram', 'TikTok', 'Twitter'],
        assetStrategy: 'auto',
        ...overrides,
    };
}

function createMockTimeline(overrides: Partial<Timeline> = {}): Timeline {
    const phases: TimelinePhase[] = [
        {
            id: 'phase_0', name: 'Tease', order: 0, startDay: 0, endDay: 14,
            cadence: 'sparse', agentId: 'marketing', description: 'Build anticipation',
        },
        {
            id: 'phase_1', name: 'Build', order: 1, startDay: 14, endDay: 35,
            cadence: 'moderate', agentId: 'marketing', description: 'Ramp up activity',
        },
        {
            id: 'phase_2', name: 'Launch', order: 2, startDay: 35, endDay: 56,
            cadence: 'intense', agentId: 'marketing', description: 'Full push',
        },
    ];

    const now = Date.now();
    const milestones: TimelineMilestone[] = [
        {
            id: 'ms_0_0', phaseId: 'phase_0', phaseName: 'Tease',
            scheduledAt: now - 1000, type: 'post',
            instruction: 'Post teaser image', assetStrategy: 'auto',
            status: 'completed', agentId: 'marketing', executedAt: now - 500, retryCount: 0,
        },
        {
            id: 'ms_0_1', phaseId: 'phase_0', phaseName: 'Tease',
            scheduledAt: now + 86400000, type: 'post',
            instruction: 'Share BTS content', assetStrategy: 'auto',
            status: 'pending', agentId: 'social', retryCount: 0,
        },
        {
            id: 'ms_1_0', phaseId: 'phase_1', phaseName: 'Build',
            scheduledAt: now + 86400000 * 14, type: 'asset_creation',
            instruction: 'Create cover art variations', assetStrategy: 'create_new',
            status: 'pending', agentId: 'marketing', retryCount: 0,
        },
        {
            id: 'ms_2_0', phaseId: 'phase_2', phaseName: 'Launch',
            scheduledAt: now + 86400000 * 35, type: 'post',
            instruction: 'Release day blast', assetStrategy: 'create_new',
            status: 'pending', agentId: 'marketing', retryCount: 0,
        },
    ];

    return {
        id: 'tl_test_001',
        userId: mockUserId,
        title: 'Release "Midnight Sun"',
        goal: 'Release my single on April 15',
        domain: 'marketing',
        templateId: 'single_release_8w',
        startDate: now - 86400000 * 7, // Started 7 days ago
        endDate: now + 86400000 * 49,   // Ends in 49 days
        phases,
        milestones,
        status: 'active',
        currentPhaseOrder: 0,
        completedCount: 1,
        totalCount: milestones.length,
        createdAt: now - 86400000 * 7,
        updatedAt: now,
        ...overrides,
    };
}

// ============================================================================
// Tests
// ============================================================================

describe('TimelineOrchestratorService', () => {
    let service: TimelineOrchestratorService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TimelineOrchestratorService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================================================
    // Creation
    // ========================================================================

    describe('createTimeline', () => {
        it('should create a timeline from a template', async () => {
            const brief = createMockBrief({ templateId: 'single_release_8w' });
            const timeline = await service.createTimeline(brief);

            expect(timeline).toBeDefined();
            expect(timeline.id).toMatch(/^tl_/);
            expect(timeline.userId).toBe(mockUserId);
            expect(timeline.status).toBe('draft');
            expect(timeline.phases.length).toBeGreaterThan(0);
            expect(timeline.milestones.length).toBeGreaterThan(0);
            expect(timeline.currentPhaseOrder).toBe(0);
            expect(mockSetDoc).toHaveBeenCalledOnce();
        });

        it('should create a timeline with custom AI generation', async () => {
            const brief = createMockBrief({ templateId: 'custom' });
            const timeline = await service.createTimeline(brief);

            expect(timeline.phases.length).toBe(3);
            expect(timeline.milestones.length).toBe(5);
            expect(timeline.phases[0]!.name).toBe('Tease');
            expect(timeline.phases[1]!.name).toBe('Launch');
            expect(timeline.phases[2]!.name).toBe('Sustain');
        });

        it('should reject invalid start dates', async () => {
            const brief = createMockBrief({ startDate: 'not-a-date' });
            await expect(service.createTimeline(brief)).rejects.toThrow('Invalid start date');
        });

        it('should set milestones sorted by scheduled time', async () => {
            const brief = createMockBrief({ templateId: 'single_release_8w' });
            const timeline = await service.createTimeline(brief);

            for (let i = 1; i < timeline.milestones.length; i++) {
                expect(timeline.milestones[i]!.scheduledAt).toBeGreaterThanOrEqual(
                    timeline.milestones[i - 1]!.scheduledAt
                );
            }
        });

        it('should propagate asset strategy from brief to milestones', async () => {
            const brief = createMockBrief({
                templateId: 'single_release_8w',
                assetStrategy: 'create_new',
            });
            const timeline = await service.createTimeline(brief);

            // Phase-level asset strategy
            for (const phase of timeline.phases) {
                expect(phase.assetStrategy).toBe('create_new');
            }
        });
    });

    // ========================================================================
    // Lifecycle
    // ========================================================================

    describe('lifecycle management', () => {
        const mockTimeline = createMockTimeline({ status: 'draft' });

        beforeEach(() => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ ...mockTimeline }),
            });
        });

        it('should activate a draft timeline', async () => {
            const result = await service.activateTimeline('tl_test_001');
            expect(result.status).toBe('active');
            expect(mockSetDoc).toHaveBeenCalled();
        });

        it('should pause an active timeline', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ ...mockTimeline, status: 'active' }),
            });
            const result = await service.pauseTimeline('tl_test_001');
            expect(result.status).toBe('paused');
        });

        it('should resume a paused timeline', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ ...mockTimeline, status: 'paused' }),
            });
            const result = await service.resumeTimeline('tl_test_001');
            expect(result.status).toBe('active');
        });

        it('should cancel a timeline', async () => {
            const result = await service.cancelTimeline('tl_test_001');
            expect(result.status).toBe('cancelled');
        });

        it('should throw for non-existent timelines', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => false,
            });
            await expect(service.activateTimeline('fake_id')).rejects.toThrow('Timeline not found');
        });
    });

    // ========================================================================
    // Phase Advancement
    // ========================================================================

    describe('advancePhase', () => {
        it('should skip remaining pending milestones and advance to next phase', async () => {
            const timeline = createMockTimeline();
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => JSON.parse(JSON.stringify(timeline)),
            });

            const result = await service.advancePhase('tl_test_001');
            expect(result.currentPhaseOrder).toBe(1);

            // All phase_0 pending milestones should be skipped
            const phase0Pending = result.milestones.filter(
                m => m.phaseId === 'phase_0' && m.status === 'pending'
            );
            expect(phase0Pending.length).toBe(0);

            const phase0Skipped = result.milestones.filter(
                m => m.phaseId === 'phase_0' && m.status === 'skipped'
            );
            expect(phase0Skipped.length).toBe(1); // ms_0_1 was pending
        });

        it('should mark timeline as completed when advancing past last phase', async () => {
            const timeline = createMockTimeline({ currentPhaseOrder: 2 });
            // Mark all phase_2 milestones as pending for the skip
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => JSON.parse(JSON.stringify(timeline)),
            });

            const result = await service.advancePhase('tl_test_001');
            expect(result.status).toBe('completed');
        });
    });

    // ========================================================================
    // Cadence Adjustment
    // ========================================================================

    describe('adjustCadence', () => {
        it('should update the cadence of a specific phase', async () => {
            const timeline = createMockTimeline();
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => JSON.parse(JSON.stringify(timeline)),
            });

            const result = await service.adjustCadence('tl_test_001', 'phase_0', 'intense');
            const phase = result.phases.find(p => p.id === 'phase_0');
            expect(phase?.cadence).toBe('intense');
        });

        it('should throw for non-existent phase', async () => {
            const timeline = createMockTimeline();
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => JSON.parse(JSON.stringify(timeline)),
            });

            await expect(
                service.adjustCadence('tl_test_001', 'fake_phase', 'daily')
            ).rejects.toThrow('Phase not found');
        });
    });

    // ========================================================================
    // Progress Tracking
    // ========================================================================

    describe('getTimelineProgress', () => {
        it('should calculate correct progress metrics', () => {
            const timeline = createMockTimeline();
            const progress = service.getTimelineProgress(timeline);

            expect(progress.timelineId).toBe('tl_test_001');
            expect(progress.completedMilestones).toBe(1);
            expect(progress.totalMilestones).toBe(4);
            expect(progress.percentComplete).toBe(25);
            expect(progress.currentPhaseName).toBe('Tease');
            expect(progress.totalPhases).toBe(3);
            expect(progress.daysRemaining).toBeGreaterThan(0);
        });

        it('should report 0% for empty milestones', () => {
            const timeline = createMockTimeline({ milestones: [], totalCount: 0 });
            const progress = service.getTimelineProgress(timeline);
            expect(progress.percentComplete).toBe(0);
        });

        it('should report 100% when all milestones are completed', () => {
            const timeline = createMockTimeline();
            timeline.milestones.forEach(m => { m.status = 'completed'; });
            const progress = service.getTimelineProgress(timeline);
            expect(progress.percentComplete).toBe(100);
        });

        it('should include next milestone info', () => {
            const timeline = createMockTimeline();
            const progress = service.getTimelineProgress(timeline);
            expect(progress.nextMilestone).toBeDefined();
            expect(progress.nextMilestone?.id).toBe('ms_0_1');
        });
    });

    // ========================================================================
    // Template Management
    // ========================================================================

    describe('getAvailableTemplates', () => {
        it('should return available templates', () => {
            const templates = service.getAvailableTemplates();
            expect(templates.length).toBeGreaterThanOrEqual(4);

            const templateIds = templates.map(t => t.id);
            expect(templateIds).toContain('single_release_8w');
            expect(templateIds).toContain('album_rollout_16w');
            expect(templateIds).toContain('merch_drop_4w');
            expect(templateIds).toContain('tour_promo_12w');
        });
    });

    // ========================================================================
    // Query Methods
    // ========================================================================

    describe('getAllTimelines', () => {
        it('should return all timelines for the user', async () => {
            const mockTimeline = createMockTimeline();
            mockGetDocs.mockResolvedValue({
                docs: [
                    { data: () => mockTimeline },
                    { data: () => ({ ...mockTimeline, id: 'tl_test_002', title: 'Second Campaign' }) },
                ],
            });

            const timelines = await service.getAllTimelines();
            expect(timelines.length).toBe(2);
        });

        it('should handle errors gracefully', async () => {
            mockGetDocs.mockRejectedValue(new Error('Network error'));
            const timelines = await service.getAllTimelines();
            expect(timelines).toEqual([]);
        });
    });

    describe('getTimeline', () => {
        it('should return a single timeline by ID', async () => {
            const mockTimeline = createMockTimeline();
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => mockTimeline,
            });

            const timeline = await service.getTimeline('tl_test_001');
            expect(timeline).toBeDefined();
            expect(timeline?.id).toBe('tl_test_001');
        });

        it('should return null for missing timeline', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false });
            const timeline = await service.getTimeline('nonexistent');
            expect(timeline).toBeNull();
        });
    });

    // ========================================================================
    // Delete
    // ========================================================================

    describe('deleteTimeline', () => {
        it('should delete a timeline document', async () => {
            await service.deleteTimeline('tl_test_001');
            expect(mockDeleteDoc).toHaveBeenCalledOnce();
        });
    });

    // ========================================================================
    // Due Milestone Detection
    // ========================================================================

    describe('getDueMillestones', () => {
        it('should return milestones that are past due', async () => {
            const now = Date.now();
            const timeline = createMockTimeline({
                milestones: [
                    {
                        id: 'ms_due', phaseId: 'phase_0', phaseName: 'Tease',
                        scheduledAt: now - 60000, type: 'post',
                        instruction: 'Past due post', assetStrategy: 'auto',
                        status: 'pending', agentId: 'marketing', retryCount: 0,
                    },
                    {
                        id: 'ms_future', phaseId: 'phase_0', phaseName: 'Tease',
                        scheduledAt: now + 86400000, type: 'post',
                        instruction: 'Future post', assetStrategy: 'auto',
                        status: 'pending', agentId: 'marketing', retryCount: 0,
                    },
                ],
            });

            mockGetDocs.mockResolvedValue({
                docs: [{ data: () => timeline }],
            });

            const due = await service.getDueMillestones(mockUserId);
            expect(due.length).toBe(1);
            expect(due[0]!.milestone.id).toBe('ms_due');
        });
    });
});
