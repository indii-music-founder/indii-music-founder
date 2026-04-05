/**
 * Captain's Log Tools — Agent-facing tools for Layer 4 (Captain's Logs)
 *
 * Provides read access to the operational timeline.
 * Write access is primarily handled by auto-capture hooks in the services,
 * but agents can also log decisions and milestones directly.
 */

import { captainsLogService, type LogEntryType } from '../memory/CaptainsLogService';
import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';

export const CaptainsLogTools = {
    /**
     * Read a specific day's Captain's Log.
     * Defaults to today if no date provided.
     */
    captains_log_read: wrapTool(
        'captains_log_read',
        async (
            args: { date?: string },
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
                const entries = args.date
                    ? await captainsLogService.readLogByDate(userId, args.date)
                    : await captainsLogService.readTodaysLog(userId);

                return {
                    date: args.date || new Date().toISOString().split('T')[0],
                    entries: entries.map(e => ({
                        id: e.id,
                        type: e.type,
                        content: e.content,
                        timestamp: e.timestamp,
                        agentId: e.agentId,
                    })),
                    entryCount: entries.length,
                    message: entries.length > 0
                        ? `Retrieved ${entries.length} log entries.`
                        : 'No log entries found for this date.',
                };
            } catch (error: unknown) {
                return toolError(`Failed to read log: ${error}`, 'READ_FAILED');
            }
        }
    ),

    /**
     * Log a strategic decision to the Captain's Log.
     */
    captains_log_decision: wrapTool(
        'captains_log_decision',
        async (
            args: { description: string; agentId?: string },
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

            if (!args.description || args.description.trim().length < 5) {
                return toolError('Description must be at least 5 characters.', 'INVALID_INPUT');
            }

            try {
                await captainsLogService.logDecision(userId, args.description.trim(), args.agentId);
                return {
                    type: 'decision' as LogEntryType,
                    description: args.description.trim(),
                    message: `Decision logged: "${args.description.substring(0, 60)}..."`,
                };
            } catch (error: unknown) {
                return toolError(`Failed to log decision: ${error}`, 'LOG_FAILED');
            }
        }
    ),

    /**
     * Log a milestone achievement.
     */
    captains_log_milestone: wrapTool(
        'captains_log_milestone',
        async (
            args: { description: string },
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
                await captainsLogService.logMilestone(userId, args.description.trim());
                return {
                    type: 'milestone' as LogEntryType,
                    description: args.description.trim(),
                    message: `Milestone logged: "${args.description.substring(0, 60)}..."`,
                };
            } catch (error: unknown) {
                return toolError(`Failed to log milestone: ${error}`, 'LOG_FAILED');
            }
        }
    ),
} satisfies Record<string, AnyToolFunction>;
