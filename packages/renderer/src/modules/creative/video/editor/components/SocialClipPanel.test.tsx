import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SocialClipPanel } from './SocialClipPanel';

const mocks = vi.hoisted(() => ({
    state: { user: { uid: 'owner', isAnonymous: false }, currentProjectId: 'source', currentOrganizationId: 'org', addProject: vi.fn(), setProject: vi.fn() },
    project: { id: 'source', name: 'Source', fps: 30, durationInFrames: 900, tracks: [], clips: [] },
    create: vi.fn(), load: vi.fn(), save: vi.fn(),
}));
vi.mock('@/core/store', () => ({ useStore: Object.assign((selector: (state: typeof mocks.state) => unknown) => selector(mocks.state), { getState: () => mocks.state }) }));
vi.mock('../../store/videoEditorStore', () => ({ useVideoEditorStore: Object.assign((selector: (state: unknown) => unknown) => selector({ project: mocks.project }), { getState: () => ({ currentTime: 0 }) }) }));
vi.mock('@/services/ProjectService', () => ({ ProjectService: { createProject: mocks.create } }));
vi.mock('@/services/dashboard/projectTypeUtils', () => ({ projectToMetadata: (project: unknown) => project }));
vi.mock('../../services/VideoProjectPersistenceService', () => ({ loadVideoProject: mocks.load, saveVideoProject: mocks.save }));
vi.mock('../../services/socialClipProject', () => ({ createSocialClipProject: () => ({ ...mocks.project, name: 'Social copy' }) }));

describe('SocialClipPanel persistence lifecycle (structural)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.create.mockResolvedValue({ id: 'destination' });
        mocks.load.mockResolvedValue({ status: 'absent', token: 'token' });
        mocks.save.mockResolvedValue({ success: true });
    });
    const start = (flushSave: () => Promise<void> = vi.fn().mockResolvedValue(undefined)) => {
        render(<SocialClipPanel flushSave={flushSave} />);
        fireEvent.click(screen.getByRole('button', { name: /Social clip —/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Save social copy' }));
    };
    it('offers the destination only after successful persistence', async () => {
        start();
        await screen.findByTestId('open-social-copy-btn');
        expect(mocks.save).toHaveBeenCalledWith('token', expect.objectContaining({ id: 'destination' }), 'owner', 'org');
        fireEvent.click(screen.getByTestId('open-social-copy-btn'));
        expect(mocks.state.setProject).toHaveBeenCalledWith('destination');
    });
    it('reports a failed save and keeps retry available without presenting a completed copy', async () => {
        mocks.save.mockResolvedValue({ success: false, reason: 'Permission denied' });
        start();
        await screen.findByText(/Permission denied/);
        expect(screen.queryByTestId('open-social-copy-btn')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save social copy' })).toBeEnabled();
    });
    it('stops subsequent steps after a cancellation while source persistence is pending', async () => {
        let finish!: () => void;
        start(() => new Promise<void>(resolve => { finish = resolve; }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.getByRole('status')).toHaveTextContent('Waiting for the current save');
        finish();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Save social copy' })).toBeEnabled());
        expect(mocks.create).not.toHaveBeenCalled();
        expect(screen.getByRole('status')).toHaveTextContent('creation stopped');
    });
    it('warns about the persisted destination when cancellation arrives during its save', async () => {
        let finish!: (result: { success: boolean }) => void;
        mocks.save.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        start();
        await waitFor(() => expect(mocks.save).toHaveBeenCalled());
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        finish({ success: true });
        await screen.findByText(/A destination project was created/);
        expect(screen.queryByTestId('open-social-copy-btn')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save social copy' })).toBeEnabled();
    });
});
