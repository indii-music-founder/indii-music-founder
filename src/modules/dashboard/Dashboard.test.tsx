import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: vi.fn(() => ({}))
}));

vi.mock('./components/AgentWorkspace', () => ({
    default: () => <div data-testid="agent-workspace">Agent Workspace</div>
}));

describe('Dashboard', () => {
    it('renders AgentWorkspace by default', () => {
        render(<Dashboard />);
        expect(screen.getByTestId('agent-workspace')).toBeInTheDocument();
    });
});
