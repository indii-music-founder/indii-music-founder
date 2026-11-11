import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VersionHistory } from './VersionHistory';

const mockGetDocs = vi.hoisted(() => vi.fn());

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    getDocs: mockGetDocs,
    doc: vi.fn(),
    deleteDoc: vi.fn(),
    Timestamp: class {
        toDate() {
            return new Date('2026-11-08T12:00:00Z');
        }
    },
}));

vi.mock('@/services/firebase', () => ({
    db: {},
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: any) =>
        selector({
            userProfile: { id: 'test-user-123' },
            currentOrganizationId: 'test-org-123',
            currentProjectId: 'test-proj-123',
        }),
}));

describe('VersionHistory (ISSUE-1606)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders saved versions when query succeeds', async () => {
        mockGetDocs.mockResolvedValueOnce({
            forEach: (cb: any) => {
                cb({
                    id: 'design-1',
                    data: () => ({
                        name: 'Content Audit 2026-10-29',
                        canvasJSON: '{"objects":[]}',
                        thumbnail: 'https://storage.googleapis.com/test-bucket/thumb.png',
                        lastModified: new Date('2026-11-08T12:00:00Z'),
                        createdAt: new Date('2026-11-08T12:00:00Z'),
                    }),
                });
            },
        });

        const onRestore = vi.fn();
        const onClose = vi.fn();

        render(
            <VersionHistory
                isOpen={true}
                onClose={onClose}
                onRestoreVersion={onRestore}
                currentDesignId="design-0"
            />
        );

        expect(await screen.findByText('Content Audit 2026-10-29')).toBeInTheDocument();
        expect(screen.getByText('1 saved versions')).toBeInTheDocument();
    });

    it('surfaces an actionable error state with retry when missing index or query fails', async () => {
        mockGetDocs.mockRejectedValueOnce(
            new Error('FirebaseError: The query requires an index.')
        );

        const onRestore = vi.fn();
        const onClose = vi.fn();

        render(
            <VersionHistory
                isOpen={true}
                onClose={onClose}
                onRestoreVersion={onRestore}
                currentDesignId="design-0"
            />
        );

        expect(await screen.findByTestId('version-history-error')).toBeInTheDocument();
        expect(screen.getByText('Failed to load versions')).toBeInTheDocument();
        expect(screen.getByText(/FirebaseError: The query requires an index/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
        expect(screen.queryByText('No saved versions yet')).not.toBeInTheDocument();
    });
});
