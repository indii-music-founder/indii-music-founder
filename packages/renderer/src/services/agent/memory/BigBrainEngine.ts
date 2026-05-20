/**
 * Big Brain Engine — Layer 5 of the indii Memory Architecture
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
import { alwaysOnMemoryEngine } from './AlwaysOnMemoryEngine';
import { memoryBankService } from './MemoryBankService';
import { logger } from '@/utils/logger';

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

/** Configuration for Big Brain */
export interface BigBrainConfig {
    /** Total characters allowed for all injected context */
    maxTotalCharacters: number;
    /** Proportional allocation for each layer */
    budgetAllocation: {
        dailyLog: number;
        vaultFacts: number;
        episodicRecall: number;
        alignmentRules: number;
    };
}

const DEFAULT_CONFIG: BigBrainConfig = {
    maxTotalCharacters: 10000,
    budgetAllocation: {
        dailyLog: 0.2,      // 2,000 chars
        vaultFacts: 0.3,    // 3,000 chars
        episodicRecall: 0.4, // 4,000 chars
        alignmentRules: 0.1, // 1,000 chars
    },
};

// ============================================================================
// AGENT → VAULT CATEGORY MAPPING
// ============================================================================

/** Map of agent IDs to the vault categories they should auto-fetch */
const AGENT_VAULT_MAP: Record<string, VaultCategory[]> = {
    'marketing-agent': ['artist_identity', 'preferences', 'goals'],
    'creative-director': ['artist_identity', 'preferences', 'technical', 'goals'],
    'brand-agent': ['artist_identity', 'goals'],
    'music-agent': ['artist_identity', 'technical', 'preferences'],
    'legal-agent': ['artist_identity', 'legal'],
    'road-agent': ['artist_identity', 'technical'],
    'finance-agent': ['artist_identity', 'financial'],

    // Module ID aliases (ContextPipeline passes activeModule, not agent folder name)
    'generalist': ['artist_identity', 'goals', 'preferences', 'team'],  // indii Conductor (Hub)
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
     * @param _projectId - Legacy projectId (now unused in Always-On architecture)
     */
    async assembleContext(
        userId: string,
        agentId: string,
        userMessage: string,
        _projectId?: string
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
            this.fetchEpisodicRecall(userId, userMessage, budgets.episodicRecall),
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

        // Fetch all categories concurrently to avoid N+1 queries
        const categoryPromises = targetCategories.map(async (category) => {
            const { facts } = await coreVaultService.readVault(userId, category as VaultCategory);
            return { category, facts };
        });

        const resolvedCategories = await Promise.all(categoryPromises);

        const factLines: string[] = [];
        let currentChars = 0;

        for (const { category, facts } of resolvedCategories) {
            if (currentChars >= maxChars) break;

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
     * Layer 2: Fetch episodic memories from Always-On Memory matching the user's intent.
     */
    private async fetchEpisodicRecall(
        userId: string,
        userMessage: string,
        maxChars?: number
    ): Promise<string> {
        const _maxChars = maxChars || 4000;
        const lines: string[] = [];

        if (!userMessage) return '';

        // 1. Semantic search via Mem0 (MemoryBankService) for global episodic recall
        try {
            const mem0Results = await memoryBankService.searchMemories(userId, userMessage, 8);
            for (const mem of mem0Results) {
                const line = `- [Recall] ${mem.memory}`;
                if (lines.join('\n').length + line.length > _maxChars) break;
                lines.push(line);
            }
        } catch (error) {
            logger.warn('[BigBrain] Memory recall retrieval failed:', error);
        }

        // 2. Fetch recent unconsolidated memories for fresh context
        try {
            const freshMemories = await alwaysOnMemoryEngine.getAllMemories(5);
            for (const mem of freshMemories) {
                // Skip if already in results (naive check)
                if (lines.some(l => l.includes(mem.summary || mem.content.substring(0, 50)))) continue;
                
                const line = `- [Fresh] ${mem.summary || mem.content}`;
                if (lines.join('\n').length + line.length > _maxChars) break;
                lines.push(line);
            }
        } catch (error) {
            logger.warn('[BigBrain] Fresh memory retrieval failed:', error);
        }

        return lines.join('\n');
    }

    /**
     * Layer (User): Fetch user alignment rules and preferences from Always-On Memory.
     */
    private async fetchAlignmentRules(
        userId: string,
        userMessage: string,
        maxChars: number
    ): Promise<string[]> {
        // Query preferences and feedback categories specifically
        const results = await memoryBankService.searchMemories(userId, userMessage || 'general preferences', 5);

        const result: string[] = [];
        let currentChars = 0;

        for (const res of results) {
            const content = res.memory;
            // Only include if it sounds like a rule or preference
            const isRule = /prefer|like|always|never|should|must|avoid|style|tone/i.test(content);
            if (!isRule && result.length > 0) continue; 

            if (currentChars + content.length > maxChars) break;
            result.push(content);
            currentChars += content.length;
        }

        return result;
    }
}

export const bigBrainEngine = new BigBrainEngine();
