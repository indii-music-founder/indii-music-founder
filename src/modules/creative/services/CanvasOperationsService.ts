import * as fabric from 'fabric';
import { hexToRgba, scaleImageToCanvas } from '@/lib/canvasUtils';
import { STUDIO_COLORS, CreativeColor } from '../constants';

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

    /**
     * Initialize a Fabric.js canvas with optional image
     */
    initialize(
        canvasElement: HTMLCanvasElement,
        imageUrl?: string,
        onReady?: () => void
    ): fabric.Canvas {
        this.canvas = new fabric.Canvas(canvasElement, {
            width: 800,
            height: 600,
            backgroundColor: '#1a1a1a',
        });

        if (imageUrl) {
            fabric.Image.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then((img: fabric.Image) => {
                if (!this.canvas) return;
                scaleImageToCanvas(img, this.canvas);
                this.canvas.add(img);
                this.canvas.renderAll();
                onReady?.();
            });
        } else {
            onReady?.();
        }

        return this.canvas;
    }

    /**
     * Dispose of the canvas and cleanup
     */
    dispose(): void {
        if (this.canvas) {
            this.canvas.dispose();
            this.canvas = null;
        }
    }

    /**
     * Get the current canvas instance
     */
    getCanvas(): fabric.Canvas | null {
        return this.canvas;
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
            console.error(`Failed to load canvas from JSON: ${message}`);
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
            console.error(`Failed to create blob from canvas: ${message}`);
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
        } else {
            this.canvas.isDrawingMode = false;
        }
    }

    /**
     * Update brush color for magic fill mode
     */
    updateBrushColor(color: CreativeColor): void {
        if (!this.canvas?.isDrawingMode || !this.canvas.freeDrawingBrush) return;
        this.canvas.freeDrawingBrush.color = hexToRgba(color.hex, 0.5);
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
            data: dataUrl.split(',')[1]
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
            data: baseDataUrl.split(',')[1]
        };

        const masks: MaskData[] = [];

        // Step 2: Extract Binary Masks for each defined color
        for (const [colorId, prompt] of activeDefinitions) {
            const colorDef = STUDIO_COLORS.find(c => c.id === colorId);
            if (!colorDef) continue;

            const targetRgbaStart = hexToRgba(colorDef.hex, 0.5).slice(0, -4);

            const colorPaths = maskObjects.filter(obj => {
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
                    (obj as any)._originalStroke = obj.stroke;
                    obj.set({ stroke: '#ffffff', fill: '' });
                });

                // Clear background to pure BLACK for strict binary mask
                this.canvas.backgroundColor = '#000000';
                const maskDataUrl = this.canvas.toDataURL({ format: 'png', multiplier: 1 });

                masks.push({
                    mimeType: 'image/png',
                    data: maskDataUrl.split(',')[1],
                    prompt,
                    colorId,
                    referenceImage: referenceImages[colorId] || undefined
                });

                // Restore original stroke for these paths
                colorPaths.forEach(obj => {
                    obj.set({ stroke: (obj as any)._originalStroke });
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

        const img = await fabric.Image.fromURL(candidateUrl, { crossOrigin: 'anonymous' });

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
            obj.set({
                visible: state.visible,
                stroke: state.stroke,
                fill: state.fill,
                opacity: state.opacity
            });
        });

        this.canvas.renderAll();

        return dataUrl.split(',')[1];
    }

    /**
     * Convert canvas to JSON
     */
    async toJSON(): Promise<string | null> {
        if (!this.canvas) return null;
        const json = this.canvas.toJSON();
        return JSON.stringify(json);
    }
}

export const canvasOps = new CanvasOperationsService();
