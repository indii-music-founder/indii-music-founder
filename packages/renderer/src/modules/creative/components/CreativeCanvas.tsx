import React from 'react';
import { HistoryItem } from '@/core/store';
import { motion, AnimatePresence } from 'motion/react';
import { CanvasHeader } from './CanvasHeader';
import { CanvasToolbar } from './CanvasToolbar';
import AnnotationPalette from './AnnotationPalette';
import EditDefinitionsPanel from './EditDefinitionsPanel';
import { CanvasViewport } from './CanvasViewport';
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
                    saveCanvas={saveCanvas}
                    item={item}
                    endFrameItem={endFrameItem}
                    setEndFrameItem={setEndFrameItem}
                    setIsSelectingEndFrame={setIsSelectingEndFrame}
                    handleAnimate={handleAnimate}
                    onClose={onClose}
                    onSendToWorkflow={onSendToWorkflow}
                    onRefine={handleRefine}
                    onCreateLastFrame={handleCreateLastFrame}
                    isHighFidelity={isHighFidelity}
                    setIsHighFidelity={setIsHighFidelity}
                    batchExportDimensions={batchExportDimensions}
                    flattenCanvas={handleFlattenCanvas}
                />

                <div className="flex-1 relative overflow-hidden bg-[#060608]">
                    {/* Stage: Main Viewport */}
                    <div className="absolute inset-0 z-0">
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
                    </div>

                    {/* Floating Dynamic Island */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 hidden md:flex items-center gap-2 bg-[#060608]/80 backdrop-blur-2xl border border-white/10 rounded-full px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
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
                        <div className="w-px h-6 bg-white/10 mx-2" />
                        <AnnotationPalette
                            activeColor={activeColor}
                            onColorSelect={setActiveColor}
                            colorDefinitions={definitions}
                            onOpenDefinitions={() => setIsDefinitionsOpen(true)}
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
