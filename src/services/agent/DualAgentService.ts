import { v4 as uuidv4 } from 'uuid';
import { useStore, AgentMessage } from '../../core/store';
import { AI } from '../ai/AIService';
import { events } from '../../core/events';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';

interface AgentConfig {
    name: string;
    role: string;
    systemPrompt: string;
    tools: Record<string, (args: any) => Promise<string>>;
}

export class DualAgentService {
    private managerConfig: AgentConfig;
    private executorConfig: AgentConfig;
    private isProcessing = false;

    constructor(manager: AgentConfig, executor: AgentConfig) {
        this.managerConfig = manager;
        this.executorConfig = executor;
    }

    async sendMessage(text: string) {
        return this.processGoal(text);
    }

    async processGoal(goal: string) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        this.addMessage('user', goal);
        events.emit('AGENT_ACTION', { agentId: 'Manager', action: 'Goal Received', details: goal });

        try {
            // 1. Manager: Deconstruct Goal & Plan
            this.addSystemMessage(`[${this.managerConfig.name}] Planning curriculum...`);
            const plan = await this.generateManagerPlan(goal);
            this.addMessage('model', `Plan: ${plan} `);
            events.emit('AGENT_ACTION', { agentId: 'Manager', action: 'Plan Created', details: JSON.stringify(plan) });

            // 2. Executor: Execute Plan
            this.addSystemMessage(`[${this.executorConfig.name}] Executing plan...`);
            const executionResult = await this.runExecutorLoop(plan);
            this.addMessage('model', `Execution Result: ${executionResult} `);

            // 3. Manager: Critique & Evolve
            this.addSystemMessage(`[${this.managerConfig.name}] Critiquing output...`);
            const critique = await this.generateManagerCritique(goal, executionResult);

            if (critique.pass) {
                this.addSystemMessage(`[${this.managerConfig.name}]PASSED.Result approved.`);
                // In a real Agent Zero, we would save the successful trajectory here
            } else {
                this.addSystemMessage(`[${this.managerConfig.name}]FAILED.Critique: ${critique.reason} `);
                // In a real Agent Zero, we would update the Executor's system prompt (Memory) here
                this.evolveExecutorMemory(critique.reason);
            }

        } catch (e: any) {
            console.error(e);
            this.addSystemMessage(`Error: ${e.message} `);
        } finally {
            this.isProcessing = false;
        }
    }

    private getBrandContext(): string {
        const { userProfile } = useStore.getState();
        const brandKit = userProfile.brandKit;
        return `
        BRAND CONTEXT:
        - Identity: ${userProfile.bio || 'N/A'}
        - Visual Style: ${brandKit.brandDescription || 'N/A'}
        - Colors: ${brandKit.colors.join(', ') || 'N/A'}
        - Fonts: ${brandKit.fonts || 'N/A'}
        - Current Release: ${brandKit.releaseDetails.title} (${brandKit.releaseDetails.type}) - ${brandKit.releaseDetails.mood}
        `;
    }

    private async generateManagerPlan(goal: string): Promise<string> {
        const prompt = `
            ${this.managerConfig.systemPrompt}
            ${this.getBrandContext()}
GOAL: ${goal}
TASK: Break this down into a step - by - step plan for the Executor.
    OUTPUT: Plain text plan.
        `;
        const res = await AI.generateContent({
            model: AI_MODELS.TEXT.AGENT,
            contents: { role: 'user', parts: [{ text: prompt }] },
            config: { ...AI_CONFIG.THINKING.HIGH }
        });
        return res.text() || "Failed to generate plan.";
    }

    private async runExecutorLoop(plan: string): Promise<string> {
        const toolNames = Object.keys(this.executorConfig.tools).join(', ');

        const prompt = `
            ${this.executorConfig.systemPrompt}
            ${this.getBrandContext()}
PLAN: ${plan}
            AVAILABLE TOOLS: ${toolNames}

TASK: Execute the plan.If you need to use a tool, output ONLY a JSON object in this format:
{ "tool": "tool_name", "args": { "arg_name": "value" } }
            
            If no tool is needed, just provide the final answer text.
        `;

        const res = await AI.generateContent({
            model: AI_MODELS.TEXT.AGENT,
            contents: { role: 'user', parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json', ...AI_CONFIG.THINKING.HIGH } // Force JSON to make parsing easier
        });

        const responseText = res.text() || "{}";
        const parsed = AI.parseJSON(responseText);

        if (parsed.tool && this.executorConfig.tools[parsed.tool]) {
            this.addSystemMessage(`[${this.executorConfig.name}] Calling tool: ${parsed.tool}...`);
            try {
                const toolOutput = await this.executorConfig.tools[parsed.tool](parsed.args);
                return `Tool Output: ${toolOutput} `;
            } catch (err: any) {
                return `Tool Execution Failed: ${err.message} `;
            }
        }

        // If no tool called, return the text (or the parsed JSON if it was just a message)
        return responseText;
    }

    private async generateManagerCritique(goal: string, result: string): Promise<{ pass: boolean; reason: string }> {
        const prompt = `
            ${this.managerConfig.systemPrompt}
            ${this.getBrandContext()}
            ORIGINAL GOAL: ${goal}
            EXECUTION RESULT: ${result}
TASK: Critique the result.Did it fully satisfy the goal ?
    OUTPUT JSON: { "pass": boolean, "reason": "string" }
`;
        const res = await AI.generateContent({
            model: AI_MODELS.TEXT.AGENT,
            contents: { role: 'user', parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json', ...AI_CONFIG.THINKING.HIGH }
        });
        return AI.parseJSON(res.text());
    }

    private evolveExecutorMemory(critique: string) {
        // "In-Context Evolution"
        // We append the lesson learned to the Executor's system prompt for this session
        this.executorConfig.systemPrompt += `\n\n[LESSON LEARNED]: ${critique} `;
        this.addSystemMessage(`[Evolution] Executor memory updated with lesson.`);
    }

    private addMessage(role: 'user' | 'model' | 'system', text: string) {
        useStore.getState().addAgentMessage({
            id: uuidv4(),
            role,
            text,
            timestamp: Date.now()
        });
    }

    private addSystemMessage(text: string) {
        this.addMessage('system', text);
    }
}
