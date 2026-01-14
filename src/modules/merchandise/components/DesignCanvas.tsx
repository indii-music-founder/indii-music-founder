import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { Loader2 } from 'lucide-react';
import { useStore } from '@/core/store';

export interface CanvasObject {
    id: string;
    type: 'image' | 'text' | 'shape';
    name: string;
    visible: boolean;
    locked: boolean;
    fabricObject: fabric.Object;
}

export interface DesignCanvasProps {
    onExport?: (dataUrl: string) => void;
    onLayersChange?: (objects: CanvasObject[]) => void;
    onSelectionChange?: (selected: CanvasObject | null) => void;
    onCanvasReady?: (canvas: fabric.Canvas) => void;
}

export const DesignCanvas: React.FC<DesignCanvasProps> = ({
    onExport,
    onLayersChange,
    onSelectionChange,
    onCanvasReady
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize Fabric.js canvas
    useEffect(() => {
        if (!canvasRef.current || fabricCanvasRef.current) return;

        const canvas = new fabric.Canvas(canvasRef.current, {
            width: 800,
            height: 1000,
            backgroundColor: '#000000',
            preserveObjectStacking: true,
            selection: true,
            renderOnAddRemove: true,
            enableRetinaScaling: true,
        });

        // Enable object controls
        fabric.Object.prototype.set({
            transparentCorners: false,
            borderColor: '#FFE135',
            cornerColor: '#FFE135',
            cornerSize: 10,
            cornerStyle: 'circle',
            borderScaleFactor: 2,
        });

        fabricCanvasRef.current = canvas;
        setIsInitialized(true);

        // Notify parent that canvas is ready
        if (onCanvasReady) {
            onCanvasReady(canvas);
        }

        // Selection change handler
        canvas.on('selection:created', (e) => {
            handleSelectionChange(e.selected?.[0]);
        });

        canvas.on('selection:updated', (e) => {
            handleSelectionChange(e.selected?.[0]);
        });

        canvas.on('selection:cleared', () => {
            handleSelectionChange(null);
        });

        // Object modification handlers
        canvas.on('object:modified', () => {
            emitLayersChange();
        });

        canvas.on('object:added', () => {
            emitLayersChange();
        });

        canvas.on('object:removed', () => {
            emitLayersChange();
        });

        return () => {
            canvas.dispose();
            fabricCanvasRef.current = null;
        };
    }, []);

    // Handle selection changes
    const handleSelectionChange = useCallback((obj: fabric.Object | null | undefined) => {
        if (!obj) {
            onSelectionChange?.(null);
            return;
        }

        const canvasObj = convertFabricToCanvasObject(obj);
        onSelectionChange?.(canvasObj);
    }, [onSelectionChange]);

    // Emit layers change
    const emitLayersChange = useCallback(() => {
        if (!fabricCanvasRef.current) return;

        const objects = fabricCanvasRef.current.getObjects();
        const canvasObjects = objects.map(convertFabricToCanvasObject);
        onLayersChange?.(canvasObjects);
    }, [onLayersChange]);

    // Convert Fabric.js object to CanvasObject
    const convertFabricToCanvasObject = (obj: fabric.Object): CanvasObject => {
        return {
            id: obj.name || `obj-${Date.now()}`,
            type: obj.type === 'text' || obj.type === 'i-text' ? 'text' : obj.type === 'image' ? 'image' : 'shape',
            name: obj.name || `${obj.type} ${Date.now()}`,
            visible: obj.visible ?? true,
            locked: !obj.selectable,
            fabricObject: obj
        };
    };

    // Responsive canvas sizing
    useEffect(() => {
        const handleResize = () => {
            if (!containerRef.current || !fabricCanvasRef.current) return;

            const container = containerRef.current;
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            // Maintain aspect ratio (800x1000 = 4:5)
            const canvasAspect = 800 / 1000;
            const containerAspect = containerWidth / containerHeight;

            let scale: number;
            if (containerAspect > canvasAspect) {
                // Container is wider - fit to height
                scale = (containerHeight * 0.85) / 1000;
            } else {
                // Container is taller - fit to width
                scale = (containerWidth * 0.85) / 800;
            }

            fabricCanvasRef.current.setZoom(scale);
            fabricCanvasRef.current.setDimensions({
                width: 800 * scale,
                height: 1000 * scale
            });
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isInitialized]);

    return (
        <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]">
            {!isInitialized && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[#FFE135] animate-spin" />
                </div>
            )}
            <canvas ref={canvasRef} className="shadow-2xl" />
        </div>
    );
};

// Export canvas manipulation functions
export const useCanvasControls = (canvasRef: React.RefObject<fabric.Canvas | null>) => {
    const addImage = useCallback(async (imageUrl: string, name?: string) => {
        if (!canvasRef.current) return;

        return new Promise<void>((resolve, reject) => {
            fabric.Image.fromURL(imageUrl, (img) => {
                if (!img.width || !img.height) {
                    reject(new Error('Invalid image'));
                    return;
                }

                // Scale image to fit canvas (max 600px width/height)
                const maxSize = 600;
                const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

                img.set({
                    left: 100,
                    top: 100,
                    scaleX: scale,
                    scaleY: scale,
                    name: name || `Image ${Date.now()}`
                });

                canvasRef.current?.add(img);
                canvasRef.current?.setActiveObject(img);
                canvasRef.current?.renderAll();
                resolve();
            }, { crossOrigin: 'anonymous' });
        });
    }, [canvasRef]);

    const addText = useCallback((text: string = 'Your Text', options?: Partial<fabric.ITextOptions>) => {
        if (!canvasRef.current) return;

        const textObj = new fabric.IText(text, {
            left: 200,
            top: 200,
            fontSize: 60,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 'bold',
            fill: '#FFE135',
            name: `Text ${Date.now()}`,
            ...options
        });

        canvasRef.current.add(textObj);
        canvasRef.current.setActiveObject(textObj);
        canvasRef.current.renderAll();
    }, [canvasRef]);

    const deleteSelected = useCallback(() => {
        if (!canvasRef.current) return;

        const activeObjects = canvasRef.current.getActiveObjects();
        if (activeObjects.length === 0) return;

        activeObjects.forEach(obj => {
            canvasRef.current?.remove(obj);
        });

        canvasRef.current.discardActiveObject();
        canvasRef.current.renderAll();
    }, [canvasRef]);

    const bringToFront = useCallback(() => {
        if (!canvasRef.current) return;

        const activeObject = canvasRef.current.getActiveObject();
        if (!activeObject) return;

        canvasRef.current.bringToFront(activeObject);
        canvasRef.current.renderAll();
    }, [canvasRef]);

    const sendToBack = useCallback(() => {
        if (!canvasRef.current) return;

        const activeObject = canvasRef.current.getActiveObject();
        if (!activeObject) return;

        canvasRef.current.sendToBack(activeObject);
        canvasRef.current.renderAll();
    }, [canvasRef]);

    const exportToImage = useCallback((): string | null => {
        if (!canvasRef.current) return null;

        return canvasRef.current.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 2 // Export at 2x resolution
        });
    }, [canvasRef]);

    const clear = useCallback(() => {
        if (!canvasRef.current) return;

        canvasRef.current.clear();
        canvasRef.current.backgroundColor = '#000000';
        canvasRef.current.renderAll();
    }, [canvasRef]);

    const setBackgroundColor = useCallback((color: string) => {
        if (!canvasRef.current) return;

        canvasRef.current.backgroundColor = color;
        canvasRef.current.renderAll();
    }, [canvasRef]);

    const undo = useCallback(() => {
        // TODO: Implement undo/redo stack
        console.log('Undo not yet implemented');
    }, []);

    const redo = useCallback(() => {
        // TODO: Implement undo/redo stack
        console.log('Redo not yet implemented');
    }, []);

    return {
        addImage,
        addText,
        deleteSelected,
        bringToFront,
        sendToBack,
        exportToImage,
        clear,
        setBackgroundColor,
        undo,
        redo
    };
};
