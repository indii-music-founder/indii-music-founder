import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkflowLab from './WorkflowLab';
import { protocolToReactFlow } from './utils/maestroAdapter';
import { WORKFLOW_REGISTRY } from '@/services/agent/WorkflowRegistry';

let mockSelectedNodeId: string | null = null;

vi.mock('../../core/store', () => ({
    useStore: (selector: (s: Record<string, unknown>) => unknown) =>
        selector({
            nodes: [],
            edges: [],
            setNodes: vi.fn(),
            setEdges: vi.fn(),
            user: { uid: 'user-1' },
            currentProjectId: 'proj-1',
            selectedNodeId: mockSelectedNodeId,
            setHasUnsavedChanges: vi.fn(),
            setModule: vi.fn(),
        }),
}));

vi.mock('./components/WorkflowEditor', () => ({
    default: () => <div data-testid="mock-workflow-editor" />,
}));
vi.mock('./components/WorkflowGeneratorModal', () => ({ default: () => null }));
vi.mock('./components/WorkflowTemplateModal', () => ({ default: () => null }));
vi.mock('./components/WorkflowLoadModal', () => ({ default: () => null }));
vi.mock('./components/WorkflowNodeInspector', () => ({
    default: () => <div data-testid="mock-node-inspector">Inspector</div>,
}));
vi.mock('@/modules/creative/components/FreeMiniCampaignModal', () => ({
    FreeMiniCampaignModal: () => null,
}));
vi.mock('./services/workflowPersistence', () => ({
    getUserWorkflows: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock('@/hooks/useMobile', () => ({
    useMobile: () => ({ isMobile: false }),
}));

describe('WorkflowLab Inspector & Library responsive toggle (ISSUE-1616)', () => {
    beforeEach(() => {
        mockSelectedNodeId = null;
        vi.clearAllMocks();
    });

    it('renders the Inspector & Library toggle button and opens the drawer on click', () => {
        render(<WorkflowLab />);

        const toggleBtn = screen.getByTestId('workflow-inspector-toggle');
        const rightPanel = screen.getByTestId('workflow-right-panel');

        expect(toggleBtn).toHaveTextContent('Inspector & Library');
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
        expect(rightPanel.className).toContain('hidden');

        fireEvent.click(toggleBtn);

        expect(toggleBtn).toHaveTextContent('Hide Inspector');
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
        expect(rightPanel.className).toContain('flex');
        expect(rightPanel.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    });

    it('automatically opens the inspector drawer when a node is selected', () => {
        const { rerender } = render(<WorkflowLab />);
        expect(screen.getByTestId('workflow-right-panel').className).toContain('hidden');

        mockSelectedNodeId = 'node-123';
        rerender(<WorkflowLab />);

        expect(screen.getByTestId('workflow-right-panel').className).toContain('flex');
        expect(screen.getByTestId('mock-node-inspector')).toBeInTheDocument();
    });
});

describe('maestroAdapter protocolToReactFlow (ISSUE-1617)', () => {
    it('maps protocol agentIds to valid departmentNode definitions instead of Router fallback', () => {
        const growthProtocol = WORKFLOW_REGISTRY['INDII_GROWTH_PROTOCOL'];
        expect(growthProtocol).toBeDefined();

        const { nodes } = protocolToReactFlow(growthProtocol);
        expect(nodes.length).toBe(growthProtocol.steps.length);
        for (const node of nodes) {
            expect(node.data.nodeType).toBe('department');
            expect(node.data.departmentName).toMatch(/Department$|Manager$/);
            expect(node.data.selectedJobId).toBeTruthy();
        }
    });
});
