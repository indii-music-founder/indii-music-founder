import React, { useState, useRef, useEffect } from 'react';
import { Brush, Wand2 } from 'lucide-react';
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
    // UI State
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<string>('');
    // Magic Fill is now always available if needed, but we start with standard interaction
    const [isMagicFillMode, setIsMagicFillMode] = useState(false);
    const [isSelectingEndFrame, setIsSelectingEndFrame] = useState(false);

    // Data State
    const [prompt, setPrompt] = useState('');
    const [activeColor, setActiveColor] = useState<CreativeColor>(STUDIO_COLORS[0]);
    const [generatedCandidates, setGeneratedCandidates] = useState<Candidate[]>([]);
    const [endFrameItem, setEndFrameItem] = useState<{ id: string; url: string; prompt: string; type: 'image' | 'video' } | null>(null);
    const [magicFillPrompt, setMagicFillPrompt] = useState('');

    // Canvas ref (kept for potential future restoration of advanced edit features if requested)
    const canvasEl = useRef<HTMLCanvasElement>(null);

    // Sync prompt from item
    useEffect(() => {
        if (item) setPrompt(item.prompt);
    }, [item]);

    // Simplified initialization: re-enabled Fabric.js for functional annotations
    useEffect(() => {
        if (canvasEl.current && item && item.type === 'image') {
            canvasOps.initialize(canvasEl.current, item.url);
        }
        return () => {
            canvasOps.dispose();
        };
    }, [item]);

    // Sync brush color
    useEffect(() => {
        if (isMagicFillMode) {
            canvasOps.updateBrushColor(activeColor);
        }
    }, [activeColor, isMagicFillMode]);

    if (!item) return null;

    const toggleMagicFill = () => {
        const newMode = !isMagicFillMode;
        setIsMagicFillMode(newMode);

        if (isMagicFillMode) {
            setGeneratedCandidates([]);
        }

        canvasOps.setMagicFillMode(newMode, activeColor);

        if (newMode) {
            toast.info(`Annotating with ${activeColor.name}. Describe your edit.`);
        }
    };

    // Simplified Magic Fill Handler using direct editing (Future: Integreate with mask drawing if needed)
    const handleMagicFill = async () => {
        if (!magicFillPrompt) {
            toast.error("Please describe the edit you want to make.");
            return;
        }

        setIsProcessing(true);
        toast.info('Processing Magic Edit...');

        try {
            // Use ImageGeneration.editImage directly for semantic edits without masks if supported, 
            // or default to whole image remix. 
            // For now, we'll assume remixing for simplicity or we can re-introduce masking later.
            // As per user request "simplify layers", we rely on semantic editing.

            const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
            // Extract base64
            const res = await fetch(item.url);
            const blob = await res.blob();
            const mimeType = blob.type || 'image/png';
            const reader = new FileReader();
            reader.readAsDataURL(blob);

            reader.onloadend = async () => {
                const base64data = (reader.result as string).split(',')[1];

                // Using remix for "Magic Fill" style editing on the whole image for now
                const result = await ImageGeneration.remixImage({
                    contentImage: { mimeType, data: base64data },
                    styleImage: { mimeType, data: base64data }, // Self-ref for style
                    prompt: magicFillPrompt
                });

                if (result) {
                    setGeneratedCandidates([{
                        id: crypto.randomUUID(),
                        url: result.url,
                        prompt: magicFillPrompt // Add prompted text to satisfy interface
                    }]);
                    toast.success("Edit Generated!");
                }
            }

        } catch (error: any) {
            toast.error(error.message || 'Failed to process edit');
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
                    onRefine={onRefine || handleRefine}
                    onCreateLastFrame={handleCreateLastFrame}
                    processingStatus={processingStatus}
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
                                colorDefinitions={{}} // TODO: Sync with store
                                onOpenDefinitions={() => { }} // TODO: Implement UI
                            />
                        </div>
                    </aside>

                    {/* Stage: Main Viewport */}
                    <main className="flex-1 relative bg-[#050505] flex items-center justify-center overflow-hidden p-12">
                        {item.type === 'video' && !item.url.startsWith('data:image') ? (
                            <video src={item.url} controls className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
                        ) : (
                            <div className="relative w-full h-full flex items-center justify-center group" onClick={(e) => isMagicFillMode && e.stopPropagation()}>
                                <canvas
                                    ref={canvasEl}
                                    className="max-w-full max-h-full object-contain shadow-2xl rounded-lg cursor-crosshair"
                                    data-testid="creative-canvas-element"
                                />
                                {item.type === 'video' && item.url.startsWith('data:image') && (
                                    <div className="absolute top-4 left-4 bg-purple-600/90 text-white text-xs font-bold px-3 py-1 rounded-md backdrop-blur-sm shadow-lg border border-white/20 pointer-events-none">
                                        STORYBOARD PREVIEW
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Floating Interaction Status */}
                        {isMagicFillMode && (
                            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-blue-600/20 border border-blue-500/50 text-blue-400 px-4 py-1 rounded-full text-xs font-bold backdrop-blur-md flex items-center gap-2">
                                <Wand2 size={12} />
                                Magic Edit Mode
                            </div>
                        )}

                        {/* Candidates Overlay */}
                        <CandidatesCarousel
                            candidates={generatedCandidates}
                            onSelect={handleCandidateSelect}
                            onClose={() => setGeneratedCandidates([])}
                        />

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
                    </main>

                    {/* Right Panel: Contextual Options (Optional / Future) */}
                    {/* <EditDefinitionsPanel /> */}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
