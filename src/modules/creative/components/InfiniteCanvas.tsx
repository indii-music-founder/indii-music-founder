import React, { useRef, useEffect, useState } from 'react';
import { useStore, CanvasImage } from '@/core/store';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { Editing } from '@/services/image/EditingService';
import { Loader2, Move, MousePointer2, Eraser, ImagePlus } from 'lucide-react';

export default function InfiniteCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { canvasImages, addCanvasImage, updateCanvasImage, removeCanvasImage, selectedCanvasImageId, selectCanvasImage, currentProjectId } = useStore();

    // Camera State
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [tool, setTool] = useState<'pan' | 'select' | 'generate'>('pan');
    const [isGenerating, setIsGenerating] = useState(false);

    // Interaction State
    const isDragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const dragImageId = useRef<string | null>(null);
    const selectionStart = useRef<{ x: number, y: number } | null>(null);
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

    // Initialize / Resize
    useEffect(() => {
        const resize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
                draw();
            }
        };
        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
    }, []);

    // Draw Loop
    useEffect(() => {
        draw();
    }, [canvasImages, scale, offset, selectedCanvasImageId, tool]);

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.fillStyle = '#151515';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // Grid
        drawGrid(ctx, canvas.width, canvas.height);

        // Images
        canvasImages.forEach(img => {
            let image = imageCache.current.get(img.id);
            if (!image) {
                image = new window.Image();
                image.src = img.base64;
                image.onload = () => draw();
                imageCache.current.set(img.id, image);
            }

            if (image.complete && image.naturalWidth > 0) {
                ctx.drawImage(image, img.x, img.y, img.width, img.height);

                if (img.id === selectedCanvasImageId) {
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 4 / scale;
                    ctx.strokeRect(img.x, img.y, img.width, img.height);
                }
            }
        });

        ctx.restore();

        // Selection Box (Screen Space)
        if (selectionStart.current && tool === 'generate') {
            const mx = lastPos.current.x; // Current mouse pos stored in lastPos during drag
            const my = lastPos.current.y;
            const sx = selectionStart.current.x;
            const sy = selectionStart.current.y;

            ctx.strokeStyle = '#9333ea';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(sx, sy, mx - sx, my - sy);
            ctx.setLineDash([]);
        }
    };

    const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        const gridSize = 100;
        const startX = (-offset.x / scale) - 100;
        const startY = (-offset.y / scale) - 100;
        const endX = ((w - offset.x) / scale) + 100;
        const endY = ((h - offset.y) / scale) + 100;

        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1 / scale;
        ctx.beginPath();

        for (let x = Math.floor(startX / gridSize) * gridSize; x <= endX; x += gridSize) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = Math.floor(startY / gridSize) * gridSize; y <= endY; y += gridSize) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
    };

    // Event Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;

        lastPos.current = { x: cx, y: cy };
        isDragging.current = true;

        if (tool === 'generate') {
            selectionStart.current = { x: cx, y: cy };
            return;
        }

        // Hit Test
        const wx = (cx - offset.x) / scale;
        const wy = (cy - offset.y) / scale;

        // Check top-most image first
        for (let i = canvasImages.length - 1; i >= 0; i--) {
            const img = canvasImages[i];
            if (wx >= img.x && wx <= img.x + img.width && wy >= img.y && wy <= img.y + img.height) {
                if (tool === 'select') {
                    selectCanvasImage(img.id);
                    dragImageId.current = img.id;
                    return;
                }
            }
        }

        // If no hit or pan tool
        selectCanvasImage(null);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current) return;

        const rect = canvasRef.current!.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const dx = cx - lastPos.current.x;
        const dy = cy - lastPos.current.y;

        lastPos.current = { x: cx, y: cy };

        if (tool === 'generate') {
            draw(); // Redraw selection box
            return;
        }

        if (dragImageId.current && tool === 'select') {
            updateCanvasImage(dragImageId.current, {
                x: canvasImages.find(i => i.id === dragImageId.current)!.x + (dx / scale),
                y: canvasImages.find(i => i.id === dragImageId.current)!.y + (dy / scale)
            });
        } else {
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        }
    };

    const handleMouseUp = async () => {
        isDragging.current = false;
        dragImageId.current = null;

        if (tool === 'generate' && selectionStart.current) {
            const sx = selectionStart.current.x;
            const sy = selectionStart.current.y;
            const ex = lastPos.current.x;
            const ey = lastPos.current.y;

            const w = Math.abs(ex - sx);
            const h = Math.abs(ey - sy);

            if (w > 20 && h > 20) {
                const prompt = window.prompt("Generate/Outpaint Prompt:");
                if (prompt) {
                    await handleGeneration(Math.min(sx, ex), Math.min(sy, ey), w, h, prompt);
                }
            }
            selectionStart.current = null;
            draw();
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const z = Math.exp(e.deltaY * -0.001);
        const newScale = Math.min(Math.max(scale * z, 0.1), 5);

        const rect = canvasRef.current!.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        setOffset({
            x: mx - (mx - offset.x) * (newScale / scale),
            y: my - (my - offset.y) * (newScale / scale)
        });
        setScale(newScale);
    };

    const handleGeneration = async (sx: number, sy: number, w: number, h: number, prompt: string) => {
        setIsGenerating(true);
        try {
            // World Coords for new image
            const wx = (sx - offset.x) / scale;
            const wy = (sy - offset.y) / scale;
            const ww = w / scale;
            const wh = h / scale;

            // Capture Context
            const canvas = canvasRef.current;
            if (!canvas) throw new Error("No canvas");

            // Create a temp canvas to crop the selection
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const tCtx = tempCanvas.getContext('2d');
            if (!tCtx) throw new Error("No temp context");

            // Draw the visible canvas onto temp canvas
            // We need to map screen coords (sx, sy) to the temp canvas (0, 0)
            tCtx.drawImage(canvas, sx, sy, w, h, 0, 0, w, h);

            const contextDataUrl = tempCanvas.toDataURL('image/png');
            const base64Data = contextDataUrl.split(',')[1];

            // Use ImageService for generation (Edit Mode / Magic Fill)
            // We use editImage to include the context
            const result = await Editing.editImage({
                image: { mimeType: 'image/png', data: base64Data },
                prompt: prompt
            });

            if (result) {
                addCanvasImage({
                    id: result.id,
                    base64: result.url,
                    x: wx, y: wy, width: ww, height: wh,
                    aspect: ww / wh,
                    projectId: currentProjectId
                });
            } else {
                // Fallback to pure generation if edit returns null (unlikely)
                const results = await ImageGeneration.generateImages({
                    prompt: prompt,
                    count: 1,
                    aspectRatio: "1:1"
                });
                if (results.length > 0) {
                    const res = results[0];
                    addCanvasImage({
                        id: res.id,
                        base64: res.url,
                        x: wx, y: wy, width: ww, height: wh,
                        aspect: ww / wh,
                        projectId: currentProjectId
                    });
                }
            }
        } catch (e: unknown) {
            console.error(e);
            if (e instanceof Error) {
                alert(`Generation failed: ${e.message}`);
            } else {
                alert("Generation failed: An unknown error occurred.");
            }
        } finally {
            setIsGenerating(false);
            setTool('select');
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        const state = useStore.getState();
        const historyItem = state.generatedHistory.find(h => h.id === id) || state.uploadedImages.find(u => u.id === id);

        if (historyItem && (historyItem.type === 'image' || historyItem.type === 'video')) { // Allow videos as static frames for now
            const rect = canvasRef.current!.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const wx = (mx - offset.x) / scale;
            const wy = (my - offset.y) / scale;

            const img = new window.Image(); // Explicit window.Image to avoid conflict if imported
            img.onload = () => {
                const aspect = img.width / img.height;
                addCanvasImage({
                    id: crypto.randomUUID(),
                    base64: historyItem.url,
                    x: wx - 150, y: wy - (150 / aspect),
                    width: 300, height: 300 / aspect,
                    aspect,
                    projectId: currentProjectId
                });
            };
            img.src = historyItem.url;
        }
    };

    return (
        <div className="relative w-full h-full overflow-hidden bg-[#151515]">
            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="block cursor-crosshair touch-none"
            />

            {/* HUD */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-gray-700 rounded-full px-4 py-2 flex items-center gap-2 shadow-xl">
                <button
                    onClick={() => setTool('pan')}
                    className={`p-2 rounded-full transition-colors ${tool === 'pan' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    title="Pan Tool"
                >
                    <Move size={18} />
                </button>
                <button
                    onClick={() => setTool('select')}
                    className={`p-2 rounded-full transition-colors ${tool === 'select' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    title="Select/Move Tool"
                >
                    <MousePointer2 size={18} />
                </button>
                <button
                    onClick={() => setTool('generate')}
                    className={`p-2 rounded-full transition-colors ${tool === 'generate' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    title="Generate/Outpaint Tool"
                >
                    <ImagePlus size={18} />
                </button>
                <div className="w-px h-6 bg-gray-700 mx-1"></div>
                <button
                    onClick={() => selectedCanvasImageId && removeCanvasImage(selectedCanvasImageId)}
                    disabled={!selectedCanvasImageId}
                    className="p-2 rounded-full text-red-400 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete Selected"
                >
                    <Eraser size={18} />
                </button>
            </div>

            {isGenerating && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 size={48} className="animate-spin text-purple-500" />
                        <p className="text-white font-bold animate-pulse">Dreaming...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
