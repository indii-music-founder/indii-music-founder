import React, { useEffect, useRef } from 'react';
import * as fabric from 'fabric';

interface FabricCanvasProps {
    width?: number;
    height?: number;
}

export const FabricCanvas: React.FC<FabricCanvasProps> = ({ width = 800, height = 600 }) => {
    const canvasEl = useRef<HTMLCanvasElement>(null);
    const fabricCanvas = useRef<fabric.Canvas | null>(null);

    useEffect(() => {
        if (canvasEl.current && !fabricCanvas.current) {
            fabricCanvas.current = new fabric.Canvas(canvasEl.current, {
                width,
                height,
                backgroundColor: '#1a1a1a',
            });

            // Add a demo rectangle
            const rect = new fabric.Rect({
                left: 100,
                top: 100,
                fill: '#3b82f6',
                width: 60,
                height: 60,
                angle: 45,
            });
            fabricCanvas.current.add(rect);
        }

        return () => {
            if (fabricCanvas.current) {
                fabricCanvas.current.dispose();
                fabricCanvas.current = null;
            }
        };
    }, [width, height]);

    return (
        <div className="border border-gray-700 rounded-lg overflow-hidden">
            <canvas ref={canvasEl} />
        </div>
    );
};
