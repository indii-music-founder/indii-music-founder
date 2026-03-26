/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

let mockDocExists = false;
const mockEntries: unknown[] = [];

vi.mock('@/services/firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({ id: 'mock-doc-ref' })),
    getDoc: vi.fn(() => Promise.resolve({
        exists: () => mockDocExists,
        data: () => ({
            date: '2026-03-25',
            userId: 'user-1',
            entries: mockEntries,
            lastUpdated: null,
        }),
    })),
    setDoc: vi.fn(() => Promise.resolve()),
    updateDoc: vi.fn(() => Promise.resolve()),
    arrayUnion: vi.fn((...args) => args),
    serverTimestamp: vi.fn(() => new Date()),
    Timestamp: {
        now: vi.fn(() => ({ toMillis: () => Date.now() })),
    },
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { captainsLogService } from '../CaptainsLogService';
import { setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

// ============================================================================
// TESTS
// ============================================================================

describe('CaptainsLogService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDocExists = false;
        mockEntries.length = 0;
    });

    describe('appendEntry', () => {
        it('should create a new daily document when none exists', async () => {
            mockDocExists = false;

            const entryId = await captainsLogService.appendEntry(
                'user-1',
                'task',
                'Generated 3 images for album art'
            );

            expect(entryId).toMatch(/^log_task_/);
            expect(setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    userId: 'user-1',
                    entries: expect.arrayContaining([
                        expect.objectContaining({
                            type: 'task',
                            content: 'Generated 3 images for album art',
                        }),
                    ]),
                })
            );
        });

        it('should append to an existing daily document', async () => {
            mockDocExists = true;
            mockEntries.push({
                id: 'log_task_1',
                timestamp: new Date().toISOString(),
                type: 'task',
                content: 'First entry',
            });

            const entryId = await captainsLogService.appendEntry(
                'user-1',
                'decision',
                'Switched distributor to DistroKid',
                { agentId: 'distribution' }
            );

            expect(entryId).toMatch(/^log_decision_/);
            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    entries: expect.anything(),
                })
            );
            expect(arrayUnion).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'decision',
                    content: 'Switched distributor to DistroKid',
                    agentId: 'distribution',
                })
            );
        });

        it('should include metadata when provided', async () => {
            mockDocExists = true;

            await captainsLogService.appendEntry(
                'user-1',
                'error',
                'API rate limit exceeded',
                { agentId: 'creative-director', metadata: { errorCode: 'RATE_LIMIT' } }
            );

            expect(arrayUnion).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    metadata: { errorCode: 'RATE_LIMIT' },
                })
            );
        });
    });

    describe('readTodaysLog', () => {
        it('should return empty array when no log exists for today', async () => {
            mockDocExists = false;

            const entries = await captainsLogService.readTodaysLog('user-1');

            expect(entries).toEqual([]);
        });

        it('should return all entries from today', async () => {
            mockDocExists = true;
            mockEntries.push(
                { id: 'log_1', type: 'task', content: 'Task 1', timestamp: new Date().toISOString() },
                { id: 'log_2', type: 'error', content: 'Error 1', timestamp: new Date().toISOString() }
            );

            const entries = await captainsLogService.readTodaysLog('user-1');

            expect(entries).toHaveLength(2);
            expect(entries[0]!.type).toBe('task');
            expect(entries[1]!.type).toBe('error');
        });
    });

    describe('getTodaysSummary', () => {
        it('should return empty string when no entries exist', async () => {
            mockDocExists = false;

            const summary = await captainsLogService.getTodaysSummary('user-1');

            expect(summary).toBe('');
        });

        it('should group entries by type in the summary', async () => {
            mockDocExists = true;
            mockEntries.push(
                { id: 'l1', type: 'task', content: 'Generated album art', timestamp: new Date().toISOString() },
                { id: 'l2', type: 'task', content: 'Created press kit', timestamp: new Date().toISOString() },
                { id: 'l3', type: 'error', content: 'SFTP upload failed', timestamp: new Date().toISOString() },
                { id: 'l4', type: 'decision', content: 'Switch to FLAC', timestamp: new Date().toISOString() },
                { id: 'l5', type: 'milestone', content: 'First release submitted', timestamp: new Date().toISOString() }
            );

            const summary = await captainsLogService.getTodaysSummary('user-1');

            expect(summary).toContain("Captain's Log");
            expect(summary).toContain('Tasks (2)');
            expect(summary).toContain('Errors (1)');
            expect(summary).toContain('Decisions');
            expect(summary).toContain('Milestones');
        });
    });

    describe('convenience loggers', () => {
        it('logTask should create a task entry', async () => {
            mockDocExists = false;

            await captainsLogService.logTask('user-1', 'Mixed down track 3', 'music');

            expect(setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    entries: expect.arrayContaining([
                        expect.objectContaining({ type: 'task', agentId: 'music' }),
                    ]),
                })
            );
        });

        it('logError should include error code in metadata', async () => {
            mockDocExists = true;

            await captainsLogService.logError('user-1', 'Upload failed', 'distribution', 'SFTP_TIMEOUT');

            expect(arrayUnion).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    metadata: { errorCode: 'SFTP_TIMEOUT' },
                })
            );
        });

        it('logMilestone should create a milestone entry', async () => {
            mockDocExists = false;

            await captainsLogService.logMilestone('user-1', 'First 1000 streams!');

            expect(setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    entries: expect.arrayContaining([
                        expect.objectContaining({ type: 'milestone', content: 'First 1000 streams!' }),
                    ]),
                })
            );
        });

        it('logSessionStart should create a session entry', async () => {
            mockDocExists = false;

            await captainsLogService.logSessionStart('user-1');

            expect(setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    entries: expect.arrayContaining([
                        expect.objectContaining({ type: 'session', content: 'Session started' }),
                    ]),
                })
            );
        });
    });
});
