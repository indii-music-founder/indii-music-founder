import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from './AgentService';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { useStore } from '@/core/store';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateContentStream: vi.fn().mockResolvedValue({
            stream: {
                getReader: () => ({
                    read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
                    releaseLock: vi.fn(),
                }),
            },
        }),
    },
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(),
    },
}));

vi.mock('uuid', () => ({
    v4: vi.fn(() => 'mock-uuid'),
}));

// Mock other dependencies to avoid errors during import/instantiation
vi.mock('./components/ContextPipeline', () => ({
    ContextPipeline: class {
        buildContext = vi.fn().mockResolvedValue({
            chatHistory: [],
            userProfile: { id: 'test-user', displayName: 'Test Artist' }
        });
    }
}));
vi.mock('./components/AgentOrchestrator', () => ({ AgentOrchestrator: class {} }));
vi.mock('./hybrid/HybridOrchestrator', () => ({ HybridOrchestrator: class {} }));
vi.mock('./components/AgentExecutor', () => ({ AgentExecutor: class {} }));
vi.mock('./registry', () => ({ agentRegistry: { warmup: vi.fn() } }));
vi.mock('./WorkflowCoordinator', () => ({ coordinator: { handleUserRequest: vi.fn() } }));
vi.mock('./AgentZeroService', () => ({ agentZeroService: { sendMessage: vi.fn() } }));

describe('AgentService Direct Chat Reproduction', () => {
    let agentService: AgentService;
    const mockAddAgentMessage = vi.fn();
    const mockUpdateAgentMessage = vi.fn();

    beforeEach(async () => {
        vi.clearAllMocks();

        // Reset modules to ensure fresh AgentService instance if possible
        // But since AgentService is a singleton export, we might need to rely on mocking its internals.
        // However, since we mock dependencies, the singleton instance should pick them up.
    });

    it('should not duplicate the latest user message in the prompt sent to LLM', async () => {
        const userText = 'Hello world';
        const history = [
            { role: 'user', text: 'Previous message', id: '1', timestamp: 1000 },
            { role: 'model', text: 'Previous response', id: '2', timestamp: 2000 },
            // The current message will be added by sendMessage
        ];

        const currentHistory = [...history];

        mockAddAgentMessage.mockImplementation((msg) => {
            currentHistory.push(msg);
        });

        vi.mocked(useStore.getState).mockReturnValue({
            addAgentMessage: mockAddAgentMessage,
            updateAgentMessage: mockUpdateAgentMessage,
            activeAgentProvider: 'direct', // Target direct chat flow
            sessions: { 'session-1': { participants: ['generalist'] } },
            activeSessionId: 'session-1',
            get agentHistory() { return currentHistory; }, // Dynamic property
            generatedHistory: []
        } as any);

        // Import inside test to ensure mocks apply
        const mod = await import('./AgentService');
        agentService = mod.agentService;

        await agentService.sendMessage(userText);

        // Verify addAgentMessage was called
        expect(mockAddAgentMessage).toHaveBeenCalledWith(expect.objectContaining({
            role: 'user',
            text: userText
        }));

        // Verify firebaseAI.generateContentStream was called
        expect(firebaseAI.generateContentStream).toHaveBeenCalled();

        const callArgs = vi.mocked(firebaseAI.generateContentStream).mock.calls[0];
        const contents = callArgs[0] as any[];

        // Log contents for debugging
        console.log('Contents sent to LLM:', JSON.stringify(contents, null, 2));

        // Expected contents:
        // 1. Previous message (user)
        // 2. Previous response (model)
        // 3. Current message (user)

        // Assertions
        expect(contents.length).toBe(3);

        const lastMessage = contents[contents.length - 1];
        const secondLastMessage = contents[contents.length - 2];

        expect(lastMessage.role).toBe('user');
        expect(lastMessage.parts[0].text).toBe(userText);

        expect(secondLastMessage.parts[0].text).not.toBe(userText);
        expect(secondLastMessage.parts[0].text).toBe('Previous response');
    });
});
