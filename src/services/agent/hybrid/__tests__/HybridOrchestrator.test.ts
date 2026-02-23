import { HybridOrchestrator } from '../HybridOrchestrator';
import { AgentContext } from '../../types';
import { GenAI } from '@/services/ai/GenAI';
import { TraceService } from '../../observability/TraceService';

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user' } },
    remoteConfig: { defaultConfig: {} },
    db: {},
    functions: {},
    storage: {}
}));
vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn()
    }
}));
vi.mock('../../observability/TraceService', () => ({
    TraceService: {
        startTrace: vi.fn().mockResolvedValue('trace-123'),
        addStep: vi.fn().mockResolvedValue(undefined),
        completeTrace: vi.fn().mockResolvedValue(undefined)
    }
}));
vi.mock('../../AgentService');
vi.mock('../../registry', () => ({
    agentRegistry: {
        getAll: vi.fn().mockReturnValue([
            { id: 'legal', name: 'Legal', description: 'Legal agent' }
        ])
    }
}));

describe('HybridOrchestrator Integration', () => {
    let orchestrator: HybridOrchestrator;
    const mockContext: AgentContext = {
        activeModule: 'legal',
        chatHistory: [],
        chatHistoryString: ''
    };

    beforeEach(() => {
        orchestrator = new HybridOrchestrator();
        vi.clearAllMocks();
    });

    it('should handle multi-turn reasoning to completion', async () => {
        const mockResponses = [
            {
                response: {
                    text: () => JSON.stringify({
                        thought: "I need to check the copyright office for this artist.",
                        useTool: "browser_control",
                        args: { url: "https://publicrecords.copyright.gov/" },
                        answer: "Searching the Copyright Office...",
                        complete: false
                    })
                }
            },
            {
                response: {
                    text: () => JSON.stringify({
                        thought: "Search complete. No existing registrations found.",
                        answer: "I've checked the records. You are clear to proceed with registration.",
                        complete: true
                    })
                }
            }
        ];

        (GenAI.generateContent as any)
            .mockResolvedValueOnce(mockResponses[0])
            .mockResolvedValueOnce(mockResponses[1]);

        const result = await orchestrator.execute(mockContext, "Check copyright for my new song 'Detroit Ghost'");

        expect(result).toContain("clear to proceed");
        expect(GenAI.generateContent).toHaveBeenCalledTimes(2);
    });

    it('should prune excessively long tool results', async () => {
        const longData = 'x'.repeat(5000);

        // Mock BrowserTools to return a very long result
        vi.doMock('../../tools/BrowserTools', () => ({
            BrowserTools: {
                browser_navigate: vi.fn().mockResolvedValue({ data: longData, message: longData })
            }
        }));

        const mockResponses = [
            {
                response: {
                    text: () => JSON.stringify({
                        thought: "Checking long data...",
                        useTool: "browser_control",
                        args: { url: "https://example.com" },
                        answer: "Searching...",
                        complete: false
                    })
                }
            },
            {
                response: {
                    text: () => JSON.stringify({
                        thought: "Done.",
                        answer: "Completed with long data check.",
                        complete: true
                    })
                }
            }
        ];

        (GenAI.generateContent as any)
            .mockResolvedValueOnce(mockResponses[0])
            .mockResolvedValueOnce(mockResponses[1]);

        await orchestrator.execute(mockContext, "Run with long data");

        expect(GenAI.generateContent).toHaveBeenCalledTimes(2);
        // Verify the second call's prompt contains the truncation marker
        const secondCallPrompt = (GenAI.generateContent as any).mock.calls[1][0][0].text;
        expect(secondCallPrompt).toContain('Result truncated');
    });
});
