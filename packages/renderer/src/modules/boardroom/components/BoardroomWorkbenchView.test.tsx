import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardroomWorkbenchTarget } from '@/core/store/slices/boardroomSlice';
import { BoardroomWorkbenchView } from '@/modules/boardroom/components/BoardroomWorkbenchView';

const store: Record<string, any> = {
    boardroomWorkbenchTarget: null as BoardroomWorkbenchTarget,
    generatedHistory: [],
    isHistoryInitialized: true,
    historySyncError: null as string | null,
    initializeHistory: vi.fn(),
    boardroomControl: { surface: 'workbench', holder: 'artist', grantId: null, revision: 0 },
    takeBoardroomControl: vi.fn(),
};
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock('@/core/store', () => ({
    useStore: (select: (state: typeof store) => unknown) => select(store),
}));
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => toast }));

const readArtifact = vi.fn();
const listArtifacts = vi.fn();

describe('Boardroom Workbench artifacts', () => {
    beforeEach(() => {
        store.boardroomWorkbenchTarget = null;
        store.generatedHistory = [];
        store.isHistoryInitialized = true;
        store.historySyncError = null;
        store.initializeHistory = vi.fn();
        store.boardroomControl = { surface: 'workbench', holder: 'artist', grantId: null, revision: 0 };
        store.takeBoardroomControl = vi.fn();
        readArtifact.mockReset();
        listArtifacts.mockResolvedValue({ success: true, data: [{ filename: 'first.md' }, { filename: 'second.md' }] });
        vi.stubGlobal('electronAPI', { agent: { readArtifact, listArtifacts } });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('shows a read error and can retry a document that turns out to be empty', async () => {
        readArtifact.mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({ success: true, data: '' });
        render(<BoardroomWorkbenchView />);
        fireEvent.click(screen.getByRole('tab', { name: /artifacts & splits/i }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not read this document.');
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(await screen.findByText('This document is empty.')).toBeVisible();
        expect(screen.queryByText('Loading document...')).not.toBeInTheDocument();
    });

    it('opens each external artifact target and ignores the previous read after a target change', async () => {
        let completeFirst!: (result: { success: boolean; data: string }) => void;
        readArtifact.mockImplementation((filename: string) => filename === 'first.md'
            ? new Promise(resolve => { completeFirst = resolve; })
            : Promise.resolve({ success: true, data: 'New document body' }));
        store.boardroomWorkbenchTarget = { kind: 'artifact', filename: 'first.md' };
        const view = render(<BoardroomWorkbenchView />);
        expect(screen.getByRole('tab', { name: /artifacts & splits/i })).toHaveAttribute('aria-selected', 'true');
        expect(readArtifact).toHaveBeenCalledWith('first.md');

        store.boardroomWorkbenchTarget = { kind: 'artifact', filename: 'second.md' };
        view.rerender(<BoardroomWorkbenchView />);
        expect(await screen.findByText('New document body')).toBeVisible();
        await act(async () => { completeFirst({ success: true, data: 'Old document body' }); });
        expect(screen.queryByText('Old document body')).not.toBeInTheDocument();
    });

    it('opens split-sheet target on Artifacts & Splits and renders media loading/error/control states', async () => {
        store.boardroomWorkbenchTarget = { kind: 'split-sheet', itemId: 'second', title: 'Album Split 50/50' };
        readArtifact.mockResolvedValue({ success: true, data: '# Split Sheet\n50 / 50' });
        const view = render(<BoardroomWorkbenchView />);

        expect(screen.getByTestId('boardroom-split-sheet-target')).toHaveTextContent('Album Split 50/50');
        expect(screen.getByRole('tab', { name: /artifacts & splits/i })).toHaveAttribute('aria-selected', 'true');
        expect(await screen.findByText('Split Sheet')).toBeVisible();

        store.isHistoryInitialized = false;
        store.boardroomControl = { surface: 'workbench', holder: 'legal', grantId: 'g-2', revision: 3 };
        view.rerender(<BoardroomWorkbenchView />);
        expect(screen.getByText(/Legal Director has control/i)).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Take control' }));
        expect(store.takeBoardroomControl).toHaveBeenCalledWith('workbench');

        fireEvent.click(screen.getByRole('tab', { name: /Generated Media/i }));
        expect(screen.getByText('Loading media…')).toBeVisible();

        store.historySyncError = 'Network timeout';
        view.rerender(<BoardroomWorkbenchView />);
        expect(screen.getByRole('alert')).toHaveTextContent('Could not load media: Network timeout');
        fireEvent.click(screen.getByRole('button', { name: 'Retry media' }));
        expect(store.initializeHistory).toHaveBeenCalledTimes(1);
    });
});
