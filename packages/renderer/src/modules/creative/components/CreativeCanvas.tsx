import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HistoryItem, useStore } from '@/core/store';
import { motion, AnimatePresence } from 'motion/react';
import { CanvasHeader } from './CanvasHeader';
import { CanvasEditorPortal } from './CanvasEditorPortal';
import { CanvasToolbar } from './CanvasToolbar';
import AnnotationPalette from './AnnotationPalette';
import EditDefinitionsPanel from './EditDefinitionsPanel';
import LayersPanel from './LayersPanel';
import { CanvasViewport } from './CanvasViewport';
import { CanvasActionRail } from './CanvasActionRail';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { canvasOps } from '../services/CanvasOperationsService';
import { useCreativeCanvas } from '../hooks/useCreativeCanvas';
import { printReadyUpscaleService } from '@/services/upscale/PrintReadyUpscaleService';
import { printUpscaleMethodLabel } from '@/services/upscale/printUpscalePlan';
import { useToast } from '@/core/context/ToastContext';

interface CreativeCanvasProps {
    item: HistoryItem | null;
    onClose: () => void;
    onSendToWorkflow?: (type: 'firstFrame' | 'lastFrame', item: HistoryItem) => void | Promise<void>;
    onRefine?: () => void;
}

export default function CreativeCanvas({ item, onClose, onSendToWorkflow, onRefine }: CreativeCanvasProps) {
    const {
        isProcessing,
        isSavingCanvas,
        isMagicFillMode,
        isSelectingEndFrame,
        isDefinitionsOpen,
        isLayersPanelOpen,
        layers,
        selectedLayerId,
        selectedText,
        updateSelectedText,
        hasDetections,
        activeColor,
        definitions,
        referenceImages,
        referenceRoles,
        generatedCandidates,
        endFrameItem,
        magicFillPrompt,
        isHighFidelity,
        processingStatus,
        canvasEl,
        generatedHistory,
        editManifest,

        setIsSelectingEndFrame,
        setEndFrameItem,
        setIsDefinitionsOpen,
        toggleLayersPanel,
        setActiveColor,
        setMagicFillPrompt,
        setIsHighFidelity,
        setGeneratedCandidates,

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        toggleMagicFill,
        handleDetectObjects,
        handleUpdateDefinition,
        handleUpdateReferenceImage,
        handleUpdateReferenceRole,
        handleMagicFill,
        handleClearDetections,
        handleSelectLayer,
        handleToggleLayerVisibility,
        handleToggleLayerLock,
        handleDeleteLayer,
        handleReorderLayer,
        handleAnimate,
        handleCandidateApply,
        saveCanvas,
        handleCreateLastFrame,
        handleFlattenCanvas,
        handleFitArtboardToArtwork,
        batchExportDimensions,
        handleUndo,
        handleRedo,
        canUndo,
        canRedo,
        activeTool,
        handleSetTool,
        handleAddRectangle,
        handleAddCircle,
        handleAddText,
        handleAddSketchLayer,
        handleSendToCanvas,
        prepareArtworkForAction,
    } = useCreativeCanvas({ item, onClose, onRefine });

    const [textSizeDraft, setTextSizeDraft] = useState('');
    useEffect(() => { setTextSizeDraft(selectedText ? String(selectedText.fontSize) : ''); }, [selectedText]);
    const [contextPanelWidth, setContextPanelWidth] = useState(0);
    useLayoutEffect(() => {
        const panel = document.querySelector<HTMLElement>('[aria-label="Context panel"]');
        if (!panel) return;
        const measure = () => setContextPanelWidth(panel.getBoundingClientRect().width);
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(panel);
        window.addEventListener('resize', measure);
        return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
    }, []);

    const openAssets = () => {
        const state = useStore.getState();
        state.setRightPanelTab('assets');
    };

    const [isUpscaling, setIsUpscaling] = useState(false);
    const [upscaleStatus, setUpscaleStatus] = useState({ stage: '', progress: 0, saving: false });
    const printRun = useRef<{ controller: AbortController; saving: boolean } | null>(null);
    const toast = useToast();

    useEffect(() => () => {
        if (printRun.current && !printRun.current.saving) printRun.current.controller.abort();
    }, [item?.id]);

    const handleUpscaleToPrintReady = async () => {
        if (!item || !item.url || printRun.current) return;
        const run = { controller: new AbortController(), saving: false };
        printRun.current = run;
        setIsUpscaling(true);
        setUpscaleStatus({ stage: 'Preparing artwork...', progress: 0, saving: false });
        try {
            toast.info("Upscaling to 3000x3000px @ 300 DPI print standard...");
            const artwork = await prepareArtworkForAction();
            if (!artwork) return;
            const result = await printReadyUpscaleService.upscaleToPrintReady({
                dataUrl: artwork.url,
                prompt: item.prompt,
                signal: run.controller.signal,
                onProgress: (progress, stage) => setUpscaleStatus({ stage, progress, saving: false }),
            });
            run.controller.signal.throwIfAborted();
            const { addToHistory, setSelectedItem } = useStore.getState();
            const upscaledItem: HistoryItem = {
                ...item,
                id: `print-3000-${Date.now()}`,
                url: result.dataUrl,
                timestamp: Date.now(),
                origin: 'editor',
                preserveResolution: true,
                distributorCompliance: {
                    valid: true,
                    errors: [],
                    warnings: [],
                    measuredWidth: 3000,
                    measuredHeight: 3000,
                    mimeType: result.format,
                },
                meta: JSON.stringify({
                    width: 3000,
                    height: 3000,
                    dpi: 300,
                    upscaled: result.method !== 'resize-only',
                    upscaleMethod: result.method,
                }),
            };
            const { StorageService } = await import('@/services/StorageService');
            run.controller.signal.throwIfAborted();
            // Once persistence begins, cancellation cannot promise no saved file.
            run.saving = true;
            setUpscaleStatus({ stage: 'Saving the print master...', progress: 1, saving: true });
            const saved = await StorageService.saveItem(upscaledItem);
            const persistedItem = { ...upscaledItem, url: saved.url, storageUri: saved.storageUri };
            addToHistory(persistedItem);
            setSelectedItem(persistedItem);
            toast.success(`Upscaled to 3000x3000px (300 DPI) via ${printUpscaleMethodLabel(result.method)}`);
        } catch (err: unknown) {
            if (run.controller.signal.aborted && !run.saving) {
                toast.info('Print preparation cancelled. No print master was saved.');
            } else {
                toast.error(err instanceof Error ? err.message : 'Upscaling failed');
            }
        } finally {
            printRun.current = null;
            setIsUpscaling(false);
        }
    };

    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-focus the modal container on mount for screen readers and keyboard trap
    useEffect(() => {
        containerRef.current?.focus();
    }, []);

    // ISSUE-1390 / ISSUE-1453: Focus trap and Escape handler.
    // Escape always returns to the canvas/previous view.
    // Tab cycles within the modal dialog so focus never leaks into underlying covered controls.
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key === 'Tab' && contextPanelWidth === 0 && containerRef.current) {
                const focusable = containerRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length > 0) {
                    const first = focusable[0];
                    const last = focusable[focusable.length - 1];
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, contextPanelWidth]);

    if (!item) return null;

    return (
        <CanvasEditorPortal>
        <AnimatePresence>
            <motion.div
                ref={containerRef}
                role="dialog"
                aria-modal={contextPanelWidth === 0}
                aria-label="Creative Canvas Editor"
                style={{ right: contextPanelWidth }}
                tabIndex={-1}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col overflow-hidden outline-none"
                data-testid="creative-canvas-container"
            >
                <CanvasHeader
                    item={item}
                    isMagicFillMode={isMagicFillMode}
                    magicFillPrompt={magicFillPrompt}
                    setMagicFillPrompt={setMagicFillPrompt}
                    handleMagicFill={handleMagicFill}
                    isProcessing={isProcessing}
                    processingStatus={processingStatus}
                    isHighFidelity={isHighFidelity}
                    setIsHighFidelity={setIsHighFidelity}
                    modelTier={editManifest.settings.modelTier}
                    resolution={editManifest.settings.resolution}
                    aspectRatio={editManifest.settings.aspectRatio}
                    grounding={editManifest.settings.grounding}
                    imageSize={editManifest.settings.imageSize}
                    onClose={onClose}
                    onOpenAssets={openAssets}
                    // ISSUE-1395: the canvas board is image-only — a video
                    // item falls back to plain close instead of staging an
                    // unrenderable video URL on the board.
                    onSendToCanvas={item.type === 'image' ? handleSendToCanvas : undefined}
                />

                <div className="flex-1 relative overflow-hidden bg-transparent">
                    <div className={`absolute inset-0 grid grid-cols-[minmax(0,1fr)] gap-0 ${item.type === 'image'
                        ? 'md:grid-cols-[72px_minmax(0,1fr)_72px]'
                        : 'md:grid-cols-[minmax(0,1fr)_72px]'}`}>
                        {/* ISSUE-1395: the fabric editing tools only exist for
                            image items — a video is a plain player, so the
                            tool/annotation rail is hidden (video preview has
                            its own controls). */}
                        {item.type === 'image' && (
                            <aside aria-label="Edit Bar" className="z-30 hidden min-h-0 flex-col items-center justify-center border-r border-white/10 bg-[#050608]/74 px-2 py-4 backdrop-blur-xl md:flex">
                                <div className="max-h-full overflow-y-auto rounded-2xl border border-white/10 bg-[#050608]/82 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                    <p className="mb-2 text-center text-[9px] font-semibold text-gray-400">Edit Bar</p>
                                    <CanvasToolbar
                                        addRectangle={handleAddRectangle}
                                        addCircle={handleAddCircle}
                                        addText={handleAddText}
                                        setTool={handleSetTool}
                                        undo={handleUndo}
                                        redo={handleRedo}
                                        canUndo={canUndo}
                                        canRedo={canRedo}
                                        activeTool={activeTool}
                                        handleDetectObjects={handleDetectObjects}
                                        handleClearDetections={handleClearDetections}
                                        hasDetections={hasDetections}
                                        toggleLayersPanel={toggleLayersPanel}
                                        isLayersPanelOpen={isLayersPanelOpen}
                                        addSketchLayer={handleAddSketchLayer}
                                        orientation="vertical"
                                    />
                                    <div className="my-2 h-px w-8 bg-white/10" />
                                    <AnnotationPalette
                                        activeColor={activeColor}
                                        onColorSelect={setActiveColor}
                                        colorDefinitions={definitions}
                                        onOpenDefinitions={() => setIsDefinitionsOpen(true)}
                                        orientation="vertical"
                                    />
                                </div>
                            </aside>
                        )}

                        {/* Stage: Main Viewport */}
                        <CanvasViewport
                            item={item}
                            canvasRef={canvasEl}
                            isMagicFillMode={isMagicFillMode}
                            activeColor={activeColor}
                            generatedCandidates={generatedCandidates}
                            onCandidateApply={handleCandidateApply}
                            onCloseCandidates={() => setGeneratedCandidates([])}
                            isSelectingEndFrame={isSelectingEndFrame}
                            setIsSelectingEndFrame={setIsSelectingEndFrame}
                            generatedHistory={generatedHistory}
                            onEndFrameSelect={(histItem) => {
                                setEndFrameItem(histItem as { id: string; url: string; prompt: string; type: 'image' | 'video' });
                                setIsSelectingEndFrame(false);
                            }}
                        />

                        <div className="z-30 hidden min-h-0 flex-col items-center justify-center border-l border-white/10 bg-[#050608]/74 px-2 py-4 backdrop-blur-xl md:flex">
                            <CanvasActionRail
                                item={item}
                                endFrameItem={endFrameItem}
                                setEndFrameItem={setEndFrameItem}
                                setIsSelectingEndFrame={setIsSelectingEndFrame}
                                handleAnimate={handleAnimate}
                                onClose={onClose}
                                onSendToWorkflow={onSendToWorkflow ? async (type) => {
                                    try {
                                        const artwork = await prepareArtworkForAction();
                                        if (artwork) await onSendToWorkflow(type, artwork);
                                    } catch (error) {
                                        toast.error(error instanceof Error ? error.message : 'Could not prepare the edited artwork.');
                                    }
                                } : undefined}
                                onCreateLastFrame={handleCreateLastFrame}
                                isProcessing={isProcessing}
                                processingStatus={processingStatus}
                                saveCanvas={saveCanvas}
                                isSavingCanvas={isSavingCanvas}
                                batchExportDimensions={batchExportDimensions}
                                flattenCanvas={handleFlattenCanvas}
                                fitArtboardToArtwork={handleFitArtboardToArtwork}
                                // ISSUE-1395: the canvas board is image-only —
                                // hide the rail send action for video items.
                                onSendToCanvas={item.type === 'image' ? handleSendToCanvas : undefined}
                                onUpscaleToPrint={handleUpscaleToPrintReady}
                                isUpscaling={isUpscaling}
                            />
                        </div>
                    </div>

                    {selectedText && !isMagicFillMode && (
                        <div role="toolbar" aria-label="Text formatting" className="absolute left-1/2 top-4 z-30 flex max-w-[calc(100%_-_32px)] md:max-w-[calc(100%_-_160px)] -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl border border-white/15 bg-[#0b0d10]/95 p-3 text-xs text-white shadow-xl">
                            <label className="flex items-center gap-2">Text
                                <input aria-label="Text content" value={selectedText.text} onChange={e => updateSelectedText({ text: e.target.value })} className="w-28 rounded border border-white/20 bg-black px-2 py-1" />
                            </label>
                            <label className="flex items-center gap-2">Font
                                <select aria-label="Text font" value={selectedText.fontFamily} onChange={e => updateSelectedText({ fontFamily: e.target.value })} className="rounded border border-white/20 bg-black px-2 py-1">
                                    {['Arial', 'Georgia', 'Courier New'].map(font => <option key={font} value={font}>{font}</option>)}
                                    {!['Arial', 'Georgia', 'Courier New'].includes(selectedText.fontFamily) && <option value={selectedText.fontFamily}>{selectedText.fontFamily}</option>}
                                </select>
                            </label>
                            <label className="flex items-center gap-2">Size
                                <input aria-label="Text size" type="number" min="8" max="300" value={textSizeDraft} onChange={e => { setTextSizeDraft(e.target.value); const size = Number(e.target.value); if (size >= 8 && size <= 300) updateSelectedText({ fontSize: size }); }} onBlur={() => setTextSizeDraft(String(selectedText.fontSize))} className="w-16 rounded border border-white/20 bg-black px-2 py-1" />
                            </label>
                        </div>
                    )}

                    {isUpscaling && (
                        <div className="absolute inset-x-4 top-4 z-40 mx-auto max-w-sm rounded-xl border border-amber-500/30 bg-[#050608]/95 p-4 shadow-xl">
                            <div role="status" aria-live="polite" className="text-sm text-white">
                                <p className="font-medium">Preparing 3000px print master</p>
                                <p className="mt-1 text-white/70">{upscaleStatus.stage}</p>
                                {!upscaleStatus.saving && <progress className="mt-2 w-full" value={upscaleStatus.progress} max={1} aria-label="Print preparation progress" />}
                            </div>
                            <button
                                className="mt-3 rounded-lg border border-white/20 px-3 py-1 text-sm text-white disabled:opacity-40"
                                disabled={upscaleStatus.saving}
                                onClick={() => {
                                    const run = printRun.current;
                                    if (run && !run.saving) run.controller.abort();
                                }}
                            >Cancel print preparation</button>
                        </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-black/35 to-transparent md:inset-x-[72px]" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/30 to-transparent md:inset-x-[72px]" />

                    {item.type === 'image' && (
                        <div className="md:hidden absolute inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 border-t border-white/10 bg-[#050608]/95 px-3 py-3">
                            <CanvasToolbar
                                addRectangle={handleAddRectangle}
                                addCircle={handleAddCircle}
                                addText={handleAddText}
                                setTool={handleSetTool}
                                undo={handleUndo}
                                redo={handleRedo}
                                canUndo={canUndo}
                                canRedo={canRedo}
                                activeTool={activeTool}
                                handleDetectObjects={handleDetectObjects}
                                handleClearDetections={handleClearDetections}
                                hasDetections={hasDetections}
                                toggleLayersPanel={toggleLayersPanel}
                                isLayersPanelOpen={isLayersPanelOpen}
                                addSketchLayer={handleAddSketchLayer}
                            />
                        </div>
                    )}

                    {/* Right Panel: Contextual Options — image-only (fabric
                        layers/definitions do not exist for video items). */}
                    {item.type === 'image' && (
                        <EditDefinitionsPanel
                            isOpen={isDefinitionsOpen}
                            onClose={() => setIsDefinitionsOpen(false)}
                            definitions={definitions}
                            onUpdateDefinition={handleUpdateDefinition}
                            referenceImages={referenceImages}
                            onUpdateReferenceImage={handleUpdateReferenceImage}
                            referenceRoles={referenceRoles}
                            onUpdateReferenceRole={handleUpdateReferenceRole}
                        />
                    )}

                    {item.type === 'image' && (
                        <LayersPanel
                            isOpen={isLayersPanelOpen}
                            onClose={toggleLayersPanel}
                            layers={layers}
                            selectedLayerId={selectedLayerId}
                            onSelectLayer={handleSelectLayer}
                            onToggleVisibility={handleToggleLayerVisibility}
                            onToggleLock={handleToggleLayerLock}
                            onDeleteLayer={handleDeleteLayer}
                            onReorderLayer={handleReorderLayer}
                            onAddSketchLayer={handleAddSketchLayer}
                            onAddTextLayer={handleAddText}
                            onAddRectangleLayer={handleAddRectangle}
                            onAddCircleLayer={handleAddCircle}
                        />
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
        </CanvasEditorPortal>
    );
}
