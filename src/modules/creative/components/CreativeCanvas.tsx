import React, { useState, useRef, useEffect } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { saveAssetToStorage, saveCanvasStateToStorage, getCanvasStateFromStorage } from '@/services/storage/repository';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/core/context/ToastContext';
import { CanvasHeader } from './CanvasHeader';
import { CanvasToolbar } from './CanvasToolbar';
import { EndFrameSelector } from './EndFrameSelector';
import { CandidatesCarousel, Candidate } from './CandidatesCarousel';
import AnnotationPalette from './AnnotationPalette';
import EditDefinitionsPanel from './EditDefinitionsPanel';
import { STUDIO_COLORS, CreativeColor } from '../constants';
import { canvasOps } from '../services/CanvasOperationsService';
import { VideoDirector } from '../services/VideoDirector';
import { Editing } from '@/services/image/EditingService';

interface CreativeCanvasProps {
    item: HistoryItem | null;
    onClose: () => void;
    onSendToWorkflow?: (type: 'firstFrame' | 'lastFrame', item: HistoryItem) => void;
    onRefine?: () => void;
}

export default function CreativeCanvas({ item, onClose, onSendToWorkflow, onRefine }: CreativeCanvasProps) {
    const { generatedHistory } = useStore();
    const toast = useToast();

    // UI State
    const [isEditing, setIsEditing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isMagicFillMode, setIsMagicFillMode] = useState(false);
    const [isDefinitionsOpen, setIsDefinitionsOpen] = useState(false);
    const [isSelectingEndFrame, setIsSelectingEndFrame] = useState(false);

    // Data State
    const [prompt, setPrompt] = useState('');
    const [activeColor, setActiveColor] = useState<CreativeColor>(STUDIO_COLORS[0]);
    const [editDefinitions, setEditDefinitions] = useState<Record<string, string>>({});
    const [referenceImages, setReferenceImages] = useState<Record<string, { mimeType: string; data: string } | null>>({});
    const [generatedCandidates, setGeneratedCandidates] = useState<Candidate[]>([]);
    const [endFrameItem, setEndFrameItem] = useState<{ id: string; url: string; prompt: string; type: 'image' | 'video' } | null>(null);
    const [magicFillPrompt, setMagicFillPrompt] = useState('');

    // Canvas ref
    const canvasEl = useRef<HTMLCanvasElement>(null);

    // Sync prompt from item
    useEffect(() => {
        if (item) setPrompt(item.prompt);
    }, [item]);

    // Initialize/dispose canvas
    useEffect(() => {
        if (!item) return;

        if (isEditing && canvasEl.current && !canvasOps.isInitialized()) {
            const imageUrl = item.url && item.type === 'image' ? item.url : undefined;

            // Initialize with image, then try to load saved state
            canvasOps.initialize(canvasEl.current, imageUrl, async () => {
                if (!item) return;
                const savedState = await getCanvasStateFromStorage(item.id);
                if (savedState) {
                    console.info(`[CreativeCanvas] Loading saved state for ${item.id}`);
                    await canvasOps.loadFromJSON(savedState);
                }
            });
        }

        return () => {
            if (!isEditing) {
                canvasOps.dispose();
            }
        };
    }, [isEditing, item]);

    // Update brush color when active color changes
    useEffect(() => {
        canvasOps.updateBrushColor(activeColor);
    }, [activeColor]);

    if (!item) return null;

    const toggleMagicFill = () => {
        const newMode = !isMagicFillMode;
        setIsMagicFillMode(newMode);

        if (isMagicFillMode) {
            setGeneratedCandidates([]);
        }

        canvasOps.setMagicFillMode(newMode, activeColor);

        if (newMode) {
            toast.info(`Annotating with ${activeColor.name}. Define edit in settings.`);
        }
    };

    const handleMultiEdit = async () => {
        const prepared = canvasOps.prepareMasksForEdit(editDefinitions, referenceImages);

        if (!prepared) {
            toast.error('Please define at least one edit prompt and draw annotations.');
            setIsDefinitionsOpen(true);
            return;
        }

        setIsProcessing(true);
        toast.info('Processing Studio Edits...');

        try {
            const results = await Editing.multiMaskEdit({
                image: prepared.baseImage,
                masks: prepared.masks
            });

            if (results && results.length > 0) {
                setGeneratedCandidates(results);
                toast.success(`Generated ${results.length} variations!`);
            } else {
                toast.error('Generation failed to produce candidates.');
            }
        } catch (error) {
            toast.error('Failed to process edits');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAnimate = async () => {
        if (!item) return;
        toast.info('Starting video generation...');

        try {
            const result = await VideoDirector.triggerAnimation(item);
            if (result.success) {
                toast.success('Video generation started in background!');
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Animation failed: ${message}`);
        }
    };

    const handleCandidateSelect = async (candidate: Candidate, index: number) => {
        await canvasOps.applyCandidateImage(candidate.url, isMagicFillMode, activeColor);
        setGeneratedCandidates([]);
        toast.success(`Daisy Chain Linked: Applied Option ${index + 1}`);
    };

    const saveCanvas = async () => {
        // 1. Download Locally (Existing behavior)
        canvasOps.saveCanvas(`edited-${item.id}.png`);

        // 2. Save to Project (Cloud/Persistence)
        try {
            // Save the visual result
            const blob = await canvasOps.getBlob();
            if (blob) {
                const assetId = await saveAssetToStorage(blob);
                console.info(`[CreativeCanvas] Saved asset ${assetId} to project`);
            }

            // Save the editable project state
            const json = await canvasOps.toJSON();
            if (json) {
                await saveCanvasStateToStorage(item.id, json);
                console.info(`[CreativeCanvas] Saved project state for ${item.id}`);
            }

            toast.success('Canvas & Project State stored!');
        } catch (error) {
            // Don't block the user, just warn
            toast.warning('Saved to disk, but cloud sync failed.');
        }
    };

    const handleRefine = async () => {
        if (!item) return;

        // 1. Close the canvas (this logic is handled by the caller usually, but we can do it here if needed)
        // Actually, we want to transition view.
        onClose();

        const {
            addWhiskItem,
            setPendingPrompt,
            setViewMode,
            setGenerationMode // Ensure we are in image mode
        } = useStore.getState();

        // 2. Set up UI state for refinement
        // We'll optimistically add it to Whisk even before caption is ready? 
        // Better to get caption first, or use a placeholder?
        // Let's use a "Thinking..." or reuse original prompt as temporary caption.

        toast.info("Refining... Analyzing image essence.");

        // Ensure we are in the right mode
        setGenerationMode('image');
        setViewMode('gallery'); // Or keep same view? Gallery seems standard.

        // 3. Add to Whisk
        // We need an ID for the whisk item.
        const whiskId = crypto.randomUUID();

        // Use original prompt as fallback initial caption
        const initialCaption = item.prompt || "Image Reference";

        // Store signature: addWhiskItem: (category, type, content, aiCaption, explicitId)
        addWhiskItem('subject', 'image', item.url, initialCaption, whiskId);

        // 4. Set pending prompt to original prompt so user can iterate
        setPendingPrompt(item.prompt);

        // 5. Async: Get the real caption
        try {
            // Dynamic import to avoid circular deps if any, or just good practice for heavy services
            const { ImageGeneration } = await import('@/services/image/ImageGenerationService');

            // Parse data URL (assuming base64 for generated items)
            const [mimeType, b64] = item.url.split(',');
            const pureMime = mimeType.split(':')[1].split(';')[0];

            const caption = await ImageGeneration.captionImage(
                { mimeType: pureMime, data: b64 },
                'subject'
            );

            // Update the item with the real caption
            // Store signature: updateWhiskItem: (category, id, updates)
            const { updateWhiskItem } = useStore.getState();
            updateWhiskItem('subject', whiskId, { aiCaption: caption });
            toast.success("Image essence extracted and locked!");
        } catch (e) {
            toast.warning("Could not auto-caption. Using original prompt.");
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                onClick={onClose}
                data-testid="creative-canvas-modal-overlay"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative max-w-6xl w-full h-[90vh] bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden flex flex-col shadow-2xl"
                    onClick={e => e.stopPropagation()}
                    data-testid="creative-canvas-modal-content"
                >
                    <CanvasHeader
                        isEditing={isEditing}
                        setIsEditing={setIsEditing}
                        isMagicFillMode={isMagicFillMode}
                        magicFillPrompt={magicFillPrompt}
                        setMagicFillPrompt={setMagicFillPrompt}
                        handleMagicFill={handleMultiEdit}
                        isProcessing={isProcessing}
                        saveCanvas={saveCanvas}
                        item={item}
                        endFrameItem={endFrameItem}
                        setEndFrameItem={setEndFrameItem}
                        setIsSelectingEndFrame={setIsSelectingEndFrame}
                        handleAnimate={handleAnimate}
                        onClose={onClose}
                        onSendToWorkflow={onSendToWorkflow}
                        onRefine={onRefine || handleRefine}
                    />

                    <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#0f0f0f] relative">
                        {isEditing ? (
                            <>
                                <div className="flex h-full w-full">
                                    <AnnotationPalette
                                        activeColor={activeColor}
                                        onColorSelect={setActiveColor}
                                        colorDefinitions={editDefinitions}
                                        onOpenDefinitions={() => setIsDefinitionsOpen(true)}
                                    />
                                    <CanvasToolbar
                                        addRectangle={() => canvasOps.addRectangle()}
                                        addCircle={() => canvasOps.addCircle()}
                                        addText={() => canvasOps.addText()}
                                        toggleMagicFill={toggleMagicFill}
                                        isMagicFillMode={isMagicFillMode}
                                    />
                                    <div className="flex-1 flex items-center justify-center bg-gray-900 overflow-auto p-8">
                                        <canvas ref={canvasEl} />
                                    </div>
                                </div>

                                <EditDefinitionsPanel
                                    isOpen={isDefinitionsOpen}
                                    onClose={() => setIsDefinitionsOpen(false)}
                                    definitions={editDefinitions}
                                    onUpdateDefinition={(id, val) => setEditDefinitions(prev => ({ ...prev, [id]: val }))}
                                    referenceImages={referenceImages}
                                    onUpdateReferenceImage={(id, val) => setReferenceImages(prev => ({ ...prev, [id]: val }))}
                                />

                                <CandidatesCarousel
                                    candidates={generatedCandidates}
                                    onSelect={handleCandidateSelect}
                                    onClose={() => setGeneratedCandidates([])}
                                />
                            </>
                        ) : (
                            item.type === 'video' && !item.url.startsWith('data:image') ? (
                                <video src={item.url} controls className="max-w-full max-h-full object-contain shadow-2xl" />
                            ) : (
                                <div className="relative max-w-full max-h-full">
                                    <img src={item.url} alt={item.prompt || 'Content'} className="max-w-full max-h-full object-contain shadow-2xl" />
                                    {item.type === 'video' && item.url.startsWith('data:image') && (
                                        <div className="absolute top-4 left-4 bg-purple-600/90 text-white text-xs font-bold px-3 py-1 rounded-md backdrop-blur-sm shadow-lg border border-white/20">
                                            STORYBOARD PREVIEW
                                        </div>
                                    )}
                                </div>
                            )
                        )}

                        <EndFrameSelector
                            isOpen={isSelectingEndFrame}
                            onClose={() => setIsSelectingEndFrame(false)}
                            generatedHistory={generatedHistory}
                            currentItemId={item.id}
                            onSelect={(histItem) => {
                                setEndFrameItem(histItem as typeof endFrameItem);
                                setIsSelectingEndFrame(false);
                            }}
                        />
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
