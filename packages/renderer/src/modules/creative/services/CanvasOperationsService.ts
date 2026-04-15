import * as fabric from 'fabric';
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
        // Fast path for data URIs — no CORS issues possible
        if (url.startsWith('data:')) {
            return fabric.Image.fromURL(url, { crossOrigin: 'anonymous' });
        }

        // Attempt 1: Direct load
        try {
            const img = await fabric.Image.fromURL(url, { crossOrigin: 'anonymous' });
            // Verify the image actually loaded (width/height > 0)
            if (img.width && img.width > 0 && img.height && img.height > 0) {
                return img;
            }
            throw new Error('Image loaded but has zero dimensions');
        } catch (directErr: unknown) {
            logger.warn('[CanvasOps] Direct image load failed (likely CORS), attempting blob fallback:', directErr);
        }

        // Attempt 2: Fetch via safeStorageFetch → blob URL (bypasses CORS)
        try {
            const { safeStorageFetch } = await import('@/services/storage/safeStorageFetch');
            const { blob } = await safeStorageFetch(url);
            const blobUrl = URL.createObjectURL(blob);
            this._activeBlobUrls.push(blobUrl);

            const img = await fabric.Image.fromURL(blobUrl, { crossOrigin: 'anonymous' });
            if (img.width && img.width > 0 && img.height && img.height > 0) {
                logger.info('[CanvasOps] Image loaded via blob URL fallback');
                return img;
            }
            throw new Error('Blob-loaded image has zero dimensions');
        } catch (blobErr: unknown) {
            logger.warn('[CanvasOps] Blob fallback also failed, trying Image element:', blobErr);
        }

        // Attempt 3: Raw Image element load → canvas → data URL → Fabric
        return new Promise<fabric.Image>((resolve, reject) => {
            const htmlImg = new Image();
            htmlImg.crossOrigin = 'anonymous';
            htmlImg.onload = async () => {
                try {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = htmlImg.naturalWidth;
                    tempCanvas.height = htmlImg.naturalHeight;
                    const ctx = tempCanvas.getContext('2d');
                    if (!ctx) throw new Error('Canvas 2D context unavailable');
                    ctx.drawImage(htmlImg, 0, 0);
                    const dataUrl = tempCanvas.toDataURL('image/png');
                    const fabricImg = await fabric.Image.fromURL(dataUrl, { crossOrigin: 'anonymous' });
                    resolve(fabricImg);
                } catch (canvasErr) {
                    reject(canvasErr);
                }
            };
            htmlImg.onerror = () => {
                // Final fallback: try without crossOrigin for display-only (won't be exportable)
                const fallbackImg = new Image();
                fallbackImg.onload = async () => {
                    try {
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = fallbackImg.naturalWidth;
                        tempCanvas.height = fallbackImg.naturalHeight;
                        const ctx = tempCanvas.getContext('2d');
                        if (!ctx) throw new Error('Canvas 2D context unavailable');
                        ctx.drawImage(fallbackImg, 0, 0);
                        const dataUrl = tempCanvas.toDataURL('image/png');
                        const fabricImg = await fabric.Image.fromURL(dataUrl, { crossOrigin: 'anonymous' });
                        logger.info('[CanvasOps] Image loaded via no-crossOrigin fallback');
                        resolve(fabricImg);
                    } catch (e) {
                        reject(e);
                    }
                };
                fallbackImg.onerror = () => reject(new Error(`All image load strategies failed for: ${url}`));
                fallbackImg.src = url;
            };
            htmlImg.src = url;
        });
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
            this.canvas.on('object:modified', onChange);
            this.canvas.on('object:added', onChange);
            this.canvas.on('object:removed', onChange);
            this.canvas.on('path:created', onChange);
        }

        return this.canvas;
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
            if (objects.length > 0) {
                const group = new fabric.Group(objects);

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

            const dataUrl = this.canvas!.toDataURL({
                format: 'png',
                quality: 1,
                multiplier: 1
            });

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
    addRectangle(): void {
        if (!this.canvas) return;
        const rect = new fabric.Rect({
            left: 100,
            top: 100,
            fill: 'rgba(255,0,0,0.5)',
            width: 100,
            height: 100,
        });
        this.canvas.add(rect);
    }

    /**
     * Add a circle shape to canvas
     */
    addCircle(): void {
        if (!this.canvas) return;
        const circle = new fabric.Circle({
            left: 200,
            top: 200,
            fill: 'rgba(0,255,0,0.5)',
            radius: 50,
        });
        this.canvas.add(circle);
    }

    /**
     * Add editable text to canvas
     */
    addText(): void {
        if (!this.canvas) return;
        const text = new fabric.IText('Edit Me', {
            left: 300,
            top: 300,
            fill: '#ffffff',
            fontSize: 24,
        });
        this.canvas.add(text);
    }

    /**
     * Save canvas as PNG file download
     */
    saveCanvas(filename: string): string {
        if (!this.canvas) return '';
        const dataUrl = this.canvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 2
        });

        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return dataUrl;
    }

    /**
     * Get canvas as Blob for uploading
     */
    async getBlob(): Promise<Blob | null> {
        if (!this.canvas) return null;

        // simple dataURL to blob conversion
        const dataUrl = this.canvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 2
        });

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
     * Workflow A: Visual Prompting
     * Returns a flattened image containing both the original content and the user's colorful highlights.
     * Best for gemini-3-pro-image-preview.
     */
    async prepareVisualPrompt(): Promise<{ mimeType: string, data: string } | null> {
        if (!this.canvas) return null;

        // Ensure all layers are visible for flattened export
        const objects = this.canvas.getObjects();
        objects.forEach(obj => (obj.visible = true));

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
        const maskObjects = originalObjects.filter(obj => obj.type === 'path');
        const contentObjects = originalObjects.filter(obj => obj.type !== 'path');

        // Step 1: Generate Base Image (Content only, hide all annotations)
        maskObjects.forEach(obj => (obj.visible = false));
        contentObjects.forEach(obj => (obj.visible = true));

        // Store original canvas background
        const originalBg = this.canvas.backgroundColor;
        this.canvas.backgroundColor = '#000000'; // Black background for clean content extraction if transparent

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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = (obj as any).data;
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
                    // Store original properties to restore later
                    (obj as fabric.Object & { _originalStroke?: typeof obj.stroke })._originalStroke = obj.stroke;
                    obj.set({ stroke: '#ffffff', fill: '' });
                });

                // Clear background to pure BLACK for strict binary mask
                this.canvas.backgroundColor = '#000000';
                const maskDataUrl = this.canvas.toDataURL({ format: 'png', multiplier: 1 });

                masks.push({
                    mimeType: 'image/png',
                    data: maskDataUrl.split(',')[1] ?? '',
                    prompt,
                    colorId,
                    referenceImage: referenceImages[colorId] || undefined
                });

                // Restore original stroke for these paths
                colorPaths.forEach(obj => {
                    obj.set({ stroke: (obj as fabric.Object & { _originalStroke?: typeof obj.stroke })._originalStroke });
                });
            }
        }

        // Restore visual state for the user
        originalObjects.forEach(obj => (obj.visible = true));
        this.canvas.backgroundColor = originalBg;
        this.canvas.renderAll();

        if (masks.length === 0) return null;

        return { baseImage, masks };
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
            opacity: obj.opacity
        }));

        // 2. Transform to Binary Mask Mode
        this.canvas.backgroundColor = "#000000"; // Black Context
        // this.canvas.backgroundImage = null; // CanvasOperationsService uses an image object, not backgroundImage property usually

        originalObjects.forEach(obj => {
            // Only mask "path" objects (user drawings) -> White
            if (obj.type === 'path') {
                obj.set({
                    stroke: "#FFFFFF",
                    fill: (obj.fill && obj.fill !== 'transparent') ? "#FFFFFF" : undefined, // Keep fill logic if present
                    opacity: 1,
                    visible: true
                });
            } else {
                // Hide other content (base image, etc)
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
            if (obj.type === 'path') {
                // Determine the "True Color" (Opaque) from the stroke
                // Usually stroke is rgba(r,g,b,0.5). We want rgb(r,g,b) or hex.
                // For now, we trust the stroke color but pump opacity to 1.0
                obj.set({
                    opacity: 1.0,
                    visible: true
                });
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
                opacity: state.opacity
            });
        });

        this.canvas.renderAll();

        return dataUrl.split(',')[1] ?? null;
    }

    /**
     * Convert canvas to JSON
     */
    async toJSON(): Promise<string | null> {
        if (!this.canvas) return null;
        // Include 'data' property so colorId survives serialization/deserialization
        // Fabric 6: toJSON() takes no args; use toObject() for custom property inclusion
        const json = this.canvas.toObject(['data']);
        return JSON.stringify(json);
    }
}

export const canvasOps = new CanvasOperationsService();
