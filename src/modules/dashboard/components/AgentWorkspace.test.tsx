
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AgentWorkspace from './AgentWorkspace';

// Mock child components
vi.mock('./QuickActions', () => ({
    default: () => <div data-testid="quick-actions">QuickActions</div>
}));

vi.mock('./WorkspaceCanvas', () => ({
    WorkspaceCanvas: () => <div data-testid="workspace-canvas">WorkspaceCanvas</div>
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className }: any) => <div className={className}>{children}</div>
    }
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
    CheckCircle: () => <span>CheckCircle</span>,
    AlertCircle: () => <span>AlertCircle</span>
}));

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: vi.fn()
}));

describe('AgentWorkspace Component', () => {
    it('should render correctly', () => {
        render(<AgentWorkspace />);

        expect(screen.getByText('Agent Workspace')).toBeInTheDocument();
        expect(screen.getByText('indii is ready to assist.')).toBeInTheDocument();
        expect(screen.getByText('System Active')).toBeInTheDocument();

        expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
        expect(screen.getByTestId('workspace-canvas')).toBeInTheDocument();

        expect(screen.getByText('Last Completed')).toBeInTheDocument();
        expect(screen.getByText('Active Context')).toBeInTheDocument();
    });
});
