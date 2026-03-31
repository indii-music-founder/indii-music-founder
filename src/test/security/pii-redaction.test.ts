import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../../services/agent/AgentService';

const { executeMock } = vi.hoisted(() => ({
    executeMock: vi.fn().mockResolvedValue({ text: 'Agent Response', thoughtSignature: 'mock-sig' })
}));

// Fix for "is not a constructor" - we must provide a class or constructor function
vi.mock('../../services/agent/components/AgentExecutor', () => {
    return {
        AgentExecutor: class {
            execute = executeMock;
        }
    };
});

// Also need to mock ContextPipeline and AgentOrchestrator
vi.mock('../../services/agent/components/ContextPipeline', () => {
    return {
        ContextPipeline: class {
            buildContext = vi.fn().mockResolvedValue({
                chatHistory: [],
                chatHistoryString: ''
            });
        }
    };
});

vi.mock('../../services/agent/components/AgentOrchestrator', () => {
    return {
        AgentOrchestrator: class {
            determineAgent = vi.fn().mockResolvedValue('generalist');
        }
    };
});

// Mock the store to avoid side effects
vi.mock('../../core/store', () => {
    const messages: any[] = [];
    return {
        serverTimestamp: vi.fn(),
        useStore: {
            getState: () => ({
                activeAgentProvider: 'agent', // Make sure Direct mode is OFF so executor runs
                addAgentMessage: (msg: any) => messages.push(msg),
                updateAgentMessage: () => { },
                agentHistory: messages,
                currentProjectId: 'test-project',
                activeSessionId: 'test-session',
                isKnowledgeBaseEnabled: false
            })
        }
    };
});

// Mock dependencies from AgentService
vi.mock('@/utils/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/agent/MemoryService', () => ({ memoryService: { saveMemory: vi.fn().mockResolvedValue(true) } }));
vi.mock('../../services/ai/GenAI', () => ({ GenAI: { generateContentStream: vi.fn() } }));

describe('🛡️ Shield: PII Redaction Security Test', () => {
    let agentService: AgentService;

    beforeEach(() => {
        vi.clearAllMocks();
        agentService = new AgentService();
    });

    it('should REDACT Credit Card numbers before sending to LLM', async () => {
        const sensitiveInput = "Here is my credit card: 4111 1111 1111 1111 for the payment.";
        await agentService.sendMessage(sensitiveInput);

        expect(executeMock).toHaveBeenCalled();
        const payloadText = executeMock.mock.calls[0]?.[1]; // 2nd argument is user text

        expect(payloadText).toContain('[REDACTED_CREDIT_CARD]');
        expect(payloadText).not.toContain('4111 1111 1111 1111');
    });

    it('should REDACT Passwords before sending to LLM', async () => {
        const sensitiveInput = "My password is supersecret123!";
        await agentService.sendMessage(sensitiveInput);

        expect(executeMock).toHaveBeenCalled();
        const payloadText = executeMock.mock.calls[0]?.[1];

        expect(payloadText).toContain('[REDACTED_PASSWORD]');
        expect(payloadText).not.toContain('supersecret123');
    });

    it('should allow benign text to pass through', async () => {
        const benignInput = "Hello, can you help me write a poem?";
        await agentService.sendMessage(benignInput);

        expect(executeMock).toHaveBeenCalled();
        const payloadText = executeMock.mock.calls[0]?.[1];

        expect(payloadText).toContain(benignInput);
    });
});
