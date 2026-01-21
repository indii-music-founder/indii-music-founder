import { SpecializedAgent, AgentResponse, AgentProgressCallback, AgentConfig, ToolDefinition, FunctionDeclaration, AgentContext, VALID_AGENT_IDS_LIST, VALID_AGENT_IDS, ValidAgentId, WhiskState, AnyToolFunction } from './types';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { ZodType } from 'zod';
import { LoopDetector, DelegationLoopDetector } from './LoopDetector';
import { AgentExecutionContext, ExecutionContextFactory } from './context/AgentExecutionContext';
import { ToolExecutionContext } from './ToolExecutionContext';
import { wrapTool, toolError } from './utils/ToolUtils';
// TOOL_REGISTRY removed to prevent circular dependency

// Export types for use in definitions
export type { AgentConfig };

const SUPERPOWER_TOOLS: FunctionDeclaration[] = [
    {
        name: 'save_memory',
        description: 'Save a fact, rule, or preference to long-term memory.',
        parameters: {
            type: 'OBJECT',
            properties: {
                content: { type: 'STRING', description: 'The content to remember.' },
                type: { type: 'STRING', description: 'Type of memory.', enum: ['fact', 'summary', 'rule'] }
            },
            required: ['content']
        }
    },
    {
        name: 'recall_memories',
        description: 'Search long-term memory for relevant information.',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: { type: 'STRING', description: 'Search query.' }
            },
            required: ['query']
        }
    },
    {
        name: 'verify_output',
        description: 'Critique and verify generated content against a goal.',
        parameters: {
            type: 'OBJECT',
            properties: {
                goal: { type: 'STRING', description: 'The original goal.' },
                content: { type: 'STRING', description: 'The content to verify.' }
            },
            required: ['goal', 'content']
        }
    },
    {
        name: 'request_approval',
        description: 'Request user approval for high-stakes actions.',
        parameters: {
            type: 'OBJECT',
            properties: {
                content: { type: 'STRING', description: 'Content or action requiring approval.' },
                type: { type: 'STRING', description: 'Type of action (e.g., "post", "email").' }
            },
            required: ['content']
        }
    },
    {
        name: 'get_project_details',
        description: 'Fetch full details of a project by ID.',
        parameters: {
            type: 'OBJECT',
            properties: {
                projectId: { type: 'STRING', description: 'The ID of the project to fetch.' }
            },
            required: ['projectId']
        }
    },
    {
        name: 'search_knowledge',
        description: 'Search the internal knowledge base for answers, guidelines, or policies.',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: { type: 'STRING', description: 'The search query.' }
            },
            required: ['query']
        }
    },
    {
        name: 'delegate_task',
        description: `Delegate a sub-task to another specialized agent. ONLY use valid agent IDs from this list: ${VALID_AGENT_IDS_LIST}. Using any other ID will fail.`,
        parameters: {
            type: 'OBJECT',
            properties: {
                targetAgentId: { type: 'STRING', description: `The ID of the agent to delegate to. MUST be one of: ${VALID_AGENT_IDS_LIST}` },
                task: { type: 'STRING', description: 'The specific task for the agent to perform.' }
            },
            required: ['targetAgentId', 'task']
        }
    },
    {
        name: 'consult_experts',
        description: 'Consult multiple specialized agents in parallel to get diverse perspectives on a complex sub-task.',
        parameters: {
            type: 'OBJECT',
            properties: {
                consultations: {
                    type: 'ARRAY',
                    description: 'List of specific tasks to delegate to specialized agents.',
                    items: {
                        type: 'OBJECT',
                        properties: {
                            targetAgentId: { type: 'STRING', description: `The ID of the agent to consult. MUST be one of: ${VALID_AGENT_IDS_LIST}` },
                            task: { type: 'STRING', description: 'The specific question or instruction for this specialist.' }
                        },
                        required: ['targetAgentId', 'task']
                    }
                }
            },
            required: ['consultations']
        }
    },
    {
        name: 'speak',
        description: 'Read text aloud using the agents voice. Use this for proactive notifications or to emphasize important information.',
        parameters: {
            type: 'OBJECT',
            properties: {
                text: { type: 'STRING', description: 'The text to read aloud.' },
                voice: { type: 'STRING', description: 'Optional voice override (e.g., Kore, Puck, Charon, Vega, Capella).' }
            },
            required: ['text']
        }
    },
    {
        name: 'schedule_task',
        description: 'Schedule a task to be executed automatically after a delay (e.g., follow-ups, reminders).',
        parameters: {
            type: 'OBJECT',
            properties: {
                targetAgentId: { type: 'STRING', description: `Agent to execute. Valid IDs: ${VALID_AGENT_IDS_LIST}` },
                task: { type: 'STRING', description: 'The instruction to execute.' },
                delayMinutes: { type: 'NUMBER', description: 'Minutes to wait before execution.' }
            },
            required: ['targetAgentId', 'task', 'delayMinutes']
        }
    },
    {
        name: 'subscribe_to_event',
        description: 'Subscribe to a system event to trigger an autonomous response (e.g., when a task completes).',
        parameters: {
            type: 'OBJECT',
            properties: {
                eventType: {
                    type: 'STRING',
                    enum: ['TASK_COMPLETED', 'TASK_FAILED', 'SYSTEM_ALERT'],
                    description: 'The type of event to monitor.'
                },
                task: { type: 'STRING', description: 'The instruction to execute when the event occurs.' }
            },
            required: ['eventType', 'task']
        }
    },
    {
        name: 'send_notification',
        description: 'Display a proactive notification (toast) to the user.',
        parameters: {
            type: 'OBJECT',
            properties: {
                type: {
                    type: 'STRING',
                    enum: ['info', 'success', 'warning', 'error'],
                    description: 'The style of the notification.'
                },
                message: { type: 'STRING', description: 'The message to display.' }
            },
            required: ['type', 'message']
        }
    }
];

export class BaseAgent implements SpecializedAgent {
    public id: string;
    public name: string;
    public description: string;
    public color: string;
    public category: 'manager' | 'department' | 'specialist';
    public systemPrompt: string;
    public tools: ToolDefinition[];
    protected functions: Record<string, AnyToolFunction> = {};
    private toolSchemas: Map<string, ZodType> = new Map();

    // CRITICAL: Execution lock to prevent concurrent agent execution for same user/project
    // Prevents race conditions that cause agents to "dismantle" each other
    private static executionLocks: Map<string, Promise<any>> = new Map();

    // Phase 2: Advanced loop detection to prevent stuck agents
    private loopDetector: LoopDetector = new LoopDetector();

    constructor(config: AgentConfig) {
        this.id = config.id;
        this.name = config.name;
        this.description = config.description;
        this.color = config.color;
        this.category = config.category;
        this.systemPrompt = config.systemPrompt;
        this.tools = config.tools || [];

        // Populate tool schemas for validation
        this.tools.forEach(def => {
            def.functionDeclarations.forEach(fn => {
                if (fn.schema) {
                    this.toolSchemas.set(fn.name, fn.schema);
                }
            });
        });

        this.functions = {
            // Phase 3.5: Migrated to use execution context for isolated state access
            get_project_details: async ({ projectId }, _context, toolContext?: ToolExecutionContext) => {
                // Use execution context if available, fallback to direct store access for backwards compatibility
                const projects = toolContext ? toolContext.get('projects') : (await import('@/core/store')).useStore.getState().projects;
                const project = projects?.find((p: any) => p.id === projectId);
                if (!project) return { success: false, error: 'Project not found' };
                return { success: true, data: project };
            },
            // Phase 3.5: Updated signature to accept toolContext (not used, but consistent)
            delegate_task: async ({ targetAgentId, task }: any, context, _toolContext?: ToolExecutionContext) => {
                const { agentService } = await import('./AgentService');
                const { toolError } = await import('./utils/ToolUtils');
                const { DelegationLoopDetector } = await import('./LoopDetector');
                const { validateHubAndSpoke } = await import('./types');

                if (typeof targetAgentId !== 'string' || typeof task !== 'string') {
                    return toolError('Invalid delegation parameters', 'INVALID_ARGS');
                }
                // Runtime validation: reject invalid agent IDs to prevent hallucination issues
                if (!VALID_AGENT_IDS.includes(targetAgentId as ValidAgentId)) {
                    return toolError(
                        `Invalid agent ID: "${targetAgentId}". Valid IDs are: ${VALID_AGENT_IDS_LIST}`,
                        'INVALID_AGENT_ID'
                    );
                }

                // Phase 4: Enforce hub-and-spoke architecture
                const hubSpokeError = validateHubAndSpoke(this.id, targetAgentId);
                if (hubSpokeError) {
                    console.warn(`[BaseAgent] Hub-and-spoke violation: ${this.id} -> ${targetAgentId}`);
                    return toolError(hubSpokeError, 'HUB_SPOKE_VIOLATION');
                }

                // Phase 2: Check for delegation loops
                const traceId = context?.traceId || 'unknown';
                const delegationCheck = DelegationLoopDetector.recordDelegation(traceId, targetAgentId);
                if (delegationCheck.isLoop) {
                    console.warn(`[BaseAgent] Delegation loop detected: ${traceId} -> ${targetAgentId}. Pattern: ${delegationCheck.pattern}`);
                    return toolError(
                        `Cannot delegate: ${delegationCheck.reason}. Chain: ${delegationCheck.pattern}`,
                        'DELEGATION_LOOP'
                    );
                }

                const result = await agentService.runAgent(targetAgentId, task, context, context?.traceId, context?.attachments);
                return {
                    success: true,
                    data: result,
                    message: `Delegated task to ${targetAgentId}`
                };
            },
            // Phase 3.5: Updated signature to accept toolContext (not used, but consistent)
            consult_experts: async ({ consultations }: any, context, _toolContext?: ToolExecutionContext) => {
                const { agentService } = await import('./AgentService');
                const { toolError } = await import('./utils/ToolUtils');
                const { validateHubAndSpoke } = await import('./types');

                if (!Array.isArray(consultations)) {
                    return toolError('Consultations must be an array', 'INVALID_ARGS');
                }

                try {
                    const results = await Promise.all(
                        consultations.map(async (c: { targetAgentId: string; task: string }) => {
                            if (!VALID_AGENT_IDS.includes(c.targetAgentId as ValidAgentId)) {
                                return { agentId: c.targetAgentId, error: `Invalid agent ID: ${c.targetAgentId}` };
                            }

                            // Phase 4: Enforce hub-and-spoke architecture
                            const hubSpokeError = validateHubAndSpoke(this.id, c.targetAgentId);
                            if (hubSpokeError) {
                                console.warn(`[BaseAgent] Hub-and-spoke violation in consult_experts: ${this.id} -> ${c.targetAgentId}`);
                                return { agentId: c.targetAgentId, error: hubSpokeError };
                            }

                            const res = await agentService.runAgent(c.targetAgentId, c.task, context, context?.traceId, context?.attachments);
                            return { agentId: c.targetAgentId, response: res };
                        })
                    );

                    return {
                        success: true,
                        data: { results },
                        message: `Consulted ${consultations.length} experts`
                    };
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    return toolError(`Consultation failed: ${message}`, 'EXECUTION_ERROR');
                }
            },
            // Phase 3.5: Updated signature to accept toolContext (not used, but consistent)
            schedule_task: async (args: Record<string, unknown>, _context?: AgentContext, _toolContext?: ToolExecutionContext) => {
                const { targetAgentId, task, delayMinutes } = args as { targetAgentId: string; task: string; delayMinutes: number };
                const { proactiveService } = await import('./ProactiveService');
                const executeAt = Date.now() + (delayMinutes * 60000);
                const taskId = await proactiveService.scheduleTask(targetAgentId, task, executeAt);
                return {
                    success: true,
                    data: { taskId },
                    message: `Task scheduled for ${new Date(executeAt).toLocaleString()}`
                };
            },
            // Phase 3.5: Updated signature to accept toolContext (not used, but consistent)
            subscribe_to_event: async (args: Record<string, unknown>, _context?: AgentContext, _toolContext?: ToolExecutionContext) => {
                const { eventType, task } = args as { eventType: string; task: string };
                const { proactiveService } = await import('./ProactiveService');
                // @ts-expect-error - eventType is dynamically checked in proactiveService
                const taskId = await proactiveService.subscribeToEvent(this.id, eventType, task);
                return {
                    success: true,
                    data: { taskId },
                    message: `Agent ${this.name} subscribed to ${eventType}`
                };
            },
            // Phase 3.5: Updated signature to accept toolContext (not used, but consistent)
            send_notification: async (args: Record<string, unknown>, _context?: AgentContext, _toolContext?: ToolExecutionContext) => {
                const { type, message } = args as { type: 'info' | 'success' | 'warning' | 'error'; message: string };
                const { events } = await import('@/core/events');
                events.emit('SYSTEM_ALERT', { level: type, message });
                return {
                    success: true,
                    message: 'Notification sent'
                };
            },
            speak: async (args: Record<string, unknown>, _context?: AgentContext, _toolContext?: ToolExecutionContext) => {
                const { text, voice } = args as { text: string; voice?: string };
                const { AI } = await import('@/services/ai/AIService');
                const { audioService } = await import('@/services/audio/AudioService');

                const VOICE_MAP: Record<string, string> = {
                    'kyra': 'Kore',
                    'liora': 'Vega',
                    'mistral': 'Charon',
                    'seraph': 'Capella',
                    'vance': 'Puck'
                };

                const selectedVoice = voice || VOICE_MAP[this.id.toLowerCase()] || 'Kore';

                try {
                    const response = await AI.generateSpeech(text, selectedVoice);
                    await audioService.play(response.audio.inlineData.data, response.audio.inlineData.mimeType);
                    return {
                        success: true,
                        message: 'Speech generated and played'
                    };
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    console.error('[BaseAgent] Speak failure:', err);
                    return {
                        success: false,
                        message: `Failed to speak: ${message}`
                    };
                }
            },
            ...(config.functions || {} as Record<string, AnyToolFunction>)
        };
    }

    protected buildWhiskContext(whiskState: WhiskState): string {
        if (!whiskState) return '';
        const { subjects, scenes, styles, preciseReference } = whiskState;
        const lines: string[] = [];

        const checkedSubjects = subjects.filter(s => s.checked);
        const checkedScenes = scenes.filter(s => s.checked);
        const checkedStyles = styles.filter(s => s.checked);

        if (checkedSubjects.length === 0 && checkedScenes.length === 0 && checkedStyles.length === 0) {
            return '';
        }

        lines.push('## REFERENCE MIXER (WHISK) CONTEXT');
        lines.push(`- Precise Mode: ${preciseReference ? 'ON (strict adherence to references)' : 'OFF (creative freedom)'}`);
        lines.push('The following items are "Locked" in the Reference Mixer. They represent the current visual direction:');

        if (checkedSubjects.length > 0) {
            lines.push('- SUBJECTS: ' + checkedSubjects.map(s => s.aiCaption || s.content).join(', '));
        }
        if (checkedScenes.length > 0) {
            lines.push('- SCENES: ' + checkedScenes.map(s => s.aiCaption || s.content).join(', '));
        }
        if (checkedStyles.length > 0) {
            lines.push('- STYLES: ' + checkedStyles.map(s => s.aiCaption || s.content).join(', '));
        }

        lines.push('IMPORTANT: When generating images or videos, you MUST incorporate these locked references. Synthesize the subject, scene, and style into a cohesive prompt.');
        return lines.join('\n');
    }

    /**
     * Common method to execute a task using the agent's capabilities.
     * This method handles the AI interaction loop, tool calls, and progress reporting.
     * 
     * @param task The mission or objective to achieve
     * @param context Execution context (org, project, brand, etc.)
     * @param onProgress Callback for granular progress events (thought, tool use, tokens)
     * @param signal AbortSignal for cancellation
     * @param attachments Optional multimodal inputs (images, base64)
     * @returns Standardized AgentResponse
     */
    async execute(task: string, context?: AgentContext, onProgress?: AgentProgressCallback, signal?: AbortSignal, attachments?: { mimeType: string; base64: string }[]): Promise<AgentResponse> {
        // CRITICAL: Execution Lock Implementation
        // Prevents concurrent execution for same user/project/agent combination
        // This eliminates race conditions that cause "agent dismantling"
        const lockKey = `${context?.userId || 'unknown'}-${context?.projectId || 'unknown'}-${this.id}`;

        // If another execution is in progress for this key, wait for it
        if (BaseAgent.executionLocks.has(lockKey)) {
            console.log(`[BaseAgent] ${this.name} waiting for existing execution to complete...`);
            try {
                await BaseAgent.executionLocks.get(lockKey);
            } catch (err) {
                // Previous execution failed, but we can proceed
                console.warn(`[BaseAgent] Previous execution failed for ${lockKey}, proceeding...`);
            }
        }

        // Create a promise for this execution and store it
        const executionPromise = (async () => {
            try {
                return await this._executeInternal(task, context, onProgress, signal, attachments);
            } finally {
                // Clean up lock when done
                BaseAgent.executionLocks.delete(lockKey);
            }
        })();

        BaseAgent.executionLocks.set(lockKey, executionPromise);
        return executionPromise;
    }

    /**
     * Internal execution method (separated to support locking mechanism)
     */
    private async _executeInternal(task: string, context?: AgentContext, onProgress?: AgentProgressCallback, signal?: AbortSignal, attachments?: { mimeType: string; base64: string }[]): Promise<AgentResponse> {
        // Lazy import AI Service to prevent circular deps during registry loading
        const { AI } = await import('@/services/ai/AIService');

        // Report thinking start
        onProgress?.({ type: 'thought', content: `Analyzing request: "${task.substring(0, 50)}..."` });

        // KEEPER: Prevent Context Duplication
        const { chatHistoryString, chatHistory, memoryContext, ...leanContext } = context || {};

        const enrichedContext = {
            ...leanContext,
            orgId: context?.orgId,
            projectId: context?.projectId
        };

        // Phase 2: Clear loop detector for new task execution
        this.loopDetector.clear();

        const SUPERPOWER_PROMPT = `
        ## CAPABILITIES & PROTOCOLS
        You have access to the following advanced capabilities ("Superpowers"):
        - **Memory:** Call 'save_memory' to retain critical facts. Call 'recall_memories' to find past context.
        - **Reflection:** Call 'verify_output' to critique your own work if the task is complex.
        - **Approval:** Call 'request_approval' for any action that publishes content or spends money.
        - **Collaboration:** If a task requires expertise outside your primary domain (${this.name}), call 'delegate_task' to hand it over to a specialist. For complex problems needing multiple viewpoints, use 'consult_experts'.
        - **Speech:** Use 'speak' to announce high-level intent or share creative insights. **CRITICAL:** Calling 'speak' does NOT fulfill a "generate", "create", or "make" request. You MUST call the relevant action tool (e.g., 'generate_image') in addition to 'speak'.

        ## COLLABORATION PROTOCOL
        - If you are receiving a delegated task (check context.traceId), be extremely concise and data-oriented.
        - When delegating, provide full context so the next agent doesn't need to ask follow-up questions.
        - Use 'consult_experts' when you need parallel logic (e.g., both music and marketing perspectives).

        ## TONE & STYLE
        - Be direct and concise. Avoid "As an AI..." boilerplate.
        - Act with the authority of your role (${this.name}).
        - If the user asks for an action, DO IT. Don't just say you can.
        `;

        // Build memory section if memories were retrieved
        const memorySection = context?.memoryContext
            ? `\n## RELEVANT MEMORIES\n${context.memoryContext}\n`
            : '';

        // Build Reference Mixer context
        const whiskContext = context?.whiskState ? `\n${this.buildWhiskContext(context.whiskState)}\n` : '';

        // Build distributor section
        const distributorSection = context?.distributor?.isConfigured
            ? `\n## DISTRIBUTOR REQUIREMENTS\n${context.distributor.promptContext}\n\nIMPORTANT: When generating any cover art, promotional images, or release assets:\n- ALWAYS use ${context.distributor.coverArtSize.width}x${context.distributor.coverArtSize.height}px for cover art\n- Export audio in ${context.distributor.audioFormat.join(' or ')} format\n- These are ${context.distributor.name} requirements - non-compliance will cause upload rejection.\n`
            : '';

        let safeHistory = context?.chatHistoryString || '';

        // KEEPER: Intelligent Context Truncation
        // Prefer structured history with token-aware truncation over raw character slicing.
        if (context?.chatHistory && Array.isArray(context.chatHistory) && context.chatHistory.length > 0) {
            const { ContextManager } = await import('@/services/ai/context/ContextManager');
            // Convert AgentMessage[] to Content[] for ContextManager
            const contentHistory = context.chatHistory.map(msg => ({
                role: (msg.role === 'model' || msg.role === 'system' ? 'model' : 'user') as 'model' | 'user',
                parts: [{ text: msg.text }]
            }));

            // Truncate to safe token limit (e.g. 15k tokens reserved for history out of 32k/1M context)
            // Keeping it relatively tight to save cost/latency, though models support more.
            const SAFE_TOKEN_LIMIT = 15000;
            const truncated = ContextManager.truncateContext(contentHistory, SAFE_TOKEN_LIMIT);

            // Reconstruct string for the prompt
            safeHistory = truncated.map(c => {
                const text = c.parts.map(p => 'text' in p ? p.text : '').join('');
                return `${c.role.toUpperCase()}: ${text}`;
            }).join('\n\n');
        } else {
            // Fallback: Naive slicing if no structured history is available
            const MAX_HISTORY_CHARS = 32000;
            if (safeHistory.length > MAX_HISTORY_CHARS) {
                safeHistory = safeHistory.slice(-MAX_HISTORY_CHARS);
                safeHistory = `[...Older history truncated...]\n${safeHistory}`;
            }
        }

        let fullPrompt = `
# MISSION
${this.systemPrompt}

# CONTEXT
${JSON.stringify(enrichedContext, null, 2)}

${context?.brandKit ? `
## BRAND & IDENTITY
- **Brand Description:** ${context.brandKit.brandDescription || 'Not provided'}
- **Aesthetic Style:** ${context.brandKit.aestheticStyle || 'Not provided'}
${context.brandKit.releaseDetails ? `
- **CURRENT PROJECT (ALBUM/SINGLE):** ${context.brandKit.releaseDetails.title || 'Untitled Project'}
- **ARTIST NAME:** ${context.brandKit.releaseDetails.artists || 'Unknown Artist'}
- **MOOD/THEME:** ${context.brandKit.releaseDetails.mood || 'N/A'}
` : ''}
` : ''}

${whiskContext}

# HISTORY
${safeHistory}
${memorySection}
${distributorSection}

${SUPERPOWER_PROMPT}

# CURRENT OBJECTIVE
${task}
`;

        // Tool gathering logic
        const specialistToolNames = new Set(
            (this.tools || []).flatMap(t => t.functionDeclarations || []).map(f => f.name)
        );
        const filteredSuperpowers = SUPERPOWER_TOOLS.filter(tool => !specialistToolNames.has(tool.name));
        const collaborationToolNames = ['delegate_task', 'consult_experts'];
        const collaborationTools = filteredSuperpowers.filter(t => collaborationToolNames.includes(t.name));
        const otherSuperpowers = filteredSuperpowers.filter(t => !collaborationToolNames.includes(t.name));

        const MAX_TOOLS_PER_AGENT = 24;
        const allFunctions: FunctionDeclaration[] = ([
            ...collaborationTools,
            ...(this.tools || []).flatMap(t => t.functionDeclarations || []),
            ...otherSuperpowers
        ]).slice(0, MAX_TOOLS_PER_AGENT);

        const allTools: ToolDefinition[] = allFunctions.length > 0
            ? [{
                functionDeclarations: allFunctions.map(fn => ({
                    name: fn.name,
                    description: fn.description,
                    parameters: fn.parameters
                }))
            }]
            : [];

        const accumulatedResponse = '';
        let iterations = 0;
        const MAX_ITERATIONS = 5;
        const toolCalls: any[] = [];
        let lastToolResult: any = undefined;

        // Phase 2: Clear loop detector for new task execution
        this.loopDetector.clear();

        // Phase 3: Create isolated execution context for this agent run
        const executionContext = ExecutionContextFactory.fromAgentContext(
            {
                userId: context?.userId,
                projectId: context?.projectId,
                traceId: context?.traceId
            },
            this.id
        );
        const toolContext = new ToolExecutionContext(executionContext);

        // Lazy import MembershipService for budget checks
        const { MembershipService } = await import('@/services/MembershipService');

        try {
            while (iterations < MAX_ITERATIONS) {
                // LEDGER: Circuit Breaker - Check Budget before execution
                const budgetCheck = await MembershipService.checkBudget(0);
                if (!budgetCheck.allowed) {
                    console.warn(`[BaseAgent] Budget exceeded in ${this.id}. Halting execution.`);
                    await executionContext.rollback();
                    return {
                        text: 'Task halted: Budget exceeded.',
                        error: 'Budget exceeded',
                        toolCalls
                    };
                }

                iterations++;
                onProgress?.({ type: 'thought', content: iterations === 1 ? 'Generating response...' : 'Processing tool result...' });

                const response = await AI.generateContent({
                    model: AI_MODELS.TEXT.AGENT,
                    contents: [{
                        role: 'user',
                        parts: [
                            { text: fullPrompt },
                            ...(attachments || []).map(a => ({
                                inlineData: { mimeType: a.mimeType, data: a.base64 }
                            }))
                        ]
                    }],
                    config: { ...AI_CONFIG.THINKING.LOW },
                    tools: allTools as any
                });
                const functionCall = response.functionCalls()?.[0];

                if (functionCall) {
                    const { name, args } = functionCall;

                    // Phase 2: Advanced loop detection
                    const loopCheck = this.loopDetector.detectLoop(name, args);
                    if (loopCheck.isLoop) {
                        console.warn(`[BaseAgent] Loop detected in ${this.id}: ${loopCheck.reason}`);
                        console.warn(`[BaseAgent] Pattern: ${loopCheck.pattern}`);
                        await executionContext.rollback();
                        return {
                            text: `Task ended: ${loopCheck.reason}`,
                            error: 'Loop detected',
                            toolCalls
                        };
                    }

                    // Record this tool call for future loop detection
                    this.loopDetector.recordToolCall(name, args);

                    const argsStr = JSON.stringify(args);
                    onProgress?.({ type: 'tool', toolName: name, content: `Executing ${name}...` });

                    let result: any;
                    if (this.functions[name]) {
                        try {
                            const schema = this.toolSchemas.get(name);
                            if (schema) schema.parse(args);
                            // Phase 3.5: Pass execution context to tools for isolated state access
                            result = await this.functions[name](args, enrichedContext, toolContext);
                        } catch (err: unknown) {
                            const msg = err instanceof Error ? err.message : String(err);
                            result = { success: false, error: msg };
                        }
                    } else {
                        const { TOOL_REGISTRY } = await import('./tools');
                        if (TOOL_REGISTRY[name]) {
                            // Phase 3.5: Pass execution context to TOOL_REGISTRY tools
                            result = await (TOOL_REGISTRY[name] as AnyToolFunction)(args, enrichedContext, toolContext);
                        } else {
                            result = { success: false, error: `Tool '${name}' not found.` };
                        }
                    }

                    // Store tool call and result
                    lastToolResult = result;
                    toolCalls.push({ name, args, result });

                    const outputText = typeof result === 'string'
                        ? result
                        : (result.success === false
                            ? `Error: ${result.error || result.message}`
                            : `Success: ${JSON.stringify(result.data || result)}`);

                    // Update prompt with tool result for next iteration
                    fullPrompt += `\n[Tool Call: ${name}(${argsStr})] Result: ${outputText}\n`;

                    if (name === 'speak') {
                        // Keep going - don't let speak terminate the agent turn
                        continue;
                    }

                    // For most tools, we continue to let the AI process the result
                    continue;
                } else {
                    const finalResponse = response.text?.() || '';
                    const usage = response.usage?.();

                    // Phase 3: Commit execution context changes on successful completion
                    if (executionContext.hasUncommittedChanges()) {
                        console.log(`[BaseAgent] Committing changes for ${this.id}: ${executionContext.getChangeSummary()}`);
                        executionContext.commit();
                    }

                    return {
                        text: finalResponse,
                        data: lastToolResult,
                        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                        usage: usage ? {
                            promptTokens: usage.promptTokenCount || 0,
                            completionTokens: usage.candidatesTokenCount || 0,
                            totalTokens: usage.totalTokenCount || 0
                        } : undefined
                    };
                }
            }

            // Phase 3: Max iterations reached - rollback any uncommitted changes
            if (executionContext.hasUncommittedChanges()) {
                console.warn(`[BaseAgent] Max iterations reached, rolling back ${executionContext.getChangeSummary()}`);
                executionContext.rollback();
            }

            return {
                text: 'Maximum iterations reached.',
                data: lastToolResult,
                toolCalls,
                error: 'Max iterations reached'
            };
        } catch (error: unknown) {
            // Phase 3: Error occurred - rollback any uncommitted changes
            if (executionContext.hasUncommittedChanges()) {
                console.error(`[BaseAgent] Error occurred, rolling back ${executionContext.getChangeSummary()}`);
                executionContext.rollback();
            }

            const errorMessage = error instanceof Error ? error.message : String(error);
            return { text: `Error: ${errorMessage}` };
        }
    }
}

