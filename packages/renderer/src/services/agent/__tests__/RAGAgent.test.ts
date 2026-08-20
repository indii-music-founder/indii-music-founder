import { describe, it, expect, vi } from 'vitest';
import { RAGAgent } from '../RAGAgent';
import { knowledgeRetrievalService } from '@/modules/knowledge/services/KnowledgeRetrievalService';
import { AgentConfig } from '../types';
import { firebaseAI } from '@/services/intelligence/FirebaseIntelligenceService';
import { RateLimiter } from '@/services/intelligence/RateLimiter';

// Mock the Knowledge Retrieval service
vi.mock('@/modules/knowledge/services/KnowledgeRetrievalService', () => ({
    knowledgeRetrievalService: {
        chat: vi.fn(),
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
        _task: string,
        _context: any,
        _onProgress: any,
        _signal: any,
        _attachments: any
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

// The agent loop routes content through the backend streaming endpoint via
// fetch and a singleton rate limiter with ONE initial token (~6s refill) —
// both made deterministic here so the loop cannot hang on the network or a
// token queue.
const streamChunk = (text: string): Uint8Array =>
    new TextEncoder().encode(`${JSON.stringify({ text })}\n${JSON.stringify({ complete: true })}\n`);
vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(streamChunk('Standard agent response.'));
            controller.close();
        },
    }),
    text: async () => '',
})));

describe('ISSUE-481: KB offline message', () => {
    beforeEach(() => {
        firebaseAI.rateLimiter = new RateLimiter(10, 10);
    });
    it('emits neutral "Proceeding with standard knowledge." when RAG throws an error', async () => {
        // Arrange
        const agent = new TestRAGAgent({ id: 'finance', name: 'Test', role: 'Test', systemPrompt: 'Test' } as any);
        const onProgress = vi.fn();
        
        // Mock RAG to throw an error (simulating KB offline)
        vi.mocked(knowledgeRetrievalService.chat).mockRejectedValueOnce(new Error('KB offline'));

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
        vi.mocked(knowledgeRetrievalService.chat).mockResolvedValueOnce('NONE');

        // Act
        await agent.testExecuteInternal('Test task', undefined, onProgress);

        // Assert
        expect(onProgress).toHaveBeenCalledWith({
            type: 'thought',
            content: 'Proceeding with standard protocol (no supplemental insights required).'
        });
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});
