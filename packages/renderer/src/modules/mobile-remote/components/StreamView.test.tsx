import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StreamView from '@/modules/mobile-remote/components/StreamView';
import type { DesktopState } from '@/services/agent/RemoteRelayService';
import { StorageService } from '@/services/StorageService';

vi.mock('@/services/StorageService', () => ({
    StorageService: { loadHistory: vi.fn().mockResolvedValue([
        { id: 'track-1', type: 'music', url: 'https://example.test/master.mp3', prompt: 'New Master', timestamp: 1, projectId: 'p' },
    ]) },
}));
vi.mock('@/modules/mobile-remote/components/TransportBar', () => ({
    default: ({ track }: { track: { id: string } | null }) => <div data-testid="transport-track">{track?.id || 'none'}</div>,
}));

describe('StreamView desktop handoff', () => {
    beforeEach(() => {
        vi.mocked(StorageService.loadHistory).mockReset().mockResolvedValue([
            { id: 'track-1', type: 'music', url: 'https://example.test/master.mp3', prompt: 'New Master', timestamp: 1, projectId: 'p' } as never,
        ]);
    });

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

    it('renders JevRemoteHintBar and sends focused track to Studio on click', async () => {
        const onSendToStudio = vi.fn();
        render(
            <StreamView
                desktopState={{ activeTrackId: 'track-1', activeTrackTitle: 'New Master' } as DesktopState}
                onSendToStudio={onSendToStudio}
            />
        );

        const hintBar = await screen.findByTestId('jev-remote-hint-bar');
        expect(hintBar).toHaveTextContent(/Jev/i);
        fireEvent.click(screen.getByTestId('jev-remote-hint-action'));
        expect(onSendToStudio).toHaveBeenCalledWith(expect.stringContaining('New Master'));
    });

    it('shows an error alert with Retry instead of No Tracks Available when vault load fails', async () => {
        vi.mocked(StorageService.loadHistory)
            .mockRejectedValueOnce(new Error('Vault offline'))
            .mockResolvedValueOnce([
                { id: 'track-1', type: 'music', url: 'https://example.test/master.mp3', prompt: 'New Master', timestamp: 1, projectId: 'p' } as never,
            ]);

        render(<StreamView />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Vault offline');
        expect(screen.queryByText('No Tracks Available')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(await screen.findByText('New Master')).toBeInTheDocument();
    });
});
