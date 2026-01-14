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

    **3. Mode C: The Companion (Casual Conversation)**
    * **Function:** Chat, Greetings, and Simple Q&A.
    * **Behavior:** If the user is just saying hello, asking a simple question, or chatting, respond NATURALLY.
    * **Constraint:** Do NOT use [Curriculum] or [Executor] prefixes for this mode. Just be helpful and friendly.

    **Tone:** Professional, conversational, and encouraging. Be helpful and proactive.

    **4. SUPERPOWERS (The "indii" Upgrade)**
    * **Memory:** You have long-term memory. Use 'save_memory' to store important facts/preferences. Use 'recall_memories' to fetch context before answering complex queries.
    * **Reflection:** For creative tasks, use 'verify_output' to critique your own work before showing it to the user.
    * **Approval:** For high-stakes actions (e.g., posting to social media, sending emails), you MUST use 'request_approval' to get user sign-off.
    * **File Management:** You can list and search generated files using 'list_files' and 'search_files'. Use this to help the user find past work.
    * **Organization:** You can switch contexts using 'switch_organization' or 'create_organization' if the user asks to change workspaces.
    `;

    // Override the raw system prompt with our specialized protocol
    systemPrompt = `You are indii, the Autonomous Studio Manager (Agent Zero).
    ${this.AGENT0_PROTOCOL}
    
    RULES:
    1. Output format: { "thought": "...", "tool": "...", "args": {} } OR { "final_response": "..." }
    2. When the user asks to "generate", "create", or "make" an image/visual, you MUST use the 'generate_image' tool. Do not just describe it.
    3. When the task is complete, you MUST use "final_response" to finish.
    `;

    // Base tools are usually handled by the agent superclass or passed in context.
    // For now, I'm defining the necessary properties.

    tools = []; // Generalist uses the global TOOL_REGISTRY for now.

    constructor() {
        super({
            id: 'generalist',
            name: 'Agent Zero',
            description: 'General assistance, complex reasoning, fallback.',
            color: 'bg-stone-500',
            category: 'manager',
            systemPrompt: 'You are indii, the Autonomous Studio Manager (Agent Zero).',
            tools: []
        });
        this.functions = TOOL_REGISTRY;
    }


    // BaseAgent provides a robust execution loop. GeneralistAgent extends it to add Mode A/B logic.
    // However, the current GeneralistAgent overrides execute entirely with an older, less stable loop.
    // I am updating it to use the robust streamIterator pattern from BaseAgent.

    /**
     * Extracts multiple JSON objects from a stream buffer.
     * Handles { ... } { ... } concatenation.
     */
    private extractJsonObjects(buffer: string): { objects: Record<string, unknown>[], remaining: string } {
        const objects: Record<string, unknown>[] = [];
        let remaining = buffer;

        while (true) {
            const start = remaining.indexOf('{');
            if (start === -1) break;

            let balance = 0;
            let end = -1;
            let inString = false;
            let escape = false;

            for (let i = start; i < remaining.length; i++) {
                const char = remaining[i];

                if (escape) {
                    escape = false;
                    continue;
                }

                if (char === '\\') {
                    escape = true;
                    continue;
                }

                if (char === '"') {
                    inString = !inString;
                    continue;
                }

                if (!inString) {
                    if (char === '{') balance++;
                    if (char === '}') {
                        balance--;
                        if (balance === 0) {
                            end = i;
                            break;
                        }
                    }
                }
            }

            if (end !== -1) {
                const jsonStr = remaining.substring(start, end + 1);
                try {
                    const obj = JSON.parse(jsonStr);
                    objects.push(obj);
                    remaining = remaining.substring(end + 1);
                } catch (e) {
                    // Invalid JSON in this chunk (maybe falsely identified braces?), skip past this opening brace
                    console.info(`[GeneralistAgent] Failed to parse chunk, attempting recovery: ${jsonStr.substring(0, 20)}...`);
                    remaining = remaining.substring(start + 1);
                }
            } else {
                // Incomplete object, wait for more data
                break;
            }
        }

        return { objects, remaining };
    }

    /**
     * Executes a task using the Agent Zero strategy.
     * Implements the Curriculum (Mode A) and Executor (Mode B) internal modes.
     * 
     * @param task The task or prompt to execute
     * @param context Optional execution context
     * @param onProgress Optional callback for progress updates
     * @returns The generated response text and any associated data
     */
    async execute(task: string, context?: any, onProgress?: (event: any) => void): Promise<{ text: string; data?: unknown }> {


        // Report thinking start
        onProgress?.({ type: 'thought', content: `Analyzing request: "${task.substring(0, 50)}..."` });

        const { useStore } = await import('@/core/store');
        const { currentOrganizationId, currentProjectId, currentModule } = useStore.getState();




        const orgContext = `
        ORGANIZATION CONTEXT:
        - Organization ID: ${currentOrganizationId}
        - Project ID: ${currentProjectId}
        - Current Module: ${currentModule || 'unknown'}
        `;

        // Inject Brand Context if available
        const brandKit = context?.brandKit;
        const brandContext = brandKit ? `
        BRAND CONTEXT:
        - Identity: ${context.userProfile?.bio || 'N/A'}
        - Visual Style: ${brandKit.brandDescription || 'N/A'}
        - Colors: ${brandKit.colors?.join(', ') || 'N/A'}
        - Fonts: ${brandKit.fonts || 'N/A'}
        - Negative Prompt: ${brandKit.negativePrompt || 'N/A'}
        
        CURRENT RELEASE:
        - Title: ${brandKit.releaseDetails?.title || 'Untitled'}
        - Type: ${brandKit.releaseDetails?.type || 'N/A'}
        - Mood: ${brandKit.releaseDetails?.mood || 'N/A'}
        - Themes: ${brandKit.releaseDetails?.themes || 'N/A'}
        
        SOCIALS & BUSINESS:
        - Twitter: ${brandKit.socials?.twitter || 'N/A'}
        - Instagram: ${brandKit.socials?.instagram || 'N/A'}
        - Spotify: ${brandKit.socials?.spotify || 'N/A'}
        - SoundCloud: ${brandKit.socials?.soundcloud || 'N/A'}
        - Bandcamp: ${brandKit.socials?.bandcamp || 'N/A'}
        - Beatport: ${brandKit.socials?.beatport || 'N/A'}
        - Website: ${brandKit.socials?.website || 'N/A'}
        - PRO: ${brandKit.socials?.pro || 'N/A'}
        - Distributor: ${brandKit.socials?.distributor || 'N/A'}
        
        AVAILABLE ASSETS (Reference by Index):
        Brand Assets:
        ${brandKit.brandAssets?.map((a: any, i: number) => `  [${i}] ${a.subject ? a.subject + ' - ' : ''}${a.category ? a.category.toUpperCase() + ': ' : ''}${a.description || 'Asset'} ${a.tags ? '(' + a.tags.join(', ') + ')' : ''}`).join('\n') || 'None'}
        
        Reference Images:
        ${brandKit.referenceImages?.map((a: any, i: number) => `  [${i}] ${a.subject ? a.subject + ' - ' : ''}${a.category ? a.category.toUpperCase() + ': ' : ''}${a.description || 'Image'} ${a.tags ? '(' + a.tags.join(', ') + ')' : ''}`).join('\n') || 'None'}

        RECENT UPLOADS (Reference by Index):
        ${useStore.getState().uploadedImages?.map((img: any, i: number) => `  [${i}] ${img.subject ? img.subject + ' - ' : ''}${img.category ? img.category.toUpperCase() + ': ' : ''}${img.prompt || 'Uploaded Image'} (${img.type}) ${img.tags ? '(' + img.tags.join(', ') + ')' : ''}`).slice(0, 10).join('\n') || 'None'}
        ` : '';

        const fullSystemPrompt = `${this.systemPrompt}
        ${orgContext}
        ${brandContext}
        ${BASE_TOOLS}
        RULES:
        1. Use tools via JSON.
        2. Output format: { "thought": "...", "tool": "...", "args": {} }
        3. MODULE SPECIFIC: You are currently in the '${currentModule}' module.
           - IF module is 'creative' OR 'director', YOU ARE THE CREATIVE DIRECTOR.
           - User requests for "images", "visuals", "scenes" MUST be handled by 'generate_image'.
           - DO NOT just describe the image. YOU MUST GENERATE IT.
        4. Or { "final_response": "..." }
        5. When the task is complete, you MUST use "final_response" to finish.`;

        let iterations = 0;
        let consecutiveNoProgress = 0; // Track iterations without progress
        let currentInput = task;
        const history = useStore.getState().agentHistory;
        let finalResponseText = '';
        const MAX_ITERATIONS = 5; // Reduced from 8 to prevent infinite loops
        const MAX_NO_PROGRESS = 3; // Bail out after 3 iterations without progress

        // Track last tool call to prevent stuttering loops (retrying same failed action)
        let lastToolCall: { name: string; args: string; result: 'success' | 'error' } | null = null;

        while (iterations < MAX_ITERATIONS) { // Limit iterations for safety
            iterations++; // Increment at start to ensure we always count

            const parts: any[] = [];

            // Build Context from History
            history.forEach(msg => {
                if (msg.id && msg.role !== 'system') {
                    if (msg.role === 'user' && msg.attachments) {
                        msg.attachments.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.base64 } }));
                    }
                    if (msg.text) {
                        parts.push({ text: `${msg.role.toUpperCase()}: ${msg.text}` });
                    }
                }
            });

            // Add current context
            const nextStepPrompt = `${fullSystemPrompt}\n\nLast Input: ${currentInput}\nNext Step (JSON):`;
            parts.push({ text: nextStepPrompt });

            try {
                const responseStream = await AI.generateContentStream({
                    model: AI_MODELS.TEXT.AGENT,
                    contents: [{ role: 'user', parts }],
                    config: {
                        responseMimeType: 'application/json',
                        ...AI_CONFIG.THINKING.HIGH
                    }
                });

                const { stream, response: responsePromise } = responseStream;

                let buffer = "";

                // Helper to consume stream (handles Arrays, ReadableStream, and AsyncIterable)
                const streamIterator = {
                    [Symbol.asyncIterator]: async function* () {
                        const rawStream = stream as unknown;
                        if (!rawStream) {
                            const resp = await responsePromise;
                            if (resp?.text) yield { text: () => resp.text() };
                            return;
                        }

                        if (Array.isArray(rawStream)) {
                            for (const item of rawStream) yield item;
                            return;
                        }

                        if (rawStream && typeof (rawStream as { getReader?: () => { read: () => Promise<{ done: boolean; value: any }>; releaseLock: () => void } }).getReader === 'function') {
                            const reader = (rawStream as { getReader: () => { read: () => Promise<{ done: boolean; value: any }>; releaseLock: () => void } }).getReader();
                            try {
                                while (true) {
                                    const { done, value } = await reader.read();
                                    if (done) break;
                                    yield value;
                                }
                            } finally {
                                reader.releaseLock();
                            }
                            return;
                        }

                        if (rawStream && typeof rawStream === 'object' && Symbol.asyncIterator in (rawStream as object)) {
                            yield* rawStream as AsyncIterable<{ text: () => string }>;
                            return;
                        }

                        const resp = await responsePromise;
                        if (resp?.text) yield { text: () => resp.text() };
                    }
                };

                // Track execution state within this generation
                let stepActionTaken = false;

                for await (const value of streamIterator) {
                    if (value) {
                        const chunk = typeof value.text === 'function' ? value.text() : '';
                        buffer += chunk;

                        // Emit token for UI typing effect
                        onProgress?.({ type: 'token', content: chunk });

                        // Attempt to parse objects from the growing buffer
                        const { objects, remaining } = this.extractJsonObjects(buffer);
                        buffer = remaining;

                        for (const result of objects) {
                            if (result.thought) {
                                onProgress?.({ type: 'thought', content: result.thought as string });
                            }

                            if (result.final_response) {
                                finalResponseText = result.final_response as string;
                                stepActionTaken = true;
                                // We can break inner loop if we have final response
                            }

                            if (result.tool) {
                                stepActionTaken = true;
                                const toolName = result.tool as string;
                                const argsStr = JSON.stringify(result.args || {});

                                // LOOP DETECTION: Check if we are retrying the exact same failed action
                                if (lastToolCall &&
                                    lastToolCall.name === toolName &&
                                    lastToolCall.args === argsStr &&
                                    lastToolCall.result === 'error') {

                                    const errorMsg = "Loop Detected: You are retrying the exact same tool call that just failed. Stopping execution to prevent infinite loop.";
                                    console.warn(`[GeneralistAgent] ${errorMsg}`);
                                    onProgress?.({ type: 'thought', content: errorMsg });

                                    // Force termination
                                    return { text: `Agent stopped: ${errorMsg}` };
                                }

                                // Report tool usage
                                onProgress?.({ type: 'tool', toolName: toolName, content: `Executing ${toolName}...` });

                                const toolFunc = TOOL_REGISTRY[toolName];
                                let output: string = "Unknown tool";
                                let isError = false;

                                if (toolFunc) {
                                    try {
                                        const toolResult = await toolFunc(result.args as Record<string, unknown>);

                                        // Check if the result itself indicates an error (standardized ToolResult)
                                        if (typeof toolResult === 'object' && toolResult !== null && 'success' in toolResult && (toolResult as any).success === false) {
                                            isError = true;
                                        }

                                        output = typeof toolResult === 'string'
                                            ? toolResult
                                            : (typeof toolResult === 'object' && toolResult !== null && 'message' in toolResult
                                                ? (toolResult as any).message
                                                : JSON.stringify(toolResult));
                                    } catch (err: unknown) {
                                        isError = true;
                                        output = `Error: ${err instanceof Error ? err.message : String(err)}`;
                                    }
                                } else {
                                    isError = true;
                                }

                                // Update last tool call state
                                lastToolCall = {
                                    name: toolName,
                                    args: argsStr,
                                    result: isError ? 'error' : 'success'
                                };

                                onProgress?.({ type: 'thought', content: `Tool Output: ${output}` });

                                if (String(output).toLowerCase().includes('successfully') && !isError) {
                                    currentInput = `Tool ${toolName} Output: ${output}. Task likely complete. Use final_response if done.`;
                                } else {
                                    currentInput = `Tool ${toolName} Output: ${output}. Continue.`;
                                }
                            }
                        }
                    }

                    if (stepActionTaken && finalResponseText) break; // Optimization: Stop stream if done
                }

                if (finalResponseText) break; // Break outer loop

                if (stepActionTaken) {
                    consecutiveNoProgress = 0; // Reset on progress
                } else {
                    consecutiveNoProgress++;
                    if (buffer.trim().length > 0) {
                        console.info(`[GeneralistAgent] Leftover buffer: ${buffer.substring(0, 50)}...`);
                    }
                    if (consecutiveNoProgress >= MAX_NO_PROGRESS) {
                        console.error('[GeneralistAgent] No progress after multiple iterations, terminating loop.');
                        return { text: 'Agent unable to complete task - no actionable response generated.' };
                    }
                }

            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                console.error("Generalist Loop Error:", err);
                onProgress?.({ type: 'thought', content: `Error: ${message}` });
                consecutiveNoProgress++;

                if (consecutiveNoProgress >= MAX_NO_PROGRESS) {
                    return { text: `Error after ${consecutiveNoProgress} failed attempts: ${message}` };
                }
            }
        }

        return { text: finalResponseText || "Task completed (no final text)." };
    }
}
