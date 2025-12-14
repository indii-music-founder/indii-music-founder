import * as fabric from 'fabric';
import { hexToRgba, scaleImageToCanvas } from '@/lib/canvasUtils';
import { NANA_COLORS, NanaColor } from '../constants';

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
            fabric.Image.fromURL(imageUrl).then((img: fabric.Image) => {
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
     * Enable or disable magic fill (free drawing) mode
     */
    setMagicFillMode(enabled: boolean, color: NanaColor): void {
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
    updateBrushColor(color: NanaColor): void {
        if (!this.canvas?.isDrawingMode || !this.canvas.freeDrawingBrush) return;
        this.canvas.freeDrawingBrush.color = hexToRgba(color.hex, 0.5);
    }

    /**
     * Prepare masks for multi-edit processing
     * Extracts base image and color-coded masks from canvas
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

        // Generate base image (content only, no masks)
        maskObjects.forEach(obj => (obj.visible = false));
        this.canvas.backgroundColor = '#000000';
        const baseDataUrl = this.canvas.toDataURL({ format: 'png', multiplier: 1 });
        const baseImage = {
            mimeType: 'image/png',
            data: baseDataUrl.split(',')[1]
        };

        const masks: MaskData[] = [];

        for (const [colorId, prompt] of activeDefinitions) {
            const colorDef = NANA_COLORS.find(c => c.id === colorId);
            if (!colorDef) continue;

            const targetRgbaStart = hexToRgba(colorDef.hex, 0.5).slice(0, -4); // Remove ', 0.5)' for partial match

            const colorPaths = maskObjects.filter(obj => {
                return obj.stroke && obj.stroke.toString().startsWith(targetRgbaStart);
            });

            if (colorPaths.length > 0) {
                // Hide all objects
                originalObjects.forEach(obj => (obj.visible = false));

                // Show only matching paths as white
                colorPaths.forEach(obj => {
                    obj.visible = true;
                    obj.set({ stroke: '#ffffff', fill: '' });
                });

                this.canvas.backgroundColor = '#000000';
                const maskDataUrl = this.canvas.toDataURL({ format: 'png', multiplier: 1 });

                masks.push({
                    mimeType: 'image/png',
                    data: maskDataUrl.split(',')[1],
                    prompt,
                    colorId,
                    referenceImage: referenceImages[colorId] || undefined
                });

                // Restore visual state for these paths
                const colorRgba = hexToRgba(colorDef.hex, 0.5);
                colorPaths.forEach(obj => {
                    obj.set({ stroke: colorRgba });
                });
            }
        }

        // Restore all visibility
        originalObjects.forEach(obj => (obj.visible = true));
        this.canvas.backgroundColor = '#1a1a1a';
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
        activeColor: NanaColor
    ): Promise<void> {
        if (!this.canvas) return;

        const img = await fabric.Image.fromURL(candidateUrl);
        img.scaleToWidth(this.canvas.width!);
        img.set({
            left: this.canvas.width! / 2,
            top: this.canvas.height! / 2,
            originX: 'center',
            originY: 'center'
        });

        // Clear old canvas and add new base
        this.canvas.clear();
        this.canvas.backgroundColor = '#1a1a1a';
        this.canvas.add(img);

        // Re-initialize brush if in magic fill mode
        if (magicFillEnabled) {
            this.canvas.isDrawingMode = true;
            this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
            this.canvas.freeDrawingBrush.width = 30;
            this.canvas.freeDrawingBrush.color = hexToRgba(activeColor.hex, 0.5);
        } else {
            this.canvas.isDrawingMode = false;
        }

        this.canvas.renderAll();
    }
}

export const canvasOps = new CanvasOperationsService();
