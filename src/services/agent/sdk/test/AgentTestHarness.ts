import { vi, MockInstance } from 'vitest';
import { BaseAgent } from '../../BaseAgent';
import { AgentConfig, AgentContext } from '../../types';
import { AI } from '@/services/ai/AIService';
import { TraceService } from '../../observability/TraceService';

/**
 * A test harness for isolating and testing Agents.
 * 
 * Automatically mocks:
 * - TraceService (prevents Firestore writes)
 * - FirebaseAIService (allows injecting responses)
 * 
 * Usage:
 * ```typescript
 * const harness = new AgentTestHarness(myAgentConfig);
 * harness.mockAIResponse("Hello world");
 * const result = await harness.run("Hi");
 * expect(result.text).toContain("Hello world");
 * ```
 */
export class AgentTestHarness {
    public agent: BaseAgent;

    constructor(agentOrConfig: BaseAgent | AgentConfig) {
        if (agentOrConfig instanceof BaseAgent) {
            this.agent = agentOrConfig;
        } else {
            this.agent = new BaseAgent(agentOrConfig);
        }

        this.setupMocks();
    }

    private setupMocks() {
        // Mock TraceService to avoid Firestore side effects during tests
        vi.spyOn(TraceService, 'startTrace').mockResolvedValue('test-trace-id');
        vi.spyOn(TraceService, 'addStep').mockResolvedValue(undefined);
        vi.spyOn(TraceService, 'completeTrace').mockResolvedValue(undefined);
        vi.spyOn(TraceService, 'failTrace').mockResolvedValue(undefined);

        // Spy on AI if not already mocked
        if (!vi.isMockFunction(AI.generateContent)) {
            vi.spyOn(AI, 'generateContent');
        }
    }

    /**
     * Mocks the next response from AI.generateContent.
     * @param text The text response to return.
     */
    public mockAIResponse(text: string) {
        (AI.generateContent as unknown as MockInstance).mockResolvedValue({
            text: () => text,
            functionCalls: () => []
        } as any);
    }

    /**
     * Mocks an AI response that triggers tool calls.
     * @param toolCalls Array of tool calls (name + args)
     */
    public mockAIToolCall(toolCalls: { name: string, args: Record<string, any> }[]) {
        (AI.generateContent as unknown as MockInstance).mockResolvedValue({
            text: () => '',
            functionCalls: () => toolCalls.map(tc => ({
                name: tc.name,
                args: tc.args
            }))
        } as any);
    }

    /**
     * Runtime execution of the agent.
     * @param input User input string.
     * @param context Optional agent context.
     */
    public async run(input: string, context: AgentContext = {}) {
        return this.agent.execute(input, context);
    }
}
