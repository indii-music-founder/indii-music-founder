import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { PrintTemplate } from '../../../services/design/templates';

interface PhysicalMediaLayoutProps {
    template: PrintTemplate;
    zoom?: number;
}

export const PhysicalMediaLayout: React.FC<PhysicalMediaLayoutProps> = ({ template, zoom = 0.2 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;

        // Initialize Fabric Canvas
        // precise scaling for 300DPI view
        const canvas = new fabric.Canvas(canvasRef.current, {
            width: template.totalWidth * zoom,
            height: template.totalHeight * zoom,
            backgroundColor: '#ffffff',
            selection: true
        });

        // Set viewport transform to handle the zoom level
        canvas.setZoom(zoom);

        setFabricCanvas(canvas);

        return () => {
            canvas.dispose();
        };
    }, [template, zoom]);

    useEffect(() => {
        if (!fabricCanvas) return;

        // Clear existing overlay objects
        fabricCanvas.clear();

        // fabricCanvas.backgroundColor = '#ffffff';

        // 1. Draw Bleed Area (Red tint outside trim)
        const bleedRect = new fabric.Rect({
            left: 0,
            top: 0,
            width: template.totalWidth,
            height: template.totalHeight,
            fill: 'rgba(255, 0, 0, 0.05)',
            selectable: false,
            evented: false,
            excludeFromExport: true
        });
        fabricCanvas.add(bleedRect);

        // 2. Draw Trim Line (Black Dashed)
        const trimRect = new fabric.Rect({
            left: template.bleed,
            top: template.bleed,
            width: template.totalWidth - (template.bleed * 2),
            height: template.totalHeight - (template.bleed * 2),
            fill: 'transparent',
            stroke: 'black',
            strokeWidth: 2,
            strokeDashArray: [10, 10],
            selectable: false,
            evented: false,
            excludeFromExport: true
        });
        fabricCanvas.add(trimRect);

        // 3. Draw Safe Zone (Green Dashed) - typically 3mm (36px) inside trim
        const safeMargin = 36;
        const safeRect = new fabric.Rect({
            left: template.bleed + safeMargin,
            top: template.bleed + safeMargin,
            width: template.totalWidth - ((template.bleed + safeMargin) * 2),
            height: template.totalHeight - ((template.bleed + safeMargin) * 2),
            fill: 'transparent',
            stroke: 'rgba(0, 200, 0, 0.5)',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            excludeFromExport: true
        });
        fabricCanvas.add(safeRect);

        // 4. Draw Fold Lines / Guides
        template.guides.forEach(guide => {
            let line;
            if (guide.orientation === 'vertical') {
                line = new fabric.Line([guide.x, 0, guide.x, template.totalHeight], {
                    stroke: 'blue',
                    strokeWidth: 2,
                    strokeDashArray: [5, 5],
                    selectable: false,
                    evented: false,
                    excludeFromExport: true
                });
            } else {
                line = new fabric.Line([0, guide.y, template.totalWidth, guide.y], {
                    stroke: 'blue',
                    strokeWidth: 2,
                    strokeDashArray: [5, 5],
                    selectable: false,
                    evented: false,
                    excludeFromExport: true
                });
            }
            fabricCanvas.add(line);

            // Label
            const label = new fabric.Text(guide.label, {
                left: guide.x + 5,
                top: 10,
                fontSize: 24,
                fill: 'blue',
                selectable: false,
                evented: false,
                excludeFromExport: true
            });
            fabricCanvas.add(label);
        });

        fabricCanvas.renderAll();

    }, [fabricCanvas, template]);

    return (
        <div className="flex flex-col items-center justify-center bg-neutral-900 p-8 h-full overflow-auto" ref={containerRef}>
            <div className="shadow-2xl border border-neutral-800">
                <canvas ref={canvasRef} />
            </div>
            <div className="mt-4 text-neutral-500 text-xs">
                {template.name} ({template.totalWidth}x{template.totalHeight}px @ 300DPI)
            </div>
        </div>
    );
};
