import { ContextPreparation } from './ContextPreparation';
import { readOptionalContext } from './OptionalContext';
import { ContextResolver } from './ContextResolver';
import { AgentContext, Directive } from '../types';
import { Timestamp } from 'firebase/firestore';
import { PlanStep } from '../LivingPlanService';
import { HistoryManager } from './HistoryManager';
import { alwaysOnMemoryEngine } from '../memory/AlwaysOnMemoryEngine';
import { bigBrainEngine } from '../memory/BigBrainEngine';
import { livingPlanService } from '../LivingPlanService';
import { logger } from '@/utils/logger';
import { Logger } from '@/core/logger/Logger';
import { auth } from '@/services/firebase';
import { importWithRetry } from '@/utils/dynamicImport';
import { IdeaParkingService } from '../tools/IdeaParking';
import { buildAmbitionDialPrompt } from '../builders/AmbitionDialPrompt';
import { ProductSkillRegistry } from '../skills/ProductSkillRegistry';
import { artistDirectiveService } from '../skills/ArtistDirectiveService';

export interface PipelineContext extends AgentContext {
    chatHistoryString: string;
    /** Summary of turns older than the recent window, for direct provider chat. */
    historicalSummary: string;
    historyWarning?: string;
    relevantMemories: string[];
    userAlignmentRules?: string[];
    memoryContext: string;
    /** Big Brain auto-recall block (XML-formatted, all 4 layers) */
    autoRecallBlock: string;
    /** Current active execution plan (XML-formatted) */
    activePlanBlock?: string;
    swarmId?: string | null;
    traceId?: string;
    attachments?: { mimeType: string; base64: string }[];
}

export class ContextPipeline {
    private resolver: ContextResolver;
    private historyManager: HistoryManager;

    constructor() {
        this.resolver = new ContextResolver();
        this.historyManager = new HistoryManager();
    }

    async buildContext(signal?: AbortSignal): Promise<PipelineContext> {
        const preparation = new ContextPreparation(signal);
        const { useStore } = await preparation.wait('context store', () => importWithRetry(() => import('@/core/store')));
        const { isKnowledgeBaseEnabled, userProfile } = useStore.getState();
        const userId = userProfile?.uid || auth.currentUser?.uid;

        // ISSUE-1710: the artist master directive is required, but it used to be
        // read last, with whatever was left of the shared 30 s budget after the
        // history and enrichment reads. Start it now so it overlaps them.
        const directiveRead = userId ? artistDirectiveService.getDirective(userId) : undefined;
        let directiveReady: { value: Awaited<ReturnType<typeof artistDirectiveService.getDirective>> } | undefined;
        directiveRead?.then(value => { directiveReady = { value }; }, () => undefined); // a failure is reported by the wait below

        // 1. Fetch State (The "Working Context")
        const stateContext = await preparation.wait('working context', () => this.resolver.resolveContext());

        // Derive recent user/model context synchronously from in-memory store history
        // so memory recall, active plans, product skill, and history compilation all
        // run in parallel instead of adding their timeouts sequentially.
        const storeAgentHistory = useStore.getState().agentHistory;
        const earlyRecentContext = this.extractRecentContextFromMessages(storeAgentHistory);

        // 2. Start History, Plans, Product Skill, and Memory Recall in parallel
        const historyPending = preparation.wait('conversation history', () => this.historyManager.getCompiledHistory(signal));

        const plansReadPending = stateContext.projectId
            ? readOptionalContext('active plans', () => livingPlanService.getPlansForProject(stateContext.projectId!, 'executing'), 2_500, signal)
            : undefined;
        let skillReadPending = earlyRecentContext
            ? readOptionalContext('product skill', () => ProductSkillRegistry.searchProductSkillByIntentAsync(earlyRecentContext), 2_500, signal)
            : undefined;
        // Rejects only on Stop; awaited inside try/catch below. Avoids an unhandled
        // rejection if Stop lands before either is awaited.
        plansReadPending?.catch(() => undefined);
        skillReadPending?.catch(() => undefined);

        // 3. Big Brain Auto-Recall (Unified across all 4 layers)
        const agentId = stateContext.activeModule || 'generalist';
        let recallPending = (userId && isKnowledgeBaseEnabled && earlyRecentContext)
            ? readOptionalContext('memory recall', () => bigBrainEngine.assembleContext(
                userId,
                agentId,
                earlyRecentContext,
                stateContext.projectId
            ), 3_500, signal)
            : undefined;
        recallPending?.catch(() => undefined);

        const { view: chatHistoryString, historicalSummary, historyWarning } = await historyPending;

        const recentContext = earlyRecentContext || this.extractRecentContext(chatHistoryString);
        if (!skillReadPending && recentContext) {
            skillReadPending = readOptionalContext('product skill', () => ProductSkillRegistry.searchProductSkillByIntentAsync(recentContext), 2_500, signal);
            skillReadPending.catch(() => undefined);
        }
        if (!recallPending && userId && isKnowledgeBaseEnabled) {
            recallPending = readOptionalContext('memory recall', () => bigBrainEngine.assembleContext(
                userId,
                agentId,
                recentContext,
                stateContext.projectId
            ), 3_500, signal);
            recallPending.catch(() => undefined);
        }

        let autoRecallBlock = '';
        let relevantMemories: string[] = [];
        let userAlignmentRules: string[] = [];

        // ISSUE-1708: memory recall, fallback memories, active plans and product
        // skills are enrichment. A slow one used to burn the shared 30 s budget
        // and fail the artist's message ("Context preparation timed out");
        // each now has its own short budget and the turn continues without it.
        let memoriesUnavailable = false;
        const fallbackMemories = async (): Promise<string[]> => {
            const fallback = await readOptionalContext('fallback memories',
                () => this.fallbackRetrieveMemories(stateContext.projectId, chatHistoryString), 2_000, signal);
            if (fallback.unavailable !== undefined) {
                logger.warn('[ContextPipeline] Fallback memories unavailable (non-blocking):', fallback.unavailable);
                memoriesUnavailable = true;
                return [];
            }
            return fallback.value;
        };

        if (recallPending) {
            const recall = await recallPending;

            if (recall.unavailable !== undefined) {
                logger.warn('[ContextPipeline] BigBrain assembly unavailable (non-blocking):', recall.unavailable);
                // Do not chain a second semantic-memory network timeout when recall already timed out.
                if (!recall.unavailable.startsWith('timed out during')) {
                    relevantMemories = await fallbackMemories();
                }
                memoriesUnavailable = true;
            } else {
                const bigBrainContext = recall.value;

                // Format into XML block for prompt injection
                autoRecallBlock = bigBrainEngine.formatForPrompt(bigBrainContext);

                // Extract individual components for backward compatibility
                userAlignmentRules = bigBrainContext.alignmentRules;

                // Also keep the relevantMemories array for the legacy formatMemoryContext
                if (bigBrainContext.episodicRecall) {
                    relevantMemories = bigBrainContext.episodicRecall
                        .split('\n')
                        .filter(l => l.startsWith('- '))
                        .map(l => l.substring(2));
                }

                logger.debug(
                    `[ContextPipeline] BigBrain injected ${bigBrainContext.totalCharacters} chars ` +
                    `(vault:${bigBrainContext.meta.vaultFactCount}, ` +
                    `episodic:${bigBrainContext.meta.episodicMatches}, ` +
                    `rules:${bigBrainContext.meta.alignmentRuleCount})`
                );
            }
        } else if (isKnowledgeBaseEnabled) {
            // No user but knowledge base enabled — basic memory retrieval
            relevantMemories = await fallbackMemories();
        }

        preparation.mark('memory recall');

        // 4. Fetch Active Living Plans (V2 Continuity)
        let activePlanBlock = '';
        if (plansReadPending) {
            try {
                const plansRead = await plansReadPending;
                preparation.mark('active plans');
                if (plansRead.unavailable !== undefined) logger.warn('[ContextPipeline] Active plans unavailable (non-blocking):', plansRead.unavailable);
                const activePlans = plansRead.unavailable !== undefined ? [] : plansRead.value;
                if (activePlans.length > 0) {
                    // Use the most recent executing plan
                    const plan = activePlans[0];
                    if (plan) {
                        activePlanBlock = `
<active_execution_plan id="${plan.id}" title="${plan.draft.summary}">
  <status>${plan.status}</status>
  <steps>
${plan.draft.steps ? plan.draft.steps.map((s: PlanStep, i: number) => `    <step index="${i}" status="${s.status}">
      <description>${s.description}</description>
      ${s.result ? `<result>${s.result}</result>` : ''}
      ${s.error ? `<error>${s.error}</error>` : ''}
    </step>`).join('\n') : ''}
  </steps>
  <instruction>
    You are currently EXECUTING this plan. 
    1. Check which steps are 'pending'.
    2. Continue with the next logical step using your tools.
    3. Update step progress using 'complete_step' or 'fail_plan' tools.
    4. When all steps are done, use 'complete_plan'.
  </instruction>
</active_execution_plan>
`.trim();
                    }
                }
            } catch (err) {
                preparation.throwIfStopped();
                logger.warn('[ContextPipeline] Failed to fetch active plans:', err);
            }
        }

        // 5. Format legacy memory context for backward compatibility
        const memoryContext = this.formatMemoryContext(relevantMemories);

        // 6. Generate A2A Swarm Directive
        if (!userId) {
            throw new Error('User must be authenticated to build agent context.');
        }

        const directive: Directive = {
            id: crypto.randomUUID(),
            userId,
            title: stateContext.activeModule ? `Task: ${stateContext.activeModule}` : 'General Consultation',
            status: 'IN_PROGRESS',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            assignedAgent: (stateContext.activeModule || 'generalist') as any,
            goalAncestry: [],
            computeAllocation: {
                maxTokens: 4000,
                tokensUsed: 0,
                isMaximizerModeActive: false
            },
            contextFiles: [],
            conversationThread: [],
            requiresDigitalHandshake: false,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        // 7. v1.5 Consent-based dial promotion: inject prompt if threshold hit
        const ambitionDialNotes: string[] = [];
        if (IdeaParkingService.shouldAskForDialUpgrade()) {
            ambitionDialNotes.push(buildAmbitionDialPrompt());
            IdeaParkingService.clearAmbitionPromptFlag();
        }

        // 8. Resolve Active Product Skill Playbook
        let activeProductSkillBlock = '';
        try {
            let skill: Awaited<ReturnType<typeof ProductSkillRegistry.searchProductSkillByIntentAsync>> | undefined;
            if (skillReadPending) {
                const skillRead = await skillReadPending;
                preparation.mark('product skill');
                if (skillRead.unavailable !== undefined) logger.warn('[ContextPipeline] Product skill search unavailable (non-blocking):', skillRead.unavailable);
                else skill = skillRead.value;
            }

            if (!skill && stateContext.activeModule) {
                skill = ProductSkillRegistry.getSkillForModule(stateContext.activeModule);
            }

            if (skill && !skill.disableModelInvocation) {
                activeProductSkillBlock = ProductSkillRegistry.formatSkillForPrompt(skill);
            }
        } catch (err) {
            preparation.throwIfStopped();
            logger.warn('[ContextPipeline] Failed to resolve active product skill:', err);
        }

        // 8.5 Resolve Tier 0 Artist Master Directive (Living User Skill)
        preparation.throwIfStopped();
        // Already read: use it even if the enrichment reads spent the shared budget.
        const directiveObj = directiveReady
            ? directiveReady.value
            : await preparation.wait('artist master directive', () => directiveRead ?? artistDirectiveService.getDirective(userId));
        if (directiveReady) preparation.mark('artist master directive');
        Logger.info('ContextPipeline', 'Context ready', preparation.timings());
        const artistMasterDirectiveBlock = artistDirectiveService.formatDirectiveForPrompt(directiveObj);

        preparation.throwIfStopped();

        // 9. Assemble Pipeline Context
        return {
            ...stateContext,
            chatHistoryString,
            historicalSummary,
            historyWarning: historyWarning ?? (memoriesUnavailable ? 'Saved memories are unavailable for this reply.' : undefined),
            relevantMemories,
            userAlignmentRules: [...(userAlignmentRules || []), ...ambitionDialNotes],
            memoryContext,
            autoRecallBlock,
            activePlanBlock,
            activeProductSkillBlock,
            artistMasterDirectiveBlock,
            directive,
            // Judgment layer: user-owned ambition dial (default 'balanced' if unset)
            ambitionLevel: userProfile?.preferences?.agentAmbition || 'balanced',
        };
    }

    /**
     * Fallback memory retrieval (used when BigBrain is unavailable)
     */
    private async fallbackRetrieveMemories(
        _projectId: string | undefined,
        chatHistory: string
    ): Promise<string[]> {
        try {
            const recentContext = this.extractRecentContext(chatHistory);
            if (!recentContext) return [];

            // Use the unified engine's retrieve for semantic search
            const memories = await alwaysOnMemoryEngine.retrieve({ query: recentContext, limit: 5 });
            return memories.map(m => m.summary || m.content);
        } catch (error: unknown) {
            logger.warn('[ContextPipeline] Fallback memory retrieval failed:', error);
            return [];
        }
    }

    /**
     * Extract recent context directly from in-memory store messages so memory recall
     * and skill search can start concurrently with history summarization.
     */
    private extractRecentContextFromMessages(
        messages?: Array<{ role?: string; text?: string }> | null
    ): string {
        if (!Array.isArray(messages) || messages.length === 0) return '';

        const recentTexts = messages
            .filter(m => (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.trim().length > 0)
            .slice(-5)
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text!.trim()}`);

        return recentTexts.join(' ').slice(-500);
    }

    /**
     * Extract recent context from chat history for memory query
     */
    private extractRecentContext(chatHistory: string): string {
        if (!chatHistory) return '';

        const lines = chatHistory.split('\n').filter(l => l.trim());
        const recentLines = lines.slice(-5);

        return recentLines.join(' ').slice(-500);
    }

    /**
     * Format memories into a context string for agent consumption
     */
    private formatMemoryContext(memories: string[]): string {
        if (memories.length === 0) return '';

        return `
## Long-Term Memory (Relevant Context)
The following memories from previous sessions may be relevant:
${memories.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n')}

Use these memories to maintain continuity and apply learned preferences/rules.
`.trim();
    }

    /**
     * Extract and save learnings from a completed conversation
     * Call this after significant interactions
     */
    async extractAndSaveLearnings(
        _projectId: string,
        learnings: Array<{ content: string; type: 'fact' | 'summary' | 'rule' }>
    ): Promise<void> {
        for (const learning of learnings) {
            // Map legacy 'type' to AlwaysOnMemoryCategory
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const categoryMap: Record<string, any> = {
                'fact': 'fact',
                'summary': 'context',
                'rule': 'preference'
            };
            
            await alwaysOnMemoryEngine.ingest(
                learning.content, 
                'agent_extraction',
                categoryMap[learning.type] || 'fact'
            );
        }
    }
}
