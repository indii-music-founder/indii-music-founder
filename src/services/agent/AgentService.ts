import { v4 as uuidv4 } from 'uuid';
import { useStore, AgentMessage } from '@/core/store';
import { AI } from '@/services/ai/AIService';
import { TOOL_REGISTRY, BASE_TOOLS } from './tools';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';

const PERSONA_DEFINITIONS: Record<string, string> = {
    GENERALIST: `You are Agent R, the Autonomous Studio Manager. Generalist: video, image, text ops. Respect settings unless overriding.`,
    ARCHITECT: `You are Agent R, Senior Architectural Visualizer. Focus: batch_style_transfer, 4K, 16:9, consistent geometry.`,
    FASHION: `You are Agent R, Digital Fashion Stylist. Focus: 9:16, fabric textures, social media.`,
    DIRECTOR: `You are Agent R, Creative Director. Focus: Cohesive video, Director's Cut, Show Bible consistency.`
};

class AgentService {
    private isProcessing = false;

    async sendMessage(text: string, attachments?: { mimeType: string; base64: string }[]) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        // Add User Message
        const userMsg: AgentMessage = {
            id: uuidv4(),
            role: 'user',
            text,
            timestamp: Date.now(),
            attachments
        };
        useStore.getState().addAgentMessage(userMsg);

        try {
            await this.runAgentLoop(text);
        } catch (e: any) {
            console.error(e);
            this.addSystemMessage(`Error: ${e.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    private async runAgentLoop(userGoal: string) {
        const persona = 'GENERALIST'; // TODO: Detect persona from project context

        // Inject Brand Context
        const { userProfile } = useStore.getState();
        const brandKit = userProfile.brandKit;
        const brandContext = `
        BRAND CONTEXT:
        - Identity: ${userProfile.bio || 'N/A'}
        - Visual Style: ${brandKit.brandDescription || 'N/A'}
        - Colors: ${brandKit.colors.join(', ') || 'N/A'}
        - Fonts: ${brandKit.fonts || 'N/A'}
        - Current Release: ${brandKit.releaseDetails.title} (${brandKit.releaseDetails.type}) - ${brandKit.releaseDetails.mood}
        `;

        const systemPrompt = `${PERSONA_DEFINITIONS[persona]}\n${brandContext}\n${BASE_TOOLS}\nRULES:\n1. Use tools via JSON.\n2. Output format: { "thought": "...", "tool": "...", "args": {} }\n3. Or { "final_response": "..." }\n4. When the task is complete, you MUST use "final_response" to finish.`;

        let iterations = 0;
        let currentInput = userGoal;
        const history = useStore.getState().agentHistory;

        while (iterations < 8) { // Limit iterations for safety
            const parts: any[] = [];

            // Build Context from History
            history.forEach(msg => {
                if (msg.role === 'user' && msg.attachments) {
                    msg.attachments.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.base64.split(',')[1] } }));
                }
                parts.push({ text: `${msg.role.toUpperCase()}: ${msg.text}` });
            });
            parts.push({ text: `${systemPrompt}\n\nLast Input: ${currentInput}\nNext Step (JSON):` });

            // UI Feedback
            const thinkingId = uuidv4();
            useStore.getState().addAgentMessage({ id: thinkingId, role: 'system', text: 'Thinking...', timestamp: Date.now() });

            // Call AI
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { parts },
                config: {
                    responseMimeType: 'application/json',
                    ...AI_CONFIG.THINKING.HIGH
                }
            });

            // Remove "Thinking..."
            useStore.setState(state => ({ agentHistory: state.agentHistory.filter(m => m.id !== thinkingId) }));

            const result = AI.parseJSON(res.text);

            if (result.final_response) {
                this.addModelMessage(result.final_response);
                break;
            }

            if (result.tool) {
                this.addModelMessage(`⚙️ ${result.tool}`);

                // Execute Tool
                const toolFunc = TOOL_REGISTRY[result.tool];
                let output = "Unknown tool";
                if (toolFunc) {
                    try {
                        output = await toolFunc(result.args);
                    } catch (err: any) {
                        output = `Error: ${err.message}`;
                    }
                }

                this.addSystemMessage(`Output: ${output}`);

                if (output.toLowerCase().includes('successfully')) {
                    currentInput = `Tool ${result.tool} Output: ${output}. Task likely complete. Use final_response if done.`;
                } else {
                    currentInput = `Tool ${result.tool} Output: ${output}. Continue.`;
                }
            }
            iterations++;
        }
    }

    private addModelMessage(text: string) {
        useStore.getState().addAgentMessage({ id: uuidv4(), role: 'model', text, timestamp: Date.now() });
    }

    private addSystemMessage(text: string) {
        useStore.getState().addAgentMessage({ id: uuidv4(), role: 'system', text, timestamp: Date.now() });
    }
}

export const agentService = new AgentService();
