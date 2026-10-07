import React, { useEffect, useRef, useState } from 'react';
import { HistoryItem, useStore } from '@/core/store';
import { motion, AnimatePresence } from 'motion/react';
import { CanvasHeader } from './CanvasHeader';
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
        isMagicFillMode,
        isSelectingEndFrame,
        isDefinitionsOpen,
        isLayersPanelOpen,
        layers,
        selectedLayerId,
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
    } = useCreativeCanvas({ item, onClose, onRefine });

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
        setUpscaleStatus({ stage: 'Reading the original artwork...', progress: 0, saving: false });
        try {
            toast.info("Upscaling to 3000x3000px @ 300 DPI print standard...");
            const result = await printReadyUpscaleService.upscaleToPrintReady({
                dataUrl: item.url,
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

    // ISSUE-1390: Escape always returns to the canvas — the editor overlay
    // previously had no keyboard path back, and on mobile no visible one.
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    if (!item) return null;

    return (
        <AnimatePresence>
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Creative Canvas Editor"
                tabIndex={-1}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col overflow-hidden"
                data-testid="creative-canvas-container"
            >
                <CanvasHeader
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
                    // ISSUE-1395: the canvas board is image-only — a video
                    // item falls back to plain close instead of staging an
                    // unrenderable video URL on the board.
                    onSendToCanvas={item.type === 'image' ? handleSendToCanvas : undefined}
                />

                <div className="flex-1 relative overflow-hidden bg-transparent">
                    <div className="absolute inset-0 grid grid-cols-[minmax(0,1fr)] gap-0 md:grid-cols-[72px_minmax(0,1fr)_72px]">
                        {/* ISSUE-1395: the fabric editing tools only exist for
                            image items — a video is a plain player, so the
                            tool/annotation rail is hidden (video preview has
                            its own controls). */}
                        {item.type === 'image' && (
                            <aside className="z-30 hidden min-h-0 flex-col items-center justify-center border-r border-white/10 bg-[#050608]/74 px-2 py-4 backdrop-blur-xl md:flex">
                                <div className="max-h-full overflow-y-auto rounded-2xl border border-white/10 bg-[#050608]/82 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                                onSendToWorkflow={onSendToWorkflow}
                                onCreateLastFrame={handleCreateLastFrame}
                                isProcessing={isProcessing}
                                processingStatus={processingStatus}
                                saveCanvas={saveCanvas}
                                batchExportDimensions={batchExportDimensions}
                                flattenCanvas={handleFlattenCanvas}
                                // ISSUE-1395: the canvas board is image-only —
                                // hide the rail send action for video items.
                                onSendToCanvas={item.type === 'image' ? handleSendToCanvas : undefined}
                                onUpscaleToPrint={handleUpscaleToPrintReady}
                                isUpscaling={isUpscaling}
                            />
                        </div>
                    </div>

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
    );
}
