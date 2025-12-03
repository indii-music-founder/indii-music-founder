import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/core/store';
import { X, Download, Share2, Wand2, Brush, Eraser, Save, RotateCcw, Trash2, Play, Type, Square, Circle as CircleIcon, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/core/context/ToastContext';
import * as fabric from 'fabric';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

interface CreativeCanvasProps {
    item: { id: string; url: string; prompt: string; type: 'image' | 'video'; mask?: string } | null;
    onClose: () => void;
}

export default function CreativeCanvas({ item, onClose }: CreativeCanvasProps) {
    const { updateHistoryItem, setActiveReferenceImage, uploadedImages, addUploadedImage, currentProjectId } = useStore();
    const toast = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const canvasEl = useRef<HTMLCanvasElement>(null);
    const fabricCanvas = useRef<fabric.Canvas | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (item) {
            setPrompt(item.prompt);
        }
    }, [item]);

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

        if (!isMagicFillMode) {
            // Enable drawing mode for mask
            fabricCanvas.current.isDrawingMode = true;
            fabricCanvas.current.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas.current);
            fabricCanvas.current.freeDrawingBrush.width = 30;
            fabricCanvas.current.freeDrawingBrush.color = 'rgba(255, 0, 255, 0.5)'; // Visible mask color
            toast.info("Draw over the area you want to replace");
        } else {
            fabricCanvas.current.isDrawingMode = false;
        }
    };

    const handleMagicFill = async () => {
        if (!fabricCanvas.current || !item) return;
        if (!magicFillPrompt) {
            toast.error("Please enter a prompt for Magic Fill");
            return;
        }

        setIsProcessing(true);
        toast.info("Applying Magic Fill...");

        try {
            // 1. Get the original image (base64) - assuming item.url is data URI or we can fetch it
            // For simplicity, if it's a remote URL, we might need to proxy or fetch it. 
            // If it's data URI, we're good.
            let imageBase64 = item.url;
            if (!imageBase64.startsWith('data:')) {
                // Fetch and convert if needed, or just use canvas export if it's the base
                // Let's use the canvas background or the image object
                // Simpler: Export the current canvas state WITHOUT the mask as the input image
                // But we need the mask separate.

                // Strategy: 
                // 1. Hide the mask layer (drawing paths)
                // 2. Export canvas as 'image'
                // 3. Show ONLY mask layer
                // 4. Export canvas as 'mask'

                // Actually, simpler: The user draws on top. 
                // We can export the whole canvas as the "image" (with mask hidden? No, we need the original)
                // Let's assume the user wants to edit what they see *under* the mask.

                // Hacky but effective way for v1:
                // 1. Export the current canvas (with drawings) as the mask? No, that includes the image.

                // Better:
                // Iterate objects. If it's a Path (drawing), it's the mask.
                // Hide Paths -> Export -> Image
                // Hide Images/Shapes -> Show Paths (white) on Black bg -> Export -> Mask
            }

            // Quick implementation:
            // We need to separate the drawing (mask) from the background image.
            const canvas = fabricCanvas.current;
            const originalObjects = canvas.getObjects();

            // Filter mask objects (paths created in drawing mode)
            const maskObjects = originalObjects.filter(obj => obj.type === 'path');
            const contentObjects = originalObjects.filter(obj => obj.type !== 'path');

            // 1. Generate Image (Content only)
            maskObjects.forEach(obj => obj.visible = false);
            canvas.backgroundColor = '#000000'; // Ensure black bg for export
            const image = canvas.toDataURL({ format: 'png', multiplier: 1 });

            // 2. Generate Mask (Paths only, white on black)
            maskObjects.forEach(obj => {
                obj.visible = true;
                obj.set({ stroke: '#ffffff', fill: '#ffffff' }); // Make mask white
            });
            contentObjects.forEach(obj => obj.visible = false);
            canvas.backgroundColor = '#000000';
            const mask = canvas.toDataURL({ format: 'png', multiplier: 1 });

            // Restore state
            maskObjects.forEach(obj => {
                obj.set({ stroke: 'rgba(255, 0, 255, 0.5)', fill: '' }); // Restore visual look
                obj.visible = true;
            });
            contentObjects.forEach(obj => obj.visible = true);
            canvas.backgroundColor = '#1a1a1a';
            canvas.renderAll();

            // 3. Call API
            const editImage = httpsCallable(functions, 'editImage');
            const response = await editImage({
                image,
                mask,
                prompt: magicFillPrompt
            });

            const data = response.data as any;

            // 4. Update Canvas
            if (data.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
                const newImageBase64 = `data:${data.candidates[0].content.parts[0].inlineData.mimeType};base64,${data.candidates[0].content.parts[0].inlineData.data}`;

                // Clear mask
                canvas.remove(...maskObjects);

                // Add new image on top? Or replace background?
                // Let's add it on top for now
                fabric.Image.fromURL(newImageBase64).then(img => {
                    img.scaleToWidth(canvas.width!);
                    img.set({ left: canvas.width! / 2, top: canvas.height! / 2, originX: 'center', originY: 'center' });
                    canvas.add(img);
                    canvas.renderAll();
                });

                toast.success("Magic Fill applied!");
                setIsMagicFillMode(false);
                canvas.isDrawingMode = false;
            }

        } catch (error) {
            console.error("Magic Fill Error:", error);
            toast.error("Failed to apply Magic Fill");
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
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#1a1a1a]">
                        <div className="flex-1 mr-4 flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white mb-1">
                                {isEditing ? "Fabric.js Editor" : "Preview"}
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Brush size={14} /> Edit in Canvas
                                </button>
                            ) : (
                                <>
                                    {isMagicFillMode && (
                                        <div className="flex items-center gap-2 mr-4 bg-gray-800 p-1 rounded-lg">
                                            <input
                                                type="text"
                                                value={magicFillPrompt}
                                                onChange={(e) => setMagicFillPrompt(e.target.value)}
                                                placeholder="Describe changes..."
                                                className="bg-transparent border-none text-white text-sm px-2 focus:ring-0 outline-none w-48"
                                            />
                                            <button
                                                onClick={handleMagicFill}
                                                disabled={isProcessing}
                                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded flex items-center gap-1"
                                            >
                                                {isProcessing ? <Wand2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                                Generate
                                            </button>
                                        </div>
                                    )}
                                    <button
                                        onClick={saveCanvas}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Save size={14} /> Save / Export
                                    </button>
                                </>
                            )}
                            {!isEditing && item.type === 'image' && (
                                <button
                                    onClick={() => handleAnimate()}
                                    className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Play size={14} /> Animate
                                </button>
                            )}
                            <button onClick={onClose} className="p-2 hover:bg-red-900/50 rounded-lg text-gray-400 hover:text-red-400 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#0f0f0f] relative">
                        {isEditing ? (
                            <div className="flex h-full w-full">
                                {/* Toolbar */}
                                <div className="w-16 bg-[#1a1a1a] border-r border-gray-800 flex flex-col items-center py-4 gap-4">
                                    <button onClick={addRectangle} className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Add Rectangle">
                                        <Square size={20} />
                                    </button>
                                    <button onClick={addCircle} className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Add Circle">
                                        <CircleIcon size={20} />
                                    </button>
                                    <button onClick={addText} className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Add Text">
                                        <Type size={20} />
                                    </button>
                                    <div className="w-8 h-px bg-gray-800 my-2" />
                                    <button
                                        onClick={toggleMagicFill}
                                        className={`p-2 rounded transition-colors ${isMagicFillMode ? 'bg-purple-600 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}
                                        title="Magic Fill"
                                    >
                                        <Wand2 size={20} />
                                    </button>
                                </div>
                                {/* Canvas Area */}
                                <div className="flex-1 flex items-center justify-center bg-gray-900 overflow-auto p-8">
                                    <canvas ref={canvasEl} />
                                </div>
                            </div>
                        ) : (
                            item.type === 'video' ? (
                                <video src={item.url} controls className="max-w-full max-h-full object-contain shadow-2xl" />
                            ) : (
                                <img src={item.url} alt={item.prompt} className="max-w-full max-h-full object-contain shadow-2xl" />
                            )
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
