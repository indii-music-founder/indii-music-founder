/**
 * Big Brain Engine — Layer 5 of the IndiiOS Memory Architecture
 *
 * The autonomous pre-prompt orchestrator that auto-injects memory context
 * from ALL 4 layers before the LLM sees the user's message.
 *
 * Pipeline (runs before every agent execution):
 * 1. Captain's Log → Daily context (what happened today)
 * 2. CORE Vault → Authoritative facts relevant to the active agent
 * 3. Deep Hive → Cross-session episodic memories matching the user's intent
 * 4. User Alignment Rules → Personalized preferences from feedback
 *
 * Constraints:
 * - Total auto-injected context must stay under 2500 tokens (~10,000 chars)
 * - Each layer gets a proportional budget
 * - Non-blocking: failures in any layer don't prevent agent execution
 */

import { captainsLogService } from './CaptainsLogService';
import { coreVaultService, type VaultCategory } from './CoreVaultService';
import { userMemoryService } from '../UserMemoryService';
import { memoryService } from '../MemoryService';
import { logger } from '@/utils/logger';
import type { MemorySearchResult } from '@/types/UserMemory';

// ============================================================================
// TYPES
// ============================================================================

/** The assembled context output from Big Brain */
export interface BigBrainContext {
    /** Captain's Log summary for today */
    dailyLog: string;
    /** CORE Vault facts relevant to the current agent */
    vaultFacts: string;
    /** Deep Hive episodic memories matching the user's intent */
    episodicRecall: string;
    /** User alignment rules from feedback */
    alignmentRules: string[];
    /** Total character count of all injected context */
    totalCharacters: number;
    /** Metadata about what was injected */
    meta: {
        dailyLogEntries: number;
        vaultFactCount: number;
        episodicMatches: number;
        alignmentRuleCount: number;
        layerErrors: string[];
    };
}

/** Configuration for the Big Brain token budget */
interface BigBrainConfig {
    /** Maximum total characters for auto-injected context (~4 chars per token) */
    maxTotalCharacters: number;
    /** Budget allocation per layer (must sum to 1.0) */
    budgetAllocation: {
        dailyLog: number;
        vaultFacts: number;
        episodicRecall: number;
        alignmentRules: number;
    };
}

const DEFAULT_CONFIG: BigBrainConfig = {
    maxTotalCharacters: 10000, // ~2500 tokens at 4 chars/token
    budgetAllocation: {
        dailyLog: 0.15,       // 1500 chars for today's log
        vaultFacts: 0.35,     // 3500 chars for authoritative facts
        episodicRecall: 0.30, // 3000 chars for cross-session recall
        alignmentRules: 0.20, // 2000 chars for user preferences
    },
};

// ============================================================================
// AGENT → VAULT CATEGORY MAPPING
// ============================================================================

/**
 * Maps agent IDs to the vault categories most relevant to them.
 * This allows targeted fact retrieval instead of loading everything.
 */
const AGENT_VAULT_MAP: Record<string, VaultCategory[]> = {
    // Agent folder names
    'agent0': ['artist_identity', 'goals', 'preferences', 'team'],
    'creative-director': ['artist_identity', 'preferences', 'technical'],
    'brand': ['artist_identity', 'goals', 'contacts'],
    'distribution': ['distribution', 'legal', 'financial'],
    'finance': ['financial', 'business_model', 'legal'],
    'legal': ['legal', 'financial', 'distribution'],
    'licensing': ['legal', 'financial', 'contacts'],
    'marketing': ['artist_identity', 'goals', 'contacts'],
    'music': ['technical', 'artist_identity', 'preferences'],
    'publicist': ['artist_identity', 'contacts', 'goals'],
    'publishing': ['legal', 'financial', 'distribution'],
    'road': ['contacts', 'financial', 'goals'],
    'social': ['artist_identity', 'goals', 'contacts'],
    'video': ['artist_identity', 'preferences', 'technical'],

    // Module ID aliases (ContextPipeline passes activeModule, not agent folder name)
    'agent': ['artist_identity', 'goals', 'preferences', 'team'],       // alias for agent0
    'generalist': ['artist_identity', 'goals', 'preferences', 'team'],  // alias for indii Conductor
    'creative': ['artist_identity', 'preferences', 'technical'],        // alias for creative-director
    'dashboard': ['artist_identity', 'goals', 'preferences'],           // overview module
};

// ============================================================================
// BIG BRAIN ENGINE
// ============================================================================

class BigBrainEngine {
    private config: BigBrainConfig;

    constructor(config?: Partial<BigBrainConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Assemble the complete auto-injected context from all 4 memory layers.
     *
     * Called by ContextPipeline before every agent execution.
     * Non-blocking: individual layer failures are logged but don't halt assembly.
     *
     * @param userId - The authenticated user ID
     * @param agentId - The active agent (used for vault category targeting)
     * @param userMessage - The user's latest message (used for Deep Hive search)
     * @param projectId - The current project (used for MemoryService search)
     */
    async assembleContext(
        userId: string,
        agentId: string,
        userMessage: string,
        projectId?: string
    ): Promise<BigBrainContext> {
        const meta = {
            dailyLogEntries: 0,
            vaultFactCount: 0,
            episodicMatches: 0,
            alignmentRuleCount: 0,
            layerErrors: [] as string[],
        };

        const budgets = {
            dailyLog: Math.floor(this.config.maxTotalCharacters * this.config.budgetAllocation.dailyLog),
            vaultFacts: Math.floor(this.config.maxTotalCharacters * this.config.budgetAllocation.vaultFacts),
            episodicRecall: Math.floor(this.config.maxTotalCharacters * this.config.budgetAllocation.episodicRecall),
            alignmentRules: Math.floor(this.config.maxTotalCharacters * this.config.budgetAllocation.alignmentRules),
        };

        // Run all 4 layers in parallel — non-blocking
        const [dailyLog, vaultFacts, episodicRecall, alignmentRules] = await Promise.allSettled([
            this.fetchDailyLog(userId, budgets.dailyLog),
            this.fetchVaultFacts(userId, agentId, budgets.vaultFacts),
            this.fetchEpisodicRecall(userId, userMessage, projectId, budgets.episodicRecall),
            this.fetchAlignmentRules(userId, userMessage, budgets.alignmentRules),
        ]);

        // Extract results or handle failures
        const dailyLogResult = dailyLog.status === 'fulfilled' ? dailyLog.value : '';
        const vaultFactsResult = vaultFacts.status === 'fulfilled' ? vaultFacts.value : '';
        const episodicRecallResult = episodicRecall.status === 'fulfilled' ? episodicRecall.value : '';
        const alignmentRulesResult = alignmentRules.status === 'fulfilled' ? alignmentRules.value : [];

        // Log failures
        if (dailyLog.status === 'rejected') meta.layerErrors.push(`dailyLog: ${dailyLog.reason}`);
        if (vaultFacts.status === 'rejected') meta.layerErrors.push(`vaultFacts: ${vaultFacts.reason}`);
        if (episodicRecall.status === 'rejected') meta.layerErrors.push(`episodicRecall: ${episodicRecall.reason}`);
        if (alignmentRules.status === 'rejected') meta.layerErrors.push(`alignmentRules: ${alignmentRules.reason}`);

        if (meta.layerErrors.length > 0) {
            logger.warn('[BigBrain] Layer errors:', meta.layerErrors);
        }

        // Count metadata
        meta.dailyLogEntries = dailyLogResult ? dailyLogResult.split('\n').length : 0;
        meta.vaultFactCount = vaultFactsResult ? vaultFactsResult.split('\n').filter(l => l.startsWith('-')).length : 0;
        meta.episodicMatches = episodicRecallResult ? episodicRecallResult.split('\n').filter(l => l.startsWith('-')).length : 0;
        meta.alignmentRuleCount = alignmentRulesResult.length;

        const totalCharacters = dailyLogResult.length + vaultFactsResult.length +
            episodicRecallResult.length + alignmentRulesResult.join('').length;

        logger.debug(
            `[BigBrain] Assembled context: ${totalCharacters} chars ` +
            `(log:${meta.dailyLogEntries}, vault:${meta.vaultFactCount}, ` +
            `episodic:${meta.episodicMatches}, rules:${meta.alignmentRuleCount})`
        );

        return {
            dailyLog: dailyLogResult,
            vaultFacts: vaultFactsResult,
            episodicRecall: episodicRecallResult,
            alignmentRules: alignmentRulesResult,
            totalCharacters,
            meta,
        };
    }

    /**
     * Format the assembled context into a single XML block for prompt injection.
     */
    formatForPrompt(context: BigBrainContext): string {
        const sections: string[] = [];

        if (context.dailyLog) {
            sections.push(`<daily_context>\n${context.dailyLog}\n</daily_context>`);
        }

        if (context.vaultFacts) {
            sections.push(`<authoritative_facts>\n${context.vaultFacts}\n</authoritative_facts>`);
        }

        if (context.episodicRecall) {
            sections.push(`<cross_session_recall>\n${context.episodicRecall}\n</cross_session_recall>`);
        }

        // NOTE: User alignment rules are NOT included here because
        // AgentPromptBuilder already injects them via the separate
        // `userAlignmentRules` field on PipelineContext.

        if (sections.length === 0) return '';

        return `<auto_recall>\n${sections.join('\n')}\n</auto_recall>`;
    }

    // ========================================================================
    // LAYER FETCHERS (private, budget-constrained)
    // ========================================================================

    /**
     * Layer 4: Fetch today's Captain's Log summary.
     */
    private async fetchDailyLog(userId: string, maxChars: number): Promise<string> {
        const summary = await captainsLogService.getTodaysSummary(userId);
        return summary.substring(0, maxChars);
    }

    /**
     * Layer 3: Fetch CORE Vault facts targeted to the active agent.
     */
    private async fetchVaultFacts(userId: string, agentId: string, maxChars: number): Promise<string> {
        const targetCategories = AGENT_VAULT_MAP[agentId] || ['artist_identity', 'preferences', 'goals'];

        const factLines: string[] = [];
        let currentChars = 0;

        for (const category of targetCategories) {
            if (currentChars >= maxChars) break;

            const { facts } = await coreVaultService.readVault(userId, category);
            for (const fact of facts) {
                const line = `- [${category}] ${fact.fact}`;
                if (currentChars + line.length > maxChars) break;
                factLines.push(line);
                currentChars += line.length + 1; // +1 for newline
            }
        }

        return factLines.join('\n');
    }

    /**
     * Layer 2: Fetch episodic memories from Deep Hive matching the user's intent.
     */
    private async fetchEpisodicRecall(
        userId: string,
        userMessage: string,
        projectId?: string,
        maxChars?: number
    ): Promise<string> {
        const _maxChars = maxChars || 3000;
        const lines: string[] = [];

        // Project-scoped semantic search via MemoryService
        if (projectId && userMessage) {
            const memories = await memoryService.retrieveRelevantMemories(
                projectId,
                userMessage,
                5
            );
            for (const mem of memories) {
                const line = `- ${mem}`;
                if (lines.join('\n').length + line.length > _maxChars) break;
                lines.push(line);
            }
        }

        return lines.join('\n');
    }

    /**
     * Layer (User): Fetch user alignment rules from UserMemoryService.
     */
    private async fetchAlignmentRules(
        userId: string,
        userMessage: string,
        maxChars: number
    ): Promise<string[]> {
        const rules = await userMemoryService.searchMemories({
            userId,
            query: userMessage || 'general preferences',
            categories: ['preference', 'feedback', 'interaction'],
            limit: 5
        });

        const result: string[] = [];
        let currentChars = 0;

        for (const rule of rules) {
            const r = rule as MemorySearchResult;
            const content = r.memory.content;
            if (currentChars + content.length > maxChars) break;
            result.push(content);
            currentChars += content.length;
        }

        return result;
    }
}

export const bigBrainEngine = new BigBrainEngine();
