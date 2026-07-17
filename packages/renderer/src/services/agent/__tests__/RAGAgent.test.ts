import { describe, it, expect, vi } from 'vitest';
import { RAGAgent } from '../RAGAgent';
import { GeminiRetrieval } from '@/services/rag/GeminiRetrievalService';
import { AgentConfig } from '../types';

// Mock the Gemini Retrieval service
vi.mock('@/services/rag/GeminiRetrievalService', () => ({
    GeminiRetrieval: {
        query: vi.fn(),
    },
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('@/services/agent/fine-tuned-models', () => ({
    getFineTunedModel: vi.fn(() => 'mocked-endpoint-123'),
}));

// Provide a concrete subclass of RAGAgent for testing since it's abstract
class TestRAGAgent extends RAGAgent {
    constructor(config: AgentConfig) {
        super(config);
    }
    // Stub _executeInternal of BaseAgent
    protected async _executeInternal(
        task: string,
        context: any,
        onProgress: any,
        signal: any,
        attachments: any
    ): Promise<any> {
        return { success: true, text: 'Test successful', toolCalls: [], tokens: 0 };
    }
    
    // Expose the protected method for testing
    public async testExecuteInternal(
        task: string,
        context?: any,
        onProgress?: any,
        signal?: any,
        attachments?: any
    ) {
        return super._executeInternal(task, context, onProgress, signal, attachments);
    }
}

describe('ISSUE-481: KB offline message', () => {
    it('emits neutral "Proceeding with standard knowledge." when RAG throws an error', async () => {
        // Arrange
        const agent = new TestRAGAgent({ id: 'finance', name: 'Test', role: 'Test', systemPrompt: 'Test' } as any);
        const onProgress = vi.fn();
        
        // Mock RAG to throw an error (simulating KB offline)
        vi.mocked(GeminiRetrieval.query).mockRejectedValueOnce(new Error('KB offline'));

        // Act
        await agent.testExecuteInternal('Test task', undefined, onProgress);

        // Assert
        // Should have been called with the neutral message
        expect(onProgress).toHaveBeenCalledWith({
            type: 'thought',
            content: 'Proceeding with standard knowledge.'
        });
    });

    it('emits neutral "Proceeding with standard protocol" when RAG returns empty', async () => {
        // Arrange
        const agent = new TestRAGAgent({ id: 'finance', name: 'Test', role: 'Test', systemPrompt: 'Test' } as any);
        const onProgress = vi.fn();
        
        // Mock RAG to return empty/NONE
        vi.mocked(GeminiRetrieval.query).mockResolvedValueOnce({
            candidates: [{ content: { parts: [{ text: 'NONE' }] } }]
        } as any);

        // Act
        await agent.testExecuteInternal('Test task', undefined, onProgress);

        // Assert
        expect(onProgress).toHaveBeenCalledWith({
            type: 'thought',
            content: 'Proceeding with standard protocol (no supplemental insights required).'
        });
    });
});
