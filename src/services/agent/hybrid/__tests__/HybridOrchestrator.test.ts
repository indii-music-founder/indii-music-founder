import { HybridOrchestrator } from '../HybridOrchestrator';
import { AgentContext } from '../../types';
import { AI } from '@/services/ai/AIService';
import { TraceService } from '../../observability/TraceService';

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user' } },
    remoteConfig: { defaultConfig: {} },
    db: {},
    functions: {},
    storage: {}
}));
vi.mock('@/services/ai/AIService', () => ({
    AI: {
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
                text: () => JSON.stringify({
                    thought: "I need to check the copyright office for this artist.",
                    useTool: "browser_control",
                    args: { url: "https://publicrecords.copyright.gov/" },
                    answer: "Searching the Copyright Office...",
                    complete: false
                })
            },
            {
                text: () => JSON.stringify({
                    thought: "Search complete. No existing registrations found.",
                    answer: "I've checked the records. You are clear to proceed with registration.",
                    complete: true
                })
            }
        ];

        (AI.generateContent as any)
            .mockResolvedValueOnce(mockResponses[0])
            .mockResolvedValueOnce(mockResponses[1]);

        const result = await orchestrator.execute(mockContext, "Check copyright for my new song 'Detroit Ghost'");
        
        expect(result).toContain("clear to proceed");
        expect(AI.generateContent).toHaveBeenCalledTimes(2);
    });
});
