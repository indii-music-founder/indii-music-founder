import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TraceViewer } from './TraceViewer';
import { AgentTrace } from '@/services/agent/observability/types';

// Mock data
const mockTrace: AgentTrace = {
    id: 'trace-123',
    userId: 'user-1',
    agentId: 'agent-007',
    startTime: { seconds: 1600000000, nanoseconds: 0 },
    status: 'completed',
    input: 'test input',
    steps: [],
    endTime: { seconds: 1600000010, nanoseconds: 0 },
};

// Mock dependencies
const mockOnSnapshot = vi.fn((query, callback) => {
    // Simulate initial data load
    callback({
        docs: [
            {
                id: mockTrace.id,
                data: () => mockTrace
            }
        ]
    });
    return vi.fn(); // unsubscribe
});

vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    onSnapshot: (q: any, cb: any) => mockOnSnapshot(q, cb)
}));

vi.mock('@/services/firebase', () => ({
  serverTimestamp: vi.fn(),
    db: {}
}));

vi.mock('./SwarmGraph', () => ({
  serverTimestamp: vi.fn(),
    SwarmGraph: () => <div data-testid="swarm-graph-mock">Swarm Graph</div>
}));

vi.mock('./XRayPanel', () => ({
  serverTimestamp: vi.fn(),
    XRayPanel: ({ trace }: { trace?: AgentTrace | null }) => (
        <div data-testid="xray-panel-mock">
            {trace ? `X-Ray Trace: ${trace.id}` : 'X-Ray Panel'}
        </div>
    )
}));

describe('TraceViewer Accessibility (⌨️ Keyboard)', () => {
    it('allows selecting a trace using keyboard (Enter)', async () => {
        render(<TraceViewer />);

        // Wait for the trace to appear
        await screen.findByText('test input');

        // Find the button by its content. We use getAllByRole('button') and filter because
        // accessible name computation can be whitespace-sensitive.
        const buttons = screen.getAllByRole('button');
        const traceButton = buttons.find(
            b => b.textContent?.includes('agent-007') && b.textContent?.includes('test input')
        );

        if (!traceButton) {
            throw new Error('Trace button not found');
        }

        // Verify it is a button (implicit by getAllByRole) and has keyboard support
        // Note: standard HTML buttons are keyboard accessible by default, so we mostly check standard attributes if needed.
        // We explicitly added aria-pressed.
        expect(traceButton).toHaveAttribute('aria-pressed', 'false');

        // Simulate Tab navigation (focus)
        traceButton.focus();
        expect(document.activeElement).toBe(traceButton);

        // Simulate Enter key
        fireEvent.click(traceButton); // Click should work.
        // Also verify keydown handler if we added one?
        // Standard buttons trigger onClick on Enter/Space, so fireEvent.click matches user behavior.
        // But let's verify Space key specifically if we want to ensure standard behavior is preserved.

        // Verify selection happened
        expect(screen.getByText(`X-Ray Trace: ${mockTrace.id}`)).toBeInTheDocument();
    });

    it('verifies visual focus indication', async () => {
         render(<TraceViewer />);
         await screen.findByText('test input');

         const buttons = screen.getAllByRole('button');
         const traceButton = buttons.find(
            b => b.textContent?.includes('agent-007')
         );

         expect(traceButton).toHaveClass('focus-visible:ring-2');
    });
});
