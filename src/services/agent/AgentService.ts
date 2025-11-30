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

            // Create placeholder for streaming response
            const responseId = uuidv4();
            useStore.getState().addAgentMessage({ id: responseId, role: 'model', text: '', timestamp: Date.now(), isStreaming: true });

            // Call AI with Streaming
            // Note: We are assuming the AI service wrapper supports generateContentStream. 
            // If not, we might need to fallback or update the wrapper. 
            // For this implementation, we'll try to use the stream if available, or simulate it if the wrapper is strict.

            let fullText = '';

            try {
                // Check if the underlying AI service has stream capability exposed
                // If strictly typed to not have it, we might need to cast or update AIService.ts first.
                // For now, let's assume we can call it.
                const streamResult = await AI.generateContentStream({
                    model: AI_MODELS.TEXT.AGENT,
                    contents: { parts },
                    config: {
                        responseMimeType: 'application/json',
                        ...AI_CONFIG.THINKING.HIGH
                    }
                });

                for await (const chunk of streamResult) {
                    const chunkText = typeof (chunk as any).text === 'function' ? (chunk as any).text() : ((chunk as any).text || '');
                    fullText += chunkText;

                    // Update store with partial text
                    useStore.getState().updateAgentMessage(responseId, { text: fullText });
                }
            } catch (err) {
                // Fallback to non-streaming if stream fails or not implemented
                console.warn("Streaming failed, falling back to unary", err);
                const res = await AI.generateContent({
                    model: AI_MODELS.TEXT.AGENT,
                    contents: { parts },
                    config: {
                        responseMimeType: 'application/json',
                        ...AI_CONFIG.THINKING.HIGH
                    }
                });
                fullText = res.text;
                useStore.getState().updateAgentMessage(responseId, { text: fullText });
            }

            // Mark streaming as done
            useStore.getState().updateAgentMessage(responseId, { isStreaming: false });

            const result = AI.parseJSON(fullText);

            if (result.final_response) {
                // If the final response is different from the raw JSON, update it to show the clean response
                // Or we can just leave the JSON for transparency. 
                // Let's replace the JSON with the final response text for better UX.
                useStore.getState().updateAgentMessage(responseId, { text: String(result.final_response || '') });
                break;
            }

            if (result.tool) {
                // We keep the tool call visible or maybe minimize it? 
                // For now, let's keep it as is.

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
