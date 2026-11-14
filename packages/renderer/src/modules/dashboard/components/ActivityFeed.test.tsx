import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AgentEventBus } from '@/services/agent/governance/AgentEventBus';
import ActivityFeed from './ActivityFeed';

vi.mock('@/core/store', () => ({
    useStore: (select: (state: { agentHistory: []; sessions: [] }) => unknown) =>
        select({ agentHistory: [], sessions: [] }),
}));

// Component regression using the real event bus and no account or service.
it('replaces only the matching activity row when overlapping calls settle', () => {
    render(<ActivityFeed />);
    expect(screen.getByText(/Start a conversation/)).toBeInTheDocument();
    const timestamp = Date.now();
    act(() => {
        for (const toolCallId of ['first', 'second']) {
            AgentEventBus.emitToolEvent('TOOL_EXECUTION_START', {
                agentId: 'agent', toolName: 'lookup', timestamp, toolCallId,
            });
        }
    });
    expect(screen.getAllByText(/TOOL_EXECUTION_START/)).toHaveLength(2);
    expect(screen.queryByText(/Start a conversation/)).not.toBeInTheDocument();

    act(() => AgentEventBus.emitToolResult('agent', 'lookup', timestamp, { success: false }, 'second'));
    expect(screen.getAllByText(/TOOL_EXECUTION_START/)).toHaveLength(1);
    expect(screen.getByText(/TOOL_EXECUTION_FAILED/)).toBeInTheDocument();

    act(() => AgentEventBus.emitToolResult('agent', 'lookup', timestamp, { success: true }, 'first'));
    expect(screen.queryByText(/TOOL_EXECUTION_START/)).not.toBeInTheDocument();
    expect(screen.getByText(/TOOL_EXECUTION_COMPLETE/)).toBeInTheDocument();
    expect(screen.getByText(/TOOL_EXECUTION_FAILED/)).toBeInTheDocument();
});
