import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StreamView from './StreamView';
import type { DesktopState } from '@/services/agent/RemoteRelayService';

vi.mock('@/services/StorageService', () => ({
    StorageService: { loadHistory: vi.fn().mockResolvedValue([
        { id: 'track-1', type: 'music', url: 'https://example.test/master.mp3', prompt: 'New Master', timestamp: 1, projectId: 'p' },
    ]) },
}));
vi.mock('./TransportBar', () => ({
    default: ({ track }: { track: { id: string } | null }) => <div data-testid="transport-track">{track?.id || 'none'}</div>,
}));

describe('StreamView desktop handoff', () => {
    it('offers the cloud copy of the desktop track for local phone playback', async () => {
        render(<StreamView desktopState={{ activeTrackId: 'track-1', activeTrackTitle: 'New Master' } as DesktopState} />);
        const button = await screen.findByRole('button', { name: 'Stream to Phone' });
        fireEvent.click(button);
        await waitFor(() => expect(screen.getByTestId('transport-track')).toHaveTextContent('track-1'));
    });

    it('does not offer an absent desktop track as playable media', async () => {
        render(<StreamView desktopState={{ activeTrackId: 'desktop-only', activeTrackTitle: 'Local Demo' } as DesktopState} />);
        await screen.findByText('This track is not in Cloud Vault');
        expect(screen.queryByRole('button', { name: 'Stream to Phone' })).not.toBeInTheDocument();
    });
});
