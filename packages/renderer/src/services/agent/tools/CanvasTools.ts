import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';
import type { CanvasContentType, CanvasData, CanvasPushPayload } from '@/types/AgentCanvas';
import { secureRandomHex } from '@/utils/crypto-random';

/**
 * ISSUE-035 Fix: Z-Index Ceiling for Canvas Shapes
 * Prevents agents from rendering shapes with excessively high z-index
 * that could obscure interactive UI elements and lock users out.
 */
const MAX_Z_INDEX = 1000;

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

    /**
     * Draw a shape on the canvas with validated z-index (ISSUE-035 Fix).
     * Prevents agents from rendering shapes with excessively high z-index
     * that could obscure interactive UI elements.
     */
    draw_shape: wrapTool('draw_shape', async (args: {
        shapeType: 'rect' | 'circle' | 'line' | 'text';
        x: number;
        y: number;
        width?: number;
        height?: number;
        radius?: number;
        color?: string;
        fill?: boolean;
        stroke?: string;
        zIndex?: number;
        label?: string;
    }) => {
        try {
            const { shapeType, x, y, width, height, radius, color = '#000', fill = true, stroke, label, zIndex = 0 } = args;

            // ISSUE-035: Validate and clamp z-index to prevent UI sabotage
            if (zIndex < 0) {
                return toolError(
                    `Invalid z-index: ${zIndex}. Z-index must be >= 0.`,
                    'CANVAS_INVALID_Z_INDEX'
                );
            }

            if (zIndex > MAX_Z_INDEX) {
                return toolError(
                    `Z-index ${zIndex} exceeds maximum allowed value of ${MAX_Z_INDEX}. ` +
                    `Shapes are constrained to prevent obscuring UI elements. ` +
                    `Please use z-index <= ${MAX_Z_INDEX}.`,
                    'CANVAS_Z_INDEX_CEILING'
                );
            }

            const validShapes = ['rect', 'circle', 'line', 'text'];
            if (!validShapes.includes(shapeType)) {
                return toolError(
                    `Invalid shape type "${shapeType}". Must be one of: ${validShapes.join(', ')}`,
                    'CANVAS_INVALID_SHAPE'
                );
            }

            // Validate dimensions based on shape type
            if (shapeType === 'rect' && (!width || !height)) {
                return toolError('Rectangle requires width and height', 'CANVAS_MISSING_DIMS');
            }
            if (shapeType === 'circle' && !radius) {
                return toolError('Circle requires radius', 'CANVAS_MISSING_DIMS');
            }
            // CodeRabbit (PR #1707): validate line and text required fields
            if (shapeType === 'text' && !label) {
                return toolError('Text shape requires a label', 'CANVAS_MISSING_DIMS');
            }
            if (shapeType === 'line' && !width && !height) {
                return toolError('Line shape requires width or height to define its extent', 'CANVAS_MISSING_DIMS');
            }

            const shapeData = {
                id: secureRandomHex(8),
                shapeType,
                x,
                y,
                width,
                height,
                radius,
                color,
                fill,
                stroke,
                zIndex,
                label,
                createdAt: Date.now(),
            };

            // Push to the store
            const { useStore } = await import('@/core/store');
            useStore.getState().pushCanvas({
                id: shapeData.id,
                type: 'shape',
                title: label || `${shapeType} shape`,
                data: shapeData,
                agentId: 'conductor',
                createdAt: shapeData.createdAt,
            });

            logger.info(`[CanvasTools] Drew ${shapeType} shape at (${x}, ${y}) with z-index ${zIndex}`);
            return toolSuccess(
                { shapeId: shapeData.id, shapeType, zIndex },
                `Shape "${shapeType}" drawn successfully at (${x}, ${y}) with z-index ${zIndex}.`
            );
        } catch (error: unknown) {
            logger.error('[CanvasTools] draw_shape error:', error);
            return toolError(`Failed to draw shape: ${String(error)}`, 'CANVAS_DRAW_ERROR');
        }
    }),
} satisfies Record<string, AnyToolFunction>;
