import React, { useCallback, useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { adjustmentsToFilters, type RasterLayer } from '@/services/canvas/CanvasDoc';
import { descriptorsToFabricFilters } from '@/services/canvas/fabricFilters';
import { rasterizeTextLayer } from '@/services/canvas/textLayerRaster';
import { LayerList } from './LayerList';
import { AdjustPanel } from './AdjustPanel';
import { ExportBar, type ExportFormat } from './ExportBar';
import { useCanvasAutosave } from '../../hooks/useCanvasAutosave';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';
import { canvasDocToPsd } from '@/services/canvas/PsdExportService';

type LayerIdCarrier = fabric.FabricObject & { layerId?: string };

/**
 * Viewport proxy constraint (Part I.2):
 * Real-time editing is constrained to 1024px viewport proxies when master dimensions
 * exceed 1024px (e.g. 3000x3000 Spotify masters or 300 DPI print sleeves).
 * This avoids UI main-thread blocking during live filter manipulation while keeping
 * the master CanvasDoc non-destructive.
 */
export const MAX_VIEWPORT_PROXY = 1024;

export function getViewportProxy(width: number, height: number): { proxyWidth: number; proxyHeight: number; proxyScale: number } {
    const maxDim = Math.max(width, height);
    const proxyScale = maxDim > MAX_VIEWPORT_PROXY ? MAX_VIEWPORT_PROXY / maxDim : 1;
    return {
        proxyWidth: Math.round(width * proxyScale),
        proxyHeight: Math.round(height * proxyScale),
        proxyScale
    };
}

/**
 * CanvasEditor — the non-destructive layer editor (Workstream C1.3).
 *
 * DEC-4: adjustment params live ONLY on the CanvasDoc. This component reads the
 * doc, renders one `fabric.Image` per raster layer, and rebuilds Fabric filters
 * from `adjustmentsToFilters` on every doc change. The source raster element is
 * never mutated; `object:modified` writes the transform back to the doc.
 */
export const CanvasEditor: React.FC = () => {
    const { currentDoc, selectedLayerId, updateLayer, setAdjustments, selectLayer, closeDoc } = useStore(
        useShallow((state) => ({
            currentDoc: state.currentDoc,
            selectedLayerId: state.selectedLayerId,
            updateLayer: state.updateLayer,
            setAdjustments: state.setAdjustments,
            selectLayer: state.selectLayer,
            closeDoc: state.closeDoc,
        })),
    );

    const canvasElRef = useRef<HTMLCanvasElement | null>(null);
    const fabricRef = useRef<fabric.Canvas | null>(null);
    const syncGeneration = useRef(0);

    // Persist doc changes to storage (C1.5).
    useCanvasAutosave();

    // Initialize the Fabric canvas once.
    useEffect(() => {
        if (!canvasElRef.current || fabricRef.current) return;
        const canvas = new fabric.Canvas(canvasElRef.current, {
            width: 1080,
            height: 1080,
            preserveObjectStacking: true,
            selection: true,
        });
        fabricRef.current = canvas;
        return () => {
            canvas.dispose();
            fabricRef.current = null;
        };
    }, []);

    // Rebuild layer objects from the doc (single source of truth). A generation
    // guard drops stale async image loads when a newer rebuild has started.
    // Constrained to 1024px viewport proxy to prevent UI thread blocking on heavy rasters (Part I.2).
    useEffect(() => {
        const canvas = fabricRef.current;
        if (!canvas || !currentDoc) return;
        const generation = ++syncGeneration.current;

        const { proxyWidth, proxyHeight, proxyScale } = getViewportProxy(currentDoc.width, currentDoc.height);
        canvas.setDimensions({ width: proxyWidth, height: proxyHeight });
        canvas.clear();

        void (async () => {
            for (const layer of currentDoc.layers) {
                try {
                    let img: fabric.Image;
                    if (layer.kind === 'text') {
                        // Text layers bake via the deterministic B1 vector path.
                        const { dataUrl } = await rasterizeTextLayer(layer, proxyScale);
                        img = await fabric.Image.fromURL(dataUrl, { crossOrigin: 'anonymous' });
                    } else {
                        // gs:// sources must resolve to an https URL before Fabric
                        // can load them; https/data sources pass through unchanged.
                        const src = await resolveStorageUrl(layer.src);
                        img = await fabric.Image.fromURL(src, { crossOrigin: 'anonymous' });
                    }
                    if (generation !== syncGeneration.current) return; // stale load
                    (img as LayerIdCarrier).layerId = layer.id;
                    img.set({
                        left: layer.x * proxyScale,
                        top: layer.y * proxyScale,
                        scaleX: layer.scaleX * proxyScale,
                        scaleY: layer.scaleY * proxyScale,
                        angle: layer.rotation,
                        opacity: layer.opacity,
                        visible: layer.visible,
                        locked: layer.locked,
                    });
                    if (layer.kind === 'raster') {
                        img.filters = descriptorsToFabricFilters(adjustmentsToFilters(layer.adjustments));
                        img.applyFilters();
                    }
                    canvas.add(img);
                    canvas.renderAll();
                } catch {
                    // A layer whose source fails to load is skipped, never fatal.
                }
            }
        })();
    }, [currentDoc]);

    // Sync Fabric transforms back to the doc on object:modified (C2.2).
    useEffect(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const handler = (e: fabric.ModifiedEvent) => {
            const target = e.target as LayerIdCarrier;
            if (!target.layerId || !currentDoc) return;
            const { proxyScale } = getViewportProxy(currentDoc.width, currentDoc.height);
            updateLayer(target.layerId, {
                x: (target.left ?? 0) / proxyScale,
                y: (target.top ?? 0) / proxyScale,
                scaleX: (target.scaleX ?? 1) / proxyScale,
                scaleY: (target.scaleY ?? 1) / proxyScale,
                rotation: target.angle ?? 0,
            });
        };
        canvas.on('object:modified', handler);
        return () => {
            canvas.off('object:modified', handler);
        };
    }, [currentDoc, updateLayer]);

    const toggleVisible = useCallback(
        (id: string) => {
            const layer = currentDoc?.layers.find((l) => l.id === id);
            if (layer) updateLayer(id, { visible: !layer.visible });
        },
        [currentDoc, updateLayer],
    );

    const toggleLock = useCallback(
        (id: string) => {
            const layer = currentDoc?.layers.find((l) => l.id === id);
            if (layer) updateLayer(id, { locked: !layer.locked });
        },
        [currentDoc, updateLayer],
    );

    const handleExport = useCallback(
        async (format: ExportFormat, scale: number) => {
            if (!currentDoc) return;
            const stem = `canvas-${currentDoc.id.slice(0, 8)}`;

            // PSD: write the document (adjustments baked) and download the blob.
            if (format === 'psd') {
                const buffer = await canvasDocToPsd(currentDoc, { scale });
                const blob = new Blob([buffer], { type: 'image/vnd.adobe.photoshop' });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `${stem}.psd`;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
                URL.revokeObjectURL(url);
                return;
            }

            const canvas = fabricRef.current;
            if (!canvas) return;
            const { proxyScale } = getViewportProxy(currentDoc.width, currentDoc.height);
            // Viewport proxy normalization (Part I.2):
            // Multiplier must scale relative to the proxy canvas so raster output
            // is generated at master doc resolution (currentDoc.width * scale, currentDoc.height * scale).
            const exportMultiplier = scale / proxyScale;
            const dataUrl = canvas.toDataURL({ format, multiplier: exportMultiplier });
            const { downloadAsset } = await import('@/utils/download');
            await downloadAsset(dataUrl, `${stem}.${format}`);
        },
        [currentDoc],
    );

    if (!currentDoc) {
        return (
            <div
                className="flex h-full items-center justify-center text-sm text-white/40"
                data-testid="canvas-editor-empty"
            >
                No document open. Open an image in the Layer Editor to begin.
            </div>
        );
    }

    const selectedLayer = currentDoc.layers.find((l) => l.id === selectedLayerId) ?? null;
    const selectedRaster: RasterLayer | null = selectedLayer?.kind === 'raster' ? selectedLayer : null;

    return (
        <div className="flex h-full min-h-0" data-testid="canvas-editor">
            <div className="flex-1 flex items-center justify-center bg-black/50 p-6 min-w-0">
                <canvas
                    ref={canvasElRef}
                    data-testid="canvas-editor-canvas"
                    className="max-w-full max-h-full shadow-2xl rounded-lg"
                />
            </div>
            <aside className="w-72 shrink-0 flex flex-col border-l border-white/10 bg-black/30 overflow-y-auto">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                    <span className="text-xs font-bold uppercase tracking-wider text-white/70">Layer Editor</span>
                    <button
                        onClick={closeDoc}
                        data-testid="canvas-editor-close"
                        aria-label="Close editor"
                        className="ml-auto text-xs text-white/40 hover:text-white px-2 py-1 rounded hover:bg-white/10"
                    >
                        Close
                    </button>
                </div>
                <LayerList
                    layers={currentDoc.layers}
                    selectedLayerId={selectedLayerId}
                    onSelect={selectLayer}
                    onToggleVisible={toggleVisible}
                    onToggleLock={toggleLock}
                />
                {selectedRaster && (
                    <AdjustPanel
                        adjustments={selectedRaster.adjustments}
                        onChange={(patch) => setAdjustments(selectedRaster.id, patch)}
                    />
                )}
                <div className="mt-auto">
                    <ExportBar onExport={(f, s) => void handleExport(f, s)} />
                </div>
            </aside>
        </div>
    );
};
