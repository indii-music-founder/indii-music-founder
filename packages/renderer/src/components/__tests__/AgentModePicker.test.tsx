/**
 * AgentModePicker — UI behavior coverage.
 *
 * Closes the visual/UX gap that BaseAgent unit tests can't reach. The picker is
 * exercised in controlled mode (props instead of store) so each test is fully
 * isolated and deterministic. Selectors use `data-testid` attributes so labels
 * like "Department" can't collide with agent names like "Director".
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { AgentModePicker } from '../AgentModePicker';

vi.mock('@/core/store', () => ({
    useStore: () => ({
        conversationMode: 'direct',
        activeDepartmentId: null,
        directTargetAgentId: null,
        setConversationMode: vi.fn(),
        setActiveDepartmentId: vi.fn(),
        setDirectTargetAgentId: vi.fn(),
    }),
}));

describe('AgentModePicker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('mode segmented switch', () => {
        it('renders all three mode buttons (boardroom, department, direct)', () => {
            render(<AgentModePicker mode="direct" />);
            expect(screen.getByTestId('agent-mode-boardroom')).toBeInTheDocument();
            expect(screen.getByTestId('agent-mode-department')).toBeInTheDocument();
            expect(screen.getByTestId('agent-mode-direct')).toBeInTheDocument();
        });

        it('marks the active mode via data-active and aria-pressed', () => {
            render(<AgentModePicker mode="boardroom" />);
            const boardroom = screen.getByTestId('agent-mode-boardroom');
            const direct = screen.getByTestId('agent-mode-direct');
            expect(boardroom).toHaveAttribute('data-active', 'true');
            expect(boardroom).toHaveAttribute('aria-pressed', 'true');
            expect(direct).toHaveAttribute('data-active', 'false');
            expect(direct).toHaveAttribute('aria-pressed', 'false');
        });

        it('invokes onModeChange with the selected mode', () => {
            const onModeChange = vi.fn();
            render(<AgentModePicker mode="direct" onModeChange={onModeChange} />);

            fireEvent.click(screen.getByTestId('agent-mode-department'));
            expect(onModeChange).toHaveBeenLastCalledWith('department');

            fireEvent.click(screen.getByTestId('agent-mode-boardroom'));
            expect(onModeChange).toHaveBeenLastCalledWith('boardroom');

            fireEvent.click(screen.getByTestId('agent-mode-direct'));
            expect(onModeChange).toHaveBeenLastCalledWith('direct');
        });
    });

    describe('contextual selectors', () => {
        it('shows the agent grouped-by-department selector in Direct mode', () => {
            render(<AgentModePicker mode="direct" />);
            expect(screen.getByText(/select agent/i)).toBeInTheDocument();
            // Department headers visible (using their displayNames)
            expect(screen.getByText('Finance')).toBeInTheDocument();
            expect(screen.getByText('Legal')).toBeInTheDocument();
        });

        it('shows the department grid selector in Department mode', () => {
            render(<AgentModePicker mode="department" />);
            expect(screen.getByText(/select department/i)).toBeInTheDocument();
            expect(screen.getByTestId('agent-dept-finance')).toBeInTheDocument();
            expect(screen.getByTestId('agent-dept-legal')).toBeInTheDocument();
        });

        it('shows the Boardroom info card (no extra selector) in Boardroom mode', () => {
            render(<AgentModePicker mode="boardroom" />);
            expect(screen.getByText(/boardroom active/i)).toBeInTheDocument();
            expect(screen.getByText(/full swarm mode/i)).toBeInTheDocument();
            // Direct mode's "Select Agent" header should NOT be present
            expect(screen.queryByText(/select agent/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/select department/i)).not.toBeInTheDocument();
        });
    });

    describe('Direct mode — agent selection', () => {
        it('renders heads and workers for the Finance department', () => {
            render(<AgentModePicker mode="direct" />);
            expect(screen.getByTestId('agent-direct-finance')).toBeInTheDocument();
            expect(screen.getByTestId('agent-direct-finance.tax')).toBeInTheDocument();
            expect(screen.getByTestId('agent-direct-finance.accounting')).toBeInTheDocument();
            expect(screen.getByTestId('agent-direct-finance.royalty')).toBeInTheDocument();
        });

        it('labels the head as "Department Head" and workers as "Specialist Worker"', () => {
            render(<AgentModePicker mode="direct" />);
            const headLabels = screen.getAllByText(/department head/i);
            const workerLabels = screen.getAllByText(/specialist worker/i);
            expect(headLabels.length).toBeGreaterThanOrEqual(1);
            expect(workerLabels.length).toBeGreaterThanOrEqual(3);
        });

        it('invokes onAgentChange when an agent is clicked', () => {
            const onAgentChange = vi.fn();
            render(<AgentModePicker mode="direct" onAgentChange={onAgentChange} />);
            fireEvent.click(screen.getByTestId('agent-direct-finance.tax'));
            expect(onAgentChange).toHaveBeenCalledWith('finance.tax');
        });

        it('marks the selected agent via data-selected', () => {
            render(<AgentModePicker mode="direct" agentId="finance.tax" />);
            expect(screen.getByTestId('agent-direct-finance.tax'))
                .toHaveAttribute('data-selected', 'true');
            expect(screen.getByTestId('agent-direct-finance'))
                .toHaveAttribute('data-selected', 'false');
        });
    });

    describe('Department mode — department selection', () => {
        it('invokes onDepartmentChange when a department is clicked', () => {
            const onDepartmentChange = vi.fn();
            render(<AgentModePicker mode="department" onDepartmentChange={onDepartmentChange} />);
            fireEvent.click(screen.getByTestId('agent-dept-legal'));
            expect(onDepartmentChange).toHaveBeenCalledWith('legal');
        });

        it('marks the selected department via data-selected', () => {
            render(<AgentModePicker mode="department" departmentId="finance" />);
            expect(screen.getByTestId('agent-dept-finance'))
                .toHaveAttribute('data-selected', 'true');
            expect(screen.getByTestId('agent-dept-legal'))
                .toHaveAttribute('data-selected', 'false');
        });
    });

    describe('controlled vs uncontrolled', () => {
        it('falls back to store when no controlled props are passed', () => {
            // Store mock returns conversationMode='direct'
            render(<AgentModePicker />);
            expect(screen.getByText(/select agent/i)).toBeInTheDocument();
        });

        it('controlled mode prop overrides store value', () => {
            render(<AgentModePicker mode="boardroom" />);
            expect(screen.getByText(/boardroom active/i)).toBeInTheDocument();
            expect(screen.queryByText(/select agent/i)).not.toBeInTheDocument();
        });
    });
});
