import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpdaterMonitor } from './UpdaterMonitor';

type Listener = (payload?: unknown) => void;

function installUpdaterBridge(downloadResult: { mode: 'browser' | 'in-place' | 'unavailable'; error?: string }) {
    const listeners: Record<string, Listener> = {};
    const on = (name: string) => (cb: Listener) => {
        listeners[name] = cb;
        return () => { delete listeners[name]; };
    };
    const download = vi.fn().mockResolvedValue(downloadResult);
    (window as unknown as { electronAPI: unknown }).electronAPI = {
        updater: {
            check: vi.fn(),
            install: vi.fn(),
            download,
            setChannel: vi.fn(),
            setSource: vi.fn(),
            getConfig: vi.fn(),
            onChecking: on('checking'),
            onAvailable: on('available'),
            onNotAvailable: on('not-available'),
            onProgress: on('progress'),
            onDownloaded: on('downloaded'),
            onError: on('error'),
        },
    };
    return { listeners, download };
}

describe('UpdaterMonitor', () => {
    afterEach(() => {
        delete (window as unknown as { electronAPI?: unknown }).electronAPI;
    });

    it('offers a download when a newer version is available instead of claiming one is underway', async () => {
        const { listeners, download } = installUpdaterBridge({ mode: 'browser' });
        render(<UpdaterMonitor />);

        act(() => listeners.available({ version: '2.0.0' }));

        expect(screen.getByText('Update Available')).toBeInTheDocument();
        expect(screen.queryByText(/Preparing to download/)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Download Update' }));

        await waitFor(() => expect(download).toHaveBeenCalledWith('2.0.0'));
        await waitFor(() => expect(screen.queryByText('Update Available')).not.toBeInTheDocument());
    });

    it('shows the reason when the download cannot start', async () => {
        const { listeners } = installUpdaterBridge({ mode: 'unavailable', error: 'Updates are turned off in local builds.' });
        render(<UpdaterMonitor />);

        act(() => listeners.available({ version: '2.0.0' }));
        fireEvent.click(screen.getByRole('button', { name: 'Download Update' }));

        expect(await screen.findByText('Updates are turned off in local builds.')).toBeInTheDocument();
        expect(screen.getByText('Update Failed')).toBeInTheDocument();
    });
});
