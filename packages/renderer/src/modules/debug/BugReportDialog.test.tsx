import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BugReportDialog } from './BugReportDialog';
import { useStore } from '@/core/store';
import { agentService } from '@/services/agent/AgentService';

const mockReportBugCallable = vi.fn();

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => mockReportBugCallable),
}));

vi.mock('@/services/firebase', () => ({
    functions: {},
}));

vi.mock('@/services/agent/AgentService', () => ({
    agentService: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('@/services/agent/registry', () => ({
    agentRegistry: {
        get: vi.fn((id: string) => ({
            id,
            displayName: id === 'coordinator' ? 'Coordinator Agent' : 'Test Agent',
        })),
    },
}));

describe('BugReportDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockReportBugCallable.mockResolvedValue({
            data: {
                firestore: 'ok',
                github: 'ok',
                bugId: 'bug-12345',
                message: 'Bug reported successfully',
            },
        });
        useStore.setState({
            bugReportDialog: {
                isOpen: false,
                type: 'bug',
            },
            directTargetAgentId: null,
        });
    });

    it('renders nothing when closed', () => {
        const { container } = render(<BugReportDialog />);
        expect(container.firstChild).toBeNull();
    });

    it('renders the dialog when open with prefilled error', () => {
        useStore.setState({
            bugReportDialog: {
                isOpen: true,
                type: 'bug',
                prefilledError: 'Test error occurred',
                prefilledModule: 'audio-mastering',
            },
        });

        render(<BugReportDialog />);
        expect(screen.getByText(/Report a Bug/i)).toBeInTheDocument();
        expect(screen.getAllByDisplayValue(/Test error occurred/i).length).toBeGreaterThanOrEqual(1);
    });

    it('submits bug report through reportBugFn Cloud Function and displays reference ID', async () => {
        useStore.setState({
            bugReportDialog: {
                isOpen: true,
                type: 'bug',
            },
        });

        render(<BugReportDialog />);

        const titleInput = screen.getByPlaceholderText(/e\.g\., Image generation crashes on mobile/i);
        const descriptionInput = screen.getByPlaceholderText(/Describe the issue in detail/i);

        fireEvent.change(titleInput, { target: { value: 'Export audio fails on safari' } });
        fireEvent.change(descriptionInput, { target: { value: 'Clicking export produces silent file' } });

        const submitButton = screen.getByRole('button', { name: /Send to Agent/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockReportBugCallable).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Export audio fails on safari',
                    description: 'Clicking export produces silent file',
                    severity: 'major',
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByText(/Bug report "Export audio fails on safari" submitted successfully! \(Ref: bug-12345\)/i)).toBeInTheDocument();
        });

        expect(agentService.sendMessage).toHaveBeenCalledWith(
            expect.stringContaining('Export audio fails on safari'),
            undefined,
            'coordinator'
        );
    });

    it('submits feature request through reportBugFn Cloud Function', async () => {
        useStore.setState({
            bugReportDialog: {
                isOpen: true,
                type: 'feature',
            },
        });

        render(<BugReportDialog />);

        expect(screen.getByText(/Request a Feature/i)).toBeInTheDocument();

        const titleInput = screen.getByPlaceholderText(/e\.g\., Add dark mode toggle/i);
        const descriptionInput = screen.getByPlaceholderText(/Describe the feature or improvement/i);

        fireEvent.change(titleInput, { target: { value: 'Dolby Atmos Preview' } });
        fireEvent.change(descriptionInput, { target: { value: 'Add spatial audio binaural preview mode' } });

        const submitButton = screen.getByRole('button', { name: /Send to Agent/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockReportBugCallable).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Dolby Atmos Preview',
                    description: expect.stringContaining('Add spatial audio binaural preview mode'),
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByText(/Feature request "Dolby Atmos Preview" submitted successfully! \(Ref: bug-12345\)/i)).toBeInTheDocument();
        });
    });

    it('handles reportBugFn error gracefully and still completes submission', async () => {
        mockReportBugCallable.mockRejectedValue(new Error('Cloud function offline'));

        useStore.setState({
            bugReportDialog: {
                isOpen: true,
                type: 'bug',
            },
        });

        render(<BugReportDialog />);

        const titleInput = screen.getByPlaceholderText(/e\.g\., Image generation crashes on mobile/i);
        const descriptionInput = screen.getByPlaceholderText(/Describe the issue in detail/i);

        fireEvent.change(titleInput, { target: { value: 'Minor UI glitch' } });
        fireEvent.change(descriptionInput, { target: { value: 'Button padding is misaligned' } });

        const submitButton = screen.getByRole('button', { name: /Send to Agent/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/Bug report "Minor UI glitch" submitted successfully!/i)).toBeInTheDocument();
        });
    });
});
