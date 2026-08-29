import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';
import type { CanvasContentType, CanvasData, CanvasPushPayload } from '@/types/AgentCanvas';
import { secureRandomHex } from '@/utils/crypto-random';
import { importWithRetry } from '@/utils/dynamicImport';

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
            const { type, title, data, agentId = 'generalist' } = args;

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
            const { useStore } = await importWithRetry(() => import('@/core/store'));
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
            const { useStore } = await importWithRetry(() => import('@/core/store'));
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
        shapeType: 'rect' | 'circle' | 'line' | 'text' | 'image';
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
        imageUrl?: string;
    }) => {
        try {
            const { shapeType, x, y, width, height, radius, color = '#000', fill = true, stroke, label, imageUrl, zIndex = 0 } = args;

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

            const validShapes = ['rect', 'circle', 'line', 'text', 'image'];
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
            if (shapeType === 'text' && !label) {
                return toolError('Text shape requires a label', 'CANVAS_MISSING_DIMS');
            }
            if (shapeType === 'line' && !width && !height) {
                return toolError('Line shape requires width or height to define its extent', 'CANVAS_MISSING_DIMS');
            }
            if (shapeType === 'image' && !imageUrl) {
                return toolError('Image shape requires an imageUrl', 'CANVAS_MISSING_DIMS');
            }

            // Fix ISSUE-053: Directly render to fabric.js canvas via canvasOps
            const { canvasOps } = await importWithRetry(() => import('@/modules/creative/services/CanvasOperationsService'));
            const fabric = await importWithRetry(() => import('fabric'));
            const canvas = canvasOps.getCanvas();

            if (!canvas) {
                return toolError('Creative canvas is not active. Shape was not rendered.', 'CANVAS_NOT_ACTIVE');
            }

            // Fabric.js canvas is active, draw directly
            const commonProps = { left: x, top: y, fill: fill ? color : 'transparent', stroke: stroke || (fill ? undefined : color), data: { zIndex } };

            if (shapeType === 'image') {
                try {
                    const img = await fabric.Image.fromURL(imageUrl!, { crossOrigin: 'anonymous' });
                    if (!img) {
                        return toolError(`Failed to load image from URL: ${imageUrl}`);
                    }
                    img.set({ ...commonProps });
                    if (width) img.scaleToWidth(width);
                    else if (height) img.scaleToHeight(height);
                    
                    canvas.add(img);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    canvas.getObjects().sort((a: any, b: any) => {
                        const zA = (a.data?.zIndex as number) || 0;
                        const zB = (b.data?.zIndex as number) || 0;
                        return zA - zB;
                    });
                    canvas.renderAll();
                    
                    logger.info(`[CanvasTools] Drew image shape at (${x}, ${y}) with z-index ${zIndex}`);
                    return toolSuccess(
                        { shapeType, zIndex },
                        `Image drawn successfully at (${x}, ${y}) with z-index ${zIndex} directly onto the creative canvas.`
                    );
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (err: any) {
                    return toolError(`Failed to load image from URL: ${imageUrl}. Error: ${err.message}`);
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let fabricObj: any = null;

            if (shapeType === 'rect') {
                fabricObj = new fabric.Rect({ ...commonProps, width, height });
            } else if (shapeType === 'circle') {
                fabricObj = new fabric.Circle({ ...commonProps, radius: radius! });
            } else if (shapeType === 'line') {
                fabricObj = new fabric.Line([x, y, x + (width || 0), y + (height || 0)], { ...commonProps, fill: undefined, stroke: color });
            } else if (shapeType === 'text') {
                fabricObj = new fabric.Text(label!, { ...commonProps, fontSize: 24, fill: color });
            }

            if (fabricObj) {
                canvas.add(fabricObj);
                // Simple zIndex sorting (Fabric doesn't natively auto-sort by a custom zIndex property without manual reordering)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                canvas.getObjects().sort((a: any, b: any) => {
                    const zA = (a.data?.zIndex as number) || 0;
                    const zB = (b.data?.zIndex as number) || 0;
                    return zA - zB;
                });
                canvas.renderAll();
            }

            logger.info(`[CanvasTools] Drew ${shapeType} shape at (${x}, ${y}) with z-index ${zIndex}`);
            return toolSuccess(
                { shapeType, zIndex },
                `Shape "${shapeType}" drawn successfully at (${x}, ${y}) with z-index ${zIndex} directly onto the creative canvas.`
            );
        } catch (error: unknown) {
            logger.error('[CanvasTools] draw_shape error:', error);
            return toolError(`Failed to draw shape: ${String(error)}`, 'CANVAS_DRAW_ERROR');
        }
    }),
    /**
     * Open a gallery image into the non-destructive canvas layer editor
     * (Workstream C2). Returns the docId.
     */
    canvas_open_image: wrapTool('canvas_open_image', async (args: { imageIndex: number }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const store = useStore.getState();
        const { generatedHistory, uploadedImages, currentProjectId } = store;
        const target = generatedHistory?.[args.imageIndex] ?? uploadedImages?.[args.imageIndex];
        if (!target?.url) return toolError('imageIndex did not resolve to an image.', 'INVALID_INPUT');
        try {
            store.openImage(target.url, currentProjectId ?? 'project_default');
            const docId = store.currentDoc?.id ?? null;
            return toolSuccess({ docId }, `Opened image ${args.imageIndex} into the layer editor (${docId}).`);
        } catch (error) {
            logger.error('[CanvasTools] canvas_open_image error:', error);
            return toolError(error instanceof Error ? error.message : String(error), 'CANVAS_OPEN_ERROR');
        }
    }),

    /**
     * Add a raster layer from a gallery/upload index to the open doc.
     */
    canvas_add_layer: wrapTool('canvas_add_layer', async (args: { docId: string; imageIndex: number }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const store = useStore.getState();
        if (!store.currentDoc || store.currentDoc.id !== args.docId) {
            return toolError(`No open doc "${args.docId}". Open an image first.`, 'INVALID_INPUT');
        }
        const target = store.generatedHistory?.[args.imageIndex] ?? store.uploadedImages?.[args.imageIndex];
        if (!target?.url) return toolError('imageIndex did not resolve to an image.', 'INVALID_INPUT');
        const layerId = store.addRasterLayer(target.url);
        return toolSuccess({ layerId }, `Added raster layer "${layerId}" to doc ${args.docId}.`);
    }),

    /**
     * Merge an adjustment patch over the neutral stack for a raster layer.
     */
    canvas_set_adjustments: wrapTool('canvas_set_adjustments', async (args: { docId: string; layerId: string; adjustments: Record<string, number> }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const store = useStore.getState();
        if (!store.currentDoc || store.currentDoc.id !== args.docId) {
            return toolError(`No open doc "${args.docId}".`, 'INVALID_INPUT');
        }
        try {
            store.setAdjustments(args.layerId, args.adjustments);
            return toolSuccess({ layerId: args.layerId, adjustments: args.adjustments }, `Set adjustments on layer ${args.layerId}.`);
        } catch (error) {
            return toolError(error instanceof Error ? error.message : String(error), 'CANVAS_ADJUST_ERROR');
        }
    }),

    /**
     * Export the open doc as a raster asset → history item + result URL.
     */
    canvas_export: wrapTool('canvas_export', async (args: { docId?: string; format?: 'png' | 'jpeg'; scale?: number }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const store = useStore.getState();
        if (!store.currentDoc) return toolError('No open doc to export. Open an image first.', 'INVALID_INPUT');
        const doc = store.currentDoc;
        if (args.docId && args.docId !== doc.id) return toolError(`Doc "${args.docId}" is not open.`, 'INVALID_INPUT');
        try {
            // Deterministic export: composite the layers' raster source over the
            // background at doc resolution. The Fabric canvas applies per-layer
            // adjustment filters; here we emit the doc contract URL as a PNG
            // data URL for the tool result (the interactive Editor performs the
            // full filter bake). Format honored for the history record.
            const scale = args.scale ?? 1;
            const width = Math.round(doc.width * scale);
            const height = Math.round(doc.height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('No 2D context');
            ctx.fillStyle = doc.background || '#000000';
            ctx.fillRect(0, 0, width, height);
            for (const layer of [...doc.layers].reverse()) {
                if (!layer.visible || layer.kind !== 'raster') continue; // text-vector bake is C3
                const img = new Image();
                img.src = layer.src;
                await img.decode().catch(() => {});
                if (img.width > 0) {
                    const s = Math.max(width / img.width, height / img.height);
                    const dw = img.width * s, dh = img.height * s;
                    ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
                }
            }
            const mime = args.format === 'jpeg' ? 'image/jpeg' : 'image/png';
            const url = canvas.toDataURL(mime);
            const historyId = `canvas_export_${Date.now()}`;
            store.addToHistory?.({
                id: historyId, url, prompt: 'Layer editor export', type: 'image',
                timestamp: Date.now(), projectId: doc.projectId,
                meta: JSON.stringify({ source: 'canvas_export', docId: doc.id }),
                tags: ['canvas_export'], origin: 'canvas-export'
            });
            return toolSuccess({ url, width, height }, `Exported layer doc ${doc.id} as ${args.format ?? 'png'} (${width}×${height}).`);
        } catch (error) {
            logger.error('[CanvasTools] canvas_export error:', error);
            return toolError(error instanceof Error ? error.message : String(error), 'CANVAS_EXPORT_ERROR');
        }
    })
} satisfies Record<string, AnyToolFunction>;
