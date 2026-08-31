import React, { useCallback, useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { adjustmentsToFilters, type RasterLayer } from '@/services/canvas/CanvasDoc';
import { descriptorsToFabricFilters } from './fabricFilters';
import { LayerList } from './LayerList';
import { AdjustPanel } from './AdjustPanel';
import { ExportBar, type ExportFormat } from './ExportBar';
import { useCanvasAutosave } from '../../hooks/useCanvasAutosave';

type LayerIdCarrier = fabric.FabricObject & { layerId?: string };

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
    useEffect(() => {
        const canvas = fabricRef.current;
        if (!canvas || !currentDoc) return;
        const generation = ++syncGeneration.current;

        canvas.setDimensions({ width: currentDoc.width, height: currentDoc.height });
        canvas.clear();

        void (async () => {
            for (const layer of currentDoc.layers) {
                if (layer.kind !== 'raster') continue;
                try {
                    const img = await fabric.Image.fromURL(layer.src, { crossOrigin: 'anonymous' });
                    if (generation !== syncGeneration.current) return; // stale load
                    (img as LayerIdCarrier).layerId = layer.id;
                    img.set({
                        left: layer.x,
                        top: layer.y,
                        scaleX: layer.scaleX,
                        scaleY: layer.scaleY,
                        angle: layer.rotation,
                        opacity: layer.opacity,
                        visible: layer.visible,
                        locked: layer.locked,
                    });
                    img.filters = descriptorsToFabricFilters(adjustmentsToFilters(layer.adjustments));
                    img.applyFilters();
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
            if (!target.layerId) return;
            updateLayer(target.layerId, {
                x: target.left ?? 0,
                y: target.top ?? 0,
                scaleX: target.scaleX ?? 1,
                scaleY: target.scaleY ?? 1,
                rotation: target.angle ?? 0,
            });
        };
        canvas.on('object:modified', handler);
        return () => {
            canvas.off('object:modified', handler);
        };
    }, [updateLayer]);

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
            const canvas = fabricRef.current;
            if (!canvas || !currentDoc) return;
            const dataUrl = canvas.toDataURL({ format, multiplier: scale });
            const { downloadAsset } = await import('@/utils/download');
            await downloadAsset(dataUrl, `canvas-${currentDoc.id.slice(0, 8)}.${format}`);
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
