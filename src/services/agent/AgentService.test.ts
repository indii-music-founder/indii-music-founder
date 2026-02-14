
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from './AgentService';
import { coordinator } from './WorkflowCoordinator';
// We need to import the class to spy on prototype or just mock the singleton export
import { useStore } from '@/core/store';

// Mock AgentExecutor
vi.mock('./components/AgentExecutor', () => {
    return {
        AgentExecutor: class {
            execute = vi.fn().mockResolvedValue({
                text: 'Executor Response',
                thoughtSignature: 'Executor Thought'
            });
        }
    };
});

// Mock HybridOrchestrator
vi.mock('./hybrid/HybridOrchestrator', () => {
    return {
        HybridOrchestrator: class {
            execute = vi.fn().mockResolvedValue('Hybrid Response');
        }
    };
});

// Mock ContextPipeline
vi.mock('./components/ContextPipeline', () => {
    return {
        ContextPipeline: class {
            buildContext = vi.fn().mockResolvedValue({
                chatHistory: [],
                userProfile: { id: 'test-user', displayName: 'Test Artist' }
            });
        }
    };
});

// Mock AgentOrchestrator
vi.mock('./components/AgentOrchestrator', () => {
    return {
        AgentOrchestrator: class { }
    };
});

// Mock AgentRegistry
vi.mock('./registry', () => ({
    agentRegistry: {
        warmup: vi.fn().mockResolvedValue(undefined)
    }
}));

// Mock WorkflowCoordinator
vi.mock('./WorkflowCoordinator', () => ({
    coordinator: {
        handleUserRequest: vi.fn()
    }
}));

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

// Mock AgentZeroService
vi.mock('./AgentZeroService', () => ({
    agentZeroService: {
        sendMessage: vi.fn()
    }
}));

describe('AgentService Integration Tests', () => {
    let agentService: AgentService;
    const mockAddAgentMessage = vi.fn();
    const mockUpdateAgentMessage = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup Store params
        vi.mocked(useStore.getState).mockReturnValue({
            addAgentMessage: mockAddAgentMessage,
            updateAgentMessage: mockUpdateAgentMessage,
            activeAgentProvider: 'native',
            sessions: { 'session-1': { participants: ['generalist'] } },
            activeSessionId: 'session-1',
            agentHistory: [],
            generatedHistory: []
        } as any);

        // Instantiate service (it's a singleton export, but we can re-import or use the exported instance)
        // Since it's a singleton 'new AgentService()' exported as agentService, we use the exported one.
        // We need to re-require or rely on the fact that mocks are hoisted.

        // Note: The file exports `agentService = new AgentService()`.
        // Ideally we should test the exported instance.
        // But dependencies inside constructor (ContextPipeline etc) are already mocked.
    });

    // We need to get the instance after mocks are applied.
    // Dynamic import to ensure mocks are used?
    // Vitest mocks are hoisted, so importing static instance should work if it uses classes we mocked.

    // Actually, `agentService` is created at module level.
    // Does it pick up `ContextPipeline` mock? Yes, if mock is hoisted.

    it('should send user message and route via Coordinator (Fast Path)', async () => {
        const { agentService } = await import('./AgentService');

        // Mock Coordinator to return Direct Response
        vi.mocked(coordinator.handleUserRequest).mockResolvedValue('Fast Response');

        await agentService.sendMessage('Write a haiku');

        // Verify User Message added
        expect(mockAddAgentMessage).toHaveBeenCalledWith(expect.objectContaining({
            role: 'user',
            text: 'Write a haiku'
        }));

        // Verify Coordinator called
        expect(coordinator.handleUserRequest).toHaveBeenCalledWith(
            'Write a haiku',
            expect.anything(), // context
            expect.any(Function)
        );

        // Verify Agent Response updated (done via updateAgentMessage inside executeFlow)
        expect(mockUpdateAgentMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            text: 'Fast Response',
            thoughts: expect.arrayContaining([
                expect.objectContaining({ toolName: 'Direct Generation' })
            ])
        }));
    });

    it('should delegate to Executor if Coordinator returns DELEGATED_TO_AGENT', async () => {
        const { agentService } = await import('./AgentService');

        // Mock Coordinator to delegate
        vi.mocked(coordinator.handleUserRequest).mockResolvedValue('DELEGATED_TO_AGENT');

        await agentService.sendMessage('Plan a marketing campaign');

        // Verify Coordinator called
        expect(coordinator.handleUserRequest).toHaveBeenCalled();

        // Verify Executor called (implicit via logs/updates, or spy on Executor)
        // We mocked AgentExecutor's execute method.
        // The service uses `this.executor.execute(...)`
        // We need to spy on the instance of AgentExecutor created inside AgentService.
        // Since we mocked the class `AgentExecutor`, we can't easily spy on the *specific instance* unless we control the constructor mock returns.

        // However, we see side effects: `updateAgentMessage` with `text: 'Executor Response'`
        expect(mockUpdateAgentMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            text: 'Executor Response'
        }));
    });

    it('should redact PII from user message', async () => {
        const { agentService } = await import('./AgentService');

        vi.mocked(coordinator.handleUserRequest).mockResolvedValue('Response');

        const piiText = 'My password is secret123';
        await agentService.sendMessage(piiText);

        expect(mockAddAgentMessage).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('[REDACTED_PASSWORD]')
        }));
        expect(mockAddAgentMessage).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.not.stringContaining('secret123')
        }));
    });

    it('should handle timeout gracefully', async () => {
        const { agentService } = await import('./AgentService');

        // Mock Coordinator to hang longer than the timeout (300s)
        vi.mocked(coordinator.handleUserRequest).mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 600000)); // 10 minutes
            return 'Slow Response';
        });

        vi.useFakeTimers();
        const promise = agentService.sendMessage('Slow task');

        // Fast forward past the timeout (300000ms)
        await vi.advanceTimersByTimeAsync(300001);

        await promise;

        // Should show Timeout message
        // Note: The original code logs console.error and updates message.
        // We verify updateAgentMessage was called with Timeout text.
        expect(mockUpdateAgentMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            text: expect.stringContaining('Timeout')
        }));

        vi.useRealTimers();
    });
});
