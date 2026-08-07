import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ApiCredentialsPane } from './ApiCredentialsPane';
import { credentialService } from '@/services/security/CredentialService';

describe('ApiCredentialsPane', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows a loading state before the first fetch resolves', () => {
        vi.spyOn(credentialService, 'listConfigured').mockReturnValue(new Promise(() => {}));
        render(<ApiCredentialsPane />);
        expect(screen.getByText(/Loading credential vault/)).toBeDefined();
    });

    it('marks only distributors with stored credentials as configured', async () => {
        vi.spyOn(credentialService, 'listConfigured').mockResolvedValue(['spotify', 'distrokid']);

        render(<ApiCredentialsPane />);

        await waitFor(() => expect(screen.getByText('Spotify')).toBeDefined());

        const spotifyRow = screen.getByText('Spotify').closest('div');
        const appleRow = screen.getByText('Apple').closest('div');

        expect(spotifyRow?.textContent).toContain('configured');
        expect(spotifyRow?.textContent).not.toContain('not configured');
        expect(appleRow?.textContent).toContain('not configured');
    });

    it('renders the configured/total count from the fetched snapshot', async () => {
        vi.spyOn(credentialService, 'listConfigured').mockResolvedValue(['merlin', 'apple', 'tidal']);

        render(<ApiCredentialsPane />);

        await waitFor(() => expect(screen.getByText('3')).toBeDefined());
    });

    it('shows an error state when the main-process call fails, never a false empty list', async () => {
        vi.spyOn(credentialService, 'listConfigured').mockRejectedValue(new Error('Electron API not available'));

        render(<ApiCredentialsPane />);

        await waitFor(() => expect(screen.getByText('Electron API not available')).toBeDefined());
    });
});
