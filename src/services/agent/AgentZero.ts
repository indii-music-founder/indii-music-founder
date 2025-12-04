import { v4 as uuidv4 } from 'uuid';
import { useStore } from '@/core/store';
import { AI } from '@/services/ai/AIService';
import { TOOL_REGISTRY, BASE_TOOLS } from './tools';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { AgentContext } from './components/ContextResolver';

export class AgentZero {
    private readonly AGENT0_PROTOCOL = `
    ## RULE: THE AGENT0 EVOLUTION PROTOCOL (Strict Architecture)
    **Goal:** Emulate the "Agent0" framework behavior. You are not a static chatbot; you are a co-evolutionary system consisting of two distinct internal modes.

    **1. Mode A: The Curriculum Agent (The Manager)**
    * **Function:** Strategy, Challenge, and Planning.
    * **Behavior:** When a user presents a complex goal, do not just solve it. First, generate a "Frontier Task"—a specific challenge that pushes the user's career slightly beyond their current state.
    * **Exception:** If the request is simple (e.g., "generate an image", "fix this typo"), SKIP this mode and go directly to execution.
    * **Output Signature:** Always preface strategic advice with:
        * *"[Curriculum]: Based on your current trajectory, I have formulated a new frontier task..."*

    **2. Mode B: The Executor Agent (The Worker)**
    * **Function:** Tool Use, Coding, and Implementation.
    * **Behavior:** Once the strategy is set (or for simple tasks), ruthlessly execute using available tools. Be concise.
    * **Output Signature:** Preface execution steps with:
        * *"[Executor]: Deploying tools to solve this task..."*

    **Tone:** Professional, encouraging, and concise. Avoid fluff.

    **3. SUPERPOWERS (The "Indii" Upgrade)**
    * **Memory:** You have long-term memory. Use 'save_memory' to store important facts/preferences. Use 'recall_memories' to fetch context before answering complex queries.
    * **Reflection:** For creative tasks, use 'verify_output' to critique your own work before showing it to the user.
    * **Approval:** For high-stakes actions (e.g., posting to social media, sending emails), you MUST use 'request_approval' to get user sign-off.
    `;

    async execute(userGoal: string, context: AgentContext) {
        const orgContext = `
        ORGANIZATION CONTEXT:
        - Organization ID: ${context.currentOrganizationId}
        - Project ID: ${context.currentProjectId}
        `;

        // Inject Brand Context
        const brandKit = context.brandKit;
        const brandContext = brandKit ? `
        BRAND CONTEXT:
        - Identity: ${context.userProfile?.bio || 'N/A'}
        - Visual Style: ${brandKit.brandDescription || 'N/A'}
        - Colors: ${brandKit.colors?.join(', ') || 'N/A'}
        - Fonts: ${brandKit.fonts || 'N/A'}
        - Current Release: ${brandKit.releaseDetails?.title} (${brandKit.releaseDetails?.type}) - ${brandKit.releaseDetails?.mood}
        ` : '';

        const systemPrompt = `You are Indii, the Autonomous Studio Manager (Agent Zero).
        ${orgContext}
        ${brandContext}
        ${this.AGENT0_PROTOCOL}
        ${BASE_TOOLS}
        RULES:
        1. Use tools via JSON.
        2. Output format: { "thought": "...", "tool": "...", "args": {} }
        3. Or { "final_response": "..." }
        4. When the task is complete, you MUST use "final_response" to finish.`;

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

            let fullText = '';

            try {
                const streamResult = await AI.generateContentStream({
                    model: AI_MODELS.TEXT.AGENT,
                    contents: [{ role: 'user', parts }],
                    config: {
                        responseMimeType: 'application/json',
                        ...AI_CONFIG.THINKING.HIGH
                    }
                });

                const reader = streamResult.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunkText = typeof (value as any).text === 'function' ? (value as any).text() : ((value as any).text || '');
                    fullText += chunkText;

                    // Update store with partial text
                    useStore.getState().updateAgentMessage(responseId, { text: fullText });
                }
            } catch (err) {
                // Fallback to non-streaming if stream fails or not implemented
                console.warn("Streaming failed, falling back to unary", err);
                const res = await AI.generateContent({
                    model: AI_MODELS.TEXT.AGENT,
                    contents: [{ role: 'user', parts }],
                    config: {
                        responseMimeType: 'application/json',
                        ...AI_CONFIG.THINKING.HIGH
                    }
                });
                fullText = res.text();
                useStore.getState().updateAgentMessage(responseId, { text: fullText });
            }

            // Mark streaming as done
            useStore.getState().updateAgentMessage(responseId, { isStreaming: false });

            const result = AI.parseJSON(fullText);

            if (result.final_response) {
                useStore.getState().updateAgentMessage(responseId, { text: `${result.final_response || ''}` });
                break;
            }

            if (result.tool) {
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

    private addSystemMessage(text: string) {
        useStore.getState().addAgentMessage({ id: uuidv4(), role: 'system', text, timestamp: Date.now() });
    }
}
