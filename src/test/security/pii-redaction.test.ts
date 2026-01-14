import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentService } from '../../services/agent/AgentService';
import { useStore } from '../../core/store';
import { coordinator } from '../../services/agent/WorkflowCoordinator';

// Mock the dependencies
vi.mock('../../services/agent/WorkflowCoordinator', () => ({
    coordinator: {
        handleUserRequest: vi.fn().mockResolvedValue('DELEGATED_TO_AGENT')
    }
}));

// Fix for "is not a constructor" - we must provide a class or constructor function
vi.mock('../../services/agent/components/AgentExecutor', () => {
    return {
        AgentExecutor: class {
            execute = vi.fn().mockResolvedValue({ text: 'Agent Response' });
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
        useStore: {
            getState: () => ({
                addAgentMessage: (msg: any) => messages.push(msg),
                updateAgentMessage: () => {},
                agentHistory: messages
            })
        }
    };
});

describe('🛡️ Shield: PII Redaction Security Test', () => {
    let agentService: AgentService;

    beforeEach(() => {
        vi.clearAllMocks();
        agentService = new AgentService();
    });

    it('should REDACT Credit Card numbers before sending to LLM', async () => {
        const sensitiveInput = "Here is my credit card: 4111 1111 1111 1111 for the payment.";

        await agentService.sendMessage(sensitiveInput);

        // Check Coordinator (Fast Path / Decision Maker)
        expect(coordinator.handleUserRequest).toHaveBeenCalledWith(
            expect.stringContaining('[REDACTED_CREDIT_CARD]'),
            expect.anything(),
            expect.anything()
        );

        // Ensure the raw number is NOT sent
        expect(coordinator.handleUserRequest).not.toHaveBeenCalledWith(
            expect.stringContaining('4111 1111 1111 1111'),
            expect.anything(),
            expect.anything()
        );
    });

    it('should REDACT Passwords before sending to LLM', async () => {
        const sensitiveInput = "My password is supersecret123!";

        await agentService.sendMessage(sensitiveInput);

        // Check Coordinator
        expect(coordinator.handleUserRequest).toHaveBeenCalledWith(
            expect.stringContaining('[REDACTED_PASSWORD]'),
            expect.anything(),
            expect.anything()
        );

         // Ensure the raw password is NOT sent
         expect(coordinator.handleUserRequest).not.toHaveBeenCalledWith(
            expect.stringContaining('supersecret123'),
            expect.anything(),
            expect.anything()
        );
    });

    it('should allow benign text to pass through', async () => {
        const benignInput = "Hello, can you help me write a poem?";

        await agentService.sendMessage(benignInput);

        expect(coordinator.handleUserRequest).toHaveBeenCalledWith(
            expect.stringContaining(benignInput),
            expect.anything(),
            expect.anything()
        );
    });
});
