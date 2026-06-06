import React from 'react';
import { HistoryItem } from '@/core/store';
import { motion, AnimatePresence } from 'motion/react';
import { CanvasHeader } from './CanvasHeader';
import { CanvasToolbar } from './CanvasToolbar';
import AnnotationPalette from './AnnotationPalette';
import EditDefinitionsPanel from './EditDefinitionsPanel';
import { CanvasViewport } from './CanvasViewport';
import { CanvasActionRail } from './CanvasActionRail';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { canvasOps } from '../services/CanvasOperationsService';
import { useCreativeCanvas } from '../hooks/useCreativeCanvas';

interface CreativeCanvasProps {
    item: HistoryItem | null;
    onClose: () => void;
    onSendToWorkflow?: (type: 'firstFrame' | 'lastFrame', item: HistoryItem) => void;
    onRefine?: () => void;
}

export default function CreativeCanvas({ item, onClose, onSendToWorkflow, onRefine }: CreativeCanvasProps) {
    const {
        isProcessing,
        isMagicFillMode,
        isSelectingEndFrame,
        isDefinitionsOpen,
        activeColor,
        definitions,
        referenceImages,
        generatedCandidates,
        endFrameItem,
        magicFillPrompt,
        isHighFidelity,
        canvasEl,
        generatedHistory,

        setIsSelectingEndFrame,
        setEndFrameItem,
        setIsDefinitionsOpen,
        setActiveColor,
        setMagicFillPrompt,
        setIsHighFidelity,
        setGeneratedCandidates,

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        toggleMagicFill,
        handleDetectObjects,
        handleUpdateDefinition,
        handleUpdateReferenceImage,
        handleMagicFill,
        handleClearDetections,
        handleAnimate,
        handleCandidateSelect,
        saveCanvas,
        handleRefine,
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
    } = useCreativeCanvas({ item, onClose, onRefine });

    if (!item) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-background flex flex-col overflow-hidden"
                data-testid="creative-canvas-container"
            >
                <CanvasHeader
                    isMagicFillMode={isMagicFillMode}
                    magicFillPrompt={magicFillPrompt}
                    setMagicFillPrompt={setMagicFillPrompt}
                    handleMagicFill={handleMagicFill}
                    isProcessing={isProcessing}
                    isHighFidelity={isHighFidelity}
                    setIsHighFidelity={setIsHighFidelity}
                />

                <div className="flex-1 relative overflow-hidden bg-[#060608]">
                    <div className="absolute inset-0 grid grid-cols-[72px_minmax(0,1fr)_72px] gap-0">
                        <aside className="z-30 flex min-h-0 flex-col items-center justify-center border-r border-white/10 bg-[#050608]/74 px-2 py-4 backdrop-blur-xl">
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

                        {/* Stage: Main Viewport */}
                        <CanvasViewport
                            item={item}
                            canvasRef={canvasEl}
                            isMagicFillMode={isMagicFillMode}
                            activeColor={activeColor}
                            generatedCandidates={generatedCandidates}
                            onCandidateSelect={handleCandidateSelect}
                            onCloseCandidates={() => setGeneratedCandidates([])}
                            isSelectingEndFrame={isSelectingEndFrame}
                            setIsSelectingEndFrame={setIsSelectingEndFrame}
                            generatedHistory={generatedHistory}
                            onEndFrameSelect={(histItem) => {
                                setEndFrameItem(histItem as { id: string; url: string; prompt: string; type: 'image' | 'video' });
                                setIsSelectingEndFrame(false);
                            }}
                        />

                        <div className="z-30 flex min-h-0 flex-col items-center justify-center border-l border-white/10 bg-[#050608]/74 px-2 py-4 backdrop-blur-xl">
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
                                saveCanvas={saveCanvas}
                                batchExportDimensions={batchExportDimensions}
                                flattenCanvas={handleFlattenCanvas}
                            />
                        </div>
                    </div>

                    <div className="pointer-events-none absolute inset-x-[72px] top-0 h-24 bg-linear-to-b from-black/35 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-[72px] bottom-0 h-16 bg-linear-to-t from-black/30 to-transparent" />

                    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center rounded-full border border-white/10 bg-[#050608]/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/35 backdrop-blur-xl">
                        Tools left
                        <span className="mx-2 h-1 w-1 rounded-full bg-white/20" />
                        Actions right
                    </div>

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
                        />
                    </div>

                    {/* Right Panel: Contextual Options */}
                    <EditDefinitionsPanel
                        isOpen={isDefinitionsOpen}
                        onClose={() => setIsDefinitionsOpen(false)}
                        definitions={definitions}
                        onUpdateDefinition={handleUpdateDefinition}
                        referenceImages={referenceImages}
                        onUpdateReferenceImage={handleUpdateReferenceImage}
                    />
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
