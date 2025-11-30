import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/core/store';
import { X, Download, Share2, Wand2, Brush, Eraser, Save, RotateCcw, Trash2, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/core/context/ToastContext';

interface CreativeCanvasProps {
    item: { id: string; url: string; prompt: string; type: 'image' | 'video'; mask?: string } | null;
    onClose: () => void;
}

export default function CreativeCanvas({ item, onClose }: CreativeCanvasProps) {
    const { updateHistoryItem, setActiveReferenceImage, uploadedImages, addUploadedImage, currentProjectId } = useStore();
    const toast = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
    const [brushSize, setBrushSize] = useState(20);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [prompt, setPrompt] = useState('');

    useEffect(() => {
        if (item) {
            setPrompt(item.prompt);
        }
    }, [item]);

    if (!item) return null;

    // Initialize Canvas when entering edit mode
    useEffect(() => {
        if (isEditing && canvasRef.current && imageRef.current) {
            const canvas = canvasRef.current;
            const img = imageRef.current;
            canvas.width = img.clientWidth;
            canvas.height = img.clientHeight;

            const ctx = canvas.getContext('2d');
            if (ctx && item.mask) {
                const maskImg = new Image();
                maskImg.src = item.mask;
                maskImg.onload = () => ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
            }
        }
    }, [isEditing, item.mask]);

    const startDrawing = (e: React.MouseEvent) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.beginPath();
    };

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.globalCompositeOperation = tool === 'brush' ? 'source-over' : 'destination-out';
        ctx.strokeStyle = tool === 'brush' ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0,0,0,1)';

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const clearMask = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    const invertMask = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha > 0) {
                data[i + 3] = 0;
            } else {
                data[i] = 255; // R
                data[i + 1] = 0;   // G
                data[i + 2] = 0;   // B
                data[i + 3] = 128; // A (0.5)
            }
        }
        ctx.putImageData(imageData, 0, 0);
    };

    const saveMask = () => {
        if (canvasRef.current) {
            const maskData = canvasRef.current.toDataURL();
            updateHistoryItem(item.id, { mask: maskData });
            toast.success("Mask saved!");
            setIsEditing(false);
        }
    };

    const handlePromptChange = (newPrompt: string) => {
        setPrompt(newPrompt);
        updateHistoryItem(item.id, { prompt: newPrompt });
    };

    const [showPromptInput, setShowPromptInput] = useState(false);
    const [magicPrompt, setMagicPrompt] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleUseAsReference = () => {
        // 1. Add to Assets if not present
        const exists = uploadedImages.some(img => img.id === item.id);
        if (!exists) {
            addUploadedImage({
                ...item,
                id: crypto.randomUUID(), // New ID for the asset
                timestamp: Date.now(),
                projectId: currentProjectId
            });
        }

        // 2. Set as Active Reference
        setActiveReferenceImage({
            ...item,
            timestamp: Date.now(),
            projectId: currentProjectId
        });
        toast.success("Added to Assets & set as Reference");
        onClose();
    };

    const handleHeaderGenerate = async () => {
        if (!prompt.trim()) {
            toast.error("Please enter a prompt.");
            return;
        }
        setIsProcessing(true);

        try {
            // Prepare Image Data
            const match = item.url.match(/^data:(.+);base64,(.+)$/);
            if (!match) {
                toast.error("Invalid image data.");
                setIsProcessing(false);
                return;
            }
            const imageData = { mimeType: match[1], data: match[2] };

            // Prepare Mask Data
            let maskData = undefined;
            let currentMaskUrl = item.mask;

            // If currently editing, grab mask from canvas directly
            if (isEditing && canvasRef.current) {
                currentMaskUrl = canvasRef.current.toDataURL();
                // Optional: Save it to history too
                updateHistoryItem(item.id, { mask: currentMaskUrl });
            }

            if (currentMaskUrl) {
                const maskMatch = currentMaskUrl.match(/^data:(.+);base64,(.+)$/);
                if (maskMatch) {
                    maskData = { mimeType: maskMatch[1], data: maskMatch[2] };
                }
            }

            let result;
            if (maskData) {
                // Inpainting
                result = await import('@/services/image/ImageService').then(m => m.Image.editImage({
                    image: imageData,
                    mask: maskData,
                    prompt: prompt
                }));
            } else {
                // Remix / Img2Img (No mask)
                result = await import('@/services/image/ImageService').then(m => m.Image.generateImage({
                    prompt: prompt,
                    referenceImage: imageData
                }));
            }

            if (result) {
                useStore.getState().addToHistory({
                    id: result.id,
                    url: result.url,
                    prompt: result.prompt,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });
                toast.success("Generation complete!");
                onClose();
            } else {
                toast.error("Generation failed.");
            }

        } catch (e) {
            console.error(e);
            toast.error("Generation failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleMagicFill = async () => {
        if (!magicPrompt.trim()) return;
        setIsProcessing(true);
        try {
            // Convert item to { mimeType, data }
            const match = item.url.match(/^data:(.+);base64,(.+)$/);
            if (!match) {
                toast.error("Invalid image data for editing.");
                setIsProcessing(false);
                return;
            }

            let maskData = undefined;
            if (item.mask) {
                const maskMatch = item.mask.match(/^data:(.+);base64,(.+)$/);
                if (maskMatch) {
                    maskData = { mimeType: maskMatch[1], data: maskMatch[2] };
                }
            }

            const result = await import('@/services/image/ImageService').then(m => m.Image.editImage({
                image: { mimeType: match[1], data: match[2] },
                mask: maskData,
                prompt: magicPrompt
            }));

            if (result) {
                // Add to history
                useStore.getState().addToHistory({
                    id: result.id,
                    url: result.url,
                    prompt: result.prompt,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });
                toast.success("Magic Fill complete!");
                onClose(); // Close canvas to show result in gallery
            } else {
                toast.error("Magic Fill failed to generate a result.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Magic Fill failed.");
        } finally {
            setIsProcessing(false);
            setShowPromptInput(false);
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
                    className="relative max-w-5xl w-full max-h-[90vh] bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden flex flex-col shadow-2xl"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#1a1a1a]">
                        <div className="flex-1 mr-4 flex items-center gap-2">
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-white mb-1">
                                    {isEditing ? "Annotation Mode" : "Canvas Preview"}
                                </h3>
                                <input
                                    type="text"
                                    value={prompt}
                                    onChange={(e) => handlePromptChange(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleHeaderGenerate()}
                                    className="w-full bg-transparent text-xs text-gray-400 focus:text-white focus:outline-none border-b border-transparent focus:border-gray-700 transition-colors"
                                    placeholder="Enter prompt..."
                                />
                            </div>
                            <button
                                onClick={handleHeaderGenerate}
                                disabled={isProcessing}
                                className={`p-2 rounded-full transition-colors ${isProcessing ? 'bg-gray-700 text-gray-500' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
                                title="Generate from Prompt"
                            >
                                <Play size={16} fill="currentColor" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {!isEditing ? (
                                <>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                                        title="Annotate / Edit"
                                    >
                                        <Brush size={18} />
                                    </button>
                                    <button className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                                        <Download size={18} />
                                    </button>
                                    <button className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                                        <Share2 size={18} />
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={saveMask}
                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold flex items-center gap-2"
                                >
                                    <Save size={14} /> Save Mask
                                </button>
                            )}
                            <div className="w-px h-6 bg-gray-800 mx-2"></div>
                            <button onClick={onClose} className="p-2 hover:bg-red-900/50 rounded-lg text-gray-400 hover:text-red-400 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] bg-[#0f0f0f] relative">
                        {item.type === 'video' ? (
                            <video src={item.url} controls className="max-w-full max-h-full object-contain shadow-2xl" />
                        ) : (
                            <div className="relative max-w-full max-h-full">
                                <img
                                    ref={imageRef}
                                    src={item.url}
                                    alt={item.prompt}
                                    className="max-w-full max-h-full object-contain shadow-2xl block"
                                />
                                {isEditing && (
                                    <canvas
                                        ref={canvasRef}
                                        className="absolute inset-0 cursor-crosshair touch-none"
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer / Controls */}
                    <div className="p-4 border-t border-gray-800 bg-[#1a1a1a]">
                        {isEditing ? (
                            <div className="flex items-center justify-center gap-4">
                                <div className="flex bg-gray-800 rounded-lg p-1">
                                    <button
                                        onClick={() => setTool('brush')}
                                        className={`p-2 rounded ${tool === 'brush' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <Brush size={16} />
                                    </button>
                                    <button
                                        onClick={() => setTool('eraser')}
                                        className={`p-2 rounded ${tool === 'eraser' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <Eraser size={16} />
                                    </button>
                                </div>

                                <input
                                    type="range"
                                    min="5"
                                    max="100"
                                    value={brushSize}
                                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                    className="w-32 accent-purple-500"
                                />

                                <div className="flex gap-2">
                                    <button onClick={invertMask} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300" title="Invert">
                                        <RotateCcw size={16} />
                                    </button>
                                    <button onClick={clearMask} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300" title="Clear">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : showPromptInput ? (
                            <div className="flex gap-2 justify-center w-full max-w-lg mx-auto">
                                <input
                                    type="text"
                                    value={magicPrompt}
                                    onChange={e => setMagicPrompt(e.target.value)}
                                    placeholder="Describe your edit (e.g. 'Remove the tree')..."
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                                    onKeyDown={e => e.key === 'Enter' && handleMagicFill()}
                                    autoFocus
                                />
                                <button
                                    onClick={handleMagicFill}
                                    disabled={isProcessing}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isProcessing ? 'Processing...' : 'Generate'}
                                </button>
                                <button
                                    onClick={() => setShowPromptInput(false)}
                                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={() => setShowPromptInput(true)}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Wand2 size={14} /> Magic Fill (Inpaint)
                                </button>
                                <button
                                    onClick={handleUseAsReference}
                                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-lg transition-colors"
                                >
                                    Use as Reference
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
