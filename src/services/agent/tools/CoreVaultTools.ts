/**
 * CORE Vault Tools — Agent-facing tools for Layer 3 (CORE Vault)
 *
 * Provides read, write, and supersede operations on the authoritative
 * knowledge base. When in conflict with other memory layers, CORE Vault wins.
 */

import { coreVaultService, type VaultCategory, type VaultFactSource, ALL_VAULT_CATEGORIES } from '../memory/CoreVaultService';
import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';
import { logger } from '@/utils/logger';

export const CoreVaultTools = {
    /**
     * Read active facts from a vault category.
     * Returns the summary and all active canonical facts.
     */
    core_vault_read: wrapTool(
        'core_vault_read',
        async (
            args: { category: VaultCategory },
            _context?: AgentContext,
            toolContext?: ToolExecutionContext
        ) => {
            const { useStore } = await import('@/core/store');
            const userId = toolContext
                ? toolContext.get('user')?.uid
                : useStore.getState().user?.uid;

            if (!userId) {
                return toolError('User not authenticated.', 'AUTH_REQUIRED');
            }

            if (!ALL_VAULT_CATEGORIES.includes(args.category)) {
                return toolError(
                    `Invalid category "${args.category}". Valid: ${ALL_VAULT_CATEGORIES.join(', ')}`,
                    'INVALID_CATEGORY'
                );
            }

            try {
                const { summary, facts } = await coreVaultService.readVault(userId, args.category);
                return {
                    category: args.category,
                    summary,
                    facts: facts.map(f => ({
                        id: f.id,
                        fact: f.fact,
                        source: f.source,
                        timestamp: f.timestamp,
                        tags: f.tags,
                    })),
                    factCount: facts.length,
                    message: facts.length > 0
                        ? `Retrieved ${facts.length} active facts from vault/${args.category}.`
                        : `No facts stored in vault/${args.category} yet.`,
                };
            } catch (error) {
                return toolError(`Failed to read vault: ${error}`, 'READ_FAILED');
            }
        }
    ),

    /**
     * Add a new fact to the CORE Vault.
     */
    core_vault_write: wrapTool(
        'core_vault_write',
        async (
            args: {
                category: VaultCategory;
                fact: string;
                source?: VaultFactSource;
                tags?: string[];
            },
            _context?: AgentContext,
            toolContext?: ToolExecutionContext
        ) => {
            const { useStore } = await import('@/core/store');
            const userId = toolContext
                ? toolContext.get('user')?.uid
                : useStore.getState().user?.uid;

            if (!userId) {
                return toolError('User not authenticated.', 'AUTH_REQUIRED');
            }

            if (!args.fact || args.fact.trim().length < 3) {
                return toolError('Fact text must be at least 3 characters.', 'INVALID_INPUT');
            }

            if (!ALL_VAULT_CATEGORIES.includes(args.category)) {
                return toolError(
                    `Invalid category "${args.category}". Valid: ${ALL_VAULT_CATEGORIES.join(', ')}`,
                    'INVALID_CATEGORY'
                );
            }

            try {
                const factId = await coreVaultService.addFact(
                    userId,
                    args.category,
                    args.fact.trim(),
                    args.source || 'agent',
                    { tags: args.tags }
                );

                return {
                    factId,
                    category: args.category,
                    fact: args.fact.trim(),
                    message: `Fact saved to CORE Vault/${args.category}: "${args.fact.substring(0, 60)}..."`,
                };
            } catch (error) {
                return toolError(`Failed to write to vault: ${error}`, 'WRITE_FAILED');
            }
        }
    ),

    /**
     * Supersede an existing fact with a new version.
     * The old fact is preserved with status='superseded' — never deleted.
     */
    core_vault_supersede: wrapTool(
        'core_vault_supersede',
        async (
            args: {
                category: VaultCategory;
                oldFactId: string;
                newFact: string;
                source?: VaultFactSource;
            },
            _context?: AgentContext,
            toolContext?: ToolExecutionContext
        ) => {
            const { useStore } = await import('@/core/store');
            const userId = toolContext
                ? toolContext.get('user')?.uid
                : useStore.getState().user?.uid;

            if (!userId) {
                return toolError('User not authenticated.', 'AUTH_REQUIRED');
            }

            if (!args.oldFactId || !args.newFact) {
                return toolError('Both oldFactId and newFact are required.', 'INVALID_INPUT');
            }

            try {
                const newFactId = await coreVaultService.supersedeFact(
                    userId,
                    args.category,
                    args.oldFactId,
                    args.newFact.trim(),
                    args.source || 'agent'
                );

                logger.info(`[CoreVaultTools] Superseded ${args.oldFactId} → ${newFactId}`);

                return {
                    oldFactId: args.oldFactId,
                    newFactId,
                    category: args.category,
                    message: `Fact superseded: ${args.oldFactId} → ${newFactId}. Old version preserved.`,
                };
            } catch (error) {
                return toolError(`Failed to supersede fact: ${error}`, 'SUPERSEDE_FAILED');
            }
        }
    ),

    /**
     * Get the version history (supersession chain) for a fact.
     */
    core_vault_history: wrapTool(
        'core_vault_history',
        async (
            args: { category: VaultCategory; factId: string },
            _context?: AgentContext,
            toolContext?: ToolExecutionContext
        ) => {
            const { useStore } = await import('@/core/store');
            const userId = toolContext
                ? toolContext.get('user')?.uid
                : useStore.getState().user?.uid;

            if (!userId) {
                return toolError('User not authenticated.', 'AUTH_REQUIRED');
            }

            try {
                const chain = await coreVaultService.getFactHistory(userId, args.category, args.factId);

                return {
                    factId: args.factId,
                    category: args.category,
                    chain: chain.map(f => ({
                        id: f.id,
                        fact: f.fact,
                        status: f.status,
                        timestamp: f.timestamp,
                        supersedes: f.supersedes,
                        supersededBy: f.supersededBy,
                    })),
                    message: `Found ${chain.length} versions in the supersession chain.`,
                };
            } catch (error) {
                return toolError(`Failed to get fact history: ${error}`, 'HISTORY_FAILED');
            }
        }
    ),
} satisfies Record<string, AnyToolFunction>;
