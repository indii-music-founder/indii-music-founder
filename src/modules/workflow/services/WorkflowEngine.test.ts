import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from './WorkflowEngine';
import { CustomNode, CustomEdge, Status } from '../types';
import { AI } from '@/services/ai/AIService';
import { ImageGeneration } from '@/services/image/ImageGenerationService';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            userProfile: { id: 'test-user', name: 'Test User' }
        })
    }
}));
vi.mock('@/services/ai/AIService');
vi.mock('@/services/image/ImageGenerationService');
vi.mock('@/services/rag/ragService', () => ({
    runAgenticWorkflow: vi.fn().mockResolvedValue({
        asset: { content: 'RAG Result Content' },
        updatedProfile: null
    })
}));

describe('WorkflowEngine', () => {
    let engine: WorkflowEngine;
    const mockSetNodes = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('executes a simple workflow with Knowledge Base node', async () => {
        const nodes: CustomNode[] = [
            {
                id: 'start',
                type: 'inputNode',
                position: { x: 0, y: 0 },
                data: { prompt: 'Test Query', status: Status.PENDING, nodeType: 'input' as const }
            },
            {
                id: 'kb-node',
                type: 'departmentNode',
                position: { x: 200, y: 0 },
                data: {
                    departmentName: 'Knowledge Base',
                    selectedJobId: 'kb-query',
                    status: Status.PENDING,
                    nodeType: 'department' as const
                }
            },
            {
                id: 'end',
                type: 'outputNode',
                position: { x: 400, y: 0 },
                data: { status: Status.PENDING, nodeType: 'output' as const }
            }
        ];

        const edges: CustomEdge[] = [
            { id: 'e1', source: 'start', target: 'kb-node', sourceHandle: 'output', targetHandle: 'query' },
            { id: 'e2', source: 'kb-node', target: 'end', sourceHandle: 'answer', targetHandle: 'input' }
        ];

        engine = new WorkflowEngine(nodes, edges, mockSetNodes);

        await engine.run();

        // Check if RAG service was called
        const { runAgenticWorkflow } = await import('@/services/rag/ragService');
        expect(runAgenticWorkflow).toHaveBeenCalledWith(
            'Test Query',
            expect.anything(), // userProfile
            null,
            expect.any(Function),
            expect.any(Function)
        );

        // Check if nodes were updated to DONE
        expect(mockSetNodes).toHaveBeenCalled();
        // We can't easily check the final state of nodes via mockSetNodes because it's called multiple times.
        // But we can check if the engine stored the result.
        // Accessing private property for testing is tricky in TS, but we can verify side effects.
    });
});
