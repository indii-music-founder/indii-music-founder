import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';
import type { CanvasContentType, CanvasData, CanvasPushPayload } from '@/types/AgentCanvas';
import { secureRandomHex } from '@/utils/crypto-random';

/**
 * CanvasTools — Agent-to-UI Push (A2UI)
 *
 * Allows agents to push structured visual content (charts, tables, cards,
 * markdown) directly into the user's workspace. The user sees a live panel
 * with the pushed content — no more text-only responses for dashboards.
 */
export const CanvasTools = {
    /**
     * Push structured visual content to the user's workspace canvas.
     *
     * Supported types:
     * - "chart": Recharts-powered data visualization (bar, line, pie, area, scatter, radar).
     *   data: { chartType, data: [{...}], xKey, yKeys, colors? }
     * - "table": Sortable data table.
     *   data: { columns: [{ key, label, align? }], rows: [{...}] }
     * - "card": Dashboard-style info cards.
     *   data: { cards: [{ title, value, subtitle?, icon?, trend?, trendValue? }] }
     * - "markdown": Rich formatted text.
     *   data: { content: "# Heading\nBody text..." }
     */
    canvas_push: wrapTool('canvas_push', async (args: {
        type: CanvasContentType;
        title: string;
        data: CanvasData;
        agentId?: string;
    }) => {
        try {
            const { type, title, data, agentId = 'conductor' } = args;

            const validTypes: CanvasContentType[] = ['chart', 'table', 'card', 'html', 'markdown'];
            if (!validTypes.includes(type)) {
                return toolError(
                    `Invalid canvas type "${type}". Must be one of: ${validTypes.join(', ')}`,
                    'CANVAS_INVALID_TYPE'
                );
            }

            if (!title || title.trim().length === 0) {
                return toolError('Canvas title is required', 'CANVAS_MISSING_TITLE');
            }

            const payload: CanvasPushPayload = {
                id: secureRandomHex(8),
                type,
                title: title.trim(),
                data,
                agentId,
                createdAt: Date.now(),
            };

            // Push to the store — dynamically import to avoid circular deps
            const { useStore } = await import('@/core/store');
            useStore.getState().pushCanvas(payload);

            logger.info(`[CanvasTools] Pushed "${title}" (${type}) to canvas`);
            return toolSuccess(
                { panelId: payload.id, type, title: payload.title },
                `Canvas panel "${payload.title}" pushed successfully — the user can now see it.`
            );
        } catch (error: unknown) {
            logger.error('[CanvasTools] canvas_push error:', error);
            return toolError(`Failed to push canvas: ${String(error)}`, 'CANVAS_PUSH_ERROR');
        }
    }),

    /**
     * Clear all agent-pushed canvas panels.
     */
    canvas_clear: wrapTool('canvas_clear', async () => {
        try {
            const { useStore } = await import('@/core/store');
            useStore.getState().clearCanvas();
            logger.info('[CanvasTools] Canvas cleared');
            return toolSuccess(null, 'Canvas cleared successfully.');
        } catch (error: unknown) {
            logger.error('[CanvasTools] canvas_clear error:', error);
            return toolError(`Failed to clear canvas: ${String(error)}`, 'CANVAS_CLEAR_ERROR');
        }
    }),
} satisfies Record<string, AnyToolFunction>;
