/* eslint-disable @typescript-eslint/no-explicit-any -- Service with dynamic external data */
import { logger } from '@/utils/logger';
import { db } from '@/services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import {
    SpecializedAgent,
    AgentResponse,
    AgentProgressCallback,
    AgentConfig,
    ToolDefinition,
    FunctionDeclaration,
    AgentContext,
    VALID_AGENT_IDS_LIST,
    VALID_AGENT_IDS,
    ValidAgentId,
    WhiskState,
    AnyToolFunction,
    DelegateTaskArgs,
    ConsultExpertsArgs,
    ExpertConsultation,
    ToolFunctionArgs,
    ToolFunctionResult
} from './types';
import { AI_MODELS, AI_CONFIG, MODEL_PRICING } from '@/core/config/ai-models';
import type { Tool, ContentPart, FunctionCallPart } from '@/shared/types/ai.dto';
import { ZodType } from 'zod';
import { LoopDetector, DelegationLoopDetector } from './LoopDetector';
import { AgentExecutionContext, ExecutionContextFactory } from './context/AgentExecutionContext';
import { ToolExecutionContext } from './ToolExecutionContext';
import { wrapTool, toolError } from './utils/ToolUtils';
import { SUPERPOWER_TOOLS } from './definitions/SuperpowerTools';
import { getFineTunedModel } from './fine-tuned-models';


import { AgentPromptBuilder } from './builders/AgentPromptBuilder';

export class BaseAgent implements SpecializedAgent {
    public id: string;
    public name: string;
    public description: string;
    public color: string;
    public category: 'manager' | 'department' | 'specialist';
    public systemPrompt: string;
    public tools: ToolDefinition[];
    protected functions: Record<string, AnyToolFunction> = {};
    /** Explicit allowlist of tool names. Populated from AgentConfig.authorizedTools.
     *  If undefined, all declared functionDeclarations are allowed. */
    protected authorizedTools?: string[];
    /** Fine-tuned model endpoint for this agent. When set and feature flag is enabled,
     *  this model is used instead of the default AI_MODELS.TEXT.AGENT. */
    protected modelId?: string;
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

        // Phase 4: Use shallow clone for tools to preserve Zod schemas
        this.tools = config.tools ? [...config.tools] : [];

        // Store explicit tool allowlist from config (undefined = infer from declarations)
        this.authorizedTools = config.authorizedTools;

        // Store fine-tuned model ID if specified, otherwise check registry
        this.modelId = config.modelId || getFineTunedModel(config.id as ValidAgentId);

        // Populate tool schemas for validation
        this.tools.forEach(def => {
            def.functionDeclarations.forEach(fn => {
                if (fn.schema) {
                    this.toolSchemas.set(fn.name, fn.schema);
                }
            });
        });

        // Initialize functions
        this.functions = {
            // Phase 3.5: Migrated to use execution context for isolated state access
            get_project_details: async ({ projectId }, _context, toolContext?: ToolExecutionContext) => {
                // Use execution context if available, fallback to direct store access for backwards compatibility
                const projects = toolContext ? toolContext.get('projects') : (await import('@/core/store')).useStore.getState().projects;
                const project = (projects as Array<{ id: string }>)?.find(p => p.id === projectId);
                if (!project) return { success: false, error: 'Project not found' };
                return { success: true, data: project };
            },
            // Phase 3.5: Updated signature to accept toolContext (not used, but consistent)
            delegate_task: async ({ targetAgentId, task }: DelegateTaskArgs, context, _toolContext?: ToolExecutionContext) => {
                const { agentService } = await import('./AgentService');
                const { toolError } = await import('./utils/ToolUtils');
                const { DelegationLoopDetector } = await import('./LoopDetector');
                const { validateHubAndSpoke } = await import('./types');

                if (typeof targetAgentId !== 'string' || typeof task !== 'string') {
                    return toolError('Invalid delegation parameters', 'INVALID_ARGS');
                }
                // Runtime validation: reject invalid agent IDs to prevent hallucination issues
                if (!VALID_AGENT_IDS.includes(targetAgentId)) {
                    return toolError(
                        `Invalid agent ID: "${targetAgentId}". Valid IDs are: ${VALID_AGENT_IDS_LIST}`,
                        'INVALID_AGENT_ID'
                    );
                }

                // Phase 4: Enforce hub-and-spoke architecture
                const hubSpokeError = validateHubAndSpoke(this.id, targetAgentId);
                if (hubSpokeError) {
                    logger.warn(`[BaseAgent] Hub-and-spoke violation: ${this.id} -> ${targetAgentId}`);
                    return toolError(hubSpokeError, 'HUB_SPOKE_VIOLATION');
                }

                // Phase 2: Check for delegation loops
                const traceId = context?.traceId || 'unknown';
                const delegationCheck = DelegationLoopDetector.recordDelegation(traceId, targetAgentId);
                if (delegationCheck.isLoop) {
                    logger.warn(`[BaseAgent] Delegation loop detected: ${traceId} -> ${targetAgentId}. Pattern: ${delegationCheck.pattern}`);
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
            consult_experts: async ({ consultations }: ConsultExpertsArgs, context, _toolContext?: ToolExecutionContext) => {
                const { agentService } = await import('./AgentService');
                const { toolError } = await import('./utils/ToolUtils');
                const { validateHubAndSpoke } = await import('./types');

                if (!Array.isArray(consultations)) {
                    return toolError('Consultations must be an array', 'INVALID_ARGS');
                }

                try {
                    const results = await Promise.all(
                        consultations.map(async (c: ExpertConsultation) => {
                            if (!VALID_AGENT_IDS.includes(c.targetAgentId)) {
                                return { agentId: c.targetAgentId, error: `Invalid agent ID: ${c.targetAgentId}` };
                            }

                            // Phase 4: Enforce hub-and-spoke architecture
                            const hubSpokeError = validateHubAndSpoke(this.id, c.targetAgentId);
                            if (hubSpokeError) {
                                logger.warn(`[BaseAgent] Hub-and-spoke violation in consult_experts: ${this.id} -> ${c.targetAgentId}`);
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
                // Cast to EventType — runtime validation happens inside proactiveService.subscribeToEvent
                const taskId = await proactiveService.subscribeToEvent(this.id, eventType as import('@/core/events').EventType, task);
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
                const { GenAI } = await import('@/services/ai/GenAI');
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
                    const response = await GenAI.generateSpeech(text, selectedVoice);
                    await audioService.play(response.audio.inlineData.data, response.audio.inlineData.mimeType);
                    return {
                        success: true,
                        message: 'Speech generated and played'
                    };
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    logger.error('[indii:BaseAgent] Speak failure:', err);
                    return {
                        success: false,
                        message: `Failed to speak: ${message}`
                    };
                }
            },
            ...(config.functions || {} as Record<string, AnyToolFunction>)
        };
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
            logger.debug(`[BaseAgent] ${this.name} waiting for existing execution to complete...`);
            try {
                await BaseAgent.executionLocks.get(lockKey);
            } catch (err) {
                // Previous execution failed, but we can proceed
                logger.warn(`[BaseAgent] Previous execution failed for ${lockKey}, proceeding...`);
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
    protected async _executeInternal(task: string, context?: AgentContext, onProgress?: AgentProgressCallback, signal?: AbortSignal, attachments?: { mimeType: string; base64: string }[]): Promise<AgentResponse> {
        // Lazy import AI Service to prevent circular deps during registry loading
        const { GenAI } = await import('@/services/ai/GenAI');

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
                parts: msg.attachments && msg.attachments.length > 0
                    ? [{ text: msg.text || '' }, ...msg.attachments.map(a => ({ inlineData: { mimeType: a.mimeType, data: a.base64 } }))]
                    : [{ text: msg.text || '' }]
            }));

            // Truncate to safe token limit (e.g. 15k tokens reserved for history out of 32k/1M context)
            const SAFE_TOKEN_LIMIT = 15000;
            const truncated = ContextManager.truncateContext(contentHistory, SAFE_TOKEN_LIMIT);

            // Reconstruct string for the prompt
            safeHistory = truncated.map(c => {
                const role = c.role === 'model' ? 'Assistant' : 'User';
                const text = c.parts.map(p => 'text' in p ? p.text : '[Attachment]').join(' ');
                return `${role}: ${text}`;
            }).join('\n\n');
        } else {
            // Fallback: Naive slicing if no structured history is available
            const MAX_HISTORY_CHARS = 32000;
            if (safeHistory.length > MAX_HISTORY_CHARS) {
                safeHistory = safeHistory.slice(-MAX_HISTORY_CHARS);
                safeHistory = `[...Older history truncated...]\n${safeHistory}`;
            }
        }

        let fullPrompt = AgentPromptBuilder.buildFullPrompt(
            this.systemPrompt,
            task,
            this.name,
            this.id,
            context,
            enrichedContext,
            safeHistory,
            SUPERPOWER_PROMPT,
            memorySection,
            distributorSection
        );

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
                    parameters: JSON.parse(JSON.stringify(fn.parameters))
                }))
            }]
            : [];

        const accumulatedResponse = '';
        let iterations = 0;
        const MAX_ITERATIONS = 15;
        const toolCalls: Array<{ name: string; args: ToolFunctionArgs; result: ToolFunctionResult | string }> = [];
        let lastToolResult: ToolFunctionResult | undefined = undefined;
        let currentThoughtSignature: string | undefined = undefined;

        // Phase 2: Clear loop detector for new task execution
        this.loopDetector.clear();

        // Phase 3: Create isolated execution context for this agent run
        const executionContext = await ExecutionContextFactory.fromAgentContext(
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
                    logger.warn(`[BaseAgent] Budget exceeded in ${this.id}. Halting execution.`);
                    // executionContext.rollback() is already synchronous, but for consistency if we ever make it async:
                    executionContext.rollback();
                    return {
                        text: 'Task halted: Budget exceeded.',
                        error: 'Budget exceeded',
                        toolCalls
                    };
                }

                iterations++;
                onProgress?.({ type: 'thought', content: iterations === 1 ? 'Generating response...' : 'Processing tool result...' });

                // Resolve model: fine-tuned endpoint > default base model
                const resolvedModel = this.modelId || AI_MODELS.TEXT.AGENT;
                if (iterations === 1 && this.modelId) {
                    logger.info(`[${this.id}] Using fine-tuned endpoint: ${this.modelId}`);
                }

                const result = await GenAI.generateContent(
                    [{ // contents
                        role: 'user' as const,
                        parts: [
                            { text: fullPrompt },
                            ...(attachments || []).map(a => ({
                                inlineData: { mimeType: a.mimeType, data: a.base64 }
                            }))
                        ]
                    }],
                    resolvedModel, // modelOverride — fine-tuned or base
                    { ...AI_CONFIG.THINKING.LOW }, // config
                    undefined, // systemInstruction
                    allTools as unknown as Parameters<import('@/services/ai/FirebaseAIService').FirebaseAIService['generateContent']>[4], // tools — bridges internal ToolDefinition to SDK type
                    { thoughtSignature: currentThoughtSignature } // options
                );

                // Wrap the raw result into a WrappedResponse-like shape for downstream use
                const response = {
                    text: () => result.response?.text?.() || '',
                    functionCalls: () => {
                        // Support mocked results or SDK results that provide a direct functionCalls helper
                        const res = result.response as { functionCalls?: () => Array<{ name: string; args: Record<string, unknown> }>; candidates?: Array<{ content?: { parts?: ContentPart[] } }> };
                        if (res && typeof res.functionCalls === 'function') {
                            const calls = res.functionCalls();
                            return Array.isArray(calls) ? calls : [];
                        }

                        const candidates = res?.candidates;
                        const parts = (candidates?.[0]?.content?.parts || []) as ContentPart[];
                        return parts
                            .filter((p): p is FunctionCallPart => !!p && typeof p === 'object' && 'functionCall' in p)
                            .map((p) => p.functionCall);
                    },
                    usage: () => result.response?.usageMetadata,
                    thoughtSignature: (() => {
                        // Extract thoughtSignature from the last part of the response
                        const parts = (result.response?.candidates?.[0]?.content?.parts || []) as ContentPart[];
                        for (const p of parts) {
                            if (p.thoughtSignature) return p.thoughtSignature;
                        }
                        return undefined;
                    })()
                };

                // Transfer thought signature for function calling continuity
                if (response.thoughtSignature) {
                    currentThoughtSignature = response.thoughtSignature;
                }

                // LEDGER: Record Spend based on Token Usage
                const usage = response.usage?.();
                if (usage && context?.userId) {
                    const pricing = MODEL_PRICING[AI_MODELS.TEXT.AGENT];
                    // Ensure we are using a text model pricing schema (input/output)
                    if (pricing && 'input' in pricing && 'output' in pricing) {
                        const inputCost = ((usage.promptTokenCount || 0) / 1000000) * pricing.input;
                        const outputCost = ((usage.candidatesTokenCount || 0) / 1000000) * pricing.output;
                        const totalCost = inputCost + outputCost;

                        if (totalCost > 0) {
                            await MembershipService.recordSpend(context.userId, totalCost);
                        }
                    }
                }

                const functionCall = response.functionCalls()?.[0];

                if (functionCall) {
                    const { name, args } = functionCall;

                    // Phase 2: Advanced loop detection
                    const loopCheck = this.loopDetector.detectLoop(name, args);
                    if (loopCheck.isLoop) {
                        logger.warn(`[BaseAgent] Loop detected in ${this.id}: ${loopCheck.reason}`);
                        logger.warn(`[BaseAgent] Pattern: ${loopCheck.pattern}`);
                        await executionContext.rollback();
                        return {
                            text: `Task ended: ${loopCheck.reason}`,
                            error: 'Loop detected',
                            toolCalls
                        };
                    }

                    // Record this tool call for future loop detection
                    this.loopDetector.recordToolCall(name, args);

                    // Runtime tool authorization enforcement
                    // Build the allowed set: explicit authorizedTools > declared functionDeclarations > allow-all
                    const declaredToolNames = this.tools.flatMap(
                        (t: ToolDefinition) => t.functionDeclarations.map((d: FunctionDeclaration) => d.name)
                    );
                    const authorizedTools: string[] | undefined = this.authorizedTools ?? (
                        declaredToolNames.length > 0 ? declaredToolNames : undefined
                    );
                    if (authorizedTools !== undefined && !authorizedTools.includes(name)) {
                        logger.warn(`[BaseAgent] SECURITY: Agent '${this.id}' attempted unauthorized tool call: '${name}'`);
                        const blockedResult: ToolFunctionResult = {
                            success: false,
                            error: `Tool '${name}' is not authorized for agent '${this.id}'.`
                        };
                        toolCalls.push({ name, args, result: blockedResult });
                        lastToolResult = blockedResult;
                        // Inject block notice into conversation and continue loop
                        fullPrompt += `\n[Tool Call: ${name}(${JSON.stringify(args)})] Result: Error: Tool '${name}' is not authorized for agent '${this.id}'.\n`;
                        continue;
                    }

                    const argsStr = JSON.stringify(args);
                    onProgress?.({ type: 'tool', toolName: name, content: `Executing ${name}...` });

                    let result: ToolFunctionResult;
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

                    // Item 406: Write async tool audit record (fire-and-forget, non-blocking)
                    if (enrichedContext.userId) {
                        const auditCol = collection(db, 'users', enrichedContext.userId, 'agent_audit');
                        addDoc(auditCol, {
                            toolName: name,
                            agentId: this.id,
                            timestamp: serverTimestamp(),
                            success: typeof result === 'object' && result !== null ? (result as unknown as Record<string, unknown>).success !== false : true,
                        }).catch(() => { /* audit is best-effort */ });
                    }

                    const outputText = typeof result === 'string'
                        ? result
                        : (result.success === false
                            ? `Error: ${result.error || result.message}`
                            : `Success: ${JSON.stringify(result.data || result)}`);

                    // Update prompt with tool result for next iteration
                    fullPrompt += `\n[Tool Call: ${name}(${argsStr})] Result: ${outputText}\n`;

                    // Emit tool result for UI/Persistence
                    onProgress?.({
                        type: 'tool_result',
                        toolName: name,
                        content: outputText
                    });

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
                        logger.debug(`[BaseAgent] Committing changes for ${this.id}: ${executionContext.getChangeSummary()}`);
                        await executionContext.commit();
                    }

                    return {
                        text: finalResponse,
                        data: lastToolResult,
                        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                        thoughtSignature: currentThoughtSignature,
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
                logger.warn(`[BaseAgent] Max iterations reached, rolling back ${executionContext.getChangeSummary()}`);
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
                logger.error(`[BaseAgent] Error occurred, rolling back ${executionContext.getChangeSummary()}`);
                executionContext.rollback();
            }

            const errorMessage = error instanceof Error ? error.message : String(error);
            return { text: `Error: ${errorMessage}` };
        }
    }
}

