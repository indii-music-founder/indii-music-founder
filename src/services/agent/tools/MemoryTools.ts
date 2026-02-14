// useStore removed

import { memoryService } from '@/services/agent/MemoryService';
import { compactionService } from '@/services/agent/memory/CompactionService';
import { livingFileService } from '@/services/agent/living/LivingFileService';
import { auth } from '@/services/firebase';
import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';

// ============================================================================
// Types for MemoryTools
// ============================================================================

export const MemoryTools: Record<string, AnyToolFunction> = {
    save_memory: wrapTool('save_memory', async (args: { content: string; type?: 'fact' | 'summary' | 'rule' }, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const { useStore } = await import('@/core/store');
        // Phase 3.6: Use execution context when available, fallback to direct store
        const currentProjectId = toolContext
            ? toolContext.get('currentProjectId')
            : useStore.getState().currentProjectId;

        if (!currentProjectId) {
            return toolError("No active project found to save memory to.", "PROJ_REQUIRED");
        }

        try {
            await memoryService.saveMemory(currentProjectId, args.content, args.type || 'fact');
        } catch (e) {
            console.error('[MemoryTools] save_memory failed internally: (Non-blocking)', e);
        }

        return {
            content: args.content,
            type: args.type || 'fact',
            message: `Memory processed: "${args.content}"`
        };
    }),

    recall_memories: wrapTool('recall_memories', async (args: { query: string }, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const { useStore } = await import('@/core/store');
        // Phase 3.6: Use execution context when available, fallback to direct store
        const currentProjectId = toolContext
            ? toolContext.get('currentProjectId')
            : useStore.getState().currentProjectId;

        if (!currentProjectId) {
            return toolError("No active project found to recall memories from.", "PROJ_REQUIRED");
        }

        const memories = await memoryService.retrieveRelevantMemories(currentProjectId, args.query);
        return {
            memories,
            message: memories.length > 0 ? `Retrieved ${memories.length} relevant memories.` : "No relevant memories found."
        };
    }),

    verify_output: wrapTool('verify_output', async (args: { goal: string, content: string }) => {
        const { AI } = await import('@/services/ai/AIService'); // Lazy load to avoid cycle
        const prompt = `
        Verify if the following content meets the goal:
        Goal: ${args.goal}
        Content: ${args.content}
        
        Return JSON: { score: number (1-10), pass: boolean, reason: string }
        `;

        const response = await AI.generateContent({
            model: 'gemini-3-pro-preview',
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });

        const text = response.text();
        const verification = JSON.parse(text);

        return {
            verification,
            message: `Verification complete. Score: ${verification.score}. Pass: ${verification.pass}`
        };
    }),

    read_history: wrapTool('read_history', async (_args, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const { useStore } = await import('@/core/store');
        // Phase 3.6: Use execution context when available, fallback to direct store
        const history = (toolContext
            ? toolContext.get('agentHistory')
            : useStore.getState().agentHistory) || [];

        const recentHistory = history.slice(-20); // Increase range for better context
            history: recentHistory.map(h => ({
                role: h.role,
                text: (h.text ?? '').substring(0, 300) // Increase snippet size for more context
                text: (h.text || '').substring(0, 300) // Increase snippet size for more context
            })),
            message: `Retrieved ${recentHistory.length} most recent history items.`
        };
    }),

    compact_history: wrapTool('compact_history', async (_args, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const { useStore } = await import('@/core/store');

        const userId = auth.currentUser?.uid;
        if (!userId) {
            return toolError("User not authenticated. Deployment of compaction requires an active session.", "AUTH_REQUIRED");
        }

        const history = (toolContext
            ? toolContext.get('agentHistory')
            : useStore.getState().agentHistory) || [];

        if (history.length < 10) {
            return {
                success: false,
                message: "History is currently too short (under 10 messages) to require compaction. Focus on high-value activity first."
            };
        }
        try {
            console.log(`[MemoryTools] Initiating history compaction for ${history.length} messages...`);
            const summary = await compactionService.compactChatHistory(history);

            if (!summary) {
                return toolError("Compaction process failed to generate a coherent summary.", "COMPACTION_FAILED");
            }

            // Save to EPISODIC memory (Layer 1 - Activity Log)
            await livingFileService.appendToEpisodic(userId, `HISTORY_COMPACTION: ${summary}`);

            // Save to MemoryService (Layer 2 - Semantic Retrieval)
            const currentProjectId = toolContext
                ? toolContext.get('currentProjectId')
                : useStore.getState().currentProjectId;

            if (currentProjectId) {
                try {
                    await memoryService.saveMemory(currentProjectId, `Session Summary: ${summary}`, 'summary', 0.8, 'system');
                } catch (e) {
                    console.warn('[MemoryTools] Failed to save compaction summary to MemoryService:', e);
                }
            }

            return {
                summary,
                message: "History successully compacted and archived to episodic memory for permanent retrieval.",
                cleared: false // Flag to show we haven't cleared the UI store yet, just archived.
            };
        } catch (e) {
            console.error('[MemoryTools] compact_history Error:', e);
            return toolError(`Internal error during compaction: ${(e as Error).message}`);
        }
    })
};
