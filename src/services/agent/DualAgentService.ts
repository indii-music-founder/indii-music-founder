import { v4 as uuidv4 } from 'uuid';
import { useStore, AgentMessage } from '@/core/store';
import { AI } from '@/services/ai/AIService';

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

    async processGoal(userGoal: string) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        this.addMessage('user', userGoal);

        try {
            // 1. Manager: Deconstruct Goal & Plan
            this.addSystemMessage(`[${this.managerConfig.name}] Planning curriculum...`);
            const plan = await this.generateManagerPlan(userGoal);
            this.addMessage('model', `Plan: ${plan}`);

            // 2. Executor: Execute Plan
            this.addSystemMessage(`[${this.executorConfig.name}] Executing plan...`);
            const executionResult = await this.runExecutorLoop(plan);
            this.addMessage('model', `Execution Result: ${executionResult}`);

            // 3. Manager: Critique & Evolve
            this.addSystemMessage(`[${this.managerConfig.name}] Critiquing output...`);
            const critique = await this.generateManagerCritique(userGoal, executionResult);

            if (critique.pass) {
                this.addSystemMessage(`[${this.managerConfig.name}] PASSED. Result approved.`);
                // In a real Agent Zero, we would save the successful trajectory here
            } else {
                this.addSystemMessage(`[${this.managerConfig.name}] FAILED. Critique: ${critique.reason}`);
                // In a real Agent Zero, we would update the Executor's system prompt (Memory) here
                this.evolveExecutorMemory(critique.reason);
            }

        } catch (e: any) {
            console.error(e);
            this.addSystemMessage(`Error: ${e.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    private async generateManagerPlan(goal: string): Promise<string> {
        const prompt = `
            ${this.managerConfig.systemPrompt}
            GOAL: ${goal}
            TASK: Break this down into a step-by-step plan for the Executor.
            OUTPUT: Plain text plan.
        `;
        const res = await AI.generateContent({ model: 'gemini-3-pro-preview', contents: { parts: [{ text: prompt }] } });
        return res.text || "Failed to generate plan.";
    }

    private async runExecutorLoop(plan: string): Promise<string> {
        // Simplified loop for the Executor
        // In a full implementation, this would be similar to the AgentService loop
        // but guided by the specific plan steps.

        const prompt = `
            ${this.executorConfig.systemPrompt}
            PLAN: ${plan}
            TASK: Execute this plan using your tools.
            OUTPUT: Final summary of actions.
        `;

        // For this proof of concept, we'll do a single shot execution
        // Real implementation would loop through tools
        const res = await AI.generateContent({ model: 'gemini-3-pro-preview', contents: { parts: [{ text: prompt }] } });
        return res.text || "Execution failed.";
    }

    private async generateManagerCritique(goal: string, result: string): Promise<{ pass: boolean; reason: string }> {
        const prompt = `
            ${this.managerConfig.systemPrompt}
            ORIGINAL GOAL: ${goal}
            EXECUTION RESULT: ${result}
            TASK: Critique the result. Did it fully satisfy the goal?
            OUTPUT JSON: { "pass": boolean, "reason": "string" }
        `;
        const res = await AI.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json' }
        });
        return AI.parseJSON(res.text);
    }

    private evolveExecutorMemory(critique: string) {
        // "In-Context Evolution"
        // We append the lesson learned to the Executor's system prompt for this session
        this.executorConfig.systemPrompt += `\n\n[LESSON LEARNED]: ${critique}`;
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
