import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';
import { getUserWorkflows } from '@/modules/workflow/services/workflowPersistence';

const mocks = vi.hoisted(() => ({
    setModule: vi.fn(),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    setEntryAssistantDismissed: vi.fn(),
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
        setModule: mocks.setModule,
        isEntryAssistantDismissed: true,
        setEntryAssistantDismissed: mocks.setEntryAssistantDismissed,
        user: { uid: 'artist-1' },
        setNodes: mocks.setNodes,
        setEdges: mocks.setEdges,
    }),
}));

vi.mock('@/modules/workflow/services/workflowPersistence', () => ({
    getUserWorkflows: vi.fn(),
}));

vi.mock('@/core/logger/Logger', () => ({
    Logger: { error: vi.fn() },
}));

vi.mock('@/components/shared/IndiiFavicon', () => ({
    IndiiFavicon: () => <div data-testid="indii-favicon" />,
}));

vi.mock('./EntryOverlay', () => ({
    EntryOverlay: () => <div>Entry Assistant</div>,
}));

vi.mock('motion/react', () => {
    const motionProxy = new Proxy({}, {
        get: (_target, prop: string) => {
            return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
                const {
                    initial: _initial,
                    animate: _animate,
                    transition: _transition,
                    whileTap: _whileTap,
                    ...domProps
                } = props;
                const Tag = prop as unknown as React.ElementType;
                return <Tag {...domProps}>{children}</Tag>;
            };
        },
    });

    return { motion: motionProxy };
});

describe('EmptyState homepage discovery', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getUserWorkflows).mockResolvedValue([]);
    });

    it('promotes Mobile Remote and puts Build a Workflow in the suggestion grid', async () => {
        const onCommandSubmit = vi.fn();

        render(
            <EmptyState
                onCommandClick={vi.fn()}
                onCommandSubmit={onCommandSubmit}
                studioSlot={<div>Studio numbers</div>}
            />
        );

        expect(screen.getByText('Studio numbers')).toBeInTheDocument();
        expect(screen.queryByText('Your Workflows')).not.toBeInTheDocument();
        await waitFor(() => expect(getUserWorkflows).toHaveBeenCalledWith('artist-1'));

        const remote = screen.getByRole('button', {
            name: 'Connect Mobile Remote — open pairing and connection status',
        });
        const workflow = screen.getByRole('button', { name: /Build a Workflow/i });

        expect(remote).toBeInTheDocument();
        expect(workflow).toBeInTheDocument();

        fireEvent.click(remote);
        fireEvent.click(workflow);

        expect(onCommandSubmit).toHaveBeenNthCalledWith(1, '/connect-remote');
        expect(onCommandSubmit).toHaveBeenNthCalledWith(2, '/custom-workflow');
    });

    it('preserves the real saved-workflow listing and opens a selected workflow', async () => {
        const nodes = [{ id: 'node-1', type: 'input', position: { x: 0, y: 0 }, data: {} }];
        const edges = [{ id: 'edge-1', source: 'node-1', target: 'node-2' }];
        vi.mocked(getUserWorkflows).mockResolvedValue([
            {
                id: 'workflow-1',
                name: 'Release Day',
                nodes,
                edges,
            },
        ] as Awaited<ReturnType<typeof getUserWorkflows>>);

        render(
            <EmptyState
                onCommandClick={vi.fn()}
                onCommandSubmit={vi.fn()}
            />
        );

        expect(await screen.findByText('Your Workflows')).toBeInTheDocument();
        const savedWorkflow = screen.getByRole('button', { name: /Release Day/i });
        expect(screen.queryByRole('button', { name: /New workflow/i })).not.toBeInTheDocument();

        fireEvent.click(savedWorkflow);

        expect(mocks.setNodes).toHaveBeenCalledWith(nodes);
        expect(mocks.setEdges).toHaveBeenCalledWith(edges);
        expect(mocks.setModule).toHaveBeenCalledWith('workflow');
    });
});
