import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SecurityDashboard from './SecurityDashboard';

describe('SecurityDashboard', () => {
    it('renders all 4 panes', () => {
        render(<SecurityDashboard />);
        expect(screen.getByText('Security Center')).toBeDefined();
        expect(screen.getByText('Access Control')).toBeDefined();
        expect(screen.getByText('API Credentials')).toBeDefined();
        expect(screen.getByText('Audit Trail')).toBeDefined();
        expect(screen.getByText('Agent Encryption')).toBeDefined();
    });

    it('shows pending placeholders for not-yet-implemented panes', () => {
        render(<SecurityDashboard />);
        expect(screen.getByText(/Access Matrix Pending/)).toBeDefined();
        expect(screen.getByText(/Credential Vault Pending/)).toBeDefined();
        expect(screen.getByText(/Loading audit logs.../)).toBeDefined();
        expect(screen.getByText(/E2E Diagnostics Pending/)).toBeDefined();
    });
});
