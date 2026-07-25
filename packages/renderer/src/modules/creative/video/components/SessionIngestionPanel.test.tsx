import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    start: vi.fn(),
    onSnapshot: vi.fn(() => vi.fn()),
    toast: {
        error: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
    },
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({ path: 'videoSessions/session-1' })),
    onSnapshot: mocks.onSnapshot,
}));
vi.mock('@/services/firebase', () => ({
    db: {},
}));
vi.mock('@/core/store', () => ({
    useStore: (selector: (state: { user: { uid: string } }) => unknown) =>
        selector({ user: { uid: 'artist-1' } }),
}));
vi.mock('@/services/video/SessionVideoUploadService', () => ({
    SessionVideoUploadService: { start: mocks.start },
}));
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mocks.toast,
}));

import { SessionIngestionPanel } from './SessionIngestionPanel';

describe('SessionIngestionPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.stubGlobal('crypto', {
            randomUUID: vi.fn(() => 'retry-attempt-1'),
            subtle: {
                digest: vi.fn(async () => new Uint8Array(32).fill(1).buffer),
            },
        });
    });

    it('explains the project/sign-in gate instead of accepting a disposable upload', () => {
        render(<SessionIngestionPanel onOpenProxy={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Import a long recording session' }));

        expect(screen.getByRole('status')).toHaveTextContent(
            'Sign in and select a project before importing a session.',
        );
        expect(screen.queryByLabelText(/choose phone recording/i)).not.toBeInTheDocument();
    });

    it('starts the owner/project-bound service and remembers the durable session for reload', async () => {
        const session = {
            sessionId: 'a'.repeat(40),
            status: 'uploading',
        };
        mocks.start.mockResolvedValue({
            session,
            completion: new Promise(() => undefined),
            pause: vi.fn(),
            resume: vi.fn(),
            cancel: vi.fn(),
        });
        render(
            <SessionIngestionPanel
                organizationId="org-1"
                projectId="project-1"
                onOpenProxy={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Import a long recording session' }));
        const file = new File(['phone bytes'], 'session.mp4', {
            type: 'video/mp4',
            lastModified: 123,
        });
        fireEvent.change(screen.getByLabelText('Choose phone recording'), {
            target: { files: [file] },
        });

        await waitFor(() => expect(mocks.start).toHaveBeenCalledWith(
            file,
            expect.objectContaining({
                organizationId: 'org-1',
                projectId: 'project-1',
                idempotencyKey: expect.stringMatching(/^session-[a-f0-9]{64}$/),
            }),
            expect.any(Function),
        ));
        expect(localStorage.getItem('indii:video-session:artist-1:project-1')).toBe(session.sessionId);
    });

    it('uses a fresh attempt identity after cancellation and clears stale project state', async () => {
        const firstSession = {
            sessionId: 'a'.repeat(40),
            status: 'cancelled',
        };
        const secondSession = {
            sessionId: 'b'.repeat(40),
            status: 'uploading',
        };
        const digest = vi.mocked(crypto.subtle.digest)
            .mockResolvedValueOnce(new Uint8Array(32).fill(1).buffer)
            .mockResolvedValueOnce(new Uint8Array(32).fill(2).buffer);
        mocks.start
            .mockResolvedValueOnce({
                session: firstSession,
                completion: new Promise(() => undefined),
                pause: vi.fn(),
                resume: vi.fn(),
                cancel: vi.fn(),
            })
            .mockResolvedValueOnce({
                session: secondSession,
                completion: new Promise(() => undefined),
                pause: vi.fn(),
                resume: vi.fn(),
                cancel: vi.fn(),
            });

        const view = render(
            <SessionIngestionPanel
                organizationId="org-1"
                projectId="project-1"
                onOpenProxy={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Import a long recording session' }));
        const file = new File(['phone bytes'], 'session.mp4', {
            type: 'video/mp4',
            lastModified: 123,
        });
        fireEvent.change(screen.getByLabelText('Choose phone recording'), {
            target: { files: [file] },
        });
        await screen.findByLabelText('Choose file to retry');
        fireEvent.change(screen.getByLabelText('Choose file to retry'), {
            target: { files: [file] },
        });

        await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(2));
        const firstKey = mocks.start.mock.calls[0]?.[1]?.idempotencyKey;
        const secondKey = mocks.start.mock.calls[1]?.[1]?.idempotencyKey;
        expect(firstKey).not.toBe(secondKey);
        const retryDigestInput = new TextDecoder().decode(
            digest.mock.calls[1]?.[1] as ArrayBuffer,
        );
        expect(retryDigestInput).toContain('retry-attempt-1');

        view.rerender(
            <SessionIngestionPanel
                organizationId="org-2"
                projectId="project-2"
                onOpenProxy={vi.fn()}
            />,
        );
        await waitFor(() => expect(screen.getByLabelText('Choose phone recording')).toBeInTheDocument());
    });
});
