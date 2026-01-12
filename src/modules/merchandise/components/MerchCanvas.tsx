import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as fabric from 'fabric';

export interface MerchCanvasRef {
    exportToDataURL: () => string;
    addText: (text: string) => void;
    addEmoji: (emoji: string) => void;
    addImage: (url: string) => void;
    changeColor: (color: string) => void;
    undo: () => void;
    redo: () => void;
}

interface MerchCanvasProps {
    width?: number;
    height?: number;
}

const MerchCanvas = forwardRef<MerchCanvasRef, MerchCanvasProps>(({ width = 400, height = 500 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvas = useRef<fabric.Canvas | null>(null);
    const history = useRef<string[]>([]);
    const historyIndex = useRef<number>(-1);

    useEffect(() => {
        if (!canvasRef.current) return;

        fabricCanvas.current = new fabric.Canvas(canvasRef.current, {
            width,
            height,
            backgroundColor: '#000000',
            preserveObjectStacking: true,
        });

        // Background color / Rect for the "product area"
        const rect = new fabric.Rect({
            left: (width - 300) / 2,
            top: (height - 400) / 2,
            fill: '#0a0a0a',
            width: 300,
            height: 400,
            selectable: false,
            rx: 20,
            ry: 20,
            stroke: '#FFE135',
            strokeWidth: 2,
            strokeDashArray: [5, 5]
        });

        fabricCanvas.current.add(rect);
        fabricCanvas.current.sendObjectToBack(rect);
        fabricCanvas.current.renderAll();

        saveHistory();

        fabricCanvas.current.on('object:added', saveHistory);
        fabricCanvas.current.on('object:modified', saveHistory);
        fabricCanvas.current.on('object:removed', saveHistory);

        return () => {
            fabricCanvas.current?.dispose();
        };
    }, [width, height]);

    const saveHistory = () => {
        if (!fabricCanvas.current) return;
        const json = JSON.stringify(fabricCanvas.current.toJSON());

        // If we are in the middle of history, prune the forward path
        if (historyIndex.current < history.current.length - 1) {
            history.current = history.current.slice(0, historyIndex.current + 1);
        }

        history.current.push(json);
        historyIndex.current = history.current.length - 1;
    };

    useImperativeHandle(ref, () => ({
        exportToDataURL: () => {
            if (!fabricCanvas.current) return '';

            // Hide the guide rect before export
            const objects = fabricCanvas.current.getObjects();
            const guide = objects.find(obj => obj.selectable === false);
            if (guide) guide.set('visible', false);

            fabricCanvas.current.renderAll();

            // Export only the design area if possible, or just the whole canvas
            const dataUrl = fabricCanvas.current.toDataURL({
                format: 'png',
                quality: 1,
                multiplier: 2 // High res export
            });

            if (guide) guide.set('visible', true);
            fabricCanvas.current.renderAll();

            return dataUrl;
        },
        addText: (text: string) => {
            if (!fabricCanvas.current) return;
            const textObj = new fabric.IText(text, {
                left: width / 2,
                top: height / 2,
                fontFamily: 'Inter, sans-serif',
                fill: '#FFE135',
                fontSize: 40,
                originX: 'center',
                originY: 'center',
                fontWeight: '900',
            });
            fabricCanvas.current.add(textObj);
            fabricCanvas.current.setActiveObject(textObj);
        },
        addEmoji: (emoji: string) => {
            if (!fabricCanvas.current) return;
            const emojiObj = new fabric.IText(emoji, {
                left: width / 2,
                top: height / 2,
                fontSize: 80,
                originX: 'center',
                originY: 'center',
            });
            fabricCanvas.current.add(emojiObj);
            fabricCanvas.current.setActiveObject(emojiObj);
        },
        addImage: (url: string) => {
            if (!fabricCanvas.current) return;
            fabric.Image.fromURL(url, {
                crossOrigin: 'anonymous'
            }).then((img) => {
                if (!fabricCanvas.current) return;
                img.scaleToWidth(200);
                img.set({
                    left: width / 2,
                    top: height / 2,
                    originX: 'center',
                    originY: 'center'
                });
                fabricCanvas.current.add(img);
                fabricCanvas.current.setActiveObject(img);
                fabricCanvas.current.renderAll();
                saveHistory();
            }).catch(err => {
                console.error("Failed to load image", err);
            });
        },
        changeColor: (color: string) => {
            if (!fabricCanvas.current) return;
            const activeObject = fabricCanvas.current.getActiveObject();
            if (activeObject && 'fill' in activeObject) {
                activeObject.set('fill', color);
                fabricCanvas.current.renderAll();
                saveHistory();
            }
        },
        undo: () => {
            if (historyIndex.current > 0) {
                historyIndex.current--;
                const json = history.current[historyIndex.current];
                fabricCanvas.current?.loadFromJSON(json).then(() => {
                    fabricCanvas.current?.renderAll();
                });
            }
        },
        redo: () => {
            if (historyIndex.current < history.current.length - 1) {
                historyIndex.current++;
                const json = history.current[historyIndex.current];
                fabricCanvas.current?.loadFromJSON(json).then(() => {
                    fabricCanvas.current?.renderAll();
                });
            }
        }
    }));

    return (
        <div className="relative shadow-2xl border border-white/10 rounded-3xl overflow-hidden bg-black">
            <canvas ref={canvasRef} />
        </div>
    );
});

MerchCanvas.displayName = 'MerchCanvas';

export default MerchCanvas;
