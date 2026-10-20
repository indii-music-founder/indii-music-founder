import { getViewportProxy, artworkEnlargement, artworkExportDimensions } from '@/services/canvas/ArtworkGeometry';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { type RasterLayer } from '@/services/canvas/CanvasDoc';
import { TextPanel } from './TextPanel';
import { CutoutPanel } from './CutoutPanel';
import { PicturePanel } from './PicturePanel';
import { SavedArtworkPanel } from './SavedArtworkPanel';
import { StorageService } from '@/services/StorageService';
import { LayerList } from './LayerList';
import { AdjustPanel } from './AdjustPanel';
import { ExportBar, type ExportFormat } from './ExportBar';
import { useCanvasAutosave } from '../../hooks/useCanvasAutosave';
import { canvasDocToPsd } from '@/services/canvas/PsdExportService';
import { printReadyUpscaleService } from '@/services/upscale/PrintReadyUpscaleService';
import { printUpscaleMethodLabel } from '@/services/upscale/printUpscalePlan';
import { renderArtworkSource, renderArtworkDocument, artworkSourceDensity } from '@/services/canvas/ArtworkRenderService';
import { CanvasDocumentService } from '@/services/canvas/CanvasDocumentService';
import { ArtworkDraftService } from '@/services/canvas/ArtworkDraftService';
import { ArtworkCanvasSession, createArtworkCanvasObject, readArtworkCanvasTransform } from '@/services/canvas/ArtworkCanvasSession';
import { logger } from '@/utils/logger';
import { useToast } from '@/core/context/ToastContext';
import { downloadAsset, downloadBlob } from '@/utils/download';

type LayerIdCarrier = fabric.FabricObject & { layerId?: string; rasterDensity?: number };

/**
 * Viewport proxy constraint (Part I.2):
 * Real-time editing is constrained to 1024px viewport proxies when master dimensions
 * exceed 1024px (e.g. 3000x3000 Spotify masters or 300 DPI print sleeves).
 * This avoids UI main-thread blocking during live filter manipulation while keeping
 * the master CanvasDoc non-destructive.
 */
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
    const undoCanvas = useStore(state => state.undoCanvas);
    const redoCanvas = useStore(state => state.redoCanvas);
    const canUndo = useStore(state => state.canvasPast.length > 0 || Boolean(state.canvasGesture));
    const canRedo = useStore(state => state.canvasFuture.length > 0 && !state.canvasGesture);
    const beginGesture = useStore(state => state.beginCanvasGesture);
    const commitGesture = useStore(state => state.commitCanvasGesture);
    const updateArtwork = useStore(state => state.updateArtwork);
    const resizeArtwork = useStore(state => state.resizeArtwork);
    const reorderLayer = useStore(state => state.reorderLayer);
    const removeLayer = useStore(state => state.removeLayer);
    const duplicateLayer = useStore(state => state.duplicateArtworkLayer);
    const addPhoto = useStore(state => state.addRasterLayer);
    const [frameOwner, setFrameOwner] = useState<{ documentId: string; layerId: string; mode: 'frame' | 'adjustments' } | null>(null);
    const framingLayerId = frameOwner?.documentId === currentDoc?.id && currentDoc?.layers.some(layer => layer.id === frameOwner?.layerId) ? frameOwner!.layerId : null;
    const toast = useToast();

    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            const element = event.target as HTMLElement | null;
            if (framingLayerId) return;
            if (element?.closest('input, textarea, [contenteditable="true"]')) return;
            if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
            if (event.key.toLowerCase() === 'z') {
                event.preventDefault();
                if (event.shiftKey) redoCanvas(); else undoCanvas();
            } else if (event.ctrlKey && event.key.toLowerCase() === 'y') {
                event.preventDefault();
                redoCanvas();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [undoCanvas, redoCanvas, framingLayerId]);

    const canvasElRef = useRef<HTMLCanvasElement | null>(null);
    const fabricRef = useRef<fabric.Canvas | null>(null);
    const syncGeneration = useRef(0);
    const [canvasSession] = useState(() => new ArtworkCanvasSession());
    const [canvasEpoch, setCanvasEpoch] = useState(0);
    const hasDocument = Boolean(currentDoc);

    // Persist doc changes to storage (C1.5).
    const autosave = useCanvasAutosave(!framingLayerId);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [isRendering, setIsRendering] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        const element = canvasElRef.current;
        if (!hasDocument || !element) return;
        let active = true;
        void canvasSession.open(element).then(canvas => {
            if (!active || !canvas) return;
            fabricRef.current = canvas;
            setCanvasEpoch(epoch => epoch + 1);
        }).catch(failure => {
            if (active) setRenderError(failure instanceof Error ? failure.message : 'Editor canvas could not be initialized');
        });
        return () => {
            active = false;
            fabricRef.current = null;
            void canvasSession.close().catch(failure => logger.error('[CanvasEditor] canvas cleanup failed', failure));
        };
    }, [hasDocument, canvasSession]);

    // Rebuild layer objects from the doc (single source of truth). A generation
    // guard drops stale async image loads when a newer rebuild has started.
    // Constrained to 1024px viewport proxy to prevent UI thread blocking on heavy rasters (Part I.2).
    useEffect(() => {
        const canvas = fabricRef.current;
        if (!canvas || !currentDoc) return;
        const generation = ++syncGeneration.current;
        const rendering = new AbortController();
        setIsRendering(true);
        setRenderError(null);

        const { proxyWidth, proxyHeight, proxyScale } = getViewportProxy(currentDoc.width, currentDoc.height);
        void (async () => {
            const objects: fabric.FabricImage[] = [];
            for (const layer of currentDoc.layers) {
                if (!layer.visible) continue;
                try {
                    const source = await renderArtworkSource(layer, rendering.signal);
                    const density = artworkSourceDensity(source);
                    if (generation !== syncGeneration.current) return;
                    const img = createArtworkCanvasObject(source, layer, currentDoc, proxyScale, density, !framingLayerId || layer.id === framingLayerId);
                    objects.push(img);
                } catch (failure) {
                    if (generation !== syncGeneration.current) return;
                    setRenderError(`${layer.name}: ${failure instanceof Error ? failure.message : 'Layer could not load'}`);
                    setIsRendering(false);
                    return;
                }
            }
            if (generation === syncGeneration.current) {
                canvas.setDimensions({ width: proxyWidth, height: proxyHeight });
                canvas.clear();
                canvas.backgroundColor = currentDoc.background === 'transparent' ? '' : currentDoc.background;
                for (const object of objects) canvas.add(object);
                const selected = canvas.getObjects().find(object => (object as LayerIdCarrier).layerId === useStore.getState().selectedLayerId);
                if (selected) canvas.setActiveObject(selected);
                canvas.requestRenderAll();
                setIsRendering(false);
            }
        })();
        return () => { rendering.abort(); if (syncGeneration.current === generation) syncGeneration.current = generation + 1; };
    }, [currentDoc, framingLayerId, canvasEpoch]);

    useEffect(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const selection = (event: { selected?: fabric.FabricObject[] }) => {
            const id = (event.selected?.[0] as LayerIdCarrier | undefined)?.layerId;
            if (id) selectLayer(id);
        };
        canvas.on('selection:created', selection);
        canvas.on('selection:updated', selection);
        return () => { canvas.off('selection:created', selection); canvas.off('selection:updated', selection); };
    }, [selectLayer, canvasEpoch]);

    useEffect(() => {
        const canvas = fabricRef.current;
        const selected = canvas?.getObjects().find(object => (object as LayerIdCarrier).layerId === selectedLayerId);
        if (canvas && selected) { canvas.setActiveObject(selected); canvas.requestRenderAll(); }
    }, [selectedLayerId, canvasEpoch]);

    // Sync Fabric transforms back to the doc on object:modified (C2.2).
    useEffect(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const handler = (e: fabric.ModifiedEvent) => {
            // Only a completed user transform belongs in document history. Fabric
            // can also emit modification events while objects are rebuilt.
            if (!e.transform) return;
            const target = e.target as LayerIdCarrier;
            if (!target.layerId || !currentDoc) return;
            const { proxyScale } = getViewportProxy(currentDoc.width, currentDoc.height);
            updateLayer(target.layerId, {
                ...readArtworkCanvasTransform(target, proxyScale),
                ...((currentDoc.layers.find(l => l.id === target.layerId)?.kind === 'raster') ? { framing: undefined } : {}),
            });
        };
        canvas.on('object:modified', handler);
        return () => {
            canvas.off('object:modified', handler);
        };
    }, [currentDoc, updateLayer, canvasEpoch]);

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
            artworkExportDimensions(currentDoc, scale);
            const enlarged: string[] = [];
            for (const layer of currentDoc.layers) {
                if (layer.kind !== 'raster' || !layer.visible || layer.opacity === 0) continue;
                const source = await renderArtworkSource(layer);
                if (artworkEnlargement(layer, source.width, source.height, currentDoc, scale) > 1.01) enlarged.push(layer.name);
            }
            if (enlarged.length) toast.warning(`This export enlarges ${enlarged.length === 1 ? `“${enlarged[0]}”` : `${enlarged.length} photos`} beyond its source resolution. It may look soft.`);
            const stem = `canvas-${currentDoc.id.slice(0, 8)}-r${currentDoc.revision ?? 0}`;

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

            const output = await renderArtworkDocument(currentDoc, scale, format === 'jpeg');
            if (window.electronAPI?.video?.saveAsset) {
                const saved = await downloadAsset(output.toDataURL(`image/${format}`, 0.95), `${stem}.${format}`);
                if (!saved) throw new Error('Export could not be saved');
            } else {
                const blob = await new Promise<Blob>((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Export encoding took too long')), 60_000);
                    output.toBlob(value => {
                        clearTimeout(timeout);
                        if (value) resolve(value);
                        else reject(new Error('Export could not be encoded'));
                    }, `image/${format}`, 0.95);
                });
                await downloadBlob(blob, `${stem}.${format}`);
            }
        },
        [currentDoc, toast],
    );

    const [isUpscaling, setIsUpscaling] = useState(false);
    const handleUpscalePrintReady = async () => {
        if (!currentDoc) return;
        const canvas = fabricRef.current;
        if (!canvas) return;
        setIsUpscaling(true);
        try {
            toast.info("Upscaling canvas to 3000x3000px @ 300 DPI print standard...");
            const output = await renderArtworkDocument(currentDoc);
            const dataUrl = output.toDataURL('image/png');
            const result = await printReadyUpscaleService.upscaleToPrintReady({
                dataUrl,
                prompt: currentDoc.id,
            });
            const stem = `canvas-${currentDoc.id.slice(0, 8)}-3000px`;
            const { downloadAsset } = await import('@/utils/download');
            await downloadAsset(result.dataUrl, `${stem}.png`);
            toast.success(`Exported 3000x3000px (300 DPI) via ${printUpscaleMethodLabel(result.method)}`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Upscale export failed');
        } finally {
            setIsUpscaling(false);
        }
    };

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
        <div className="flex h-full min-h-0" data-testid="canvas-editor" data-document-id={currentDoc.id} data-project-id={currentDoc.projectId}>
            <div aria-busy={isRendering} style={{ pointerEvents: isRendering || (framingLayerId && frameOwner?.mode === 'adjustments') ? 'none' : undefined }} className="flex-1 flex items-center justify-center bg-black/50 p-6 min-w-0">
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
                        disabled={Boolean(framingLayerId)}
                        onClick={() => { void autosave.flush().then(() => { if (useStore.getState().currentDoc?.id === currentDoc.id) closeDoc(); }).catch(failure => toast.error(failure instanceof Error ? failure.message : 'Save failed')); }}
                        data-testid="canvas-editor-close"
                        aria-label="Close editor"
                        className="ml-auto text-xs text-white/40 hover:text-white px-2 py-1 rounded hover:bg-white/10"
                    >
                        Close
                    </button>
                </div>
                <div className="px-3 py-2 text-xs text-white/60" role="status">
                    {autosave.status === 'saved' ? 'Saved' : autosave.status === 'saving' ? 'Saving…' : autosave.status === 'error' ? 'Save failed' : 'Unsaved changes'}
                    <button disabled={Boolean(framingLayerId)} className="ml-2 underline" onClick={() => { void autosave.flush().catch(failure => toast.error(failure instanceof Error ? failure.message : 'Save failed')); }}>{autosave.status === 'error' ? 'Retry' : 'Save'}</button>
                    {autosave.status === 'error' && !framingLayerId && <button className="block mt-2 underline" onClick={() => {
                        const uid = useStore.getState().user?.uid;
                        if (!uid) { toast.error('Sign in to keep this artwork draft'); return; }
                        void (async () => {
                            for (;;) {
                                const state = useStore.getState(), document = state.currentDoc;
                                if (state.user?.uid !== uid || document?.id !== currentDoc.id) return;
                                await ArtworkDraftService.save(uid, document);
                                const latest = useStore.getState();
                                if (latest.user?.uid !== uid || latest.currentDoc?.id !== document.id) return;
                                if (latest.currentDoc.updatedAt !== document.updatedAt) continue;
                                closeDoc(); return;
                            }
                        })().catch(failure => toast.error(failure instanceof Error ? failure.message : 'Local recovery is unavailable; keep this editor open'));
                    }}>Keep draft and close</button>}
                    {autosave.status === 'error' && !framingLayerId && <button className="block mt-2 underline" onClick={() => {
                        const uid = useStore.getState().user?.uid;
                        if (!uid) { toast.error('Sign in to save a copy'); return; }
                        const copy = { ...currentDoc, id: `doc_${crypto.randomUUID()}`, revision: 0, name: `${currentDoc.name ?? 'Cover'} copy`, updatedAt: Date.now() };
                        void CanvasDocumentService.saveDoc(copy, uid).then(() => {
                            const state = useStore.getState();
                            if (state.user?.uid !== uid) return;
                            if (state.currentDoc?.id === currentDoc.id && state.currentDoc.updatedAt === currentDoc.updatedAt) state.openDoc(copy);
                            toast.success('Saved a new artwork copy');
                        }).catch(failure => toast.error(failure instanceof Error ? failure.message : 'The copy could not be saved'));
                    }}>Save as new artwork</button>}
                    {autosave.error && <p className="text-red-300">{autosave.error}</p>}
                    {autosave.recoveryError && <p className="text-amber-300">{autosave.recoveryError}</p>}
                    {isRendering && <p>Preparing artwork…</p>}
                    {renderError && <p className="text-red-300" role="alert">{renderError}</p>}
                </div>
                {!framingLayerId && <div className="flex gap-2 px-3 py-2">
                    <button onClick={undoCanvas} disabled={!canUndo} className="text-xs text-white disabled:opacity-30" aria-label="Undo">Undo</button>
                    <button onClick={redoCanvas} disabled={!canRedo} className="text-xs text-white disabled:opacity-30" aria-label="Redo">Redo</button>
                </div>}
                {!framingLayerId && <div className="flex flex-col gap-2 px-3 py-2 text-xs text-white/70">
                    <label>Artwork name<input aria-label="Artwork name" value={currentDoc.name ?? 'Untitled cover'} onFocus={beginGesture} onBlur={commitGesture} onChange={event => updateArtwork({ name: event.target.value })} className="block w-full bg-black/40 p-1" /></label>
                    <label>Square size<select aria-label="Square size" value={currentDoc.width === currentDoc.height ? currentDoc.width : ''} onChange={event => resizeArtwork(Number(event.target.value))} className="ml-2 bg-black/40">
                        <option value="" disabled>Choose square size</option>
                        {[...new Set([1080, 3000, ...(currentDoc.width === currentDoc.height ? [currentDoc.width] : [])])].sort((a,b) => a-b).map(size => <option key={size} value={size}>{size} × {size}</option>)}
                    </select></label>
                    <label>Background<select aria-label="Cover background" value={currentDoc.background} onChange={event => updateArtwork({ background: event.target.value })} className="ml-2 bg-black/40">
                        <option value="#000000">Black</option><option value="#ffffff">White</option><option value="transparent">Transparent</option>
                        {!['#000000', '#ffffff', 'transparent'].includes(currentDoc.background) && <option value={currentDoc.background}>Saved color</option>}
                    </select></label>
                    <label>Add photo<input aria-label="Add photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
                        const file = event.target.files?.[0]; event.target.value = '';
                        const uid = useStore.getState().user?.uid;
                        if (!file || !uid) { if (file) toast.error('Sign in to add a photo'); return; }
                        const documentId = currentDoc.id;
                        void StorageService.uploadFile(file, `users/${uid}/artwork/${documentId}/${crypto.randomUUID()}`).then(src => {
                            if (useStore.getState().currentDoc?.id === documentId && useStore.getState().user?.uid === uid) addPhoto(src, file.name);
                        }).catch(failure => toast.error(String(failure)));
                    }} className="block max-w-full" /></label>
                </div>}
                {!framingLayerId && <><SavedArtworkPanel projectId={currentDoc.projectId} beforeOpen={autosave.flush} />
                <LayerList
                    layers={currentDoc.layers}
                    selectedLayerId={selectedLayerId}
                    onSelect={selectLayer}
                    onToggleVisible={toggleVisible}
                    onToggleLock={toggleLock}
                />
                {selectedLayer && <div className="flex gap-2 px-3 py-2 text-xs text-white/70">
                    <button onClick={() => duplicateLayer(selectedLayer.id)}>Duplicate</button>
                    <button onClick={() => removeLayer(selectedLayer.id)}>Delete</button>
                    <button onClick={() => reorderLayer(selectedLayer.id, currentDoc.layers.findIndex(layer => layer.id === selectedLayer.id) + 1)}>Forward</button>
                    <button onClick={() => reorderLayer(selectedLayer.id, currentDoc.layers.findIndex(layer => layer.id === selectedLayer.id) - 1)}>Backward</button>
                </div>}
                </>}
                {!framingLayerId && <TextPanel key={currentDoc.id} layer={selectedLayer?.kind === 'text' ? selectedLayer : undefined} />}
                {!framingLayerId && selectedRaster && <CutoutPanel key={`${currentDoc.id}/${selectedRaster.id}/${selectedRaster.src}`} layer={selectedRaster} />}
                {selectedRaster && <PicturePanel key={`${currentDoc.id}/${selectedRaster.id}/${selectedRaster.src}`} layer={selectedRaster} onFrameChange={(active, mode = 'frame') => setFrameOwner(active ? { documentId: currentDoc.id, layerId: selectedRaster.id, mode } : null)} />}
                {!framingLayerId && selectedRaster && (
                    <AdjustPanel
                        adjustments={selectedRaster.adjustments}
                        exposureRange={selectedRaster.adjustmentVersion === 2 ? 2 : 1}
                        onGestureStart={beginGesture}
                        onGestureEnd={commitGesture}
                        onChange={(patch) => setAdjustments(selectedRaster.id, patch)}
                    />
                )}
                <div className="mt-auto">
                    <ExportBar
                        width={currentDoc.width}
                        height={currentDoc.height}
                        disabled={isRendering || Boolean(renderError) || isExporting || Boolean(framingLayerId)}
                        onExport={(f, s) => {
                            if (isRendering || renderError || isExporting) { toast.error('Wait for the artwork to finish loading before exporting'); return; }
                            setIsExporting(true);
                            void handleExport(f, s).catch(failure => toast.error(failure instanceof Error ? failure.message : 'Export failed')).finally(() => setIsExporting(false));
                        }}
                        onUpscaleToPrint={handleUpscalePrintReady}
                        isUpscaling={isUpscaling}
                    />
                </div>
            </aside>
        </div>
    );
};
