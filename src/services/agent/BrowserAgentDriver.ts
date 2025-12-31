import { AI } from '@/services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';

export interface AgentAction {
    thought: string;
    action: 'click' | 'type' | 'scroll' | 'wait' | 'finish' | 'fail';
    params?: {
        selector?: string;
        text?: string;
        reason?: string;
    };
}

export interface AgentStepResult {
    success: boolean;
    logs: string[];
    finalData?: unknown;
}

export class BrowserAgentDriver {

    /**
     * Drives the browser to achieve a specific goal starting from a URL.
     */
    async drive(url: string, goal: string, maxSteps = 10): Promise<AgentStepResult> {
        const logs: string[] = [];
        logs.push(`[Driver] Starting drive. Goal: "${goal}"`);

        const api = window.electronAPI;
        if (!api?.agent) {
            throw new Error('Electron Agent API not available');
        }

        try {
            // 1. Navigate to initial URL
            logs.push(`[Driver] Navigating to ${url}...`);
            let currentState = await api.agent.navigateAndExtract(url);

            if (!currentState.success) {
                throw new Error(`Navigation failed: ${currentState.error}`);
            }

            // 2. Control Loop
            for (let step = 1; step <= maxSteps; step++) {
                logs.push(`[Driver] Step ${step}/${maxSteps}: Analyzing state...`);

                // Prepare prompt with screenshot
                const prompt = `
                    You are an autonomous browser agent. Your goal is: "${goal}".
                    
                    Current URL: ${currentState.url}
                    Page Title: ${currentState.title}
                    
                    Analyze the current state and the attached screenshot.
                    Determine the next action to take to achieve the goal.
                    
                    Return a JSON object with this structure:
                    {
                        "thought": "Reasoning for your action",
                        "action": "click" | "type" | "scroll" | "wait" | "finish" | "fail",
                        "params": {
                            "selector": "CSS selector (click/type) OR direction (scroll: 'up' | 'down' | 'top' | 'bottom')",
                            "text": "Text to type (type) OR amount/duration (scroll/wait)",
                            "reason": "Reason for finishing or failing"
                        }
                    }
                    
                    Rules:
                    - If you see a popup/modal blocking usage, close it.
                    - If you have achieved the goal (e.g. found the info), choose 'finish'.
                    - If you cannot proceed, choose 'fail'.
                `;

                // Call AI
                const response = await AI.generateContent({
                    model: AI_MODELS.BROWSER.AGENT,
                    contents: {
                        role: 'user',
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: 'image/jpeg',
                                    data: currentState.screenshotBase64 || ''
                                }
                            }
                        ]
                    },
                    config: {
                        responseMimeType: 'application/json',
                        temperature: 0.0 // Precise actions
                    }
                });

                const plan = AI.parseJSON(response.text()) as AgentAction;
                logs.push(`[Driver] AI Thought: ${plan.thought}`);
                logs.push(`[Driver] AI Action: ${plan.action} ${plan.params?.selector || ''}`);

                // Execute Action
                if (plan.action === 'finish') {
                    logs.push('[Driver] Goal Achieved!');
                    return { success: true, logs, finalData: currentState.text };
                }

                if (plan.action === 'fail') {
                    throw new Error(`Agent gave up: ${plan.params?.reason}`);
                }

                // Interaction
                let actionResult;
                const { selector, text } = plan.params || {};

                switch (plan.action) {
                    case 'click':
                        if (!selector) throw new Error('Missing selector for click');
                        actionResult = await api.agent.performAction('click', selector);
                        break;
                    case 'type':
                        if (!selector || !text) throw new Error('Missing params for type');
                        actionResult = await api.agent.performAction('type', selector, text);
                        break;
                    case 'scroll': {
                        const direction = selector || 'down';
                        const amount = text || '500';
                        actionResult = await api.agent.performAction('scroll', direction, amount);
                        break;
                    }
                    case 'wait': {
                        const duration = text || '1000';
                        actionResult = await api.agent.performAction('wait', '', duration);
                        break;
                    }
                    default:
                        logs.push(`[Driver] Warning: Unsupported action ${plan.action}`);
                }

                if (actionResult && !actionResult.success) {
                    logs.push(`[Driver] Action failed: ${actionResult.error}`);
                }

                // Get new state (snapshot)
                currentState = await api.agent.captureState();
            }

            throw new Error('Max steps exceeded');

        } catch (error: unknown) {
            logs.push(`[Driver] Error: ${error}`);
            return { success: false, logs };
        }
    }
}

export const browserAgentDriver = new BrowserAgentDriver();
