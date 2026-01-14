import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { Loader2 } from 'lucide-react';
import { useStore } from '@/core/store';

// Generate unique IDs
const generateId = () => `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    const [error, setError] = useState<string | null>(null);

    // Memoized conversion function
    const convertFabricToCanvasObject = useCallback((obj: fabric.Object): CanvasObject => {
        return {
            id: obj.name || generateId(),
            type: obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox'
                ? 'text'
                : obj.type === 'image'
                ? 'image'
                : 'shape',
            name: obj.name || `${obj.type} ${Date.now()}`,
            visible: obj.visible ?? true,
            locked: !obj.selectable,
            fabricObject: obj
        };
    }, []);

    // Emit layers change with proper memoization
    const emitLayersChange = useCallback(() => {
        if (!fabricCanvasRef.current || !onLayersChange) return;

        try {
            const objects = fabricCanvasRef.current.getObjects();
            const canvasObjects = objects.map(convertFabricToCanvasObject);
            onLayersChange(canvasObjects);
        } catch (err) {
            console.error('Error emitting layers change:', err);
        }
    }, [onLayersChange, convertFabricToCanvasObject]);

    // Handle selection changes with proper memoization
    const handleSelectionChange = useCallback((obj: fabric.Object | null | undefined) => {
        if (!onSelectionChange) return;

        try {
            if (!obj) {
                onSelectionChange(null);
                return;
            }

            const canvasObj = convertFabricToCanvasObject(obj);
            onSelectionChange(canvasObj);
        } catch (err) {
            console.error('Error handling selection change:', err);
        }
    }, [onSelectionChange, convertFabricToCanvasObject]);

    // Initialize Fabric.js canvas
    useEffect(() => {
        if (!canvasRef.current || fabricCanvasRef.current) return;

        try {
            const canvas = new fabric.Canvas(canvasRef.current, {
                width: 800,
                height: 1000,
                backgroundColor: '#000000',
                preserveObjectStacking: true,
                selection: true,
                renderOnAddRemove: true,
                enableRetinaScaling: true,
                // Touch support
                allowTouchScrolling: false,
                stopContextMenu: true,
            });

            // Configure object controls
            fabric.Object.prototype.set({
                transparentCorners: false,
                borderColor: '#FFE135',
                cornerColor: '#FFE135',
                cornerSize: 12,
                cornerStyle: 'circle',
                borderScaleFactor: 2,
                padding: 5,
            });

            fabricCanvasRef.current = canvas;
            setIsInitialized(true);

            // Notify parent that canvas is ready
            if (onCanvasReady) {
                onCanvasReady(canvas);
            }

            // Selection change handlers
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
            canvas.on('object:modified', emitLayersChange);
            canvas.on('object:added', emitLayersChange);
            canvas.on('object:removed', emitLayersChange);

            // Keyboard shortcuts
            const handleKeyDown = (e: KeyboardEvent) => {
                // Prevent if user is typing in an input
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                    return;
                }

                const activeObject = canvas.getActiveObject();

                // Delete key
                if ((e.key === 'Delete' || e.key === 'Backspace') && activeObject) {
                    e.preventDefault();
                    const activeObjects = canvas.getActiveObjects();
                    activeObjects.forEach(obj => canvas.remove(obj));
                    canvas.discardActiveObject();
                    canvas.renderAll();
                }

                // Copy: Cmd/Ctrl + C
                if ((e.metaKey || e.ctrlKey) && e.key === 'c' && activeObject) {
                    e.preventDefault();
                    (activeObject as any).clone((cloned: fabric.Object) => {
                        (canvas as any)._clipboard = cloned;
                    });
                }

                // Paste: Cmd/Ctrl + V
                if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
                    e.preventDefault();
                    const clipboard = (canvas as any)._clipboard;
                    if (clipboard) {
                        clipboard.clone((cloned: fabric.Object) => {
                            canvas.discardActiveObject();
                            cloned.set({
                                left: (cloned.left || 0) + 10,
                                top: (cloned.top || 0) + 10,
                                evented: true,
                            });
                            if (cloned.type === 'activeSelection') {
                                (cloned as fabric.ActiveSelection).canvas = canvas;
                                (cloned as any).forEachObject((obj: fabric.Object) => {
                                    canvas.add(obj);
                                });
                                cloned.setCoords();
                            } else {
                                canvas.add(cloned);
                            }
                            (canvas as any)._clipboard.top! += 10;
                            (canvas as any)._clipboard.left! += 10;
                            canvas.setActiveObject(cloned);
                            canvas.requestRenderAll();
                        });
                    }
                }

                // Select All: Cmd/Ctrl + A
                if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
                    e.preventDefault();
                    canvas.discardActiveObject();
                    const sel = new fabric.ActiveSelection(canvas.getObjects(), {
                        canvas: canvas,
                    });
                    canvas.setActiveObject(sel);
                    canvas.requestRenderAll();
                }
            };

            window.addEventListener('keydown', handleKeyDown);

            return () => {
                window.removeEventListener('keydown', handleKeyDown);
                canvas.dispose();
                fabricCanvasRef.current = null;
            };
        } catch (err) {
            console.error('Error initializing canvas:', err);
            setError('Failed to initialize canvas');
        }
    }, [onCanvasReady, handleSelectionChange, emitLayersChange]);

    // Responsive canvas sizing
    useEffect(() => {
        if (!isInitialized) return;

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
        const resizeObserver = new ResizeObserver(handleResize);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [isInitialized]);

    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-neutral-900/20 rounded-2xl border border-white/5">
                <div className="text-center p-8">
                    <p className="text-red-400 text-sm mb-2">Canvas Error</p>
                    <p className="text-neutral-500 text-xs">{error}</p>
                </div>
            </div>
        );
    }

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
    // Smart positioning: find empty space or center
    const getSmartPosition = useCallback((width: number, height: number): { left: number; top: number } => {
        if (!canvasRef.current) return { left: 400, top: 500 };

        const objects = canvasRef.current.getObjects();
        if (objects.length === 0) {
            // First object: center it
            return {
                left: (800 - width) / 2,
                top: (1000 - height) / 2
            };
        }

        // Place in cascade pattern
        const offset = (objects.length * 30) % 400;
        return {
            left: 100 + offset,
            top: 100 + offset
        };
    }, [canvasRef]);

    const addImage = useCallback(async (imageUrl: string, name?: string): Promise<void> => {
        if (!canvasRef.current) {
            throw new Error('Canvas not initialized');
        }

        return new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                fabric.Image.fromURL(imageUrl, (fabricImg) => {
                    if (!fabricImg.width || !fabricImg.height) {
                        reject(new Error('Invalid image dimensions'));
                        return;
                    }

                    // Scale image to fit canvas (max 600px width/height)
                    const maxSize = 600;
                    const scale = Math.min(maxSize / fabricImg.width, maxSize / fabricImg.height, 1);

                    const position = getSmartPosition(fabricImg.width * scale, fabricImg.height * scale);

                    fabricImg.set({
                        ...position,
                        scaleX: scale,
                        scaleY: scale,
                        name: name || `Image ${generateId()}`
                    });

                    canvasRef.current?.add(fabricImg);
                    canvasRef.current?.setActiveObject(fabricImg);
                    canvasRef.current?.renderAll();
                    resolve();
                }, {
                    crossOrigin: 'anonymous'
                });
            };

            img.onerror = () => {
                reject(new Error('Failed to load image. Check CORS policy or URL.'));
            };

            img.src = imageUrl;
        });
    }, [canvasRef, getSmartPosition]);

    const addText = useCallback((text: string = 'Your Text', options?: Partial<fabric.ITextOptions>) => {
        if (!canvasRef.current) return;

        const position = getSmartPosition(200, 60);

        const textObj = new fabric.IText(text, {
            ...position,
            fontSize: 60,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 'bold',
            fill: '#FFE135',
            name: `Text ${generateId()}`,
            ...options
        });

        canvasRef.current.add(textObj);
        canvasRef.current.setActiveObject(textObj);
        canvasRef.current.renderAll();
    }, [canvasRef, getSmartPosition]);

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

        try {
            return canvasRef.current.toDataURL({
                format: 'png',
                quality: 1,
                multiplier: 2 // Export at 2x resolution
            });
        } catch (err) {
            console.error('Export error:', err);
            return null;
        }
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

    // TODO: Implement proper undo/redo with history stack
    const undo = useCallback(() => {
        console.log('Undo not yet implemented');
    }, []);

    const redo = useCallback(() => {
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
