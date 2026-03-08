import React from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { motion, AnimatePresence } from 'motion/react';
import { CanvasHeader } from './CanvasHeader';
import { CanvasToolbar } from './CanvasToolbar';
import AnnotationPalette from './AnnotationPalette';
import EditDefinitionsPanel from './EditDefinitionsPanel';
import { CanvasViewport } from './CanvasViewport';
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
        processingStatus,
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

        toggleMagicFill,
        handleUpdateDefinition,
        handleUpdateReferenceImage,
        handleMagicFill,
        handleAnimate,
        handleCandidateSelect,
        saveCanvas,
        handleRefine,
        handleCreateLastFrame,
        batchExportDimensions,
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
                />

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Sidebar: Tools & Annotations */}
                    <aside className="border-r border-gray-800 bg-[#0a0a0a] flex flex-col items-center">
                        <CanvasToolbar
                            addRectangle={() => canvasOps.addRectangle()}
                            addCircle={() => canvasOps.addCircle()}
                            addText={() => canvasOps.addText()}
                            toggleMagicFill={toggleMagicFill}
                            isMagicFillMode={isMagicFillMode}
                        />
                        <div className="flex-1 overflow-y-auto w-full custom-scrollbar py-4 px-2">
                            <AnnotationPalette
                                activeColor={activeColor}
                                onColorSelect={setActiveColor}
                                colorDefinitions={definitions}
                                onOpenDefinitions={() => setIsDefinitionsOpen(true)}
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
                            setEndFrameItem(histItem as any);
                            setIsSelectingEndFrame(false);
                        }}
                    />

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
