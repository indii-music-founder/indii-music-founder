import { BaseAgent } from '../BaseAgent';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '@/core/store';
import { TOOL_REGISTRY, BASE_TOOLS } from '../tools';
import { AI } from '@/services/ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';

export class GeneralistAgent extends BaseAgent {
    id = 'generalist';
    name = 'Agent Zero';
    description = 'General assistance, complex reasoning, fallback.';
    color = 'bg-stone-500';
    category = 'manager' as const; // Manager category fits "Agent Zero"

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

    // Override the raw system prompt with our specialized protocol
    systemPrompt = `You are Indii, the Autonomous Studio Manager (Agent Zero).
    ${this.AGENT0_PROTOCOL}
    
    RULES:
    1. Output format: { "thought": "...", "tool": "...", "args": {} } OR { "final_response": "..." }
    2. When the task is complete, you MUST use "final_response" to finish.
    `;

    // Base tools are usually handled by the agent superclass or passed in context, 
    // but in AgentZero they were manually handled.
    // Ideally, we replicate the BaseAgent's tool handling OR adapt AgentZero's manual loop.
    // Since BaseAgent likely runs a loop, we should check if we can just define `tools` here.
    // However, AgentZero logic had a specific 8-iteration loop. 
    // BaseAgent probably has its own loop. Let's inspect BaseAgent next to ensure compatibility.
    // For now, I'm defining the necessary properties.

    tools = []; // Generalist uses the global TOOL_REGISTRY for now.

    constructor() {
        super({
            id: 'generalist',
            name: 'Agent Zero',
            description: 'General assistance, complex reasoning, fallback.',
            color: 'bg-stone-500',
            category: 'manager',
            systemPrompt: 'You are Indii, the Autonomous Studio Manager (Agent Zero).',
            tools: []
        });
        this.functions = TOOL_REGISTRY;
    }

    async execute(task: string, context?: any, onProgress?: (event: any) => void): Promise<{ text: string; data?: any }> {
        console.log(`[${this.name}] Received task: ${task}`);

        // Report thinking start
        onProgress?.({ type: 'thought', content: `Analyzing request: "${task.substring(0, 50)}..."` });

        const { useStore } = await import('@/core/store');
        const { currentOrganizationId, currentProjectId } = useStore.getState();

        const orgContext = `
        ORGANIZATION CONTEXT:
        - Organization ID: ${currentOrganizationId}
        - Project ID: ${currentProjectId}
        `;

        // Inject Brand Context if available
        const brandKit = context?.brandKit;
        const brandContext = brandKit ? `
        BRAND CONTEXT:
        - Identity: ${context.userProfile?.bio || 'N/A'}
        - Visual Style: ${brandKit.brandDescription || 'N/A'}
        - Colors: ${brandKit.colors?.join(', ') || 'N/A'}
        ` : '';

        const fullSystemPrompt = `${this.systemPrompt}
        ${orgContext}
        ${brandContext}
        ${BASE_TOOLS}
        RULES:
        1. Use tools via JSON.
        2. Output format: { "thought": "...", "tool": "...", "args": {} }
        3. Or { "final_response": "..." }
        4. When the task is complete, you MUST use "final_response" to finish.`;

        let iterations = 0;
        let currentInput = task;
        const history = useStore.getState().agentHistory;
        let finalResponseText = '';

        while (iterations < 8) { // Limit iterations for safety
            const parts: any[] = [];

            // Build Context from History (Simplified for now, similar to AgentZero)
            history.forEach(msg => {
                if (msg.id && msg.role !== 'system') { // Skip internal system messages to avoid noise
                    if (msg.role === 'user' && msg.attachments) {
                        msg.attachments.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.base64.split(',')[1] } }));
                    }
                    parts.push({ text: `${msg.role.toUpperCase()}: ${msg.text}` });
                }
            });
            parts.push({ text: `${fullSystemPrompt}\n\nLast Input: ${currentInput}\nNext Step (JSON):` });

            // Create placeholder for internal streaming response (visible to user via store)
            const responseId = uuidv4();
            // We don't want to spam the store with every intermediate thought as a separate "model" message 
            // but AgentZero did. Let's keep the pattern for now or better, use the onProgress callback.
            // Actually, AgentZero directly manipulated the store. 
            // To be a good citizen of the unified architecture, we should rely on the `AgentService` to handle message construction
            // BUT, `AgentExecutor` expects the `execute` method to return the FINAL text.
            // Intermediate thoughts should be sent via `onProgress`.

            try {
                // Determine if we should stream? 
                // The BaseAgent uses `AI.generateContent` which isn't streaming in the `check` implementation but `AgentZero` used streaming.
                // For this refactor, we will stick to unary calls to ensure stability first, then upgrade to streaming later (Task 2).

                // STREAMING IMPLEMENTATION
                const stream = await AI.generateContentStream({
                    model: AI_MODELS.TEXT.AGENT,
                    contents: [{ role: 'user', parts }],
                    config: {
                        responseMimeType: 'application/json',
                        ...AI_CONFIG.THINKING.HIGH
                    }
                });

                let fullText = "";
                const reader = stream.getReader();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = value.text();
                    fullText += chunk;
                    // Emit token for real-time UI typing effect
                    onProgress?.({ type: 'token', content: chunk });
                }

                // Parse the accumulated full text
                const result = AI.parseJSON(fullText);

                if (result.thought) {
                    onProgress?.({ type: 'thought', content: result.thought });
                }

                if (result.final_response) {
                    finalResponseText = result.final_response;
                    break;
                }

                if (result.tool) {
                    // Report tool usage
                    onProgress?.({ type: 'tool', toolName: result.tool, content: `Executing ${result.tool}...` });

                    const toolFunc = TOOL_REGISTRY[result.tool];
                    let output = "Unknown tool";
                    if (toolFunc) {
                        try {
                            output = await toolFunc(result.args);
                        } catch (err: any) {
                            output = `Error: ${err.message}`;
                        }
                    }

                    onProgress?.({ type: 'thought', content: `Tool Output: ${output}` });

                    if (output.toLowerCase().includes('successfully')) {
                        currentInput = `Tool ${result.tool} Output: ${output}. Task likely complete. Use final_response if done.`;
                    } else {
                        currentInput = `Tool ${result.tool} Output: ${output}. Continue.`;
                    }
                }
            } catch (err: any) {
                console.error("Generalist Loop Error:", err);
                onProgress?.({ type: 'thought', content: `Error: ${err.message}` });
                return { text: `Error: ${err.message}` };
            }

            iterations++;
        }

        return { text: finalResponseText || "Task completed (no final text)." };
    }
}
