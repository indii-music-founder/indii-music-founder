import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import type { AgentMessage, AgentThought } from '@/core/store';
import { auth } from '@/services/firebase';
import { agentFirebaseConnector } from '@/services/agent/AgentFirebaseConnector';
import { ContextPipeline, PipelineContext } from './components/ContextPipeline';
import { AgentOrchestrator } from './components/AgentOrchestrator';
import { AgentExecutor } from './components/AgentExecutor';
import { AgentContext, type AgentResponse, type BoardroomDispatchTask } from './types';
import { agentRegistry } from './registry';
import { livingPlanService } from './LivingPlanService';

// Workflow coordinator removed for indii Conductor standard routing
import { maestroBatchingService } from './MaestroBatchingService';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { agentGraphService } from './orchestration/AgentGraphService';
import { agentGraphStateService } from './orchestration/AgentGraphStateService';
import { AgentGraph } from './types';
import { moduleImportCache } from './ModuleImportCache';
import { importWithRetry } from '@/utils/dynamicImport';
import {
    finalizePersonaAgentResponse,
    type PersonaAgentResponseFinalizer,
} from '@/services/persona/PersonaAgentResponseService';
import {
    PERSONA_RESPONSE_METADATA_KEY,
    getPersonaResponseMetadata,
} from '@/services/persona/PersonaResponseMetadata';

/**
 * Per-send options. `conversationModeOverride` + `targetOverride` exist for
 * remote-originated sends: the phone picks Boardroom / Department / Direct +
* agent in ITS UI, and without an explicit override the run silently followed
 * whatever mode the desktop Studio happened to be sitting in.
 */
export interface AgentSendOptions {
    source?: 'desktop' | 'mobile-remote' | 'background' | 'api';
    originalBrief?: string;
    /** Remote mode selection; validated against the three concrete T1 modes before use. */
    conversationModeOverride?: 'boardroom' | 'department' | 'direct';
    /** Agent (direct) or department id chosen by the remote sender. */
    targetOverride?: string;
}

/** Guard so a malformed relay payload can never select an execution path. */
export function resolveRemoteConversationMode(raw: unknown): AgentSendOptions['conversationModeOverride'] | undefined {
    return raw === 'boardroom' || raw === 'department' || raw === 'direct' ? raw : undefined;
}

/**
 * AgentService is the primary entry point for agent-related operations.
 * It manages the lifecycle of user messages, context resolution, orchestration, and execution.
 */
export class AgentService {
    private isProcessing = false;
    /**
     * True while a run is active. Callers that need to distinguish accepted
     * from queued work must use sendMessage()'s explicit return disposition;
     * this mutable snapshot is only for preflight UI/dispatch guards.
     */
    get isAgentBusy(): boolean {
        return this.isProcessing;
    }
    /**
     * Bounded FIFO queue for messages typed while a previous run is still
     * finishing in the background (its timeout fired but the flow kept
     * executing). Queued messages are dispatched in order when the run
     * settles — otherwise the timeout isolation change would silently drop
     * user input for up to a full run duration. This was a single slot, which
     * silently discarded every queued message except the most recent one.
     */
    private static readonly MAX_PENDING_SENDS = 25;
    private pendingSends: {
        text: string;
        attachments?: { mimeType: string; base64: string }[];
        forcedAgentId?: string;
        options?: AgentSendOptions;
    }[] = [];
    private isWarmedUp = false;
    private contextPipeline: ContextPipeline;
    private orchestrator: AgentOrchestrator;
    private executor: AgentExecutor;
    private responseCache = new Map<string, { text: string; thoughts: AgentThought[]; agentId: string }>();
    private syncDebounceTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
    private useStoreCache?: typeof import('@/core/store').useStore;

    private async getStore(): Promise<typeof import('@/core/store').useStore> {
        if (!this.useStoreCache) {
            const { useStore } = await moduleImportCache.import('@/core/store', () => import('@/core/store'));
            this.useStoreCache = useStore;
        }
        return this.useStoreCache;
    }

    private debounceSyncMessage(resId: string, getMsg: () => AgentMessage | undefined) {
        if (this.syncDebounceTimeouts.has(resId)) {
            clearTimeout(this.syncDebounceTimeouts.get(resId)!);
        }

        const timeout = setTimeout(() => {
            this.syncDebounceTimeouts.delete(resId);
            const msg = getMsg();
            if (msg) {
                agentFirebaseConnector.syncMessage(msg).catch(err =>
                    logger.error(`[AgentService] Swarm debounced sync failed for ${resId}:`, err)
                );
            }
        }, 300);

        this.syncDebounceTimeouts.set(resId, timeout);
    }

    private flushSyncMessage(resId: string, getMsg: () => AgentMessage | undefined) {
        if (this.syncDebounceTimeouts.has(resId)) {
            clearTimeout(this.syncDebounceTimeouts.get(resId)!);
            this.syncDebounceTimeouts.delete(resId);
        }
        const msg = getMsg();
        if (msg) {
            agentFirebaseConnector.syncMessage(msg).catch(err =>
                logger.error(`[AgentService] Swarm final sync failed for ${resId}:`, err)
            );
        }
    }

    /**
     * Append a run message to the session the run started in. The model
     * message is appended after awaits during which the user can switch
     * sessions, so the explicit-session append is what keeps a run's
     * conversation intact. Falls back to the active-session append (which
     * creates a session if none exists) only when the run had no session.
     */
    private appendRunMessage(
        store: typeof import('@/core/store').useStore,
        msg: AgentMessage,
        runSessionId: string | null,
    ): void {
        if (runSessionId) {
            store.getState().addMessageToSession(runSessionId, msg);
        } else {
            store.getState().addAgentMessage(msg);
        }
    }


    constructor(
        private readonly personaResponseFinalizer: PersonaAgentResponseFinalizer = finalizePersonaAgentResponse,
    ) {
        // Components initialized. Agents are auto-registered in AgentRegistry singleton.
        this.contextPipeline = new ContextPipeline();
        this.orchestrator = new AgentOrchestrator();
        this.executor = new AgentExecutor(agentRegistry);

        // Break circular dependencies by injecting runner into batcher and orchestration
        const runner = this.runAgent.bind(this);
        if (maestroBatchingService && typeof maestroBatchingService.setRunner === 'function') {
            maestroBatchingService.setRunner(runner);
        }

        // Pre-warm agents in the background (non-blocking)
        if (typeof process !== 'undefined' && process.env && (process.env.VITEST || process.env.NODE_ENV === 'test')) {
            logger.debug('[AgentService] Skipping warmup in test environment');
        } else {
            this.warmup();
        }
    }

    private async applyCompletedResponse(
        agentId: string,
        question: string,
        responseId: string,
        response: AgentResponse,
        updateAgentMessage: (id: string, updates: Partial<AgentMessage>) => void,
        getCurrentMessage: () => AgentMessage | undefined,
        additionalUpdates: Partial<AgentMessage> = {},
        onMeasurementSettled?: (message: AgentMessage) => void,
    ): Promise<string> {
        const finalized = await this.personaResponseFinalizer({
            agentId,
            question,
            responseId,
            response,
        });

        const currentMetadata = getCurrentMessage()?.metadata;
        const initialUpdate: Partial<AgentMessage> = {
            ...additionalUpdates,
            text: finalized.text,
            thoughtSignature: response.thoughtSignature,
            ...(finalized.tracking ? {
                metadata: {
                    ...(currentMetadata || {}),
                    [PERSONA_RESPONSE_METADATA_KEY]: finalized.tracking,
                },
            } : {}),
        };
        updateAgentMessage(responseId, initialUpdate);

        if (finalized.tracking && finalized.measurementRecorded) {
            void finalized.measurementRecorded.then((recorded) => {
                const latestMessage = getCurrentMessage();
                const latestTracking = getPersonaResponseMetadata(latestMessage?.metadata);
                if (latestTracking?.responseId !== responseId) return;

                updateAgentMessage(responseId, {
                    metadata: {
                        ...(latestMessage?.metadata || {}),
                        [PERSONA_RESPONSE_METADATA_KEY]: {
                            ...latestTracking,
                            measurementStatus: recorded ? 'recorded' : 'failed',
                        },
                    },
                });

                const settledMessage = getCurrentMessage();
                if (settledMessage) onMeasurementSettled?.(settledMessage);
            }).catch((error) => {
                logger.warn('[AgentService] Persona measurement status could not be persisted.', {
                    agentId,
                    reason: error instanceof Error ? error.name : 'unknown',
                });
            });
        }

        return finalized.text;
    }

    clearAccountBoundary(): void {
        this.responseCache.clear();
        this.syncDebounceTimeouts.forEach(timeout => clearTimeout(timeout));
        this.syncDebounceTimeouts.clear();
        this.isProcessing = false;
        // A queued message belongs to the previous account's session — it must
        // never be dispatched after a boundary switch.
        this.pendingSends = [];
    }

    /**
     * Returns true for short conversational inputs that carry no domain intent
     * and should skip both orchestration LLM calls to eliminate cold-start latency.
     *
     * Criteria:
     *   - ≤ 6 words AND matches a known trivial pattern (greetings, acks, filler), OR
     *   - ≤ 3 words unconditionally (too short to require routing).
     *
     * This is intentionally conservative — false negatives (routing a greeting through
     * orchestration) are acceptable; false positives (skipping routing for a real query)
     * are not. Domain-specific keywords (e.g. "contract", "distribute", "register")
     * never appear in trivial inputs.
     */
    static isTrivialInput(text: string): boolean {
        const trimmed = text.trim();
        const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

        // Always fast-path very short inputs (≤3 words can't encode real domain intent)
        if (wordCount <= 3) return true;

        // For 4–6 word inputs, require a known trivial pattern
        if (wordCount <= 6) {
            const lower = trimmed.toLowerCase();
            const trivialPatterns = [
                /^(hi|hey|hello|howdy|sup|what'?s up|yo)\b/,
                /^(thanks?|thank you|thx|ty|appreciated?)\b/,
                /^(ok|okay|got it|sounds good|perfect|great|cool|awesome|nice|alright)\b/,
                /^(yes|yeah|yep|yup|no|nope|nah|sure)\b/,
                /^(good morning|good afternoon|good evening|good night)\b/,
                /^(how are you|how'?s it going|what'?s new|how do you do)\b/,
                /^(bye|goodbye|see you|later|talk soon|ttyl)\b/,
                /^(lol|haha|lmao|😂|😊|👋|🙏)\b/,
            ];
            return trivialPatterns.some(p => p.test(lower));
        }

        return false;
    }

    /**
     * Returns an instant, zero-latency greeting string without any LLM call.
     * Incorporates time-of-day awareness and session absence context.
     *
     * @param agentId - The ID of the responding agent.
     * @param seatedAgentNames - Comma-separated names of agents seated (boardroom only).
     * @param mode - Current conversation mode for context framing.
     * @param lastMessageTimestamp - Optional timestamp of previous message to detect absence/return.
     */
    static buildInstantGreeting(
        agentId: string,
        seatedAgentNames?: string,
        mode?: string,
        lastMessageTimestamp?: number
    ): string {
        const agentName = agentRegistry.get(agentId)?.name || 'indii Conductor';
        const hour = new Date().getHours();
        const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        
        const isReturning = !lastMessageTimestamp || (Date.now() - lastMessageTimestamp > 2 * 60 * 60 * 1000);

        if (mode === 'boardroom' && seatedAgentNames) {
            if (isReturning) {
                return `${timeOfDay}! Good to have you back at the table. Seated today: **${seatedAgentNames}**. What's our agenda?`;
            }
            return `Hey! The board is assembled: **${seatedAgentNames}**. What would you like us to tackle?`;
        }

        if (isReturning) {
            return `${timeOfDay}! Good to hear from you — ${agentName} ready. What are we working on today?`;
        }

        const activeReplies = [
            `Hey! ${agentName} right here — what's next?`,
            `Right here! What do you need?`,
            `Hey! Let's keep moving — what are we tackling?`,
        ];
        return activeReplies[agentId.length % activeReplies.length]!;
    }

    private shouldCacheCompletedResponse(
        isGenerationRequest: boolean,
        message: AgentMessage | undefined,
    ): boolean {
        return Boolean(
            !isGenerationRequest &&
            message?.text &&
            !getPersonaResponseMetadata(message.metadata),
        );
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
        options?: AgentSendOptions
    ): Promise<'queued' | void> {
        if (this.isProcessing) {
            // A previous run may legitimately still be finishing in the
            // background after its timeout. Keep the message instead of
            // dropping it; it is dispatched when that run settles.
            if (this.pendingSends.length >= AgentService.MAX_PENDING_SENDS) {
                logger.warn('[AgentService] Pending-send queue full — rejecting newest message');
                throw new Error('Agent queue is full. Wait for the current task to finish.');
            }
            logger.warn('[AgentService] sendMessage queued: previous run still processing');
            this.pendingSends.push({ text, attachments, forcedAgentId, options });
            return 'queued';
        }
        this.isProcessing = true;

        let useStoreInstance: typeof import('@/core/store').useStore | null = null;
        let executionSignal: AbortSignal | undefined;
        // Declared at method scope so the outer finally can defer cleanup to
        // the flow's settlement (the flow can outlive the timeout race).
        let flowSettled = false;
        let flowPromise: Promise<void> | undefined;
        try {
            try {
                useStoreInstance = await this.getStore();
                const state = useStoreInstance.getState();
                if (typeof state.startAgentExecution === 'function') {
                    executionSignal = state.startAgentExecution();
                } else if (typeof state.setAgentProcessing === 'function') {
                    state.setAgentProcessing(true);
                }
            } catch (_) {
                // Silently ignore store loading issues here
            }

            // Ensure agents are warmed up before processing (non-blocking if already done)
            if (!this.isWarmedUp) {
                await this.warmup();
            }

            const activeUserId = auth.currentUser?.uid || null;
            if (!activeUserId) {
                this.addSystemMessage('Agent requests require an authenticated user.');
                return;
            }

            // PII Redaction for Agent/LLM Input AND Storage
            // We redact BEFORE storage to prevent PII from leaking into the Context Pipeline via chat history.
            const redactedText = this.redactPII(text);
            const originalBrief = options?.originalBrief || redactedText;
            if (redactedText !== text) {
                logger.debug("[SECURITY] PII Detected and Redacted from Agent Input");
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

            const store = useStoreInstance || await this.getStore();
            const state = store.getState();
            const isBoardroomMode = state.conversationMode === 'boardroom';
            logger.debug('[AgentService] sendMessage routing:', { isBoardroomMode });

            // The session this run started in. Everything the run appends —
            // user message, model message, streaming updates — must stay in
            // THIS conversation even if the user switches sessions mid-run.
            // (Updates are pinned by the slice's message→session registry;
            // the appends here must target the same session explicitly,
            // because the model message is appended after an await during
            // which the active session can change.)
            const runSessionId = state.activeSessionId ?? null;

            this.appendRunMessage(store, userMsg, runSessionId);

            // Tier 2: Index user message for semantic recall (Episodic Indexing)
            if (state.currentProjectId && state.activeSessionId && redactedText.length > 10) {
                const { alwaysOnMemoryEngine } = await importWithRetry(() => import('./memory/AlwaysOnMemoryEngine'));
                alwaysOnMemoryEngine.ingest(
                    redactedText,
                    'user_input',
                    'context'
                ).catch(err => logger.warn('[AgentService] Failed to index user message:', err));
            }

            // Cache Check (Item 36): Only cache small conversational/lookup queries, not generation requests
            const cacheKey = `${state.activeSessionId}:${redactedText.toLowerCase().trim()}`;
            if (this.responseCache.has(cacheKey) && !isGenerationRequest) {
                const cached = this.responseCache.get(cacheKey)!;
                logger.debug(`[AgentService] [CACHE] Cache Hit: ${cacheKey}`);

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
                    this.appendRunMessage(store, msgPayload, runSessionId);
                } else {
                    this.appendRunMessage(store, msgPayload, runSessionId);
                }
                const cacheHitState = store.getState();
                if (typeof cacheHitState.setAgentProcessing === 'function') {
                    cacheHitState.setAgentProcessing(false);
                }
                return;
            }

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
                this.appendRunMessage(store, msgPayload, runSessionId);
            } else {
                this.appendRunMessage(store, msgPayload, runSessionId);
            }

            // Create a timeout controller
            const timeoutMs = isGenerationRequest ? 600000 : 300000; // 10 min for generation, 5 min otherwise

            // Track gallery state before execution for timeout grace check
            const galleryCountBefore = store.getState().generatedHistory?.length || 0;

            let timeoutHandle: ReturnType<typeof setTimeout>;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error(`Indii Timeout: No response received after ${timeoutMs / 1000}s.`)), timeoutMs);
            });

            // The flow can legitimately outlive the race: when the timeout
            // wins, executeFlow keeps running in the background (a generation
            // may be seconds from finishing). Track its settlement so the
            // outer cleanup never runs while the run is still live — that
            // would kill the Stop button and allow a second concurrent run.
            flowSettled = false;
            flowPromise = this.executeFlow(redactedText, attachments, context, responseId, forcedAgentId, executionSignal, options).then(() => {
                const currentState = store.getState();
                const resultMsg = isBoardroomMode 
                    ? (currentState.agentHistory as AgentMessage[]).find(m => m.id === responseId)
                    : (currentState.agentHistory as AgentMessage[]).find(m => m.id === responseId);

                // After success, populate cache if not a generation request
                if (this.shouldCacheCompletedResponse(isGenerationRequest, resultMsg)) {
                    this.responseCache.set(cacheKey, {
                        text: resultMsg!.text,
                        thoughts: resultMsg!.thoughts || [],
                        agentId: resultMsg!.agentId || 'generalist'
                    });
                }

                // Trigger Autorater for feedback and fine-tuning registration
                if (resultMsg && auth.currentUser) {
                    this.triggerAutorater(
                        auth.currentUser.uid, 
                        resultMsg.agentId || 'generalist', 
                        responseId, 
                        isBoardroomMode
                    ).catch(e => logger.warn('[AgentService] Autorater execution error:', e));

                    // Phase 3: Trigger Visual Autorater for image tool completions
                    if (resultMsg.text && this.containsImageToolOutput(resultMsg)) {
                        this.triggerVisualAutorater(
                            resultMsg.text,
                            originalBrief,
                            resultMsg.agentId || 'generalist',
                            responseId,
                            isBoardroomMode
                        ).catch(e => logger.warn('[AgentService] Visual autorater error:', e));
                    }
                }
            }).finally(() => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                flowSettled = true;
            });

            try {
                // Main execution logic wrapped in a race with timeout
                await Promise.race([
                    flowPromise,
                    timeoutPromise
                ]);
            } catch (err: unknown) {
                logger.error('[AgentService] Message Flow Failed:', err);

                // TIMEOUT GRACE: Check if images were added to gallery during execution
                const galleryCountAfter = store.getState().generatedHistory?.length || 0;
                const newItemsGenerated = galleryCountAfter > galleryCountBefore;

                const errorMessage = err instanceof Error ? err.message : String(err);

                const { updateAgentMessage } = store.getState();
                const updateMsg = (id: string, updates: Partial<AgentMessage>) => {
                    updateAgentMessage(id, updates);
                };

                if (errorMessage.includes('Timeout')) {
                    if (newItemsGenerated) {
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
                        updateMsg(responseId, {
                            text: `⏳ **Still Thinking...** The Intelligence is diving deep into this one. It's taking longer than expected (${timeoutMs / 1000}s), but don't hit the panic button yet! Grab a coffee. If you're generating heavy assets, they're probably still cooking and will show up in your Gallery soon.`,
                            thoughts: [{
                                id: uuidv4(),
                                text: 'Request exceeded time limit',
                                timestamp: Date.now(),
                                type: 'error'
                            }]
                        });
                    }
                } else {
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
                const { updateAgentMessage } = store.getState();
                updateAgentMessage(responseId, { isStreaming: false });
            }
        } catch (e: unknown) {
            const errObj = e instanceof Error ? e : new Error(String(e));
            logger.error('[AgentService] Fatal Error in sendMessage:', e);
            this.addSystemMessage(`❌ **System Error:** ${errObj.message || 'Unknown error occurred.'}`);
        } finally {
            // Cleanup is owned by the FLOW, not by the race: if the timeout
            // fired first, executeFlow is still running in the background.
            // Resetting the processing flag or nulling the abort controller
            // here would kill the Stop button mid-run and let a second
            // concurrent run start. Defer cleanup until the flow settles.
            const cleanup = () => {
                this.isProcessing = false;
                if (useStoreInstance) {
                    try {
                        const state = useStoreInstance.getState();
                        if (typeof state.setAgentProcessing === 'function') {
                            state.setAgentProcessing(false);
                        }
                        useStoreInstance.setState({ agentAbortController: null });
                    } catch (e) {
                        logger.error('[AgentService] Failed to reset processing state:', e);
                    }
                } else {
                    this.getStore().then(store => {
                        const state = store.getState();
                        if (typeof state.setAgentProcessing === 'function') {
                            state.setAgentProcessing(false);
                        }
                        store.setState({ agentAbortController: null });
                    }).catch((e) => {
                        logger.error('[AgentService] Failed to reset processing state in getStore:', e);
                    });
                }
                const pending = this.pendingSends;
                this.pendingSends = [];
                for (const queued of pending) {
                    logger.info('[AgentService] Dispatching queued message after previous run settled.');
                    // Fire-and-forget on purpose: each drained message re-enters
                    // sendMessage, which either runs it now or re-queues it if
                    // another sender claimed the lock first.
                    void this.sendMessage(queued.text, queued.attachments, queued.forcedAgentId, queued.options);
                }
            };
            if (flowSettled || !flowPromise) {
                // Either the flow already settled, or sendMessage returned
                // early (auth gate, cache hit) before any flow started.
                cleanup();
            } else {
                flowPromise.then(cleanup, cleanup);
            }
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
        forcedAgentId?: string,
        signal?: AbortSignal,
        options?: AgentSendOptions
    ): Promise<void> {
        const useStore = await this.getStore();
        const state = useStore.getState();
        const { updateAgentMessage } = state;
        // Remote sends carry the sender's chosen mode; everything else keeps
        // following the desktop UI's own conversation mode.
        const isMobileRemote = options?.source === 'mobile-remote';
        const conversationMode = isMobileRemote
            ? options.conversationModeOverride ?? state.conversationMode
            : state.conversationMode;

        // Auto is a UI routing mode, not an agent-to-agent communication
        // permission. Concrete execution paths assign their existing T1 mode.
        context.conversationMode = conversationMode === 'orchestrated' ? undefined : conversationMode;
        context.runAgent = this.runAgent.bind(this);

        // 0. Dispatch by Mode — MUST be checked FIRST.
        if (conversationMode === 'boardroom') {
            logger.debug('[AgentService] Routing to boardroom multi-dispatch flow');
            const rawUserUtterance = this.sanitizeBoardroomUtterance(text);
            const boardroomTask: Readonly<BoardroomDispatchTask> = Object.freeze({
                rawUserUtterance,
            });
            await this.handleBoardroomSwarmFlow(
                boardroomTask,
                attachments,
                { ...context, boardroomTask },
                responseId,
                signal,
            );
            return;
        }

        if (conversationMode === 'department') {
            logger.debug('[AgentService] Routing to department flow');
            await this.handleDepartmentFlow(text, attachments, context, responseId, signal, options);
            return;
        }

        if (conversationMode === 'direct') {
            // A remote sender's explicitly chosen agent wins over whatever the
            // desktop UI last targeted directly.
            const targetAgentId = (
                isMobileRemote ? options.targetOverride ?? state.directTargetAgentId : state.directTargetAgentId
            ) || 'generalist';
            if (state.activeAgentProvider === 'direct' && targetAgentId === 'generalist') {
                logger.debug('[AgentService] Routing to direct chat flow (provider override) for generalist');
                await this.handleDirectChatFlow(text, attachments, context, responseId);
                return;
            }

            // Direct mode always means one explicitly selected agent.
            logger.debug(`[AgentService] Executing direct specialist agent: ${targetAgentId}`);
            updateAgentMessage(responseId, { agentId: targetAgentId });
            
            let currentStreamedText = '';
            const result = await this.executor.execute(targetAgentId, text, context as PipelineContext, (event) => {
                if (event.type === 'token') {
                    currentStreamedText += event.content;
                    updateAgentMessage(responseId, { text: currentStreamedText });
                }

                if (event.type === 'thought' || event.type === 'tool' || event.type === 'tool_result') {
                    const currentMsg = useStore.getState().agentHistory.find((m: AgentMessage) => m.id === responseId);
                    const newThought: AgentThought = {
                        id: uuidv4(),
                        text: event.content || '',
                        timestamp: Date.now(),
                        type: event.type as AgentThought["type"],
                    };

                    if (event.type === 'tool' || event.type === 'tool_result') {
                        if (event.toolName) newThought.toolName = event.toolName;
                    }

                    const safeThought = JSON.parse(JSON.stringify(newThought));
                    if (currentMsg) {
                        updateAgentMessage(responseId, {
                            thoughts: [...(currentMsg.thoughts || []), safeThought]
                        });
                    }
                }
            }, signal, undefined, attachments);

            if (result && result.text) {
                await this.applyCompletedResponse(
                    targetAgentId,
                    text,
                    responseId,
                    result,
                    updateAgentMessage,
                    () => useStore.getState().agentHistory.find((message: AgentMessage) => message.id === responseId),
                );
            } else {
                updateAgentMessage(responseId, {
                    thoughtSignature: result?.thoughtSignature
                });
            }
            return;
        }

        if (conversationMode === 'orchestrated') {
            logger.debug('[AgentService] Routing visible Auto mode through orchestration');
        }

        // 1. Resolve Orchestration Path
        let orchestration;
        // Auto always performs real routing. Module-aligned command bars may
        // still provide a legacy forced target, which must not bypass it.
        if (forcedAgentId && conversationMode !== 'orchestrated') {
            orchestration = { type: 'single' as const, agentId: forcedAgentId, reasoning: 'Forced by user' };
        } else if (AgentService.isTrivialInput(text)) {
            // Zero-latency greeting: respond instantly with a template, NO LLM call at all.
            // Incorporates time of day and presence/absence awareness.
            const activeAgentId = state.directTargetAgentId || 'generalist';
            const history = state.agentHistory || [];
            const lastMsg = history[history.length - 1];
            const instantReply = AgentService.buildInstantGreeting(
                activeAgentId,
                undefined,
                conversationMode as string,
                lastMsg?.timestamp
            );
            logger.debug('[AgentService] Trivial input instant-reply (0ms, no API call)');
            updateAgentMessage(responseId, { agentId: activeAgentId, text: instantReply, isStreaming: false });
            return;
        } else {
            orchestration = await this.orchestrator.determineOrchestrationPath(context, text);
        }

        logger.info(`[AgentService] Orchestration Path: ${orchestration.type}`, { reasoning: orchestration.reasoning });

        // 2. Route Execution
        if (orchestration.type === 'graph' && orchestration.graph) {
            await this.handleGraphExecutionFlow(orchestration.graph, context, text, responseId);
            return;
        }

        if (orchestration.type === 'parallel' && orchestration.subtasks) {
            await this.handleParallelExecutionFlow(orchestration.subtasks, context, text, responseId);
            return;
        }

        // Default: Single Agent Execution
        const agentId = orchestration.agentId || 'generalist';
        updateAgentMessage(responseId, { agentId });
        const singleAgentContext: AgentContext = { ...context, conversationMode: 'direct' };

        let currentStreamedText = '';
        const result = await this.executor.execute(agentId, text, singleAgentContext as PipelineContext, (event) => {
            if (event.type === 'token') {
                currentStreamedText += event.content;
                updateAgentMessage(responseId, { text: currentStreamedText });
            }

            if (event.type === 'thought' || event.type === 'tool' || event.type === 'tool_result') {
                if (event.type === 'tool_result') {
                    // Extract planId from LivingPlan tools
                    if (event.toolName === 'propose_plan' || event.toolName === 'get_plan') {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            let content: any = event.content;
                            if (typeof content === 'string') {
                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                try { content = JSON.parse(content); } catch (e) { /* fallback */ }
                            }

                            const planId = content?.data?.planId || content?.planId || (typeof event.content === 'string' ? event.content.match(/"planId":\s*"([^"]+)"/)?.[1] : null);
                            
                            if (planId) {
                                logger.info(`[AgentService] Detected planId: ${planId}`);
                                // Update message metadata
                                const currentMsg = useStore.getState().agentHistory.find((m: AgentMessage) => m.id === responseId);
                                updateAgentMessage(responseId, {
                                    metadata: { ...(currentMsg?.metadata || {}), planId }
                                });
                                
                                // Sync to LivingPlanSlice for immediate UI reaction
                                import('@/core/store/slices/livingPlanSlice').then(({ useLivingPlanSlice }) => {
                                    useLivingPlanSlice.getState().setSelectedPlanId(planId);
                                });
                            }
                        } catch (e) {
                            logger.error('[AgentService] Failed to process tool_result for planId:', e);
                        }
                    }
                }

                const currentMsg = useStore.getState().agentHistory.find((m: AgentMessage) => m.id === responseId);
                const newThought: AgentThought = {
                    id: uuidv4(),
                    text: event.content || '',
                    timestamp: Date.now(),
                    type: event.type as AgentThought["type"],
                };

                if (event.type === 'tool' || event.type === 'tool_result') {
                    if (event.toolName) newThought.toolName = event.toolName;
                }

                const safeThought = JSON.parse(JSON.stringify(newThought));
                if (currentMsg) {
                    updateAgentMessage(responseId, {
                        thoughts: [...(currentMsg.thoughts || []), safeThought]
                    });
                }
            }
        }, signal, undefined, attachments);

        if (result && result.text) {
            const completedText = await this.applyCompletedResponse(
                agentId,
                text,
                responseId,
                result,
                updateAgentMessage,
                () => useStore.getState().agentHistory.find((message: AgentMessage) => message.id === responseId),
            );

            // Tier 2: Index model response
            if (state.currentProjectId && state.activeSessionId && completedText.length > 20) {
                const { alwaysOnMemoryEngine } = await importWithRetry(() => import('./memory/AlwaysOnMemoryEngine'));
                alwaysOnMemoryEngine.ingest(
                    completedText,
                    'agent_output',
                    'context'
                ).catch(err => logger.warn('[AgentService] Failed to index agent response:', err));
            }
        } else {
            updateAgentMessage(responseId, {
                thoughtSignature: result?.thoughtSignature
            });
        }
    }

    /**
     * Department Flow: Limits execution to a specific department.
     * The task is routed directly to the Head of the active department.
     */
    private async handleDepartmentFlow(
        text: string,
        attachments: { mimeType: string; base64: string }[] | undefined,
        context: AgentContext,
        responseId: string,
        signal?: AbortSignal,
        options?: AgentSendOptions
    ): Promise<void> {
        const useStore = await this.getStore();
        const state = useStore.getState();
        const { updateAgentMessage } = state;
        // Remote sends carry the department the sender picked in their own UI.
        const activeDepartmentId = options?.source === 'mobile-remote'
            ? options.targetOverride ?? state.activeDepartmentId
            : state.activeDepartmentId;

        if (!activeDepartmentId) {
            updateAgentMessage(responseId, { text: '❌ No department selected.' });
            return;
        }

        const { DEPARTMENTS } = await importWithRetry(() => import('./departments'));
        const dept = DEPARTMENTS[activeDepartmentId];
        
        if (!dept) {
            updateAgentMessage(responseId, { text: `❌ Invalid department: ${activeDepartmentId}` });
            return;
        }

        // Force execution to the department head
        const forcedAgentId = dept.headId;
        updateAgentMessage(responseId, { agentId: forcedAgentId });
        
        let currentStreamedText = '';
        const result = await this.executor.execute(forcedAgentId, text, context as PipelineContext, (event) => {
            if (event.type === 'token') {
                currentStreamedText += event.content;
                updateAgentMessage(responseId, { text: currentStreamedText });
            }
            if (event.type === 'thought' || event.type === 'tool' || event.type === 'tool_result') {
                const currentMsg = useStore.getState().agentHistory.find(m => m.id === responseId);
                const newThought: AgentThought = {
                    id: uuidv4(),
                    text: event.content || '',
                    timestamp: Date.now(),
                    type: event.type as AgentThought["type"],
                };
                if (event.type === 'tool' || event.type === 'tool_result') {
                    if (event.toolName) newThought.toolName = event.toolName;
                }
                const safeThought = JSON.parse(JSON.stringify(newThought));
                if (currentMsg) {
                    updateAgentMessage(responseId, {
                        thoughts: [...(currentMsg.thoughts || []), safeThought]
                    });
                }
            }
        }, signal, undefined, attachments);

        if (result && result.text) {
            await this.applyCompletedResponse(
                forcedAgentId,
                text,
                responseId,
                result,
                updateAgentMessage,
                () => useStore.getState().agentHistory.find((message: AgentMessage) => message.id === responseId),
            );
        } else {
            updateAgentMessage(responseId, {
                thoughtSignature: result?.thoughtSignature
            });
        }
    }

    /**
     * Handles complex multi-step execution using the AgentGraphService.
     */
    private async handleGraphExecutionFlow(
        graph: AgentGraph,
        context: AgentContext,
        initialInput: string,
        responseId: string
    ): Promise<void> {
        const useStore = await this.getStore();
        const {
            updateAgentMessage,
            setActiveGraphDefinition,
            startListeningToGraphExecution,
            stopListeningToGraphExecution
        } = useStore.getState();

        updateAgentMessage(responseId, { 
            agentId: 'orchestrator', 
            text: '⛓️ **Decomposing complex request into sequential steps...**' 
        });

        // Initialize UI state for graph visualization
        setActiveGraphDefinition(graph);

        try {
            const userId = context.userId;
            if (!userId) throw new Error('userId is required for graph execution');

            // 1. Pre-create the execution to get an ID
            const executionState = await agentGraphService.createExecution(userId, graph);
            const executionId = executionState.executionId;

            // 2. Start listening to Firestore updates for real-time UI mapping
            await startListeningToGraphExecution(executionId);

            // 3. Execute the dynamic graph loop
            const finalReport = await agentGraphService.executeGraph(graph, context, initialInput, executionId);
            
            updateAgentMessage(responseId, {
                text: finalReport,
                isStreaming: false
            });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            logger.error('[AgentService] Graph execution failed:', error);
            updateAgentMessage(responseId, {
                text: `❌ **Orchestration Error:** ${error.message || 'Failed to execute multi-step plan.'}`,
                isStreaming: false
            });
        } finally {
            // The Firestore listener started above is only needed while this
            // execution is in flight; without this it stays open indefinitely,
            // one live listener per graph execution ever triggered in the session.
            stopListeningToGraphExecution();
        }
    }

    /**
     * Retries a specific node in a graph execution.
     */
    async retryGraphNode(executionId: string, nodeId: string): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const state = await agentGraphStateService.getExecution(userId, executionId);
        if (!state || !state.graph) {
            logger.warn(`[AgentService] Cannot retry node: Graph not found for execution ${executionId}`);
            return;
        }

        await agentGraphService.retryNode(userId, executionId, nodeId);
        
        // Re-trigger the graph loop in the background if it's not running
        this.executeGraphInBackground(executionId, userId);
    }

    /**
     * Resets a node and its descendants to planned state.
     */
    async resetGraphBranch(executionId: string, nodeId: string): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const state = await agentGraphStateService.getExecution(userId, executionId);
        if (!state || !state.graph) {
            logger.error(`[AgentService] Cannot reset branch: Graph not found for execution ${executionId}`);
            return;
        }

        await agentGraphService.resetBranch(userId, executionId, nodeId, state.graph);
        
        // Re-trigger the graph loop
        this.executeGraphInBackground(executionId, userId);
    }

    /**
     * Helper to resume graph execution in the background (e.g. after retry/reset).
     */
    private async executeGraphInBackground(executionId: string, userId: string): Promise<void> {
        try {
            const state = await agentGraphStateService.getExecution(userId, executionId);
            if (!state || !state.graph) return;

            const context: AgentContext = {
                userId,
                activeModule: 'generalist', // Fallback or retrieve from state
                traceId: uuidv4()
            };

            // This resumes the loop without blocking the main UI thread's response
            agentGraphService.resumeGraph(executionId, context, state.graph).catch(err => {
                logger.error('[AgentService] Background graph resumption failed:', err);
            });
        } catch (err) {
            logger.error('[AgentService] executeGraphInBackground error:', err);
        }
    }


    /**
     * Handles parallel fan-out execution.
     */
    private async handleParallelExecutionFlow(
        subtasks: Array<{ agentId: string; subtask: string }>,
        context: AgentContext,
        originalQuery: string,
        responseId: string
    ): Promise<void> {
        const useStore = await this.getStore();
        const { updateAgentMessage } = useStore.getState();

        updateAgentMessage(responseId, { 
            agentId: 'orchestrator', 
            text: `🔀 **Fanning out to ${subtasks.length} agents in parallel...**` 
        });

        try {
            const tasks = subtasks.map(s => ({
                agentId: s.agentId,
                description: `Parallel Task: ${s.subtask}`,
                priority: 'MEDIUM' as const,
                params: { prompt: s.subtask },
                context
            }));

            const results = await maestroBatchingService.executeBatch(tasks);
            
            let combinedReport = `✅ **Parallel Execution Complete**\n\n`;
            results.forEach((res, i) => {
                const subtask = subtasks[i];
                combinedReport += `### 🤖 ${subtask?.agentId.toUpperCase()}\n`;
                combinedReport += `**Task**: ${subtask?.subtask}\n`;
                combinedReport += `${res.text || res.message || 'Execution failed'}\n\n---\n\n`;
            });

            updateAgentMessage(responseId, {
                text: combinedReport,
                isStreaming: false
            });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            logger.error('[AgentService] Parallel execution failed:', error);
            updateAgentMessage(responseId, {
                text: `❌ **Parallel Orchestration Error:** ${error.message}`,
                isStreaming: false
            });
        }
    }

    /**
     * Boardroom Multi-Dispatch Flow: Dispatches the user's prompt to all active agents simultaneously.
     */
    private async handleBoardroomSwarmFlow(
        task: Readonly<BoardroomDispatchTask>,
        attachments: { mimeType: string; base64: string }[] | undefined,
        context: AgentContext,
        initialResponseId: string,
        signal?: AbortSignal
    ): Promise<void> {
        const useStore = await this.getStore();
        const state = useStore.getState();
        const activeAgents = state.activeAgents && state.activeAgents.length > 0 ? state.activeAgents : [];
        context.seatedAgents = activeAgents;
        const referencedAssets = state.referencedAssets || [];
        logger.debug('[AgentService] Boardroom swarm dispatch:', { agentCount: activeAgents.length, agents: activeAgents });

        if (activeAgents.length === 0) {
            logger.warn('[AgentService] Boardroom: No active agents seated');
            useStore.getState().updateAgentMessage(initialResponseId, {
                agentId: 'system',
                text: '*(Please drag at least one agent onto the table to begin the discussion.)*',
                isStreaming: false
            });
            return;
        }

        // Trivial Input Fast-Path in Boardroom:
        // Zero-latency: return a pre-built template instantly with NO LLM call.
        // The previous implementation still called executor.execute() causing 15-45s delays.
        if (AgentService.isTrivialInput(task.rawUserUtterance)) {
            const leadAgentId = activeAgents.includes('generalist') ? 'generalist' : activeAgents[0]!;
            const seatedAgentNames = activeAgents
                .map(id => agentRegistry.get(id)?.name || id)
                .join(', ');

            const history = state.agentHistory || [];
            const lastMsg = history[history.length - 1];
            const instantReply = AgentService.buildInstantGreeting(
                leadAgentId,
                seatedAgentNames,
                'boardroom',
                lastMsg?.timestamp
            );
            logger.debug(`[AgentService] Boardroom greeting instant-reply (0ms, no API call)`);
            useStore.getState().updateAgentMessage(initialResponseId, {
                agentId: leadAgentId,
                text: instantReply,
                isStreaming: false,
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.flushSyncMessage(initialResponseId, () => useStore.getState().agentHistory.find((m: any) => m.id === initialResponseId));
            return;
        }

        let assetContext = '';
        if (referencedAssets.length > 0) {
            assetContext = '\n\n[BOARDROOM REFERENCED ASSETS]\n' + referencedAssets.map(a => {
                const details = [
                    `- ${a.name} (${a.type}): ${a.value}`,
                    a.sourceType ? `sourceType=${a.sourceType}` : null,
                    a.prompt ? `prompt=${a.prompt}` : null,
                    a.origin ? `origin=${a.origin}` : null,
                    a.parentId ? `parentId=${a.parentId}` : null,
                ].filter((part): part is string => !!part);
                return details.join(' | ');
            }).join('\n');
        }

        let accumulatedContext = '';

        const CHUNK_SIZE = 3;
        for (let i = 0; i < activeAgents.length; i += CHUNK_SIZE) {
            const chunkAgents = activeAgents.slice(i, i + CHUNK_SIZE);
            const chunkPromises = chunkAgents.map(async (agentId, chunkIdx) => {
                const index = i + chunkIdx;
                if (!agentId) return { agentId: '', result: null };
                const resId = index === 0 ? initialResponseId : uuidv4();

                if (index > 0) {
                    useStore.getState().addAgentMessage({
                        id: resId,
                        role: 'model',
                        text: '*(Reviewing previous discussion...)*',
                        timestamp: Date.now() + index,
                        isStreaming: true,
                        thoughts: [],
                        agentId: agentId
                    });
                } else {
                    // ISSUE-1361 (Boardroom UX): the first seat (the Conductor)
                    // previously showed a static placeholder with isStreaming
                    // never set, so the user saw nothing "working" during the
                    // whole pre-token wait. Mark it streaming immediately so
                    // the typing indicator renders from message-send, not from
                    // first-token.
                    useStore.getState().updateAgentMessage(resId, { agentId, text: '*(Reviewing request...)*', isStreaming: true });
                }

                // Sync initial message immediately
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const initMsg = useStore.getState().agentHistory.find((m: any) => m.id === resId);
                if (initMsg) {
                    agentFirebaseConnector.syncMessage(initMsg).catch(err => 
                        logger.error(`[AgentService] Swarm initial sync failed for ${resId}:`, err)
                    );
                }

                let currentStreamedText = '';

                // Build the seated-agents manifest so the Conductor knows who is in the room
                const freshState = useStore.getState();
                const currentActiveAgents = freshState.activeAgents && freshState.activeAgents.length > 0 ? freshState.activeAgents : [];
                const seatedAgentNames = currentActiveAgents
                    .map(id => `${agentRegistry.get(id)?.name || id} (ID: '${id}')`)
                    .join(', ');

        const enhancedText = task.rawUserUtterance + assetContext +
            '\n\n(SYSTEM NOTE): You are in a Boardroom meeting. Swarm Protocol active. Respond from your specific department\'s perspective.' +
            `\n\n[SEATED_AGENTS]: The following agents are currently seated in the Boardroom: ${seatedAgentNames}. ONLY address or delegate to agents in this list. If a needed specialist is absent, use the seat_agent tool to invite them, or tell the user to seat them if you do not have that tool.` +
            (accumulatedContext ? `\n\n(PRIOR CONTEXT):\n${accumulatedContext}` : '');

                try {
                    logger.debug(`[AgentService] Boardroom: executing agent ${agentId} (chunk ${i/CHUNK_SIZE})`);
                    // Item: Add a safety timeout for swarm execution to prevent UI hangs
                    const executionPromise = this.executor.execute(
                        agentId,
                        enhancedText,
                        context as PipelineContext,
                        (event) => {
                            if (event.type === 'token') {
                                currentStreamedText += event.content;
                                useStore.getState().updateAgentMessage(resId, { text: currentStreamedText });
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                this.debounceSyncMessage(resId, () => useStore.getState().agentHistory.find((m: any) => m.id === resId));
                            }
                            if (event.type === 'thought' || event.type === 'tool' || event.type === 'tool_result') {
                                const currentMsg = useStore.getState().agentHistory.find(m => m.id === resId);
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
                                    useStore.getState().updateAgentMessage(resId, {
                                        thoughts: [...(currentMsg.thoughts || []), JSON.parse(JSON.stringify(newThought))]
                                    });
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    this.debounceSyncMessage(resId, () => useStore.getState().agentHistory.find((m: any) => m.id === resId));
                                }
                            }
                        },
                        signal,
                        undefined,
                        attachments
                    );

                    // Race against a 300-second (5 min) timeout for heavy swarm operations
                    const timeoutPromise = new Promise<never>((_, reject) => 
                        setTimeout(() => reject(new Error('Agent execution timed out (300s)')), 300000)
                    );

                    const result = await Promise.race([executionPromise, timeoutPromise]);

                    logger.debug(`[AgentService] Boardroom: agent ${agentId} responded (${result?.text?.length || 0} chars)`);

                    let planId: string | undefined = undefined;
                    if (result && result.toolCalls && result.toolCalls.length > 0) {
                        for (const tc of result.toolCalls) {
                            if ((tc.name === 'propose_plan' || tc.name === 'get_plan') && tc.result && typeof tc.result !== 'string' && tc.result.success && tc.result.data?.planId) {
                                planId = tc.result.data.planId;
                            }
                        }
                    }

                    if (result && result.text) {
                        // ISSUE-1362: clear the typing indicator as soon as the
                        // specialist's own execution completes. The persona
                        // finalizer below makes an additional LLM pass, and the
                        // indicator must not stay "typing..." for its duration —
                        // the founder saw exactly that (dots stuck after the
                        // reply landed).
                        useStore.getState().updateAgentMessage(resId, { isStreaming: false });
                        const completedText = await this.applyCompletedResponse(
                            agentId,
                            task.rawUserUtterance,
                            resId,
                            result,
                            (id, updates) => useStore.getState().updateAgentMessage(id, updates),
                            () => useStore.getState().agentHistory.find((message: AgentMessage) => message.id === resId),
                            {
                                ...(planId ? { planId } : {}),
                                isStreaming: false,
                            },
                            (message) => {
                                agentFirebaseConnector.syncMessage(message).catch(err =>
                                    logger.error(`[AgentService] Swarm measurement sync failed for ${resId}:`, err)
                                );
                            },
                        );

                        result.text = completedText;
                    } else {
                        if (currentStreamedText.length > 0) {
                            useStore.getState().updateAgentMessage(resId, {
                                text: currentStreamedText,
                                thoughtSignature: result?.thoughtSignature,
                                ...(planId ? { planId } : {}),
                                isStreaming: false
                            });
                        } else {
                            const hasToolCalls = result && result.toolCalls && result.toolCalls.length > 0;
                            useStore.getState().updateAgentMessage(resId, {
                                text: hasToolCalls ? '*(Executed tasks but provided no summary.)*' : '*(No observations or actions required from this department.)*',
                                thoughtSignature: result?.thoughtSignature,
                                ...(planId ? { planId } : {}),
                                isStreaming: false
                            });
                        }
                    }

                    // Sync final completed message state to Firestore
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    this.flushSyncMessage(resId, () => useStore.getState().agentHistory.find((m: any) => m.id === resId));

                    return { agentId, result };
                } catch (err) {
                    logger.error(`[AgentService] Boardroom Swarm dispatch failed for agent ${agentId}:`, err);
                    useStore.getState().updateAgentMessage(resId, {
                        text: `❌ **Error:** ${(err as Error).message || 'Request failed.'}`,
                        isStreaming: false,
                        thoughts: [{
                            id: uuidv4(),
                            text: 'Execution failed in boardroom swarm dispatch',
                            timestamp: Date.now(),
                            type: 'error'
                        }]
                    });

                    // Sync error/failure state
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    this.flushSyncMessage(resId, () => useStore.getState().agentHistory.find((m: any) => m.id === resId));

                    return { agentId, result: null };
                }
            });

            // Wait for the entire chunk to finish before accumulating context and proceeding to the next chunk
            const chunkResults = await Promise.all(chunkPromises);
            for (const { agentId, result } of chunkResults) {
                if (agentId && result?.text) {
                    accumulatedContext += `\n[${agentId.toUpperCase()}]: ${result.text}`;
                }
            }
        }
    }

    private sanitizeBoardroomUtterance(text: string): string {
        const systemicDelimiters = [
            /\(SYSTEM NOTE\):/g,
            /\[SEATED_AGENTS\]:/g,
            /\(PRIOR CONTEXT\):/g,
            /<<<SYSTEM_ORCHESTRATION>>>/g,
        ];
        return systemicDelimiters.reduce(
            (sanitized, pattern) => sanitized.replace(pattern, '[REDACTED_SPOOF]'),
            text,
        );
    }

    /**
     * Direct Chat Flow: Bypasses all orchestration and talks straight to the LLM.
     * Uses FirebaseIntelligenceService streaming for low-latency conversational responses.
     * No tools, no specialist agents, no context pipeline overhead.
     */
    private async handleDirectChatFlow(
        text: string,
        attachments: { mimeType: string; base64: string }[] | undefined,
        context: AgentContext,
        responseId: string
    ): Promise<void> {
        const useStore = await this.getStore();
        const { updateAgentMessage, agentHistory } = useStore.getState();

        const pipelineContext = context as PipelineContext;

        // Build persona-aware system prompt from context
        // Guard against default/placeholder names that haven't been updated
        let artistName = context.userProfile?.displayName || '';
        const isDefaultName = !artistName || artistName === 'New Artist' || artistName === 'pending';

        // If the stored displayName is the generic default, try Firebase Auth's displayName
        if (isDefaultName) {
            try {
                const { auth } = await importWithRetry(() => import('@/services/firebase'));
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
            if (pipelineContext.autoRecallBlock && pipelineContext.autoRecallBlock.trim()) {
                knowledgeContext = `\n\n${pipelineContext.autoRecallBlock}`;
            } else if (pipelineContext.memoryContext && pipelineContext.memoryContext.trim()) {
                knowledgeContext = `\n\nKNOWLEDGE BASE CONTEXT (from the artist's uploaded files and project data):\n${pipelineContext.memoryContext}`;
            }
        }

        const systemPrompt = `You are indii, a creative assistant for independent music artists and creators.${personaContext}${knowledgeContext}

Be direct, creative, and helpful. You are in direct chat mode — respond conversationally.

TALK-TO-EXECUTE BRIDGE:
If the user asks you to do something that requires action (like generating images, running automations, or managing projects), do NOT tell them to switch modes. Instead:
1. Discuss the task with them briefly.
2. Draft a "Living Plan" by outputting a JSON block at the end of your message.

The JSON block MUST be wrapped in \`\`\`json and look like this:
{
  "livingPlan": {
    "shape": "atomic" | "workflow" | "timeline",
    "summary": "Short summary of the plan",
    "goal": "The primary objective",
    "steps": [
      { "id": "step-1", "title": "Step title", "description": "Details", "status": "pending" }
    ],
    "durationDays": 1,
    "autoApprove": false
  }
}

The user will see this plan and can approve it to start execution.`;

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

            const { stream } = await AutonomousIntelligence.generateContentStream(
                contents,
                INTELLIGENCE_MODELS.TEXT.FAST,
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

            // --- PLAN DETECTION ---
            let planId: string | undefined;
            const jsonMatch = accumulatedText.match(/```json\s*(\{[\s\S]*?"livingPlan"[\s\S]*?\})\s*```/);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    const parsed = JSON.parse(jsonMatch[1]);
                        const planDraft = parsed.livingPlan;

                        if (planDraft && context.projectId) {
                            const { auth } = await importWithRetry(() => import('@/services/firebase'));
                            const userId = auth.currentUser?.uid || null;
                            if (!userId) {
                                throw new Error('User must be authenticated to create living plans.');
                            }

                        const plan = await livingPlanService.create(
                            userId,
                            context.projectId,
                            planDraft.goal || planDraft.summary,
                            planDraft
                        );
                        planId = plan.id;
                        logger.info(`[indii:Bridge] Created living plan: ${planId}`);
                    }
                } catch (e) {
                    logger.warn('[indii:Bridge] Failed to parse living plan from response:', e);
                }
            }

            // Final update. A generated Living Plan is tool-backed and must
            // remain byte-identical; ordinary direct chat enters the same
            // Manager persona finalizer as AgentExecutor-backed chat.
            const cleanText = accumulatedText.replace(/```json\s*(\{[\s\S]*?"livingPlan"[\s\S]*?\})\s*```/g, '').trim();
            const finalText = cleanText || 'No response generated.';
            const thoughts: AgentThought[] = [{
                    id: crypto.randomUUID(),
                    text: planId ? 'Drafted execution plan' : 'Analyzed Context',
                    timestamp: Date.now(),
                    type: planId ? 'logic' : 'logic',
                    toolName: 'Agent Core'
                }];
            await this.applyCompletedResponse(
                'generalist',
                text,
                responseId,
                {
                    text: finalText,
                    toolCalls: planId ? [{
                        name: 'propose_plan',
                        args: {},
                        result: { success: true, data: { planId } },
                    }] : [],
                },
                updateAgentMessage,
                () => useStore.getState().agentHistory.find((message: AgentMessage) => message.id === responseId),
                { planId, thoughts },
            );
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
                const { auth } = await importWithRetry(() => import('@/services/firebase'));
                if (auth.currentUser) {
                    const { livingFileService } = await moduleImportCache.import('./living/LivingFileService', () => import('./living/LivingFileService'));
                    context.livingContext = await livingFileService.injectContext(auth.currentUser.uid);
                }
            }

            // Phase 3: Semantic Retrieval Integration
            const projectId = context.projectId || (await this.getStore()).getState().currentProjectId;
            if (projectId && !context.memoryContext) {
                try {
                    logger.debug(`[AgentService] Searching for relevant memories for task: "${task.substring(0, 50)}..."`);
                    const { alwaysOnMemoryEngine } = await importWithRetry(() => import('./memory/AlwaysOnMemoryEngine'));
                    const results = await alwaysOnMemoryEngine.retrieve({ query: task, limit: 5 });
                    if (results && results.length > 0) {
                        context.relevantMemories = results.map(m => m.summary || m.content);
                        context.memoryContext = results
                            .map(m => `- ${m.summary || m.content}`)
                            .join('\n');
                        logger.debug(`[AgentService] Injected ${results.length} memories into context.`);
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

        // A manager's notes are durable Firestore documents, so a fact shared on
        // phone is available to the same manager on desktop before its next run.
        try {
            const { agentNoteService } = await importWithRetry(() => import('./AgentNoteService'));
            context.interAgentNotes = await agentNoteService.forAgent(agentId, context.projectId);
        } catch (error) {
            logger.warn('[AgentService] Could not load inter-agent notes (non-blocking):', error);
        }

        // Hub and Spoke: Inject runner for intra-agent delegation
        context.runAgent = this.runAgent.bind(this);

        // Fail-safe: Enforce a master timeout of 5 minutes per agent run
        // to prevent indefinite workflow orchestration hangs.
        const timeoutController = new AbortController();
        const timeoutMs = 300 * 1000;
        
        const timeoutPromise = new Promise<{ text: string; thoughtSignature?: string }>((_, reject) => {
            setTimeout(() => {
                logger.error(`[AgentService] Timeout: Agent ${agentId} took longer than 5 minutes to complete.`);
                timeoutController.abort(new Error(`Agent ${agentId} execution timed out.`));
                reject(new Error(`Agent ${agentId} execution timed out after ${timeoutMs / 1000}s.`));
            }, timeoutMs);
        });

        const executePromise = this.executor.execute(
            agentId,
            task,
            context as PipelineContext,
            undefined,
            timeoutController.signal,
            parentTraceId,
            attachments || context.attachments
        ).catch(err => {
            if (timeoutController.signal.aborted) {
                // We already rejected via the timeout promise, swallow to avoid unhandled rejection
                return { text: `Agent ${agentId} execution timed out.` };
            }
            throw err;
        });

        return await Promise.race([executePromise, timeoutPromise]);
    }

    /**
     * Alias for runAgent to maintain compatibility with Graph Orchestration.
     */
    async delegateTask(agentId: string, task: string, context?: AgentContext): Promise<string> {
        const result = await this.runAgent(agentId, task, context);
        return result.text;
    }

    /**
     * Entry point for executing an AgentGraph.
     */
    async executeGraph(graph: AgentGraph, context: AgentContext, initialInput?: string): Promise<string> {
        return await agentGraphService.executeGraph(graph, context, initialInput);
    }

    private async addSystemMessage(text: string): Promise<void> {
        const useStore = await this.getStore();
        const state = useStore.getState();
        const msg = { id: uuidv4(), role: 'system' as const, text, timestamp: Date.now() };
        if (state.conversationMode === 'boardroom') {
            state.addAgentMessage(msg);
        } else {
            state.addAgentMessage(msg);
        }
    }

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

    /**
     * Resumes or starts execution of a Living Plan.
     * This is called when a user approves a proposed plan or when the agent 
     * needs to continue the loop.
     */
    async resumeActivePlan(planId: string): Promise<void> {
        const useStore = await this.getStore();
        const state = useStore.getState();
        const projectId = state.currentProjectId;

        if (!projectId) {
            logger.error('[AgentService] Cannot resume plan: no active project');
            return;
        }

        try {
            // 1. Ensure the plan is in 'executing' status
            const plan = await livingPlanService.getPlan(projectId, planId);
            if (!plan) throw new Error('Plan not found');

            if (plan.status === 'proposed' || plan.status === 'awaiting_approval') {
                await livingPlanService.updatePlanStatus(projectId, planId, 'executing');
            }

            // 2. Trigger a message to the agent to start/continue the loop
            // The ContextPipeline will automatically pick up the active plan XML
            const nextStep = plan.draft.steps?.find(s => s.status === 'pending');
            const prompt = nextStep 
                ? `I've approved the plan. Please continue with the next step: "${nextStep.description}"`
                : `I've approved the plan. Please continue.`;

            // Explicitly route through sendMessage to ensure full context and orchestration
            await this.sendMessage(prompt, undefined, undefined, { source: 'desktop' });

        } catch (err) {
            logger.error('[AgentService] Failed to resume plan:', err);
            this.addSystemMessage(`❌ **Failed to resume plan:** ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Dispatches a specific tool call directly, bypassing normal message flow.
     * Often used by UI components to invoke agent tools interactively.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async dispatchToolCall(agentId: string, toolName: string, args: Record<string, any>, responseId: string): Promise<void> {
        const useStore = await this.getStore();
        const state = useStore.getState();
        const isBoardroomMode = state.conversationMode === 'boardroom';

        try {
            logger.info(`[AgentService] Dispatching direct tool call ${toolName} to agent ${agentId}`);
            
            const { TOOL_REGISTRY } = await importWithRetry(() => import('./tools'));
            if (TOOL_REGISTRY[toolName]) {
                // Execute the tool
                const result = await TOOL_REGISTRY[toolName](args);
                const resultAsRecord = result as unknown as Record<string, unknown>;
                if (typeof resultAsRecord?.toolError === 'string') {
                    const details = typeof resultAsRecord.details === 'string'
                        ? resultAsRecord.details
                        : resultAsRecord.toolError;
                    throw new Error(details);
                }
                
                const currentMsg = isBoardroomMode 
                    ? state.agentHistory.find(m => m.id === responseId)
                    : state.agentHistory.find(m => m.id === responseId);

                if (currentMsg) {
                    const newThought: AgentThought = {
                        id: uuidv4(),
                        text: JSON.stringify(result),
                        timestamp: Date.now(),
                        type: 'tool_result',
                        toolName
                    };

                    const updateMsg = state.updateAgentMessage;
                    updateMsg(responseId, {
                        thoughts: [...(currentMsg.thoughts || []), newThought]
                    });

                    // For image-editing tools, surface the result as a new message so history is preserved
                    if (toolName === 'edit_image_with_annotations' && resultAsRecord?.urls && Array.isArray(resultAsRecord.urls) && resultAsRecord.urls.length > 0) {
                        // Re-use the generate_image wire format so it renders naturally as image output
                        const imageMessage = `[Tool: generate_image]\n${JSON.stringify({ urls: resultAsRecord.urls, prompt: args.colorPrompts })}\n[End Tool generate_image]`;
                        await this.sendMessage(imageMessage, undefined, agentId, { source: 'desktop' });
                    }
                }

                // Send a silent system prompt to make the Autonomous aware of the user's action
                await this.sendMessage(`[System Note] The user manually executed the tool '${toolName}' via the UI. Action complete.`, undefined, agentId, { source: 'desktop' });
            } else {
                throw new Error(`Tool ${toolName} not found in registry.`);
            }

        } catch (error) {
            logger.error(`[AgentService] Tool dispatch failed:`, error);
            const errObj = error instanceof Error ? error : new Error(String(error));
            await this.addSystemMessage(`❌ **Tool Execution Error:** ${errObj.message}`);
            throw errObj;
        }
    }

    /**
     * Executes the MultiTurnAutorater post-completion to evaluate the conversation quality.
     * High-quality traces will automatically be registered for future fine-tuning.
     */
    private async triggerAutorater(userId: string, agentId: string, traceId: string, isBoardroomMode: boolean): Promise<void> {
        try {
            const useStore = await this.getStore();
            const state = useStore.getState();
            const history = isBoardroomMode ? state.agentHistory : state.agentHistory;
            
            // Extract the last 10 messages for context evaluation
            const recentMessages = history
                .slice(-10)
                .map(m => ({
                    role: (m.role === 'user' || m.role === 'model' || m.role === 'system') ? m.role : 'system',
                    content: m.text || ''
                }));

            const { MultiTurnAutorater } = await importWithRetry(() => import('./governance/MultiTurnAutorater'));
            
            // Fire-and-forget evaluation to not block the user interface
            await MultiTurnAutorater.evaluateAndRegister(
                userId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                agentId as any,
                traceId,
                recentMessages,
                "Fulfill the user's creative and technical requests efficiently without looping.",
                [
                    "Adhere strictly to the requested schema or output format",
                    "Do not ask unnecessary clarifying questions if context is sufficient",
                    "Use tools correctly and interpret tool outputs properly"
                ]
            );
        } catch (e) {
            logger.warn('[AgentService] Post-completion autorater failed:', e);
        }
    }

    /**
     * Checks whether a message contains output from an image-producing tool.
     * Checks both the message text and the structured thoughts (tool results).
     */
    private containsImageToolOutput(message: AgentMessage): boolean {
        // 1. Check thoughts (tool results) - most reliable
        if (message.thoughts) {
            const hasImageTool = message.thoughts.some(t => 
                t.type === 'tool_result' && 
                ['generate_image', 'edit_image', 'batch_edit_images', 'edit_image_with_annotations'].includes(t.toolName || '')
            );
            if (hasImageTool) return true;
        }

        // 2. Fallback to text patterns
        const imageToolPatterns = [
            /\[Tool: generate_image\]/,
            /\[Tool: edit_image_with_annotations\]/,
            /\[Tool: batch_edit_images\]/,
            /\[Tool: edit_image\]/,
        ];
        return imageToolPatterns.some(pattern => pattern.test(message.text || ''));
    }

    /**
     * Helper to extract image data from a message's tool results.
     */
    private findImageInThoughts(thoughts: AgentThought[]): { url: string; mimeType: string } | null {
        const imageThoughts = thoughts.filter(t => 
            t.type === 'tool_result' && 
            ['generate_image', 'edit_image', 'batch_edit_images', 'edit_image_with_annotations'].includes(t.toolName || '')
        );

        if (imageThoughts.length === 0) return null;

        // Take the most recent image tool result
        const lastThought = imageThoughts[imageThoughts.length - 1];
        if (!lastThought || !lastThought.text) return null;

        try {
            const result = JSON.parse(lastThought.text);
            const images = Array.isArray(result) ? result : [result];
            const firstImage = images[0];

            if (firstImage && firstImage.url) {
                return {
                    url: firstImage.url,
                    mimeType: firstImage.url.includes('image/webp') ? 'image/webp' : 'image/png'
                };
            }
        } catch (e) {
            logger.warn('[AgentService] Failed to parse image tool result from thoughts:', e);
            
            // Fallback: try regex on the raw text if JSON parse fails
            const base64Pattern = /data:(image\/[a-zA-Z+]+);base64,([a-zA-Z0-9+/=]+)/;
            const match = lastThought.text.match(base64Pattern);
            if (match && match[1]) {
                return { url: match[0], mimeType: match[1] };
            }
        }

        return null;
    }

    /**
     * Phase 3: Visual Output Autorater — fires after any image-producing tool completes.
     * Compares the generated image against the user's original brief, scores adherence,
     * and dispatches corrective prompts if the score falls below threshold.
     *
     * Hard cap: MAX_CORRECTION_ATTEMPTS per image to prevent runaway loops.
     */
    private async triggerVisualAutorater(
        responseText: string,
        originalBrief: string,
        agentId: string,
        responseId: string,
        isBoardroomMode: boolean
    ): Promise<void> {
        try {
            const { VisualOutputAutorater } = await importWithRetry(() => import('./governance/VisualOutputAutorater'));
            const useStore = await this.getStore();

            // Find the message in history to access thoughts/tool results
            const currentState = useStore.getState();
            const history = isBoardroomMode ? currentState.agentHistory : currentState.agentHistory;
            const message = (history as AgentMessage[]).find(m => m.id === responseId);

            if (!message) {
                logger.warn(`[AgentService] Visual autorater: Message ${responseId} not found in history`);
                return;
            }

            const traceId = `visual-${responseId}`;
            const originalImageId = this.getVisualAutoraterRetryKey(agentId, originalBrief);

            // Check if we've already exhausted retries for this image
            if (VisualOutputAutorater.hasReachedCap(originalImageId)) {
                logger.info(`[AgentService] Visual autorater: cap reached for ${originalImageId}, skipping`);
                return;
            }

            // Extract the actual image data from thoughts
            let imageBytes = '';
            let mimeType = 'image/png';

            if (message.thoughts) {
                const imageData = this.findImageInThoughts(message.thoughts);
                if (imageData) {
                    imageBytes = imageData.url;
                    mimeType = imageData.mimeType;
                }
            }

            // If no image data found in thoughts, try fallback to responseText regex
            if (!imageBytes && responseText) {
                const base64Pattern = /data:(image\/[a-zA-Z+]+);base64,([a-zA-Z0-9+/=]+)/;
                const match = responseText.match(base64Pattern);
                if (match && match[1]) {
                    imageBytes = match[0];
                    mimeType = match[1];
                }
            }

            if (!imageBytes) {
                logger.warn(`[AgentService] Visual autorater: No image data found for ${traceId}, proceeding with text-only evaluation (degraded)`);
            }

            const input = {
                imageBytes,
                originalBrief,
                agentId,
                traceId,
                originalImageId,
                mimeType
            };

            const score = await VisualOutputAutorater.evaluateImage(input);

            if (!score) {
                logger.warn(`[AgentService] Visual autorater returned null score for ${traceId}`);
                // Log audit even on null score (evaluation failure)
                await VisualOutputAutorater.logAuditRecord(input, null, false, VisualOutputAutorater.getAttemptCount(originalImageId));
                return;
            }

            const passed = VisualOutputAutorater.doesPass(score);

            // Log to Firestore audit trail
            const attemptNumber = VisualOutputAutorater.getAttemptCount(originalImageId) + 1;
            await VisualOutputAutorater.logAuditRecord(input, score, passed, attemptNumber);

            if (passed) {
                logger.info(
                    `[AgentService] Visual autorater PASSED: subject=${score.subjectMatch}, scene=${score.sceneMatch}, trace=${traceId}`
                );
                return;
            }

            // Image failed — check if we can retry
            VisualOutputAutorater.recordAttempt(originalImageId);

            if (VisualOutputAutorater.hasReachedCap(originalImageId)) {
                // Cap reached — surface manual review message
                logger.warn(`[AgentService] Visual autorater: cap reached after ${attemptNumber} attempts for ${originalImageId}`);

                const useStore = await this.getStore();
                const manualReviewMsg = {
                    id: uuidv4(),
                    role: 'system' as const,
                    text: `**Image correction stopped for manual review** — The autorater could not reach a passing score after ${attemptNumber} self-correction attempts, so no more automatic regenerations will run for this brief. Remaining gaps: ${score.gapsFound}. Next step: revise the prompt manually or accept the latest image with those limitations.`,
                    timestamp: Date.now(),
                };

                if (isBoardroomMode) {
                    useStore.getState().addAgentMessage(manualReviewMsg);
                } else {
                    useStore.getState().addAgentMessage(manualReviewMsg);
                }
                return;
            }

            // Dispatch corrective prompt to the producing agent
            logger.info(
                `[AgentService] Visual autorater FAILED (attempt ${attemptNumber}): dispatching correction. Gaps: ${score.gapsFound}`
            );

            const correctiveMessage = `[Visual Autorater Correction ${attemptNumber}/${VisualOutputAutorater.MAX_CORRECTION_ATTEMPTS}] The previously generated image did not match the brief. Remaining gaps: ${score.gapsFound}. Regenerate one corrected image using these corrections: ${score.correctivePrompt}. Original brief: "${originalBrief}"`;

            // Re-enter sendMessage to trigger a corrective generation
            await this.sendMessage(correctiveMessage, undefined, agentId, { source: 'background', originalBrief });
        } catch (error) {
            logger.error('[AgentService] Visual autorater failed:', error);
        }
    }

    private getVisualAutoraterRetryKey(agentId: string, originalBrief: string): string {
        let hash = 0;
        const normalizedBrief = originalBrief.trim().toLowerCase();

        for (let i = 0; i < normalizedBrief.length; i += 1) {
            hash = ((hash << 5) - hash) + normalizedBrief.charCodeAt(i);
            hash |= 0;
        }

        return `${agentId}:${Math.abs(hash).toString(36)}`;
    }
}

export const agentService = new AgentService();
