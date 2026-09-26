import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    setStatus: vi.fn(),
}));

vi.mock('@/services/security/ErrorReportTriageService', () => ({
    ErrorReportTriageService: {
        list: mocks.list,
        setStatus: mocks.setStatus,
    },
}));

import { ErrorReportsPanel } from '../ErrorReportsPanel';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const REPORT = {
    id: 'er_1758851550000_ab12cd',
    reportId: 'er_1758851550000_ab12cd',
    agentId: 'generalist',
    surface: 'creative director chat',
    summary: 'Finalizing an asset failed',
    detail: 'raw permission-denied stack',
    status: 'open' as const,
    createdAt: 1758851550000,
};

describe('ErrorReportsPanel (ISSUE-1446 triage)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.list.mockResolvedValue([REPORT]);
        mocks.setStatus.mockResolvedValue(undefined);
    });

    it('renders filed reports with summary, reference ID, and expandable detail', async () => {
        render(<ErrorReportsPanel />);
        await waitFor(() => expect(screen.getByText('Finalizing an asset failed')).toBeInTheDocument());
        expect(screen.getAllByText(/er_1758851550000_ab12cd/).length).toBeGreaterThan(0);
        expect(screen.getByText('Technical detail (fix team)')).toBeInTheDocument();
    });

    it('shows the empty state when no reports exist', async () => {
        mocks.list.mockResolvedValue([]);
        render(<ErrorReportsPanel />);
        await waitFor(() => expect(screen.getByText('No error reports filed yet.')).toBeInTheDocument());
    });

    it('acknowledge transition calls setStatus and removes the acknowledge affordance', async () => {
        render(<ErrorReportsPanel />);
        await waitFor(() => expect(screen.getByText('Acknowledge')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Acknowledge'));
        await waitFor(() => expect(mocks.setStatus).toHaveBeenCalledWith(REPORT.id, 'acknowledged'));
        await waitFor(() => expect(screen.queryByText('Acknowledge')).not.toBeInTheDocument());
    });

    it('surfaces callable failures verbatim instead of fabricating an empty state', async () => {
        mocks.list.mockRejectedValue(new Error('Founder access required.'));
        render(<ErrorReportsPanel />);
        await waitFor(() => expect(screen.getByText('Founder access required.')).toBeInTheDocument());
        expect(screen.queryByText('No error reports filed yet.')).not.toBeInTheDocument();
    });
});
