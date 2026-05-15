import { vi, MockInstance } from 'vitest';
import { BaseAgent } from '../../BaseAgent';
import { AgentConfig, AgentContext } from '../../types';
import { AutonomousGenAI } from '@/services/intelligence/AutonomousGenAI';
import { TraceService } from '../../observability/TraceService';

/**
 * A test harness for isolating and testing Agents.
 * 
 * Automatically mocks:
 * - TraceService (prevents Firestore writes)
 * - FirebaseIntelligenceService (allows injecting responses)
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

        // Spy on AutonomousGenAI if not already mocked
        if (!vi.isMockFunction(AutonomousGenAI.generateContent)) {
            vi.spyOn(AutonomousGenAI, 'generateContent');
        }
        if (!vi.isMockFunction(AutonomousGenAI.generateContentStream)) {
            try {
                vi.spyOn(AutonomousGenAI, 'generateContentStream');
            } catch (_e: unknown) {
                // Ignore if it fails (already mocked or property descriptor issue)
            }
        }
    }

    /**
     * Mocks the next response from AutonomousGenAI.generateContent.
     * @param text The text response to return.
     */
    public mockAutonomousGenAIResponse(text: string) {
        const mockResult = {
            response: {
                text: () => text,
                candidates: [{
                    content: {
                        parts: [{ text }]
                    }
                }],
                usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 }
            }
        };
        (AutonomousGenAI.generateContent as unknown as MockInstance).mockResolvedValue(mockResult as unknown as Awaited<ReturnType<typeof AutonomousGenAI.generateContent>>);
        if (AutonomousGenAI.generateContentStream) {
            (AutonomousGenAI.generateContentStream as unknown as MockInstance).mockResolvedValue({
                stream: (async function* () {
                    yield { text: () => text };
                })(),
                response: Promise.resolve(mockResult as unknown as Awaited<ReturnType<typeof AutonomousGenAI.generateContent>>)
            } as unknown as Awaited<ReturnType<typeof AutonomousGenAI.generateContentStream>>);
        }
    }

    /**
     * Mocks an AutonomousGenIntelligence response that triggers tool calls.
     * @param toolCalls Array of tool calls (name + args)
     */
    public mockAutonomousGenAIToolCall(toolCalls: { name: string, args: Record<string, unknown> }[]) {
        const mockResult = {
            response: {
                text: () => '',
                candidates: [{
                    content: {
                        parts: toolCalls.map(tc => ({ functionCall: tc }))
                    }
                }],
                usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 }
            }
        };
        (AutonomousGenAI.generateContent as unknown as MockInstance).mockResolvedValue(mockResult as unknown as Awaited<ReturnType<typeof AutonomousGenAI.generateContent>>);
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
