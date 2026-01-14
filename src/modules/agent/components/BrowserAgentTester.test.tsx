import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BrowserAgentTester from './BrowserAgentTester';
import { browserAgentDriver } from '../../../services/agent/BrowserAgentDriver';
import { useAgentStore } from '../store/AgentStore';
import { AgentActionType } from '../types';

// Mock dependencies
vi.mock('../../../services/agent/BrowserAgentDriver', () => ({
    browserAgentDriver: {
        drive: vi.fn(),
    }
}));

const mockLogAction = vi.fn();
vi.mock('../store/AgentStore', () => ({
    useAgentStore: vi.fn(() => ({
        logAction: mockLogAction,
    }))
}));

describe('BrowserAgentTester', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock scrollIntoView as it's not supported in JSDOM
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    it('renders initial state correctly', () => {
        render(<BrowserAgentTester />);

        // Check for inputs
        expect(screen.getByLabelText(/Target URL/i)).toHaveValue('https://www.google.com');
        expect(screen.getByLabelText(/Instruction \/ Goal/i)).toHaveValue('Find the capacity of "Saint Andrew\'s Hall" in Detroit');

        // Check button
        expect(screen.getByRole('button', { name: /Launch Agent/i })).toBeInTheDocument();

        // Check Logs area
        expect(screen.getByText('Execution Logs')).toBeInTheDocument();
    });

    it('handles successful agent execution', async () => {
        // Mock success response
        (browserAgentDriver.drive as any).mockResolvedValueOnce({
            success: true,
            logs: ['[Driver] Starting', '[Driver] Goal Achieved!']
        });

        render(<BrowserAgentTester />);

        const launchButton = screen.getByRole('button', { name: /Launch Agent/i });
        fireEvent.click(launchButton);

        // Verify Loading State
        expect(screen.getByText(/Agent Driving.../i)).toBeInTheDocument();
        expect(launchButton).toBeDisabled();

        // Wait for completion
        await waitFor(() => {
            expect(screen.getByText(/Launch Agent/i)).toBeEnabled();
        });

        // Verify Logs
        expect(screen.getByText('[Driver] Starting')).toBeInTheDocument();
        expect(screen.getByText('[Driver] Goal Achieved!')).toBeInTheDocument();

        // Verify Store Update
        expect(mockLogAction).toHaveBeenCalledWith(expect.objectContaining({
            type: AgentActionType.BROWSER_DRIVE,
            status: 'completed'
        }));
    });

    it('handles failed agent execution', async () => {
        // Mock failure response
        (browserAgentDriver.drive as any).mockResolvedValueOnce({
            success: false,
            logs: ['[Driver] Starting', '[Driver] Error: Something went wrong']
        });

        render(<BrowserAgentTester />);

        fireEvent.click(screen.getByRole('button', { name: /Launch Agent/i }));

        await waitFor(() => {
            expect(screen.getByText(/Launch Agent/i)).toBeEnabled();
        });

        // Verify Error Log
        expect(screen.getByText('[Driver] Error: Something went wrong')).toBeInTheDocument();

        // Verify Error Banner (The component sets 'error' state which renders an alert)
        // The component logic: if (!result.success) setError('Agent failed to complete the goal.');
        expect(screen.getByText('Agent failed to complete the goal.')).toBeInTheDocument();

        // Verify Store Update
        expect(mockLogAction).toHaveBeenCalledWith(expect.objectContaining({
            status: 'failed'
        }));
    });

    it('handles unexpected exceptions', async () => {
        // Mock exception
        (browserAgentDriver.drive as any).mockRejectedValueOnce(new Error('Network Error'));

        render(<BrowserAgentTester />);

        fireEvent.click(screen.getByRole('button', { name: /Launch Agent/i }));

        await waitFor(() => {
            expect(screen.getByText(/Launch Agent/i)).toBeEnabled();
        });

        // Verify Error Banner
        expect(screen.getByText('Network Error')).toBeInTheDocument();

        // Verify Log
        expect(screen.getByText('[ERROR] Network Error')).toBeInTheDocument();
    });

    it('updates input fields correctly', () => {
        render(<BrowserAgentTester />);

        const urlInput = screen.getByLabelText(/Target URL/i);
        fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
        expect(urlInput).toHaveValue('https://example.com');

        const goalInput = screen.getByLabelText(/Instruction \/ Goal/i);
        fireEvent.change(goalInput, { target: { value: 'New Goal' } });
        expect(goalInput).toHaveValue('New Goal');
    });
});
