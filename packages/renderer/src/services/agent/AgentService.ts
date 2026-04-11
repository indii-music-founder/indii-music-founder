import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import type { AgentMessage, AgentThought } from '@/core/store';
// useStore removed
import { ContextPipeline, PipelineContext } from './components/ContextPipeline';
import { AgentOrchestrator } from './components/AgentOrchestrator';
import { HybridOrchestrator } from './hybrid/HybridOrchestrator';
import { AgentExecutor } from './components/AgentExecutor';
import { AgentContext } from './types';
import { memoryService } from './MemoryService';
import { agentRegistry } from './registry';

// Workflow coordinator removed for indii Conductor standard routing
import { maestroBatchingService } from './MaestroBatchingService';
import { GenAI } from '@/services/ai/GenAI';
import { AI_MODELS } from '@/core/config/ai-models';

/**
 * AgentService is the primary entry point for agent-related operations.
 * It manages the lifecycle of user messages, context resolution, orchestration, and execution.
 */
export class AgentService {
    private isProcessing = false;
    private isWarmedUp = false;
    private contextPipeline: ContextPipeline;
    private orchestrator: AgentOrchestrator;
    private hybridOrchestrator: HybridOrchestrator;
    private executor: AgentExecutor;
    private responseCache = new Map<string, { text: string; thoughts: AgentThought[]; agentId: string }>();

    constructor() {
        // Components initialized. Agents are auto-registered in AgentRegistry singleton.
        this.contextPipeline = new ContextPipeline();
        this.orchestrator = new AgentOrchestrator();
        this.hybridOrchestrator = new HybridOrchestrator();
        this.executor = new AgentExecutor(agentRegistry);

        // Break circular dependencies by injecting runner into batcher and orchestration
        const runner = this.runAgent.bind(this);
        if (maestroBatchingService && typeof maestroBatchingService.setRunner === 'function') {
            maestroBatchingService.setRunner(runner);
        }

        // Pre-warm agents in the background (non-blocking)
        this.warmup();
    }

    /**
     * Pre-warm critical agents. Call this on app startup for better first-message latency.
     */
    async warmup(): Promise<void> {
        if (this.isWarmedUp) return;

        try {
            await agentRegistry.warmup();
            this.isWarmedUp = true;
        } catch (e: unknown) {
            logger.warn('[indii:Service] Warmup failed, will retry on first message:', e);
        }
    }

    /**
     * Sends a message to the agent system, handling context resolution and orchestration.
     * @param text The user's input text.
     * @param attachments Optional file attachments (images/PDFs).
     * @param forcedAgentId Optional specific agent to use, bypassing orchestration.
     */
    async sendMessage(
        text: string,
        attachments?: { mimeType: string; base64: string }[],
        forcedAgentId?: string,
        options?: { source?: 'desktop' | 'mobile-remote' | 'background' | 'api' }
    ): Promise<void> {
        if (this.isProcessing) return;
        this.isProcessing = true;

        // Ensure agents are warmed up before processing (non-blocking if already done)
        if (!this.isWarmedUp) {
            await this.warmup();
        }

        // PII Redaction for Agent/LLM Input AND Storage
        // We redact BEFORE storage to prevent PII from leaking into the Context Pipeline via chat history.
        const redactedText = this.redactPII(text);
        if (redactedText !== text) {
            logger.debug("🔒 PII Detected and Redacted from Agent Input");
        }

        // Detect generation requests for longer timeout AND caching exclusion
        const isGenerationRequest = /\b(generate|create|make|build)\b.*\b(image|video|asset|art|visual)\b/i.test(text);

        // Add User Message (Redacted)
        const userMsg: AgentMessage = {
            id: uuidv4(),
            role: 'user',
            text: redactedText,
            timestamp: Date.now(),
            attachments,
            source: options?.source || 'desktop',
        };
        const { useStore } = await import('@/core/store');
        const state = useStore.getState();
        const isBoardroomMode = state.isBoardroomMode;

        if (isBoardroomMode) {
            useStore.getState().addBoardroomMessage(userMsg);
        } else {
            useStore.getState().addAgentMessage(userMsg);
        }

        // Tier 2: Index user message for semantic recall (Episodic Indexing)
        if (state.currentProjectId && state.activeSessionId && redactedText.length > 10) {
            memoryService.saveMemory(
                state.currentProjectId,
                redactedText,
                'session_message',
                0.4,
                'user',
                state.activeSessionId
            ).catch(err => logger.warn('[AgentService] Failed to index user message:', err));
        }

        // Cache Check (Item 36): Only cache small conversational/lookup queries, not generation requests
        const cacheKey = `${state.activeSessionId}:${redactedText.toLowerCase().trim()}`;
        if (this.responseCache.has(cacheKey) && !isGenerationRequest) {
            const cached = this.responseCache.get(cacheKey)!;
            logger.debug(`[AgentService] ⚡ Cache Hit: ${cacheKey}`);

            const responseId = uuidv4();
            const msgPayload: AgentMessage = {
                id: responseId,
                role: 'model',
                text: cached.text,
                thoughts: cached.thoughts,
                timestamp: Date.now(),
                isStreaming: false,
                agentId: cached.agentId
            };

            if (isBoardroomMode) {
                useStore.getState().addBoardroomMessage(msgPayload);
            } else {
                useStore.getState().addAgentMessage(msgPayload);
            }
            this.isProcessing = false;
            return;
        }

        try {
            // 1. Resolve Context
            const context = await this.contextPipeline.buildContext();

            // 2. Workflow Coordination (The Brain)
            const responseId = uuidv4();
            const msgPayload: AgentMessage = {
                id: responseId,
                role: 'model',
                text: '',
                timestamp: Date.now(),
                isStreaming: true,
                thoughts: [],
                agentId: 'generalist' // Default initially
            };

            if (isBoardroomMode) {
                useStore.getState().addBoardroomMessage(msgPayload);
            } else {
                useStore.getState().addAgentMessage(msgPayload);
            }

            // Create a timeout controller
            const timeoutMs = isGenerationRequest ? 600000 : 300000; // 10 min for generation, 5 min otherwise

            // Track gallery state before execution for timeout grace check
            const galleryCountBefore = useStore.getState().generatedHistory?.length || 0;

            let timeoutHandle: ReturnType<typeof setTimeout>;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error(`Indii Timeout: No response received after ${timeoutMs / 1000}s.`)), timeoutMs);
            });

            try {
                // Main execution logic wrapped in a race with timeout
                await Promise.race([
                    this.executeFlow(redactedText, attachments, context, responseId, forcedAgentId).then(() => {
                        // After success, populate cache if not a generation request
                        if (!isGenerationRequest) {
                            const resultMsg = useStore.getState().agentHistory.find(m => m.id === responseId);
                            if (resultMsg && resultMsg.text) {
                                this.responseCache.set(cacheKey, {
                                    text: resultMsg.text,
                                    thoughts: resultMsg.thoughts || [],
                                    agentId: resultMsg.agentId || 'generalist'
                                });
                            }
                        }
                    }).finally(() => {
                        if (timeoutHandle) clearTimeout(timeoutHandle);
                    }),
                    timeoutPromise
                ]);
            } catch (err: unknown) {
                logger.error('[AgentService] Message Flow Failed:', err);

                // TIMEOUT GRACE: Check if images were added to gallery during execution
                const galleryCountAfter = useStore.getState().generatedHistory?.length || 0;
                const newItemsGenerated = galleryCountAfter > galleryCountBefore;

                const errorMessage = err instanceof Error ? err.message : String(err);

                const { updateAgentMessage, updateBoardroomMessage } = useStore.getState();
                const updateMsg = (id: string, updates: Partial<AgentMessage>) => {
                    if (isBoardroomMode) updateBoardroomMessage(id, updates);
                    else updateAgentMessage(id, updates);
                };

                if (errorMessage.includes('Timeout')) {
                    if (newItemsGenerated) {
                        // Case A: Items were found in gallery (already handled by logic above, but keeping for clarity)
                        logger.debug('[AgentService] Timeout grace: Generation detected in gallery');
                        updateMsg(responseId, {
                            text: `✅ **Generation Complete!** ${galleryCountAfter - galleryCountBefore} new item(s) added to your Gallery.`,
                            thoughts: [{
                                id: uuidv4(),
                                text: 'Synthesis successful',
                                timestamp: Date.now(),
                                type: 'logic'
                            }]
                        });
                    } else if (isGenerationRequest) {
                        // Case B: Generation request but no items yet - show "Taking longer" message
                        logger.debug('[AgentService] Timeout nudge: Showing "taking longer" message');
                        updateMsg(responseId, {
                            text: `⏳ **Still working on it...** The synthesis is taking a bit longer than expected, but I'm still processing your request in the background. Keep an eye on your Gallery - your assets will appear there shortly!`,
                            thoughts: [{
                                id: uuidv4(),
                                text: 'Background processing continues',
                                timestamp: Date.now(),
                                type: 'logic'
                            }]
                        });
                    } else {
                        // Case C: Standard timeout
                        updateMsg(responseId, {
                            text: `❌ **Timeout:** The request is taking longer than expected (${timeoutMs / 1000}s). If you're generating high-res assets, they may still appear in your Gallery soon.`,
                            thoughts: [{
                                id: uuidv4(),
                                text: 'Request exceeded time limit',
                                timestamp: Date.now(),
                                type: 'error'
                            }]
                        });
                    }
                } else {
                    // Non-timeout error (API failure, etc)
                    updateMsg(responseId, {
                        text: `❌ **Error:** ${(err as Error).message || 'The request failed.'}`,
                        thoughts: [{
                            id: uuidv4(),
                            text: 'Execution failed',
                            timestamp: Date.now(),
                            type: 'error'
                        }]
                    });
                }
            } finally {
                // CRITICAL: Always clear streaming state to avoid stuck "..." loading
                const { updateAgentMessage, updateBoardroomMessage } = useStore.getState();
                if (isBoardroomMode) updateBoardroomMessage(responseId, { isStreaming: false });
                else updateAgentMessage(responseId, { isStreaming: false });
            }
        } catch (e: unknown) {
            const errObj = e instanceof Error ? e : new Error(String(e));
            this.addSystemMessage(`❌ **Fatal Error:** ${errObj.message || 'Unknown error occurred.'}`);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Internal execution flow for sendMessage, separated for timeout racing.
     */
    private async executeFlow(
        text: string,
        attachments: { mimeType: string; base64: string }[] | undefined,
        context: AgentContext,
        responseId: string,
        forcedAgentId?: string
    ): Promise<void> {
        const { useStore } = await import('@/core/store');
        const { updateAgentMessage, activeAgentProvider } = useStore.getState();

        // 0. Direct Chat: Bypass all orchestration, talk straight to the LLM
        if (activeAgentProvider === 'direct') {
            await this.handleDirectChatFlow(text, attachments, context, responseId);
            return;
        }

        const state = useStore.getState();
        const isBoardroomMode = state.isBoardroomMode;

        // Boardroom Multi-Dispatch
        if (isBoardroomMode) {
            await this.handleBoardroomMultiDispatchFlow(text, attachments, context, responseId);
            return;
        }

        // 1. Resolve Active Agent ID if not forced
        let agentId = forcedAgentId;

        if (!agentId) {
            const state = useStore.getState();
            const session = state.sessions?.[state.activeSessionId || ''];
            agentId = session?.participants?.[0] || 'generalist';
        }

        // 2. Delegate directly to the Agent Executor (indii Conductor handles routing natively)

        // Update agent ID in the placeholder (Native/Agent path)
        updateAgentMessage(responseId, { agentId });

        let currentStreamedText = '';

        // Pass REDACTED text to the executor
        const result = await this.executor.execute(agentId || 'generalist', text, context as PipelineContext, (event) => {
            if (event.type === 'token') {
                currentStreamedText += event.content;
                updateAgentMessage(responseId, { text: currentStreamedText });
            }

            if (event.type === 'thought' || event.type === 'tool' || event.type === 'tool_result') {
                const currentMsg = useStore.getState().agentHistory.find(m => m.id === responseId);

                // Firestore explicitly rejects 'undefined' values. We must sanitize.
                const newThought: AgentThought = {
                    id: uuidv4(),
                    text: event.content || '', // Ensure no undefined text
                    timestamp: Date.now(),
                    type: event.type as AgentThought["type"], // Typed in interface
                };

                if (event.type === 'tool' || event.type === 'tool_result') {
                    if (event.toolName) {
                        newThought.toolName = event.toolName;
                    }
                }

                // AGGRESSIVE SANITIZATION: Firestore chokes on undefined.
                const safeThought = JSON.parse(JSON.stringify(newThought));

                if (currentMsg) {
                    updateAgentMessage(responseId, {
                        thoughts: [...(currentMsg.thoughts || []), safeThought]
                    });
                }
            }
        }, undefined, undefined, attachments);

        if (result && result.text) {
            // Final update with full text and signature
            updateAgentMessage(responseId, {
                text: result.text,
                thoughtSignature: result.thoughtSignature
            });

            // Tier 2: Index model response for semantic recall
            const state = useStore.getState();
            if (state.currentProjectId && state.activeSessionId && result.text.length > 20) {
                memoryService.saveMemory(
                    state.currentProjectId,
                    result.text,
                    'session_message',
                    0.4,
                    'agent',
                    state.activeSessionId
                ).catch(err => logger.warn('[AgentService] Failed to index agent response:', err));
            }
        } else {
            updateAgentMessage(responseId, {
                thoughtSignature: result?.thoughtSignature
            });
        }
    }

    /**
     * Boardroom Multi-Dispatch Flow: Dispatches the user's prompt to all active agents simultaneously.
     */
    private async handleBoardroomMultiDispatchFlow(
        text: string,
        attachments: { mimeType: string; base64: string }[] | undefined,
        context: AgentContext,
        initialResponseId: string
    ): Promise<void> {
        const { useStore } = await import('@/core/store');
        const state = useStore.getState();
        const activeAgents = state.activeAgents && state.activeAgents.length > 0 ? state.activeAgents : [];
        const referencedAssets = state.referencedAssets || [];

        if (activeAgents.length === 0) {
            useStore.getState().updateBoardroomMessage(initialResponseId, {
                agentId: 'system',
                text: '*(Please drag at least one agent onto the table to begin the discussion.)*',
                isStreaming: false
            });
            return;
        }

        // Inject asset context into the prompt
        let assetContext = '';
        if (referencedAssets.length > 0) {
            assetContext = '\n\n[BOARDROOM REFERENCED ASSETS]\n' + referencedAssets.map(a => `- ${a.name} (${a.type}): ${a.value}`).join('\n');
        }

        const enhancedText = text + assetContext + '\n\n[SYSTEM]: You are in a Boardroom meeting with other agents. Only respond from your specific department\'s perspective. Extract and execute any tasks relevant to your domain.';

        const dispatchPromises = activeAgents.map(async (agentId, index) => {
            // Re-use the initial placeholder for the first agent, create new ones for the rest
            const resId = index === 0 ? initialResponseId : uuidv4();

            if (index > 0) {
                useStore.getState().addBoardroomMessage({
                    id: resId,
                    role: 'model',
                    text: '*(Reviewing request...)*',
                    timestamp: Date.now() + index, // slight offset to maintain order
                    isStreaming: true,
                    thoughts: [],
                    agentId: agentId
                });
            } else {
                useStore.getState().updateBoardroomMessage(resId, { agentId, text: '*(Reviewing request...)*' });
            }

            let currentStreamedText = '';

            try {
                const result = await this.executor.execute(
                    agentId,
                    enhancedText,
                    context as PipelineContext,
                    (event) => {
                        if (event.type === 'token') {
                            currentStreamedText += event.content;
                            useStore.getState().updateBoardroomMessage(resId, { text: currentStreamedText });
                        }
                        if (event.type === 'thought' || event.type === 'tool' || event.type === 'tool_result') {
                            const currentMsg = useStore.getState().boardroomMessages.find(m => m.id === resId);
                            const newThought: AgentThought = {
                                id: uuidv4(),
                                text: event.content || '',
                                timestamp: Date.now(),
                                type: event.type as AgentThought["type"],
                            };
                            if (event.type === 'tool' || event.type === 'tool_result') {
                                if (event.toolName) newThought.toolName = event.toolName;
                            }

                            if (currentMsg) {
                                useStore.getState().updateBoardroomMessage(resId, {
                                    thoughts: [...(currentMsg.thoughts || []), JSON.parse(JSON.stringify(newThought))]
                                });
                            }
                        }
                    },
                    undefined,
                    undefined,
                    attachments
                );

                if (result && result.text) {
                    useStore.getState().updateBoardroomMessage(resId, {
                        text: result.text,
                        thoughtSignature: result.thoughtSignature,
                        isStreaming: false
                    });
                } else {
                    const hasToolCalls = result && result.toolCalls && result.toolCalls.length > 0;
                    useStore.getState().updateBoardroomMessage(resId, {
                        text: hasToolCalls ? '*(Executed tasks but provided no summary.)*' : '*(No observations or actions required from this department.)*',
                        thoughtSignature: result?.thoughtSignature,
                        isStreaming: false
                    });
                }
            } catch (err) {
                logger.error(`[AgentService] Boardroom dispatch failed for agent ${agentId}:`, err);
                useStore.getState().updateBoardroomMessage(resId, {
                    text: `❌ **Error:** ${(err as Error).message || 'Request failed.'}`,
                    isStreaming: false,
                    thoughts: [{
                        id: uuidv4(),
                        text: 'Execution failed in boardroom dispatch',
                        timestamp: Date.now(),
                        type: 'error'
                    }]
                });
            }
        });

        await Promise.allSettled(dispatchPromises);
    }

    /**
     * Direct Chat Flow: Bypasses all orchestration and talks straight to the LLM.
     * Uses FirebaseAIService streaming for low-latency conversational responses.
     * No tools, no specialist agents, no context pipeline overhead.
     */
    private async handleDirectChatFlow(
        text: string,
        attachments: { mimeType: string; base64: string }[] | undefined,
        context: AgentContext,
        responseId: string
    ): Promise<void> {
        const { useStore } = await import('@/core/store');
        const { updateAgentMessage, agentHistory } = useStore.getState();

        // Build persona-aware system prompt from context
        // Guard against default/placeholder names that haven't been updated
        let artistName = context.userProfile?.displayName || '';
        const isDefaultName = !artistName || artistName === 'New Artist' || artistName === 'pending';

        // If the stored displayName is the generic default, try Firebase Auth's displayName
        if (isDefaultName) {
            try {
                const { auth } = await import('@/services/firebase');
                const authUser = auth.currentUser;
                if (authUser?.displayName && authUser.displayName !== 'New Artist') {
                    artistName = authUser.displayName;
                } else if (authUser?.email) {
                    // Extract name from email as last resort (e.g., "john.doe@gmail.com" → "john doe")
                    const emailName = authUser.email.split('@')[0]!.replace(/[._-]+/g, ' ');
                    // Only use if it looks like a real name (more than 2 chars, not all numbers)
                    if (emailName.length > 2 && !/^\d+$/.test(emailName)) {
                        artistName = emailName;
                    } else {
                        artistName = ''; // No usable name found
                    }
                }
            } catch {
                artistName = ''; // Auth not available
            }
        }

        const brandDesc = context.brandKit?.brandDescription || '';
        const genre = context.brandKit?.releaseDetails?.genre || '';

        let personaContext = '';
        if (artistName && !isDefaultName) {
            personaContext += `\nYou are working with the artist **${artistName}**.`;
            personaContext += ` ALWAYS use this exact name when referring to the artist. NEVER invent a different name.`;
        } else if (artistName) {
            // We derived a name from auth but it wasn't explicitly set — use it but less forcefully
            personaContext += `\nThe user's name appears to be **${artistName}** (from their account).`;
            personaContext += ` Use this name when addressing them. If they provide a different artist/brand name, use that instead.`;
        } else {
            // No name available at all
            personaContext += `\nThe user has not set their artist name yet.`;
            personaContext += ` Do NOT call them "New Artist" or invent a name. Address them directly (e.g., "you", "your") or ask what name they go by.`;
        }
        if (brandDesc) personaContext += `\nBrand: ${brandDesc}`;
        if (genre) personaContext += `\nGenre: ${genre}`;

        // Retrieve Knowledge Base context if enabled — even in direct chat mode,
        // the user's uploaded documents and memories should be available.
        let knowledgeContext = '';
        const state = useStore.getState();
        if (state.isKnowledgeBaseEnabled) {
            try {
                const { ContextPipeline } = await import('./components/ContextPipeline');
                const pipeline = new ContextPipeline();
                const pipelineContext = await pipeline.buildContext();
                if (pipelineContext.memoryContext && pipelineContext.memoryContext.trim()) {
                    knowledgeContext = `\n\nKNOWLEDGE BASE CONTEXT (from the artist's uploaded files and project data):\n${pipelineContext.memoryContext}`;
                }
            } catch (kbErr: unknown) {
                logger.warn('[AgentService] Knowledge Base retrieval failed in direct chat, continuing without:', kbErr);
            }
        }

        const systemPrompt = `You are indii, a creative assistant for independent music artists and creators.${personaContext}${knowledgeContext}

Be direct, creative, and helpful. You are in direct chat mode — respond conversationally without using any tools or complex orchestration.
When answering questions, use the Knowledge Base context (if available) to provide personalized, grounded responses about the artist's projects, files, and data.
If the user asks you to do something that requires active tools (like generating images, running automations, or managing live projects), suggest they switch to Agent mode for that task.`;

        // Build chat history for multi-turn context (last 20 messages)
        // Note: Filter out the current message which should be the last entry
        const recentHistory = agentHistory
            .filter(m => (m.role === 'user' || m.role === 'model') && m.text && m.text.trim() !== '')
            .slice(-21) // Take 21 to ensure we have 20 after removing current
            .slice(0, -1) // Exclude the current user message (last entry)
            .map(m => ({
                role: m.role as 'user' | 'model',
                parts: [{ text: m.text }]
            }));

        // Build the prompt contents: history + current message
        const currentMessagePart: { role: 'user'; parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> } = { role: 'user' as const, parts: [{ text }] };

        // Handle image attachments inline
        if (attachments && attachments.length > 0) {
            for (const att of attachments) {
                currentMessagePart.parts.push({
                    inlineData: { mimeType: att.mimeType, data: att.base64 }
                });
            }
        }

        const contents = [
            ...recentHistory,
            currentMessagePart
        ];

        try {
            const { stream } = await GenAI.generateContentStream(
                contents,
                AI_MODELS.TEXT.FAST,
                undefined,
                systemPrompt
            );

            // Consume the ReadableStream and stream tokens to UI
            const reader = stream.getReader();
            let accumulatedText = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunkText = typeof value.text === 'function' ? value.text() : '';
                    if (chunkText) {
                        accumulatedText += chunkText;
                        updateAgentMessage(responseId, { text: accumulatedText });
                    }
                }
            } finally {
                reader.releaseLock();
            }

            // Final update
            updateAgentMessage(responseId, {
                text: accumulatedText || 'No response generated.',
                thoughts: [{
                    id: crypto.randomUUID(),
                    text: 'Direct Chat (Fast Path)',
                    timestamp: Date.now(),
                    type: 'logic',
                    toolName: 'Direct LLM'
                }]
            });
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            updateAgentMessage(responseId, {
                text: `Chat Error: ${errorMessage}`,
                thoughts: [{
                    id: crypto.randomUUID(),
                    text: 'Direct chat failed',
                    timestamp: Date.now(),
                    type: 'error'
                }]
            });
            throw err;
        }
    }

    /**
     * Programmatically runs an agent for internal tasks.
     * @param agentId The ID of the agent to execute.
     * @param task The task description.
     * @param parentContext Optional parent context to inherit.
     * @param parentTraceId Optional trace ID for observability chaining.
     * @param attachments Optional file attachments.
     */
    async runAgent(agentId: string, task: string, parentContext?: AgentContext, parentTraceId?: string, attachments?: { mimeType: string; base64: string }[]): Promise<{ text: string; thoughtSignature?: string }> {
        // CRITICAL: Deep clone context to prevent mutation affecting parent agent
        let context: AgentContext;

        if (parentContext) {
            // Deep clone to isolate execution contexts
            try {
                context = structuredClone(parentContext);
            } catch (_e: unknown) {
                context = { ...parentContext };
            }

            // Ensure Living Context is present
            if (!context.livingContext) {
                const { auth } = await import('@/services/firebase');
                if (auth.currentUser) {
                    const { livingFileService } = await import('./living/LivingFileService');
                    context.livingContext = await livingFileService.injectContext(auth.currentUser.uid);
                }
            }

            // Phase 3: Semantic Retrieval Integration
            const projectId = context.projectId || (await import('@/core/store')).useStore.getState().currentProjectId;
            if (projectId && !context.memoryContext) {
                try {
                    logger.debug(`[AgentService] Searching for relevant memories for task: "${task.substring(0, 50)}..."`);
                    const memories = await memoryService.retrieveRelevantMemories(projectId, task, 5);
                    if (memories && memories.length > 0) {
                        context.relevantMemories = memories;
                        context.memoryContext = memories
                            .map(m => `- ${m}`)
                            .join('\n');
                        logger.debug(`[AgentService] Injected ${memories.length} memories into context.`);
                    }
                } catch (e: unknown) {
                    logger.warn('[AgentService] Semantic retrieval failed (non-blocking):', e);
                }
            }

            // Restore non-serializable properties
            if (parentContext.chatHistory) {
                context.chatHistory = [...parentContext.chatHistory];
            }
            if (parentContext.attachments) {
                context.attachments = [...parentContext.attachments];
            }
        } else {
            context = await this.contextPipeline.buildContext();
        }

        // Ensure minimal context exists
        if (!context.chatHistory) context.chatHistory = [];
        if (!context.chatHistoryString) context.chatHistoryString = '';

        // Hub and Spoke: Inject runner for intra-agent delegation
        context.runAgent = this.runAgent.bind(this);

        return await this.executor.execute(
            agentId,
            task,
            context as PipelineContext,
            undefined,
            undefined,
            parentTraceId,
            attachments || context.attachments
        );
    }

    private async addSystemMessage(text: string): Promise<void> {
        const { useStore } = await import('@/core/store');
        useStore.getState().addAgentMessage({ id: uuidv4(), role: 'system', text, timestamp: Date.now() });
    }

    /**
     * Redacts sensitive information from the input text before sending it to the LLM.
     */
    private redactPII(text: string): string {
        const creditCardRegex = /\b(?:\d[ -]*?){13,16}\b/g;
        const passwordRegex = /(password(?:\s+is)?[:\s=]+)([^\s.,;!]+)/gi;

        let redacted = text.replace(creditCardRegex, (match) => {
            if (match.replace(/\D/g, '').length < 13) return match;
            return '[REDACTED_CREDIT_CARD]';
        });

        redacted = redacted.replace(passwordRegex, (match, prefix, _value) => {
            return `${prefix}[REDACTED_PASSWORD]`;
        });

        return redacted;
    }
}

export const agentService = new AgentService();
