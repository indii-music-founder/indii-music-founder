import React, { useState, useRef, useEffect } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/core/context/ToastContext';
import * as fabric from 'fabric';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { CanvasHeader } from './CanvasHeader';
import { CanvasToolbar } from './CanvasToolbar';
import { EndFrameSelector } from './EndFrameSelector';
import AnnotationPalette from './AnnotationPalette';
import EditDefinitionsPanel from './EditDefinitionsPanel';
import { NANA_COLORS, NanaColor } from '../constants';
import { Editing } from '@/services/image/EditingService';

interface CreativeCanvasProps {
    item: HistoryItem | null;
    onClose: () => void;
    onSendToWorkflow?: (type: 'firstFrame' | 'lastFrame', item: HistoryItem) => void;
}

export default function CreativeCanvas({ item, onClose, onSendToWorkflow }: CreativeCanvasProps) {
    const { updateHistoryItem, setActiveReferenceImage, uploadedImages, addUploadedImage, currentProjectId, generatedHistory } = useStore();
    const toast = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const canvasEl = useRef<HTMLCanvasElement>(null);
    const fabricCanvas = useRef<fabric.Canvas | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [endFrameItem, setEndFrameItem] = useState<{ id: string; url: string; prompt: string; type: 'image' | 'video' } | null>(null);
    const [isSelectingEndFrame, setIsSelectingEndFrame] = useState(false);

    // Nana Banana Pro State
    const [activeColor, setActiveColor] = useState<NanaColor>(NANA_COLORS[0]);
    const [editDefinitions, setEditDefinitions] = useState<Record<string, string>>({});
    const [isDefinitionsOpen, setIsDefinitionsOpen] = useState(false);
    const [generatedCandidates, setGeneratedCandidates] = useState<{ id: string; url: string; prompt: string }[]>([]);

    useEffect(() => {
        if (item) {
            setPrompt(item.prompt);
        }
    }, [item]);

    // ... (Fabric Canvas initialization omitted for brevity, it remains unchanged)

    // ... (Drawing functions omitted)

    // ... (Magic Fill logic omitted)


    // Initialize Fabric Canvas
    useEffect(() => {
        if (isEditing && canvasEl.current && !fabricCanvas.current) {
            const canvas = new fabric.Canvas(canvasEl.current, {
                width: 800,
                height: 600,
                backgroundColor: '#1a1a1a',
            });
            fabricCanvas.current = canvas;

            // Load the image onto the canvas
            if (item?.url && item.type === 'image') {
                fabric.Image.fromURL(item.url).then((img: fabric.Image) => {
                    // Scale image to fit canvas
                    const scale = Math.min(
                        (canvas.width! - 40) / img.width!,
                        (canvas.height! - 40) / img.height!
                    );
                    img.scale(scale);
                    img.set({
                        left: canvas.width! / 2,
                        top: canvas.height! / 2,
                        originX: 'center',
                        originY: 'center',
                        selectable: false // Background image shouldn't be moved easily
                    });
                    canvas.add(img);
                    canvas.renderAll();
                });
            }
        }

        return () => {
            if (!isEditing && fabricCanvas.current) {
                fabricCanvas.current.dispose();
                fabricCanvas.current = null;
            }
        };
    }, [isEditing, item]);

    if (!item) return null;

    const addRectangle = () => {
        if (!fabricCanvas.current) return;
        const rect = new fabric.Rect({
            left: 100,
            top: 100,
            fill: 'rgba(255,0,0,0.5)',
            width: 100,
            height: 100,
        });
        fabricCanvas.current.add(rect);
    };

    const addCircle = () => {
        if (!fabricCanvas.current) return;
        const circle = new fabric.Circle({
            left: 200,
            top: 200,
            fill: 'rgba(0,255,0,0.5)',
            radius: 50,
        });
        fabricCanvas.current.add(circle);
    };

    const addText = () => {
        if (!fabricCanvas.current) return;
        const text = new fabric.IText('Edit Me', {
            left: 300,
            top: 300,
            fill: '#ffffff',
            fontSize: 24,
        });
        fabricCanvas.current.add(text);
    };

    const saveCanvas = () => {
        if (fabricCanvas.current) {
            const dataUrl = fabricCanvas.current.toDataURL({
                format: 'png',
                quality: 1,
                multiplier: 2
            });
            // Save as a new asset or update history
            // For now, let's just download it or log it
            const link = document.createElement('a');
            link.download = `edited-${item.id}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Canvas saved!");
        }
    };

    const handleHeaderGenerate = async () => {
        toast.info("Generation triggered (Mock)");
    };

    const [isMagicFillMode, setIsMagicFillMode] = useState(false);
    const [magicFillPrompt, setMagicFillPrompt] = useState('');

    const toggleMagicFill = () => {
        if (!fabricCanvas.current) return;
        setIsMagicFillMode(!isMagicFillMode);

        // Clear candidates when toggling mode
        if (isMagicFillMode) {
            setGeneratedCandidates([]);
        }

        if (!isMagicFillMode) {
            // Enable drawing mode for mask
            fabricCanvas.current.isDrawingMode = true;
            fabricCanvas.current.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas.current);
            fabricCanvas.current.freeDrawingBrush.width = 30;
            // Set brush color to active Nana color
            // Use hex directly but with some transparency for visibility
            // Convert hex to rgba manually or use fabric util if available. 
            // Simple string concat for now assuming full hex.
            const hex = activeColor.hex;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            fabricCanvas.current.freeDrawingBrush.color = `rgba(${r}, ${g}, ${b}, 0.5)`;

            toast.info(`Annotating with ${activeColor.name}. Define edit in settings.`);
        } else {
            fabricCanvas.current.isDrawingMode = false;
        }
    };

    // Update brush color when active color changes
    useEffect(() => {
        if (fabricCanvas.current && fabricCanvas.current.isDrawingMode && fabricCanvas.current.freeDrawingBrush) {
            const hex = activeColor.hex;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            fabricCanvas.current.freeDrawingBrush.color = `rgba(${r}, ${g}, ${b}, 0.5)`;
        }
    }, [activeColor]);

    const handleMultiEdit = async () => {
        if (!fabricCanvas.current || !item) return;

        // Verify we have definitions
        const activeDefinitions = Object.entries(editDefinitions).filter(([_, val]) => val.trim().length > 0);
        if (activeDefinitions.length === 0) {
            toast.error("Please define at least one edit prompt in the settings panel.");
            setIsDefinitionsOpen(true);
            return;
        }

        setIsProcessing(true);
        toast.info("Processing Nana Banana Pro Edits...");

        try {
            const canvas = fabricCanvas.current;
            const originalObjects = canvas.getObjects();
            const maskObjects = originalObjects.filter(obj => obj.type === 'path');
            const contentObjects = originalObjects.filter(obj => obj.type !== 'path');

            // 1. Generate Base Image (Content only)
            // Hide all masks
            maskObjects.forEach(obj => obj.visible = false);
            canvas.backgroundColor = '#000000';
            const baseImage = canvas.toDataURL({ format: 'png', multiplier: 1 });
            const baseImageObj = { mimeType: 'image/png', data: baseImage.split(',')[1] };

            // 2. Generate Masks for each color
            const masksToProcess = [];

            for (const [colorId, prompt] of activeDefinitions) {
                const colorDef = NANA_COLORS.find(c => c.id === colorId);
                if (!colorDef) continue;

                // Find paths matching this color
                // Fabric path stroke might be rgba string. 
                // We need to match somewhat loosely or store metadata.
                // Simple approach: Check stroke color string.
                const hex = colorDef.hex;
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                const targetRgbaStart = `rgba(${r}, ${g}, ${b}`; // Partial match

                const colorPaths = maskObjects.filter(obj => {
                    return obj.stroke && obj.stroke.toString().startsWith(targetRgbaStart);
                });

                if (colorPaths.length > 0) {
                    // Hide all objects
                    originalObjects.forEach(obj => obj.visible = false);

                    // Show only specific color paths as WHITE
                    colorPaths.forEach(obj => {
                        obj.visible = true;
                        obj.set({ stroke: '#ffffff', fill: '' }); // Paths are usually strokes
                        // obj.set({ fill: '#ffffff' }); // If it was a fill shape
                    });

                    canvas.backgroundColor = '#000000';
                    const maskDataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 });

                    masksToProcess.push({
                        mimeType: 'image/png',
                        data: maskDataUrl.split(',')[1],
                        prompt: prompt,
                        colorId: colorId
                    });

                    // Restore visual state for these paths
                    colorPaths.forEach(obj => {
                        const colorRgba = `rgba(${r}, ${g}, ${b}, 0.5)`;
                        obj.set({ stroke: colorRgba });
                    });
                }
            }

            // Restore all visibility
            originalObjects.forEach(obj => obj.visible = true);
            canvas.backgroundColor = '#1a1a1a';
            canvas.renderAll();

            if (masksToProcess.length === 0) {
                toast.error("No drawn areas match your definitions.");
                setIsProcessing(false);
                return;
            }

            // 3. Call Service
            const results = await Editing.multiMaskEdit({
                image: baseImageObj,
                masks: masksToProcess
            });

            if (results && results.length > 0) {
                setGeneratedCandidates(results);
                toast.success(`Generated ${results.length} variations!`);
                // Auto-show candidates UI (implemented below)
            } else {
                toast.error("Generation failed to produce candidates.");
            }

        } catch (error) {
            console.error("Multi Edit Error:", error);
            toast.error("Failed to process edits");
        } finally {
            setIsProcessing(false);
        }
    };



    const handleAnimate = async () => {
        if (!item) return;
        toast.info("Starting video generation...");

        try {
            // Call the triggerVideoGeneration Cloud Function
            const triggerVideoGeneration = httpsCallable(functions, 'triggerVideoGeneration');
            const response = await triggerVideoGeneration({
                image: item.url,
                prompt: item.prompt || "Animate this scene",
                model: "veo-3.1-generate-preview"
            });

            const result = response.data as any;
            if (result.success) {
                toast.success("Video generation started in background!");
            } else {
                throw new Error(result.error || "Unknown error");
            }
        } catch (error: unknown) {
            console.error("Animation Error:", error);
            if (error instanceof Error) {
                toast.error(`Animation failed: ${error.message}`);
            } else {
                toast.error("Animation failed: Unknown error");
            }
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
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative max-w-6xl w-full h-[90vh] bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden flex flex-col shadow-2xl"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header                        <CanvasHeader
                            isEditing={isEditing}
                            setIsEditing={setIsEditing}
                            isMagicFillMode={isMagicFillMode}
                            magicFillPrompt={magicFillPrompt}
                            setMagicFillPrompt={setMagicFillPrompt}
                            handleMagicFill={handleMultiEdit}
                            isProcessing={isProcessing}
                            // Change 'Generate' button text based on mode
                            saveCanvas={saveCanvas}
                            item={item}
                            endFrameItem={endFrameItem}
                            setEndFrameItem={setEndFrameItem}
                            setIsSelectingEndFrame={setIsSelectingEndFrame}
                            handleAnimate={handleAnimate}
                            onClose={onClose}
                        /> */}
                    <CanvasHeader
                        isEditing={isEditing}
                        setIsEditing={setIsEditing}
                        isMagicFillMode={isMagicFillMode}
                        magicFillPrompt={magicFillPrompt}
                        setMagicFillPrompt={setMagicFillPrompt}
                        handleMagicFill={handleMultiEdit}
                        isProcessing={isProcessing}
                        // Change 'Generate' button text based on mode
                        saveCanvas={saveCanvas}
                        item={item}
                        endFrameItem={endFrameItem}
                        setEndFrameItem={setEndFrameItem}
                        setIsSelectingEndFrame={setIsSelectingEndFrame}
                        handleAnimate={handleAnimate}
                        onClose={onClose}
                        onSendToWorkflow={onSendToWorkflow}
                    />

                    {/* Content */}
                    <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#0f0f0f] relative">
                        {isEditing ? (
                            <>
                                <div className="flex h-full w-full">
                                    {/* Toolbar */}
                                    <AnnotationPalette
                                        activeColor={activeColor}
                                        onColorSelect={setActiveColor}
                                        colorDefinitions={editDefinitions}
                                        onOpenDefinitions={() => setIsDefinitionsOpen(true)}
                                    />
                                    <CanvasToolbar
                                        addRectangle={addRectangle}
                                        addCircle={addCircle}
                                        addText={addText}
                                        toggleMagicFill={toggleMagicFill}
                                        isMagicFillMode={isMagicFillMode}
                                    />
                                    {/* Canvas Area */}
                                    <div className="flex-1 flex items-center justify-center bg-gray-900 overflow-auto p-8">
                                        <canvas ref={canvasEl} />
                                    </div>
                                </div>

                                <EditDefinitionsPanel
                                    isOpen={isDefinitionsOpen}
                                    onClose={() => setIsDefinitionsOpen(false)}
                                    definitions={editDefinitions}
                                    onUpdateDefinition={(id, val) => setEditDefinitions(prev => ({ ...prev, [id]: val }))}
                                />

                                {generatedCandidates.length > 0 && (
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-gray-700 p-4 rounded-xl shadow-2xl z-50 flex gap-4 max-w-[90%] overflow-x-auto">
                                        {generatedCandidates.map((cand, idx) => (
                                            <div key={cand.id} className="relative group min-w-[150px] w-[150px]">
                                                <img src={cand.url} className="w-full h-auto rounded border border-gray-800" />
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[10px] text-center truncate text-white">
                                                    {cand.prompt}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        // Apply this candidate
                                                        if (fabricCanvas.current) {
                                                            const canvas = fabricCanvas.current;
                                                            fabric.Image.fromURL(cand.url).then(img => {
                                                                img.scaleToWidth(canvas.width!);
                                                                img.set({ left: canvas.width! / 2, top: canvas.height! / 2, originX: 'center', originY: 'center' });
                                                                // Clear old masks
                                                                const objs = canvas.getObjects();
                                                                const masks = objs.filter(o => o.type === 'path');
                                                                canvas.remove(...masks);

                                                                canvas.add(img);
                                                                canvas.renderAll();
                                                            });
                                                            setGeneratedCandidates([]); // Close selection
                                                            toast.success(`Applied Option ${idx + 1}`);
                                                        }
                                                    }}
                                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                                >
                                                    <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold">Select</span>
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => setGeneratedCandidates([])}
                                            className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center"
                                        >
                                            <span className="text-xl">×</span>
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            (item.type === 'video' && !item.url.startsWith('data:image')) ? (
                                <video src={item.url} controls className="max-w-full max-h-full object-contain shadow-2xl" />
                            ) : (
                                <div className="relative max-w-full max-h-full">
                                    <img src={item.url} alt={item.prompt || "Content"} className="max-w-full max-h-full object-contain shadow-2xl" />
                                    {item.type === 'video' && item.url.startsWith('data:image') && (
                                        <div className="absolute top-4 left-4 bg-purple-600/90 text-white text-xs font-bold px-3 py-1 rounded-md backdrop-blur-sm shadow-lg border border-white/20">
                                            STORYBOARD PREVIEW
                                        </div>
                                    )}
                                </div>
                            )
                        )}

                        {/* End Frame Selection Overlay */}
                        <EndFrameSelector
                            isOpen={isSelectingEndFrame}
                            onClose={() => setIsSelectingEndFrame(false)}
                            generatedHistory={generatedHistory}
                            currentItemId={item.id}
                            onSelect={(histItem) => {
                                setEndFrameItem(histItem as any);
                                setIsSelectingEndFrame(false);
                            }}
                        />
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence >
    );
}
