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
import { QuotaExceededError } from '@/shared/types/errors';

interface CreativeCanvasProps {
    item: HistoryItem | null;
    onClose: () => void;
    onSendToWorkflow?: (type: 'firstFrame' | 'lastFrame', item: HistoryItem) => void;
    onRefine?: () => void;
}

export default function CreativeCanvas({ item, onClose, onSendToWorkflow, onRefine }: CreativeCanvasProps) {
    const { generatedHistory, currentProjectId } = useStore();
    const toast = useToast();

    // UI State
    const [isEditing, setIsEditing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<string>('');
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
        } catch (error: unknown) {
            const err = error as { name?: string; code?: string; message?: string };
            if (err?.name === 'QuotaExceededError' || err?.code === 'QUOTA_EXCEEDED') {
                toast.error(err.message || 'Limit reached. Please upgrade.');
            } else {
                toast.error('Failed to process edits');
            }
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
            const err = error as { name?: string; code?: string; message?: string };
            if (err?.name === 'QuotaExceededError' || err?.code === 'QUOTA_EXCEEDED') {
                toast.error(err.message || 'Video limit reached. Please upgrade.');
            } else {
                const message = error instanceof Error ? error.message : 'Unknown error';
                toast.error(`Animation failed: ${message}`);
            }
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
        onClose();
        const { addWhiskItem, setPendingPrompt, setViewMode, setGenerationMode } = useStore.getState();
        toast.info("Refining... Analyzing image essence.");
        setGenerationMode('image');
        setViewMode('gallery');
        const whiskId = crypto.randomUUID();
        const initialCaption = item.prompt || "Image Reference";
        addWhiskItem('subject', 'image', item.url, initialCaption, whiskId);
        setPendingPrompt(item.prompt);
        try {
            const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
            const [mimeType, b64] = item.url.split(',');
            const pureMime = mimeType.split(':')[1].split(';')[0];
            const caption = await ImageGeneration.captionImage({ mimeType: pureMime, data: b64 }, 'subject');
            const { updateWhiskItem } = useStore.getState();
            updateWhiskItem('subject', whiskId, { aiCaption: caption });
            toast.success("Image essence extracted and locked!");
        } catch (e: any) {
            toast.warning("Could not auto-caption. Using original prompt.");
        }
    };

    const handleCreateLastFrame = async () => {
        if (!item || item.type !== 'image') return;

        setIsProcessing(true);
        setProcessingStatus("Analyzing Scene...");
        toast.info("Analyzing scene to architect cinematic climax...");

        try {
            const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
            // Remove unused import if not needed, or keep if CloudStorageService is used elsewhere

            // 1. Get Base64 & Mime
            const res = await fetch(item.url);
            const blob = await res.blob();
            // Use the blob's actual type, default to png if missing
            const mimeType = blob.type || 'image/png';

            const seedBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    // Robustly strip ALL data headers: data:image/xxx;base64,
                    const base64Clean = result.replace(/^data:.*;base64,/, '');
                    resolve(base64Clean);
                };
                reader.readAsDataURL(blob);
            });

            // 2. Analyze
            const climaxDescription = await ImageGeneration.captionImage(
                { mimeType, data: seedBase64 },
                'subject'
            );

            // 3. Synthesize
            setProcessingStatus("Synthesizing End-Frame...");
            toast.info("Synthesizing climax end-frame...");

            const refinedPrompt = `${climaxDescription}, capturing the high-energy climax of the scene with dramatic lighting and motion energy.`;
            const synthResults = await ImageGeneration.remixImage({
                contentImage: { mimeType, data: seedBase64 },
                styleImage: { mimeType, data: seedBase64 },
                prompt: refinedPrompt
            });

            if (!synthResults) throw new Error("Synthesis failed.");

            // 4. Save & Set
            setProcessingStatus("Finalizing...");
            const targetId = crypto.randomUUID();
            const targetAsset: HistoryItem = {
                id: targetId,
                url: synthResults.url,
                prompt: `End Frame Climax: ${refinedPrompt.substring(0, 50)}...`,
                type: 'image',
                timestamp: Date.now(),
                projectId: currentProjectId
            };

            const { addToHistory } = useStore.getState();
            addToHistory(targetAsset);
            setEndFrameItem(targetAsset as any);

            toast.success("Cinematic climax bridge created!");
        } catch (error: any) {
            console.error("Create Last Frame failed:", error);
            toast.error(`Architect Error: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
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
                        onCreateLastFrame={handleCreateLastFrame}
                        processingStatus={processingStatus}
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
