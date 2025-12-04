import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UniversalNode from './UniversalNode';
import { Status } from '../types';

// Mock dependencies
vi.mock('reactflow', () => ({
    Handle: ({ type, position, id }: any) => <div data-testid={`handle-${type}-${id}`} />,
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

vi.mock('../../../core/store', () => ({
    useStore: () => ({ nodes: [] }),
}));

describe('UniversalNode', () => {
    const mockData = {
        departmentName: 'Creative',
        selectedJobId: 'job1',
        nodeType: 'department',
        status: Status.PENDING,
        label: 'Test Node',
        prompt: 'Test Prompt',
        result: null,
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
});
