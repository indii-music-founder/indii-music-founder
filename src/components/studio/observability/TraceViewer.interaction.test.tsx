import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TraceViewer } from './TraceViewer';

// Mock dependencies
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    onSnapshot: vi.fn(() => vi.fn()) // Mock unsubscribe
}));

vi.mock('@/services/firebase', () => ({
    db: {}
}));

vi.mock('./SwarmGraph', () => ({
    SwarmGraph: () => <div data-testid="swarm-graph-mock">Swarm Graph</div>
}));

vi.mock('./XRayPanel', () => ({
    XRayPanel: () => <div data-testid="xray-panel-mock">X-Ray Panel</div>
}));

describe('TraceViewer Interaction (🖱️ Click)', () => {
    it('verifies the Tab switching lifecycle (List → Graph → List)', async () => {
        render(<TraceViewer />);

        // 1. Ready State: Default to List View
        expect(screen.getByTestId('list-content')).toBeInTheDocument();
        expect(screen.queryByTestId('graph-content')).not.toBeInTheDocument();

        // 2. Action: Click 'Swarm Graph' trigger
        const graphTrigger = screen.getByTestId('graph-trigger');
        fireEvent.click(graphTrigger);

        // 3. Feedback: content area switches to Graph
        expect(screen.getByTestId('graph-content')).toBeInTheDocument();
        expect(screen.queryByTestId('list-content')).not.toBeInTheDocument();
        expect(screen.getByTestId('swarm-graph-mock')).toBeInTheDocument();

        // 4. Action: Click 'List View' trigger
        const listTrigger = screen.getByTestId('list-trigger');
        fireEvent.click(listTrigger);

        // 5. Return to Ready State: List View is visible again
        expect(screen.getByTestId('list-content')).toBeInTheDocument();
        expect(screen.queryByTestId('graph-content')).not.toBeInTheDocument();
    });

    it('asserts the selected state triggers feedback on the content triggers', () => {
        render(<TraceViewer />);

        const listTrigger = screen.getByTestId('list-trigger');
        const graphTrigger = screen.getByTestId('graph-trigger');

        // Initial state: list is active
        expect(listTrigger).toHaveAttribute('data-state', 'active');
        expect(graphTrigger).toHaveAttribute('data-state', 'inactive');

        // Switch to graph
        fireEvent.click(graphTrigger);
        expect(listTrigger).toHaveAttribute('data-state', 'inactive');
        expect(graphTrigger).toHaveAttribute('data-state', 'active');
    });
});
