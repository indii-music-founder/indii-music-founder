import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SecurityDashboard from './SecurityDashboard';

describe('SecurityDashboard', () => {
    it('renders all 4 panes', async () => {
        render(<SecurityDashboard />);
        expect(screen.getByText('Security Center')).toBeDefined();
        expect(screen.getByText('Access Control')).toBeDefined();
        expect(screen.getByText('API Credentials')).toBeDefined();
        expect(screen.getByText('Audit Trail')).toBeDefined();
        expect(screen.getByText('Agent Encryption')).toBeDefined();
        await waitFor(() => expect(screen.getByText(/Electron API not available/)).toBeDefined());
    });

    it('renders the real organization access pane instead of a placeholder (ISSUE-1306)', async () => {
        render(<SecurityDashboard />);
        expect(screen.queryByText(/Access Matrix Pending/)).toBeNull();
        expect(screen.getByText(/Select an organization to view its permission matrix/)).toBeDefined();
        expect(screen.getByText(/Loading audit logs.../)).toBeDefined();
        // Settle ApiCredentialsPane's async fetch so it doesn't warn after this test exits.
        await waitFor(() => expect(screen.getByText(/Electron API not available/)).toBeDefined());
    });

    it('renders real E2E swarm diagnostics instead of a placeholder (ISSUE-1304)', async () => {
        render(<SecurityDashboard />);
        expect(screen.queryByText(/E2E Diagnostics Pending/)).toBeNull();
        expect(screen.getByText(/No Active Swarm Sessions/)).toBeDefined();
        await waitFor(() => expect(screen.getByText(/Electron API not available/)).toBeDefined());
    });

    it('renders the real credential vault pane instead of a placeholder (ISSUE-1305)', async () => {
        render(<SecurityDashboard />);
        expect(screen.queryByText(/Credential Vault Pending/)).toBeNull();
        // No `window.electronAPI.credentials` in the base test mock, so the pane
        // renders its honest error state rather than silently listing nothing.
        await waitFor(() => expect(screen.getByText(/Electron API not available/)).toBeDefined());
    });
});
