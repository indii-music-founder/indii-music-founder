import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDDEXRelease } from './useDDEXRelease';

const { mockAddDoc, mockUpdateDoc, mockRunAgent, docIds } = vi.hoisted(() => ({
    mockAddDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockRunAgent: vi.fn(),
    docIds: { counter: 0 },
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn((_db, name) => ({ path: name })),
    addDoc: mockAddDoc,
    updateDoc: mockUpdateDoc,
    doc: vi.fn((_db, _collection, id) => ({ id })),
    serverTimestamp: vi.fn(() => 'server-timestamp'),
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    storage: {},
}));

vi.mock('@/services/StorageService', () => ({
    StorageService: {},
}));

vi.mock('@/services/agent/AgentService', () => ({
    agentService: { runAgent: mockRunAgent },
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: any) => selector({
        currentOrganizationId: 'org-1',
        organizations: [{ id: 'org-1', name: 'Test Org' }],
        userProfile: { id: 'user-1', brandKit: { socials: {} } },
    }),
}));

/**
 * ISSUE-964: submission previously marked the release metadata_complete
 * BEFORE packaging ran, then swallowed any packaging error entirely — a
 * release with no real package still ended up looking submitted/complete.
 */
describe('useDDEXRelease.submitRelease (ISSUE-964)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        docIds.counter = 0;
        mockAddDoc.mockImplementation(async () => ({ id: `release-${++docIds.counter}` }));
        mockUpdateDoc.mockResolvedValue(undefined);
    });

    it('only marks metadata_complete after packaging actually succeeds', async () => {
        mockRunAgent.mockResolvedValue({ text: 'Packaged successfully' });
        const { result } = renderHook(() => useDDEXRelease());

        let returnedId = '';
        await act(async () => {
            returnedId = await result.current.submitRelease();
        });

        expect(returnedId).toBe('release-1');
        expect(mockRunAgent).toHaveBeenCalled();
        expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'metadata_complete' }));
        expect(result.current.currentStep).toBe('complete');
        expect(result.current.submitError).toBeNull();
    });

    it('marks packaging_failed with the real error instead of silently advancing to complete', async () => {
        mockRunAgent.mockRejectedValue(new Error('Publishing agent unavailable'));
        const { result } = renderHook(() => useDDEXRelease());

        await act(async () => {
            await expect(result.current.submitRelease()).rejects.toThrow(/Packaging failed/);
        });

        expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            status: 'packaging_failed',
            packagingError: 'Publishing agent unavailable',
        }));
        // Never reaches the metadata_complete write.
        expect(mockUpdateDoc).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'metadata_complete' }));
        expect(result.current.currentStep).toBe('review');
        expect(result.current.submitError).toContain('Packaging failed');
        expect(result.current.releaseId).toBe('release-1');
    });

    it('retries against the same draft instead of creating a duplicate release', async () => {
        mockRunAgent
            .mockRejectedValueOnce(new Error('Transient failure'))
            .mockResolvedValueOnce({ text: 'Packaged successfully' });

        const { result } = renderHook(() => useDDEXRelease());

        await act(async () => {
            await expect(result.current.submitRelease()).rejects.toThrow();
        });
        expect(mockAddDoc).toHaveBeenCalledTimes(1);
        expect(result.current.releaseId).toBe('release-1');

        let retryId = '';
        await act(async () => {
            retryId = await result.current.submitRelease();
        });

        // Still only one addDoc call across both attempts — no duplicate draft.
        expect(mockAddDoc).toHaveBeenCalledTimes(1);
        expect(retryId).toBe('release-1');
        expect(result.current.currentStep).toBe('complete');
    });
});
