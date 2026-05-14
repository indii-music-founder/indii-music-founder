import * as fabric from 'fabric';

declare module 'fabric' {
    interface FabricObjectProps {
        data?: any;
        id?: string;
    }
}
import { hexToRgba, scaleImageToCanvas } from '@/lib/canvasUtils';
import { STUDIO_COLORS, CreativeColor } from '../constants';
import { logger } from '@/utils/logger';

export interface MaskData {
    mimeType: string;
    data: string;
    prompt: string;
    colorId: string;
    referenceImage?: { mimeType: string; data: string };
}

export interface PreparedMasks {
    baseImage: { mimeType: string; data: string };
    masks: MaskData[];
}

export class CanvasOperationsService {
    private canvas: fabric.Canvas | null = null;
    private _pathCreatedHandler: ((e: { path: fabric.FabricObject }) => void) | null = null;
    private _activeColorId: string = '';
    /** Track blob URLs so we can revoke them on dispose to prevent memory leaks */
    private _activeBlobUrls: string[] = [];
    private _historyStack: string[] = [];
    private _redoStack: string[] = [];
    private _isUndoingRedoing: boolean = false;
    private _maxHistory: number = 50;

    // Advanced Tools State
    private _activeTool: 'select' | 'line' | 'polygon' | 'text' | 'brush' = 'select';
    private _isDrawing: boolean = false;
    private _currentShape: fabric.FabricObject | null = null;
    private _startX: number = 0;
    private _startY: number = 0;
    private _points: { x: number; y: number }[] = [];

    /**
     * Load a Fabric.js Image from URL with automatic CORS fallback.
     *
     * Strategy:
     *  1. Try fabric.Image.fromURL with crossOrigin:'anonymous' (works for data URIs
     *     and correctly-configured CORS origins).
     *  2. On failure (CORS block, network error), fetch the image bytes via
     *     `safeStorageFetch`, create a blob URL, and retry — blob URLs are same-origin
     *     so CORS is irrelevant.
     */
    private async loadImageSafe(url: string): Promise<fabric.Image> {
        // High-performance async decoding (off main thread) helper
        const loadOffThread = (sourceUrl: string, crossOrigin?: string): Promise<fabric.Image> => {
            return new Promise((resolve, reject) => {
                const htmlImg = new Image();
                if (crossOrigin) htmlImg.crossOrigin = crossOrigin;
                
                htmlImg.onload = async () => {
                    try {
                        // This moves image decoding off the main thread to prevent UI stuttering
                        await htmlImg.decode();
                        const img = new fabric.Image(htmlImg);
                        if (img.width && img.width > 0 && img.height && img.height > 0) {
                            resolve(img);
                        } else {
                            reject(new Error('Image has zero dimensions after decode'));
                        }
                    } catch (e) {
                        // Fallback if decode() fails
                        const img = new fabric.Image(htmlImg);
                        if (img.width && img.width > 0) {
                            resolve(img);
                        } else {
                            reject(e);
                        }
                    }
                };
                htmlImg.onerror = reject;
                htmlImg.src = sourceUrl;
            });
        };

        // Fast path for data URIs — no CORS issues possible
        if (url.startsWith('data:')) {
            try {
                return await loadOffThread(url);
            } catch (e) {
                logger.warn('[CanvasOps] Off-thread data URI load failed, falling back to fromURL:', e);
                return fabric.Image.fromURL(url, { crossOrigin: 'anonymous' });
            }
        }

        // Attempt 1: Direct load with crossOrigin
        try {
            return await loadOffThread(url, 'anonymous');
        } catch (directErr: unknown) {
            logger.warn('[CanvasOps] Direct image load failed (likely CORS), attempting blob fallback:', directErr);
        }

        // Attempt 2: Fetch via safeStorageFetch → blob URL (bypasses CORS)
        try {
            const { safeStorageFetch } = await import('@/services/storage/safeStorageFetch');
            const { blob } = await safeStorageFetch(url);
            const blobUrl = URL.createObjectURL(blob);
            this._activeBlobUrls.push(blobUrl);

            const img = await loadOffThread(blobUrl);
            logger.info('[CanvasOps] Image loaded via blob URL fallback');
            return img;
        } catch (blobErr: unknown) {
            logger.warn('[CanvasOps] Blob fallback also failed, trying no-CORS Image element:', blobErr);
        }

        // Attempt 3: Final fallback: try without crossOrigin for display-only (won't be exportable)
        try {
            const img = await loadOffThread(url);
            logger.info('[CanvasOps] Image loaded via no-crossOrigin fallback');
            return img;
        } catch (e) {
            throw new Error(`All image load strategies failed for: ${url}`);
        }
    }

    /**
     * Place a loaded Fabric image onto the canvas, sizing it to fit.
     */
    private placeImageOnCanvas(
        img: fabric.Image,
        maxWidth: number,
        maxHeight: number
    ): void {
        if (!this.canvas) return;

        const imgW = img.width ?? 800;
        const imgH = img.height ?? 600;
        const fitScale = Math.min(maxWidth / imgW, maxHeight / imgH, 1);
        const canvasW = Math.round(imgW * fitScale);
        const canvasH = Math.round(imgH * fitScale);
        this.canvas.setDimensions({ width: canvasW, height: canvasH });

        img.set('data', { isBaseImage: true });
        scaleImageToCanvas(img, this.canvas);
        this.canvas.add(img);
        this.canvas.renderAll();
    }

    /**
     * Initialize a Fabric.js canvas with optional image.
     * Includes CORS-resilient image loading with automatic fallback.
     */
    initialize(
        canvasElement: HTMLCanvasElement,
        imageUrl?: string,
        onReady?: () => void,
        onChange?: () => void
    ): fabric.Canvas {
        // Dynamic sizing: read container dimensions instead of hardcoded 800x600
        const container = canvasElement.parentElement;
        const maxWidth = container ? Math.max(container.clientWidth - 24, 400) : 800;
        const maxHeight = container ? Math.max(container.clientHeight - 24, 300) : 600;

        this.canvas = new fabric.Canvas(canvasElement, {
            width: maxWidth,
            height: maxHeight,
            backgroundColor: '#1a1a1a',
        });

        if (imageUrl) {
            this.loadImageSafe(imageUrl)
                .then((img: fabric.Image) => {
                    if (!this.canvas) return;
                    this.placeImageOnCanvas(img, maxWidth, maxHeight);
                    onReady?.();
                })
                .catch((err: unknown) => {
                    logger.error('[CanvasOps] All image load strategies failed:', err);
                    // Still call onReady so UI doesn't hang, but canvas will be empty
                    onReady?.();
                });
        } else {
            onReady?.();
        }

        if (onChange) {
            const wrappedChange = () => {
                if (!this._isUndoingRedoing) {
                    this.saveHistoryState();
                }
                onChange();
            };
            this.canvas.on('object:modified', wrappedChange);
            this.canvas.on('object:added', wrappedChange);
            this.canvas.on('object:removed', wrappedChange);
            this.canvas.on('path:created', wrappedChange);
            this.canvas.on('mouse:dblclick', () => {
                if (this._activeTool === 'polygon' && this._points.length > 2) {
                    const color = this._activeColorId ? STUDIO_COLORS.find(c => c.id === this._activeColorId)?.hex || '#ff0000' : '#ff0000';
                    this.finishPolygon(color);
                }
            });

            this.canvas.on('mouse:down', (o) => {
                if (!this.canvas) return;
                const pointer = this.canvas.getScenePoint(o.e);

                if (this._activeTool === 'line') {
                    this._isDrawing = true;
                    this._startX = pointer.x;
                    this._startY = pointer.y;
                    const color = this._activeColorId ? STUDIO_COLORS.find(c => c.id === this._activeColorId)?.hex || '#ff0000' : '#ff0000';
                    this._currentShape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                        stroke: color,
                        strokeWidth: 2,
                        selectable: false,
                        data: { isAnnotation: true }
                    });
                    this.canvas.add(this._currentShape);
                } else if (this._activeTool === 'polygon') {
                    this._points.push({ x: pointer.x, y: pointer.y });
                    const color = this._activeColorId ? STUDIO_COLORS.find(c => c.id === this._activeColorId)?.hex || '#ff0000' : '#ff0000';
                    if (this._points.length === 1) {
                        this._currentShape = new fabric.Polyline(this._points, {
                            stroke: color,
                            strokeWidth: 2,
                            fill: 'transparent',
                            selectable: false,
                            data: { isAnnotation: true }
                        });
                        this.canvas.add(this._currentShape);
                    } else {
                        (this._currentShape as fabric.Polyline).set({ points: [...this._points] });
                    }
                } else if (this._activeTool === 'text') {
                    const text = new fabric.IText('Edit Me', {
                        left: pointer.x,
                        top: pointer.y,
                        fill: this._activeColorId ? STUDIO_COLORS.find(c => c.id === this._activeColorId)?.hex || '#ffffff' : '#ffffff',
                        fontSize: 24,
                        data: { isAnnotation: true }
                    });
                    this.canvas.add(text);
                    this.canvas.setActiveObject(text);
                    text.enterEditing();
                    this.canvas.renderAll();
                    this.saveHistoryState();
                }
                this.canvas.renderAll();
            });

            this.canvas.on('mouse:move', (o) => {
                if (!this.canvas || !this._isDrawing || !this._currentShape) return;
                const pointer = this.canvas.getScenePoint(o.e);

                if (this._activeTool === 'line') {
                    let endX = pointer.x;
                    let endY = pointer.y;

                    if (o.e.shiftKey) {
                        const angle = Math.atan2(pointer.y - this._startY, pointer.x - this._startX);
                        const dist = Math.sqrt(Math.pow(pointer.x - this._startX, 2) + Math.pow(pointer.y - this._startY, 2));
                        const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
                        endX = this._startX + dist * Math.cos(snapAngle);
                        endY = this._startY + dist * Math.sin(snapAngle);
                    }

                    (this._currentShape as fabric.Line).set({ x2: endX, y2: endY });
                    this.canvas.renderAll();
                }
            });

            this.canvas.on('mouse:up', () => {
                if ((this._activeTool === 'line' || this._activeTool === 'brush') && this._isDrawing) {
                    this._isDrawing = false;
                    this._currentShape = null;
                    this.saveHistoryState();
                }
            });
        }

        // Initial state save
        this.saveHistoryState();

        return this.canvas;
    }

    private saveHistoryState(): void {
        if (!this.canvas) return;
        const json = JSON.stringify((this.canvas as any).toJSON(['data', 'id']));
        
        // Only push if it's different from the top of the stack
        if (this._historyStack.length === 0 || this._historyStack[this._historyStack.length - 1] !== json) {
            this._historyStack.push(json);
            if (this._historyStack.length > this._maxHistory) {
                this._historyStack.shift();
            }
            // Clear redo stack on new action
            this._redoStack = [];
        }
    }

    undo(): void {
        if (!this.canvas || this._historyStack.length <= 1) return;

        this._isUndoingRedoing = true;
        const currentState = this._historyStack.pop();
        if (currentState) {
            this._redoStack.push(currentState);
        }

        const previousState = this._historyStack[this._historyStack.length - 1];
        if (previousState) {
            this.canvas.loadFromJSON(JSON.parse(previousState), () => {
                this.canvas?.renderAll();
                this._isUndoingRedoing = false;
            });
        } else {
            this._isUndoingRedoing = false;
        }
    }

    redo(): void {
        if (!this.canvas || this._redoStack.length === 0) return;

        this._isUndoingRedoing = true;
        const nextState = this._redoStack.pop();
        if (nextState) {
            this._historyStack.push(nextState);
            this.canvas.loadFromJSON(JSON.parse(nextState), () => {
                this.canvas?.renderAll();
                this._isUndoingRedoing = false;
            });
        } else {
            this._isUndoingRedoing = false;
        }
    }

    canUndo(): boolean {
        return this._historyStack.length > 1;
    }

    canRedo(): boolean {
        return this._redoStack.length > 0;
    }

    /**
     * Check if canvas has meaningful content (not just an empty dark background).
     * Used to prevent saving blank canvases.
     */
    hasContent(): boolean {
        if (!this.canvas) return false;
        // A canvas has content if it has at least one visible object
        const objects = this.canvas.getObjects();
        return objects.some(obj => obj.visible !== false);
    }

    /**
     * Dispose of the canvas and cleanup
     */
    dispose(): void {
        if (this.canvas) {
            // Clean up path:created handler to prevent memory leaks
            if (this._pathCreatedHandler) {
                this.canvas.off('path:created', this._pathCreatedHandler);
                this._pathCreatedHandler = null;
            }
            this.canvas.dispose();
            this.canvas = null;
        }
        // Revoke blob URLs created during CORS fallback to free memory
        this._activeBlobUrls.forEach(url => {
            try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        });
        this._activeBlobUrls = [];
        this._activeColorId = '';
    }

    /**
     * Get the current canvas instance
     */
    getCanvas(): fabric.Canvas | null {
        return this.canvas;
    }

    isAnnotation(obj: fabric.Object): boolean {
        if (!obj) return false;
        const type = obj.type?.toLowerCase();
        const data = (obj as any).data;
        
        // Explicitly marked as base image? Not an annotation.
        if (data?.isBaseImage) return false;
        
        // Fabric.js paths are always annotations in this context
        if (type === 'path') return true;
        
        // Groups containing annotations (or being used for mask drawing)
        if (type === 'group') return true;
        
        // Explicitly marked as annotation metadata
        if (data?.isBoundingBox || data?.isSegmentationMask || data?.colorId || data?.isAnnotation) return true;
        
        return false;
    }

    /**
     * Retrieves the base image as a data URI (excluding annotations like paths).
     */
    getBaseImageBase64(): string | null {
        if (!this.canvas) return null;
        
        const originalObjects = this.canvas.getObjects();
        const maskObjects = originalObjects.filter(obj => this.isAnnotation(obj));
        
        const originalBg = this.canvas.backgroundColor;
        
        try {
            // Hide masks
            maskObjects.forEach(obj => (obj.visible = false));
            this.canvas.backgroundColor = '#000000';
            
            this.canvas.renderAll();
            
            const baseDataUrl = this.canvas.toDataURL({ format: 'png', multiplier: 1 });
            return baseDataUrl;
        } finally {
            // Restore
            maskObjects.forEach(obj => (obj.visible = true));
            this.canvas.backgroundColor = originalBg;
            this.canvas.renderAll();
        }
    }

    /**
     * Draw bounding boxes on the canvas.
     */
    addBoundingBoxes(objects: Array<{ label: string, box: { ymin: number, xmin: number, ymax: number, xmax: number } }>, onSelect?: (label: string) => void): void {
        if (!this.canvas) return;
        const width = this.canvas.getWidth();
        const height = this.canvas.getHeight();

        // Clear existing bounding boxes
        const existingBoxes = this.canvas.getObjects().filter(obj => (obj as fabric.Object & { data?: { isBoundingBox?: boolean } }).data?.isBoundingBox);
        existingBoxes.forEach(obj => this.canvas?.remove(obj));

        objects.forEach(obj => {
            const left = (obj.box.xmin / 1000) * width;
            const top = (obj.box.ymin / 1000) * height;
            const boxWidth = ((obj.box.xmax - obj.box.xmin) / 1000) * width;
            const boxHeight = ((obj.box.ymax - obj.box.ymin) / 1000) * height;

            const rect = new fabric.Rect({
                left,
                top,
                width: boxWidth,
                height: boxHeight,
                fill: 'rgba(0, 255, 0, 0.1)',
                stroke: '#00ff00',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: true,
                hasControls: false,
                data: { isBoundingBox: true, label: obj.label }
            });
            
            // When user clicks the box
            if (onSelect) {
                rect.on('mousedown', () => {
                    onSelect(obj.label);
                });
            }

            this.canvas?.add(rect);
            
            // Add label text
            const text = new fabric.Text(obj.label, {
                left,
                top: top - 20,
                fontSize: 16,
                fill: '#00ff00',
                backgroundColor: 'rgba(0,0,0,0.7)',
                selectable: false,
                data: { isBoundingBox: true }
            });
            this.canvas?.add(text);
        });
        
        this.canvas.renderAll();
    }

    /**
     * Clear all detected bounding boxes and segmentation masks.
     */
    clearDetections(): void {
        if (!this.canvas) return;
        const objects = this.canvas.getObjects();
        const detections = objects.filter(obj => {
            const data = (obj as fabric.Object & { data?: Record<string, unknown> }).data;
            return data?.isBoundingBox || data?.isSegmentationMask;
        });
        
        detections.forEach(obj => this.canvas?.remove(obj));
        this.canvas.renderAll();
    }

    /**
     * Requirement X: Render Segmentation Mask
     * Loads a base64 PNG mask, tints it to the active color, and applies it as a non-interactive canvas object overlay
     */
    async addSegmentationMask(base64Png: string, colorDef: CreativeColor): Promise<void> {
        if (!this.canvas) return;

        try {
            const dataUrl = `data:image/png;base64,${base64Png}`;
            const img = await fabric.Image.fromURL(dataUrl, { crossOrigin: 'anonymous' });

            if (!img) {
                throw new Error('Failed to load segmentation mask image');
            }

            const canvasW = this.canvas!.getWidth();
            const canvasH = this.canvas!.getHeight();

            const scaleX = canvasW / (img.width || canvasW);
            const scaleY = canvasH / (img.height || canvasH);
            const scale = Math.min(scaleX, scaleY);
            
            img.set({
                left: canvasW / 2,
                top: canvasH / 2,
                originX: 'center',
                originY: 'center',
                scaleX: scale,
                scaleY: scale,
                opacity: 0.6,
                selectable: false,
                evented: false,
                data: {
                    colorId: colorDef.id,
                    isSegmentationMask: true,
                }
            });

            // We use BlendColor filter
            const filter = new fabric.filters.BlendColor({
                color: colorDef.hex,
                mode: 'multiply',
                alpha: 1.0
            });

            img.filters = [filter];
            img.applyFilters();
            
            this.canvas?.add(img);

            this.canvas?.renderAll();
        } catch (err) {
            logger.error('Failed to add segmentation mask', err);
            throw err;
        }
    }

    /**
     * Requirement 107: Fabric.js Canvas Batching
     * Generates a batch of creative assets across multiple dimensions from a single canvas.
     */
    async exportBatchDimensions(): Promise<{
        tiktok: string;   // 9:16
        instagram: string; // 1:1
        youtube: string;   // 16:9
    } | null> {
        if (!this.canvas) return null;

        const originalWidth = this.canvas.getWidth();
        const originalHeight = this.canvas.getHeight();
        const jsonState = JSON.stringify(this.canvas.toJSON());

        const exportForDimensions = async (targetWidth: number, targetHeight: number): Promise<string> => {
            this.canvas!.setDimensions({ width: targetWidth, height: targetHeight });

            // Using fabric.Canvas.getObjects directly since group scale could be problematic with clip paths
            const objects = this.canvas!.getObjects();
            
            // Filter out annotations for the export
            const annotationObjects = objects.filter(obj => this.isAnnotation(obj));
            const visibilitySnapshot = annotationObjects.map(obj => obj.visible);
            
            let dataUrl = '';
            
            try {
                // Hide annotations
                annotationObjects.forEach(obj => (obj.visible = false));
                
                // Hide active selection controls if any
                const activeObject = this.canvas!.getActiveObject();
                if (activeObject) {
                    this.canvas!.discardActiveObject();
                }

                // Get visible objects (content only)
                const visibleObjects = this.canvas!.getObjects().filter(obj => obj.visible !== false);

                if (visibleObjects.length > 0) {
                    const group = new fabric.Group(visibleObjects);

                    const scaleX = targetWidth / originalWidth;
                    const scaleY = targetHeight / originalHeight;
                    const scale = Math.min(scaleX, scaleY) * 0.95; // 95% fit

                    group.scale(scale);
                    this.canvas!.centerObject(group);
                    group.setCoords();

                    // Fabric 6 uses remove() or destroys implicitly by returning objects
                    group.removeAll();
                    this.canvas!.renderAll();
                }

                dataUrl = this.canvas!.toDataURL({
                    format: 'png',
                    quality: 1,
                    multiplier: 1
                });
            } finally {
                // Restore annotation visibility BEFORE restoring JSON, just in case
                annotationObjects.forEach((obj, i) => (obj.visible = visibilitySnapshot[i] ?? true));
            }

            return new Promise((resolve) => {
                this.canvas!.loadFromJSON(jsonState, () => {
                    resolve(dataUrl);
                });
            });
        };

        try {
            // TikTok / Reels (9:16)
            const tiktok = await exportForDimensions(1080, 1920);

            // Instagram Post (1:1)
            const instagram = await exportForDimensions(1080, 1080);

            // YouTube Wide (16:9)
            const youtube = await exportForDimensions(1920, 1080);

            // Restore canvas
            this.canvas.setDimensions({ width: originalWidth, height: originalHeight });
            this.canvas.renderAll();

            return { tiktok, instagram, youtube };
        } catch (error: unknown) {
            logger.error('[CanvasBatching] Failed to export batch dimensions:', error);
            this.canvas.setDimensions({ width: originalWidth, height: originalHeight });
            return null;
        }
    }

    /**
     * Export canvas to JSON string
     */
    async toJSON(): Promise<any> {
        if (!this.canvas) return null;
        return (this.canvas as any).toJSON(['data', 'id']);
    }

    /**
     * Load canvas from JSON string
     */
    async loadFromJSON(json: string): Promise<void> {
        if (!this.canvas) return;
        try {
            await this.canvas.loadFromJSON(JSON.parse(json));
            this.canvas.renderAll();
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error(`Failed to load canvas from JSON: ${message}`);
        }
    }

    /**
     * Check if canvas is initialized
     */
    isInitialized(): boolean {
        return this.canvas !== null;
    }

    /**
     * Add a rectangle shape to canvas
     */
    addRectangle(color: string = 'rgba(255,0,0,0.5)'): void {
        if (!this.canvas) return;
        const rect = new fabric.Rect({
            left: 100,
            top: 100,
            fill: color.includes('rgba') ? color : hexToRgba(color, 0.5),
            width: 100,
            height: 100,
            data: { isAnnotation: true }
        });
        this.canvas.add(rect);
        this.canvas.renderAll();
        this.saveHistoryState();
    }

    /**
     * Add a circle shape to canvas
     */
    addCircle(color: string = 'rgba(0,255,0,0.5)'): void {
        if (!this.canvas) return;
        const circle = new fabric.Circle({
            left: 200,
            top: 200,
            fill: color.includes('rgba') ? color : hexToRgba(color, 0.5),
            radius: 50,
            data: { isAnnotation: true }
        });
        this.canvas.add(circle);
        this.canvas.renderAll();
        this.saveHistoryState();
    }

    /**
     * Add editable text to canvas
     */
    addText(content: string = 'Edit Me', fill: string = '#ffffff'): void {
        if (!this.canvas) return;
        const text = new fabric.IText(content, {
            left: 300,
            top: 300,
            fill: fill,
            fontSize: 24,
        });
        this.canvas.add(text);
        this.canvas.renderAll();
    }

    /**
     * Returns a high-res data URL of the canvas with all annotation overlays
     * (drawing paths, bounding boxes, segmentation masks) temporarily hidden.
     * This ensures saved/exported images contain only the actual artwork.
     */
    private getFlattenedDataURL(options?: { format?: string; quality?: number; multiplier?: number; excludeAnnotations?: boolean }): string {
        if (!this.canvas) return '';

        const allObjects = this.canvas.getObjects();
        const excludeAnnotations = options?.excludeAnnotations !== false;

        // Identify every annotation object on the canvas
        const annotationObjects = excludeAnnotations ? allObjects.filter(obj => this.isAnnotation(obj)) : [];

        // Snapshot current visibility so we can restore after export
        const visibilitySnapshot = annotationObjects.map(obj => obj.visible);

        try {
            // Hide all annotations
            annotationObjects.forEach(obj => (obj.visible = false));
            
            // Also hide selection handles/borders for a clean export
            const activeObject = this.canvas.getActiveObject();
            if (activeObject) {
                this.canvas.discardActiveObject();
            }
            
            this.canvas.renderAll();

            const dataUrl = this.canvas.toDataURL({
                format: (options?.format as 'png' | 'jpeg') ?? 'png',
                quality: options?.quality ?? 1,
                multiplier: options?.multiplier ?? 2,
            });

            return dataUrl;
        } finally {
            // Restore original visibility
            annotationObjects.forEach((obj, i) => (obj.visible = visibilitySnapshot[i] ?? true));
            this.canvas.renderAll();
        }
    }

    /**
     * Flatten the canvas: Consolidates all visible layers (excluding annotations) 
     * into a single new base image and clears the current layer stack.
     * This effectively "bakes" all current edits into the base.
     */
    async flattenCanvas(): Promise<boolean> {
        if (!this.canvas) return false;

        logger.info('[CanvasOps] Flattening canvas layers...');
        
        // 1. Get high-fidelity flattened image (hides annotations automatically)
        const flattenedDataUrl = this.getFlattenedDataURL({ 
            format: 'png', 
            quality: 1, 
            multiplier: 2 // Export at 2x for better quality
        });
        
        if (!flattenedDataUrl) return false;

        try {
            // 2. Load the new flattened image
            const newBaseImg = await this.loadImageSafe(flattenedDataUrl);
            
            // 3. Clear canvas and add new flattened image
            const width = this.canvas.getWidth();
            const height = this.canvas.getHeight();
            
            this.canvas.clear();
            this.canvas.backgroundColor = '#1a1a1a';
            this.canvas.setDimensions({ width, height });
            
            newBaseImg.set('data', { isBaseImage: true });
            scaleImageToCanvas(newBaseImg, this.canvas);
            this.canvas.add(newBaseImg);
            
            this.canvas.renderAll();
            
            logger.info('[CanvasOps] Canvas flattened successfully');
            return true;
        } catch (err) {
            logger.error('[CanvasOps] Failed to flatten canvas:', err);
            return false;
        }
    }

    /**
     * Get canvas as PNG data URL (annotations excluded from output)
     */
    saveCanvas(): string {
        if (!this.canvas) return '';
        return this.getFlattenedDataURL({ format: 'png', quality: 1, multiplier: 2 });
    }

    /**
     * Get canvas as Blob for uploading (annotations excluded from output)
     */
    async getBlob(): Promise<Blob | null> {
        if (!this.canvas) return null;

        const dataUrl = this.getFlattenedDataURL({ format: 'png', quality: 1, multiplier: 2 });

        try {
            const res = await fetch(dataUrl);
            return await res.blob();
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error(`Failed to create blob from canvas: ${message}`);
            return null;
        }
    }

    /**
     * Enable or disable magic fill (free drawing) mode
     */
    setMagicFillMode(enabled: boolean, color: CreativeColor): void {
        if (!this.canvas) return;

        if (enabled) {
            this.canvas.isDrawingMode = true;
            this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
            this.canvas.freeDrawingBrush.width = 30;
            this.canvas.freeDrawingBrush.color = hexToRgba(color.hex, 0.5);
            this._activeColorId = color.id;

            // Remove previous handler if any
            if (this._pathCreatedHandler) {
                this.canvas.off('path:created', this._pathCreatedHandler);
            }

            // Stamp colorId on every new path so mask extraction can reliably identify them
            this._pathCreatedHandler = (e: { path: fabric.FabricObject }) => {
                if (e.path) {
                    e.path.set('data', { colorId: this._activeColorId });
                }
            };
            this.canvas.on('path:created', this._pathCreatedHandler);
        } else {
            this.canvas.isDrawingMode = false;
            if (this._pathCreatedHandler) {
                this.canvas.off('path:created', this._pathCreatedHandler);
                this._pathCreatedHandler = null;
            }
        }
    }

    /**
     * Update brush color for magic fill mode
     */
    updateBrushColor(color: CreativeColor): void {
        if (!this.canvas) return;
        this._activeColorId = color.id;

        if (this.canvas.isDrawingMode) {
            // Ensure brush exists — handles edge case where color changes before brush is created
            if (!this.canvas.freeDrawingBrush) {
                this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
                this.canvas.freeDrawingBrush.width = 30;
            }
            this.canvas.freeDrawingBrush.color = hexToRgba(color.hex, 0.5);
        }
    }

    /**
     * Set the active drawing tool
     */
    setTool(tool: 'select' | 'line' | 'polygon' | 'text' | 'brush', color?: CreativeColor): void {
        if (!this.canvas) return;
        
        this._activeTool = tool;
        this._activeColorId = color?.id || '';
        this._points = [];
        this._currentShape = null;
        this._isDrawing = false;

        // Reset canvas state for different tools
        this.canvas.isDrawingMode = tool === 'brush';
        this.canvas.selection = tool === 'select';
        this.canvas.defaultCursor = tool === 'select' ? 'default' : 'crosshair';

        if (tool === 'brush' && color) {
            this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
            this.canvas.freeDrawingBrush.color = hexToRgba(color.hex, 0.5);
            this.canvas.freeDrawingBrush.width = 30;
            
            // Stamp colorId on every new path
            if (this._pathCreatedHandler) {
                this.canvas.off('path:created', this._pathCreatedHandler);
            }
            this._pathCreatedHandler = (e: { path: fabric.FabricObject }) => {
                if (e.path) {
                    e.path.set('data', { colorId: this._activeColorId, isAnnotation: true });
                }
            };
            this.canvas.on('path:created', this._pathCreatedHandler);
        }

        if (tool === 'select') {
            this.canvas.getObjects().forEach(obj => {
                obj.selectable = true;
                obj.evented = true;
            });
        } else {
            this.canvas.getObjects().forEach(obj => {
                obj.selectable = false;
                obj.evented = false;
            });
        }

        if (tool === 'text') {
            this.addText('New Text', color?.hex || '#ffffff');
            // We stay in text tool if the user wants to add more? 
            // The request says "text input directly on the canvas".
            // Typically after adding one, you might want to edit it.
            this.setTool('select', color);
        }

        this.canvas.renderAll();
    }

    private stopDrawingTool(): void {
        if (!this.canvas) return;
        this.canvas.isDrawingMode = false;
        this.canvas.selection = true;
        this.canvas.off('mouse:down');
        this.canvas.off('mouse:move');
        this.canvas.off('mouse:up');
        this.canvas.off('mouse:dblclick');
        this._isDrawing = false;
        this._currentShape = null;
        this._points = [];
    }

    private finishPolygon(color: string): void {
        if (!this.canvas || this._points.length < 3) return;
        
        this.canvas.remove(this._currentShape!);
        const polygon = new fabric.Polygon(this._points, {
            fill: hexToRgba(color, 0.2),
            stroke: color,
            strokeWidth: 2,
            selectable: true,
            data: { isAnnotation: true }
        });
        
        this.canvas.add(polygon);
        this._points = [];
        this._currentShape = null;
        this.canvas.renderAll();
        this.saveHistoryState();
    }

    /**
     * Workflow A: Visual Prompting
     * Returns a flattened image containing both the original content and the user's colorful highlights.
     * Best for gemini-3-pro-image-preview.
     */
    async prepareVisualPrompt(): Promise<{ mimeType: string, data: string } | null> {
        if (!this.canvas) return null;

        // Ensure all layers are visible for flattened export
        const objects = this.canvas.getObjects();
        objects.forEach(obj => (obj.visible = true));

        this.canvas.renderAll();

        // Export flattened canvas at 1x multiplier for prompt precision
        const dataUrl = this.canvas.toDataURL({
            format: 'png',
            multiplier: 1
        });

        return {
            mimeType: 'image/png',
            data: dataUrl.split(',')[1] ?? ''
        };
    }

    /**
     * Workflow B: Strict Masking
     * Extracts isolated binary masks (White on Black) for each annotated color.
     * Best for gemini-2.5-flash-image.
     */
    prepareMasksForEdit(
        definitions: Record<string, string>,
        referenceImages: Record<string, { mimeType: string; data: string } | null>
    ): PreparedMasks | null {
        if (!this.canvas) return null;

        const activeDefinitions = Object.entries(definitions).filter(
            ([, val]) => val.trim().length > 0
        );
        if (activeDefinitions.length === 0) return null;

        const originalObjects = this.canvas.getObjects();
        const maskObjects = originalObjects.filter(obj => this.isAnnotation(obj));
        const contentObjects = originalObjects.filter(obj => !this.isAnnotation(obj));

        // Store original canvas background
        const originalBg = this.canvas.backgroundColor;

        try {
            // Step 1: Generate Base Image (Content only, hide all annotations)
            maskObjects.forEach(obj => (obj.visible = false));
            contentObjects.forEach(obj => (obj.visible = true));

            this.canvas.backgroundColor = '#000000'; // Black background for clean content extraction if transparent

            this.canvas.renderAll();

            const baseDataUrl = this.canvas.toDataURL({ format: 'png', multiplier: 1 });
            const baseImage = {
                mimeType: 'image/png',
                data: baseDataUrl.split(',')[1] ?? ''
            };

            const masks: MaskData[] = [];

            // Step 2: Extract Binary Masks for each defined color
            for (const [colorId, prompt] of activeDefinitions) {
                const colorDef = STUDIO_COLORS.find(c => c.id === colorId);
                if (!colorDef) continue;

                // Primary: match by stamped colorId (reliable across save/restore cycles)
                // Fallback: legacy string-matching for paths drawn before this fix
                const colorPaths = maskObjects.filter(obj => {
                    const data = (obj as fabric.Object & { data?: { colorId?: string } }).data;
                    if (data?.colorId) {
                        return data.colorId === colorId;
                    }
                    // Fallback: legacy paths without colorId — try approximate stroke matching
                    const targetRgbaStart = hexToRgba(colorDef.hex, 0.5).slice(0, -4);
                    const stroke = obj.stroke;
                    return stroke && typeof stroke === 'string' && stroke.startsWith(targetRgbaStart);
                });

                if (colorPaths.length > 0) {
                    // Hide ALL objects initially
                    originalObjects.forEach(obj => (obj.visible = false));

                    // Show only matching paths and transform them to pure WHITE
                    colorPaths.forEach(obj => {
                        obj.visible = true;
                        if (obj.type === 'path') {
                            // Store original properties to restore later
                            (obj as fabric.Object & { _originalStroke?: typeof obj.stroke })._originalStroke = obj.stroke;
                            obj.set({ stroke: '#ffffff', fill: '' });
                        } else if (obj.type === 'image' && (obj as fabric.Object & { data?: { isSegmentationMask?: boolean } }).data?.isSegmentationMask) {
                            // For AI masks, bypass tint explicitly so it becomes pure binary
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const imgObj = obj as fabric.Image & { _originalOpacity?: number, _originalFilters?: any[] };
                            imgObj._originalOpacity = obj.opacity;
                            obj.set({ opacity: 1.0 });
                            if (imgObj.filters) {
                                imgObj._originalFilters = [...imgObj.filters];
                                imgObj.filters = [];
                                imgObj.applyFilters();
                            }
                        }
                    });

                    // Clear background to pure BLACK for strict binary mask
                    this.canvas.backgroundColor = '#000000';
                    this.canvas.renderAll();
                    const maskDataUrl = this.canvas.toDataURL({ format: 'png', multiplier: 1 });

                    masks.push({
                        mimeType: 'image/png',
                        data: maskDataUrl.split(',')[1] ?? '',
                        prompt,
                        colorId,
                        referenceImage: referenceImages[colorId] || undefined
                    });

                    // Restore original properties for these objects
                    colorPaths.forEach(obj => {
                        if (obj.type === 'path') {
                            obj.set({ stroke: (obj as fabric.Object & { _originalStroke?: typeof obj.stroke })._originalStroke });
                        } else if (obj.type === 'image' && (obj as fabric.Object & { data?: { isSegmentationMask?: boolean } }).data?.isSegmentationMask) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const imgObj = obj as fabric.Image & { _originalOpacity?: number, _originalFilters?: any[] };
                            obj.set({ opacity: imgObj._originalOpacity });
                            if (imgObj._originalFilters) {
                                imgObj.filters = imgObj._originalFilters;
                                imgObj.applyFilters();
                            }
                        }
                    });
                }
            }

            if (masks.length === 0) return null;

            return { baseImage, masks };
        } finally {
            // Restore visual state for the user
            originalObjects.forEach(obj => (obj.visible = true));
            this.canvas.backgroundColor = originalBg;
            this.canvas.renderAll();
        }
    }

    /**
     * Apply a candidate image as new canvas base (Daisy Chain)
     */
    async applyCandidateImage(
        candidateUrl: string,
        magicFillEnabled: boolean,
        activeColor: CreativeColor
    ): Promise<void> {
        if (!this.canvas) return;

        const img = await this.loadImageSafe(candidateUrl);

        // Ensure standard dimensions
        img.scaleToWidth(this.canvas.width!);
        img.set({
            left: this.canvas.width! / 2,
            top: this.canvas.height! / 2,
            originX: 'center',
            originY: 'center'
        });

        // Clear and update
        this.canvas.clear();
        this.canvas.backgroundColor = '#1a1a1a';
        img.set('data', { isBaseImage: true });
        this.canvas.add(img);

        if (magicFillEnabled) {
            this.canvas.isDrawingMode = true;
            this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
            this.canvas.freeDrawingBrush.width = 30;
            this.canvas.freeDrawingBrush.color = hexToRgba(activeColor.hex, 0.5);
        }

        this.canvas.renderAll();
    }

    /**
     * Extracts a binary "Ghost Mask" for Gemini 3 Dual-View.
     * White pixels = Edit Area.
     * Black pixels = Keep Context.
     */
    extractGeminiMask(): string | null {
        if (!this.canvas) return null;

        // 1. Save State
        const originalBg = this.canvas.backgroundColor;
        const originalObjects = this.canvas.getObjects();
        const originalState = originalObjects.map(obj => ({
            visible: obj.visible,
            stroke: obj.stroke,
            fill: obj.fill,
            opacity: obj.opacity,
            filters: obj.type === 'image' ? [...((obj as fabric.Image).filters || [])] : undefined
        }));

        // 2. Transform to Binary Mask Mode
        this.canvas.backgroundColor = "#000000"; // Black Context
        // this.canvas.backgroundImage = null; // CanvasOperationsService uses an image object, not backgroundImage property usually

        originalObjects.forEach(obj => {
            const data = (obj as fabric.Object & { data?: { isBoundingBox?: boolean, isSegmentationMask?: boolean } }).data;
            
            if (this.isAnnotation(obj)) {
                if (obj.type === 'path') {
                    obj.set({
                        stroke: "#FFFFFF",
                        fill: (obj.fill && obj.fill !== 'transparent') ? "#FFFFFF" : undefined,
                        opacity: 1,
                        visible: true
                    });
                } else if (data?.isBoundingBox) {
                    obj.set({
                        stroke: "#FFFFFF",
                        fill: "#FFFFFF",
                        opacity: 1,
                        visible: true
                    });
                } else if (data?.isSegmentationMask) {
                    const imgObj = obj as fabric.Image;
                    const whiteFilter = new fabric.filters.BlendColor({
                        color: '#FFFFFF',
                        mode: 'add',
                        alpha: 1.0
                    });
                    imgObj.filters = [whiteFilter];
                    imgObj.applyFilters();
                    imgObj.set({
                        opacity: 1.0,
                        visible: true
                    });
                }
            } else {
                obj.visible = false;
            }
        });

        this.canvas.renderAll();

        // 3. Export
        const dataUrl = this.canvas.toDataURL({
            format: 'png',
            multiplier: 1
        });

        // 4. Restore State
        this.canvas.backgroundColor = originalBg;

        originalObjects.forEach((obj, index) => {
            const state = originalState[index];
            if (!state) return;
            obj.set({
                visible: state.visible,
                stroke: state.stroke,
                fill: state.fill,
                opacity: state.opacity
            });
            if (obj.type === 'image' && state.filters) {
                const imgObj = obj as fabric.Image;
                imgObj.filters = state.filters;
                imgObj.applyFilters();
            }
        });

        this.canvas.renderAll();

        return dataUrl.split(',')[1] ?? null;
    }

    /**
     * Extracts a Multi-Color "Semantic Mask" for Pro Editing.
     * Preserves stroke colors (at 100% opacity) to distinguish regions.
     * Black pixels = Context.
     */
    extractSemanticMask(): string | null {
        if (!this.canvas) return null;

        // 1. Save State
        const originalBg = this.canvas.backgroundColor;
        const originalObjects = this.canvas.getObjects();
        const originalState = originalObjects.map(obj => ({
            visible: obj.visible,
            stroke: obj.stroke,
            opacity: obj.opacity
        }));

        // 2. Transform to Semantic Mask Mode
        this.canvas.backgroundColor = "#000000";

        originalObjects.forEach(obj => {
            const data = (obj as fabric.Object & { data?: { isSegmentationMask?: boolean, isBoundingBox?: boolean } }).data;
            const isMask = this.isAnnotation(obj);
            
            if (isMask) {
                if (data?.isBoundingBox) {
                    // For bounding boxes, we want a solid color, not just a border
                    obj.set({
                        fill: obj.stroke, // Use the bounding box color
                        opacity: 1.0,
                        visible: true
                    });
                } else {
                    obj.set({
                        opacity: 1.0,
                        visible: true
                    });
                }
            } else {
                obj.visible = false;
            }
        });

        this.canvas.renderAll();

        // 3. Export
        const dataUrl = this.canvas.toDataURL({
            format: 'png',
            multiplier: 1
        });

        // 4. Restore State
        this.canvas.backgroundColor = originalBg;

        originalObjects.forEach((obj, index) => {
            const state = originalState[index];
            if (!state) return;
            
            const data = (obj as fabric.Object & { data?: { isBoundingBox?: boolean } }).data;
            if (data?.isBoundingBox) {
                // Restore bounding box transparent fill
                obj.set({
                    fill: 'rgba(0, 255, 0, 0.1)',
                });
            }
            
            obj.set({
                visible: state.visible,
                stroke: state.stroke,
                opacity: state.opacity
            });
        });

        this.canvas.renderAll();

        return dataUrl.split(',')[1] ?? null;
    }

    /**
     * Get all layers (objects) on the canvas
     */
    getLayers(): any[] {
        if (!this.canvas) return [];
        return this.canvas.getObjects().map(obj => {
            const data = (obj as any).data || {};
            return {
                id: (obj as any).id || `layer_${Math.random().toString(36).substring(2, 9)}`,
                type: obj.type,
                visible: obj.visible,
                isBaseImage: !!data.isBaseImage,
                isAnnotation: this.isAnnotation(obj),
                colorId: data.colorId,
                label: data.label,
                object: obj
            };
        });
    }

    /**
     * Toggle visibility of a specific layer/object
     */
    toggleLayerVisibility(obj: fabric.Object, visible: boolean): void {
        if (!this.canvas) return;
        obj.set('visible', visible);
        this.canvas.renderAll();
    }
}

export const canvasOps = new CanvasOperationsService();
