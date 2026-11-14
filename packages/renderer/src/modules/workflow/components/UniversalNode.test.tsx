import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UniversalNode from './UniversalNode';
import { InputNode, OutputNode } from './CustomNodes';
import { Status } from '../types';

// Mock dependencies
vi.mock('reactflow', () => ({
    Handle: ({ type, id, className, style }: any) => (
        <div data-testid={`handle-${type}-${id}`} className={className} style={style} />
    ),
    Position: { Left: 'left', Right: 'right' },
}));

vi.mock('../services/nodeRegistry', () => ({
    getNodeDefinition: vi.fn(() => ({ icon: () => <svg data-testid="node-icon" /> })),
    getJobDefinition: vi.fn(() => ({
        label: 'Test Job',
        inputs: [{ id: 'in1', label: 'Input 1', type: 'text' }],
        outputs: [{ id: 'out1', label: 'Output 1', type: 'text' }],
    })),
    DATA_TYPE_COLORS: { text: '#fff' },
}));

vi.mock('@/core/store', () => ({
    useStore: () => ({ nodes: [], setSelectedNodeId: vi.fn() }),
}));

describe('UniversalNode', () => {
    const mockData = {
        departmentName: 'Creative',
        selectedJobId: 'job1',
        nodeType: 'department' as const,
        status: Status.PENDING,
        result: undefined,
    };

    const mockProps = {
        id: 'node1',
        data: mockData,
        selected: false,
        type: 'universal',
        zIndex: 1,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        dragging: false,
    };

    it('renders node label and department', () => {
        render(<UniversalNode {...mockProps} />);
        expect(screen.getByText('Test Job')).toBeInTheDocument();
        expect(screen.getByText('Creative')).toBeInTheDocument();
    });

    it('renders status icon', () => {
        // We can't easily check the specific icon component without deeper mocking,
        // but we can check if the status container exists or check for class names.
        // The status icon is rendered in the header.
        // Let's rely on the fact that it renders *something* in the header right side.
        // Or we can check for the text-gray-400 class which corresponds to PENDING.
        const { container } = render(<UniversalNode {...mockProps} />);
        // This is a bit brittle, but effective for now.
        expect(container.querySelector('.text-gray-400')).toBeInTheDocument();
    });

    it('renders input and output handles', () => {
        render(<UniversalNode {...mockProps} />);
        expect(screen.getByTestId('handle-target-in1')).toBeInTheDocument();
        expect(screen.getByTestId('handle-source-out1')).toBeInTheDocument();
    });

    it('renders awaiting output state', () => {
        render(<UniversalNode {...mockProps} />);
        expect(screen.getByText('Awaiting Output')).toBeInTheDocument();
    });

    it('renders result when status is DONE', () => {
        const doneProps = {
            ...mockProps,
            data: {
                ...mockData,
                status: Status.DONE,
                result: { title: 'Result Title', assetType: 'text' }
            }
        };
        render(<UniversalNode {...doneProps} />);
        expect(screen.getByText('Result Title')).toBeInTheDocument();
    });

    it('renders error message when status is ERROR', () => {
        const errorProps = {
            ...mockProps,
            data: {
                ...mockData,
                status: Status.ERROR,
                result: 'Something went wrong'
            }
        };
        render(<UniversalNode {...errorProps} />);
        expect(screen.getByText('Something went wrong...')).toBeInTheDocument();
    });

    it('renders InputNode and OutputNode handles after content with pointer-events and z-30 (ISSUE-1622)', () => {
        const { container } = render(
            <>
                <InputNode
                    id="start-1"
                    type="inputNode"
                    data={{ nodeType: 'input', prompt: 'Brief', status: Status.PENDING }}
                    selected={false}
                    zIndex={1}
                    isConnectable={true}
                    xPos={0}
                    yPos={0}
                    dragging={false}
                />
                <OutputNode
                    id="end-1"
                    type="outputNode"
                    data={{ nodeType: 'output', status: Status.PENDING }}
                    selected={false}
                    zIndex={1}
                    isConnectable={true}
                    xPos={300}
                    yPos={0}
                    dragging={false}
                />
            </>
        );

        const sourceHandle = screen.getByTestId('handle-source-output');
        expect(sourceHandle.className).toContain('!z-30');
        expect(sourceHandle.className).toContain('!pointer-events-auto');
        expect(sourceHandle.className).toContain('!w-3.5');

        const promptTextarea = container.querySelector('textarea')!;
        // Source handle follows the body in DOM order so it is never covered by body divs
        expect(Boolean(promptTextarea.compareDocumentPosition(sourceHandle) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

        const targetHandle = screen.getByTestId('handle-target-input');
        expect(targetHandle.className).toContain('!z-30');
        expect(targetHandle.className).toContain('!pointer-events-auto');
    });

    it('renders UniversalNode handles with 12x12 hit targets and z-30 stacking (ISSUE-1622)', () => {
        render(<UniversalNode {...mockProps} />);
        const targetHandle = screen.getByTestId('handle-target-in1');
        const sourceHandle = screen.getByTestId('handle-source-out1');
        expect(targetHandle.className).toContain('!z-30');
        expect(targetHandle.className).toContain('!pointer-events-auto');
        expect(targetHandle.style.width).toBe('12px');
        expect(targetHandle.style.height).toBe('12px');
        expect(sourceHandle.className).toContain('!z-30');
        expect(sourceHandle.style.width).toBe('12px');
    });
});
