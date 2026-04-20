import React, { useRef, useEffect, useState } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { Editing } from '@/services/image/EditingService';
import { Loader2, Sparkles, Send, Crop } from 'lucide-react';
import { InfiniteCanvasHUD } from './InfiniteCanvasHUD';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';
import { fetchAsBase64 } from '@/services/storage/safeStorageFetch';

export default function InfiniteCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const {
        canvasImages,
        addCanvasImage,
        updateCanvasImage,
        removeCanvasImage,
        selectedCanvasImageId,
        selectCanvasImage,
        currentProjectId,
        addToHistory
    } = useStore(useShallow(state => ({
        canvasImages: state.canvasImages,
        addCanvasImage: state.addCanvasImage,
        updateCanvasImage: state.updateCanvasImage,
        removeCanvasImage: state.removeCanvasImage,
        selectedCanvasImageId: state.selectedCanvasImageId,
        selectCanvasImage: state.selectCanvasImage,
        currentProjectId: state.currentProjectId,
        addToHistory: state.addToHistory
    })));
    const toast = useToast();

    // Camera State (Refs for performance)
    const scaleRef = useRef(1);
    const offsetRef = useRef({ x: 0, y: 0 });

    const [tool, setTool] = useState<'pan' | 'select' | 'generate' | 'crop'>('pan');
    const [isGenerating, setIsGenerating] = useState(false);
    const [promptOverlay, setPromptOverlay] = useState<{ sx: number, sy: number, w: number, h: number } | null>(null);
    const [cropOverlay, setCropOverlay] = useState<{ sx: number, sy: number, w: number, h: number } | null>(null);
    const [promptText, setPromptText] = useState("");

    // Interaction State
    const isDragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const dragImageId = useRef<string | null>(null);
    const isResizing = useRef<string | null>(null); // 'tl', 'tr', 'bl', 'br'
    const dragAccumulator = useRef({ x: 0, y: 0 });
    const resizeAccumulator = useRef({ x: 0, y: 0, w: 0, h: 0 });
    const selectionStart = useRef<{ x: number, y: number } | null>(null);
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
    const rafId = useRef<number | null>(null);

    // Initialize / Resize
    useEffect(() => {
        const resize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
                requestDraw();
            }
        };
        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Draw Loop - only for Store/Tool changes
    useEffect(() => {
        requestDraw();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canvasImages, selectedCanvasImageId, tool]);

    const requestDraw = () => {
        if (rafId.current) cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(draw);
    };

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scale = scaleRef.current;
        const offset = offsetRef.current;

        // Clear
        ctx.fillStyle = '#151515';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate visible viewport in world coordinates
        const viewportLeft = -offset.x / scale;
        const viewportTop = -offset.y / scale;
        const viewportRight = (canvas.width - offset.x) / scale;
        const viewportBottom = (canvas.height - offset.y) / scale;

        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // Grid
        drawGrid(ctx, canvas.width, canvas.height, scale, offset);

        // Images
        canvasImages.forEach(img => {
            let image = imageCache.current.get(img.id);
            if (!image) {
                image = new window.Image();
                imageCache.current.set(img.id, image);
                
                const src = img.base64;
                if (src.startsWith('http')) {
                    // Fetch as base64 to avoid CORS tainting issues
                    fetchAsBase64(src).then(({ base64, mimeType }) => {
                        image!.removeAttribute('crossOrigin');
                        image!.src = `data:${mimeType};base64,${base64}`;
                    }).catch(err => {
                        console.error("Failed to load canvas image via safe fetch:", src, err);
                        // Fallback
                        image!.crossOrigin = 'anonymous';
                        image!.src = src + (src.includes('?') ? '&' : '?') + 'cb=' + Date.now();
                    });
                } else {
                    image.removeAttribute('crossOrigin');
                    image.src = src;
                }

                image.onload = () => requestDraw();
                image.onerror = () => {
                    console.error("Failed to load canvas image:", src);
                };
            }

            if (image.complete && image.naturalWidth > 0) {
                // Ensure width/height are numbers
                const w = img.width ?? 0;
                const h = img.height ?? 0;

                let drawX = img.x;
                let drawY = img.y;
                let drawW = w;
                let drawH = h;

                if (img.id === dragImageId.current) {
                    if (isResizing.current) {
                        drawX += resizeAccumulator.current.x;
                        drawY += resizeAccumulator.current.y;
                        drawW += resizeAccumulator.current.w;
                        drawH += resizeAccumulator.current.h;
                    } else {
                        drawX += dragAccumulator.current.x;
                        drawY += dragAccumulator.current.y;
                    }
                } else if (img.parentId === dragImageId.current && !isResizing.current) {
                    drawX += dragAccumulator.current.x;
                    drawY += dragAccumulator.current.y;
                }

                if (drawX + drawW < viewportLeft || drawX > viewportRight ||
                    drawY + drawH < viewportTop || drawY > viewportBottom) {
                    return;
                }

                ctx.drawImage(image, drawX, drawY, drawW, drawH);

                if (img.id === selectedCanvasImageId) {
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 4 / scale;
                    ctx.strokeRect(drawX, drawY, drawW, drawH);
                    
                    // Draw resize handles
                    ctx.fillStyle = '#ffffff';
                    const hs = 10 / scale; // handle size
                    ctx.fillRect(drawX - hs/2, drawY - hs/2, hs, hs); // tl
                    ctx.fillRect(drawX + drawW - hs/2, drawY - hs/2, hs, hs); // tr
                    ctx.fillRect(drawX - hs/2, drawY + drawH - hs/2, hs, hs); // bl
                    ctx.fillRect(drawX + drawW - hs/2, drawY + drawH - hs/2, hs, hs); // br
                    
                    ctx.lineWidth = 1.5 / scale;
                    ctx.strokeRect(drawX - hs/2, drawY - hs/2, hs, hs);
                    ctx.strokeRect(drawX + drawW - hs/2, drawY - hs/2, hs, hs);
                    ctx.strokeRect(drawX - hs/2, drawY + drawH - hs/2, hs, hs);
                    ctx.strokeRect(drawX + drawW - hs/2, drawY + drawH - hs/2, hs, hs);
                }
            }
        });

        ctx.restore();

        // Selection Box (Screen Space)
        if (selectionStart.current && (tool === 'generate' || tool === 'crop')) {
            const mx = lastPos.current.x; // Current mouse pos stored in lastPos during drag
            const my = lastPos.current.y;
            const sx = selectionStart.current.x;
            const sy = selectionStart.current.y;

            ctx.strokeStyle = tool === 'crop' ? '#3b82f6' : '#9333ea';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(sx, sy, mx - sx, my - sy);
            ctx.setLineDash([]);
        }
    };

    const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number, scale: number, offset: { x: number, y: number }) => {
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
        const scale = scaleRef.current;
        const offset = offsetRef.current;

        lastPos.current = { x: cx, y: cy };
        isDragging.current = true;
        dragAccumulator.current = { x: 0, y: 0 }; // Reset accumulator

        if (tool === 'generate' || tool === 'crop') {
            selectionStart.current = { x: cx, y: cy };
            return;
        }

        // Hit Test
        const wx = (cx - offset.x) / scale;
        const wy = (cy - offset.y) / scale;

        // Check resize handles of selected image first
        if (selectedCanvasImageId && tool === 'select') {
            const img = canvasImages.find(i => i.id === selectedCanvasImageId);
            if (img) {
                const w = img.width ?? 0;
                const h = img.height ?? 0;
                const hsHit = 15 / scale; // slightly larger hit area
                
                const corners = [
                    { id: 'tl', x: img.x, y: img.y },
                    { id: 'tr', x: img.x + w, y: img.y },
                    { id: 'bl', x: img.x, y: img.y + h },
                    { id: 'br', x: img.x + w, y: img.y + h }
                ];
                
                for (const corner of corners) {
                    if (wx >= corner.x - hsHit && wx <= corner.x + hsHit &&
                        wy >= corner.y - hsHit && wy <= corner.y + hsHit) {
                        isResizing.current = corner.id;
                        dragImageId.current = img.id;
                        resizeAccumulator.current = { x: 0, y: 0, w: 0, h: 0 };
                        return;
                    }
                }
            }
        }

        // Check top-most image first
        for (let i = canvasImages.length - 1; i >= 0; i--) {
            const img = canvasImages[i]!;
            // Ensure width/height are numbers (fallback to 0)
            const w = img.width ?? 0;
            const h = img.height ?? 0;
            if (wx >= img.x && wx <= img.x + w && wy >= img.y && wy <= img.y + h) {
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
        const scale = scaleRef.current;

        lastPos.current = { x: cx, y: cy };

        if (tool === 'generate' || tool === 'crop') {
            requestDraw(); // Redraw selection box
            return;
        }

        if (dragImageId.current && isResizing.current && tool === 'select') {
            const img = canvasImages.find(i => i.id === dragImageId.current);
            if (!img) return;
            
            const dw = dx / scale;
            const aspect = img.aspect || (img.width! / img.height!);
            
            let deltaW = 0;
            if (isResizing.current === 'br' || isResizing.current === 'tr') {
                deltaW = dw;
            } else {
                deltaW = -dw;
            }
            
            const proposedW = img.width! + resizeAccumulator.current.w + deltaW;
            if (proposedW > 20) {
                const newW = proposedW;
                const newH = newW / aspect;
                
                resizeAccumulator.current.w = newW - img.width!;
                resizeAccumulator.current.h = newH - img.height!;
                
                if (isResizing.current === 'bl' || isResizing.current === 'tl') {
                    resizeAccumulator.current.x = img.width! - newW;
                }
                if (isResizing.current === 'tl' || isResizing.current === 'tr') {
                    resizeAccumulator.current.y = img.height! - newH;
                }
            }
            requestDraw();
            return;
        }

        if (dragImageId.current && tool === 'select') {
            dragAccumulator.current.x += dx / scale;
            dragAccumulator.current.y += dy / scale;
            requestDraw();
        } else {
            // Pan logic: direct ref update + draw call (no react render)
            offsetRef.current = {
                x: offsetRef.current.x + dx,
                y: offsetRef.current.y + dy
            };
            requestDraw();
        }
    };

    const handleMouseUp = async () => {
        isDragging.current = false;

        if (dragImageId.current && tool === 'select') {
            const img = canvasImages.find(i => i.id === dragImageId.current);
            if (img) {
                if (isResizing.current) {
                    if (resizeAccumulator.current.w !== 0 || resizeAccumulator.current.h !== 0) {
                        updateCanvasImage(dragImageId.current, {
                            x: img.x + resizeAccumulator.current.x,
                            y: img.y + resizeAccumulator.current.y,
                            width: img.width! + resizeAccumulator.current.w,
                            height: img.height! + resizeAccumulator.current.h
                        });
                    }
                } else if (dragAccumulator.current.x !== 0 || dragAccumulator.current.y !== 0) {
                    const dx = dragAccumulator.current.x;
                    const dy = dragAccumulator.current.y;
                    
                    updateCanvasImage(dragImageId.current, {
                        x: img.x + dx,
                        y: img.y + dy
                    });

                    // Move children along with the parent
                    canvasImages.forEach(cImg => {
                        if (cImg.parentId === img.id) {
                            updateCanvasImage(cImg.id, {
                                x: cImg.x + dx,
                                y: cImg.y + dy
                            });
                        }
                    });
                }
            }
        }

        isResizing.current = null;
        dragImageId.current = null;

        if ((tool === 'generate' || tool === 'crop') && selectionStart.current) {
            const sx = selectionStart.current.x;
            const sy = selectionStart.current.y;
            const ex = lastPos.current.x;
            const ey = lastPos.current.y;

            const w = Math.abs(ex - sx);
            const h = Math.abs(ey - sy);

            if (w > 20 && h > 20) {
                if (tool === 'generate') {
                    setPromptOverlay({ sx: Math.min(sx, ex), sy: Math.min(sy, ey), w, h });
                    setPromptText("");
                } else if (tool === 'crop') {
                    setCropOverlay({ sx: Math.min(sx, ex), sy: Math.min(sy, ey), w, h });
                }
            }
            selectionStart.current = null;
            requestDraw();
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const scale = scaleRef.current;
        const offset = offsetRef.current;

        const z = Math.exp(e.deltaY * -0.001);
        const newScale = Math.min(Math.max(scale * z, 0.1), 5);

        const rect = canvasRef.current!.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Update refs directly
        offsetRef.current = {
            x: mx - (mx - offset.x) * (newScale / scale),
            y: my - (my - offset.y) * (newScale / scale)
        };
        scaleRef.current = newScale;

        requestDraw();
    };

    /**
     * Draws the canvas content cleanly (no selection box, no selection borders, no tool overlays).
     * Used for capturing clean image data before sending to AI editing.
     */
    const drawClean = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scale = scaleRef.current;
        const offset = offsetRef.current;

        // Clear
        ctx.fillStyle = '#151515';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // Grid (background only)
        drawGrid(ctx, canvas.width, canvas.height, scale, offset);

        // Images — NO selection borders, NO tool overlays
        canvasImages.forEach(img => {
            const image = imageCache.current.get(img.id);
            if (image && image.complete && image.naturalWidth > 0) {
                const w = img.width ?? 0;
                const h = img.height ?? 0;
                ctx.drawImage(image, img.x, img.y, w, h);
            }
        });

        ctx.restore();
        // NO selection box drawn — this is a clean capture pass
    };

    const handleGeneration = async (sx: number, sy: number, w: number, h: number, prompt: string) => {
        setIsGenerating(true);
        const scale = scaleRef.current;
        const offset = offsetRef.current;

        try {
            // World Coords for new image
            const wx = (sx - offset.x) / scale;
            const wy = (sy - offset.y) / scale;
            const ww = w / scale;
            const wh = h / scale;

            // Capture Context — CRITICAL: draw a clean pass without overlays first
            const canvas = canvasRef.current;
            if (!canvas) throw new Error("No canvas");

            drawClean();

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const tCtx = tempCanvas.getContext('2d');
            if (!tCtx) throw new Error("No temp context");

            tCtx.drawImage(canvas, sx, sy, w, h, 0, 0, w, h);

            const contextDataUrl = tempCanvas.toDataURL('image/png');
            const base64Data = contextDataUrl.split(',')[1] ?? '';

            requestDraw();

            // Use ImageService for generation (Edit Mode / Magic Fill)
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
                    projectId: currentProjectId,
                    prompt: prompt,
                    parentId: selectedCanvasImageId || undefined,
                    originalX: wx, originalY: wy,
                    originalWidth: ww, originalHeight: wh,
                    parentOffsetX: selectedCanvasImageId ? (wx - (canvasImages.find(i => i.id === selectedCanvasImageId)?.x || 0)) : undefined,
                    parentOffsetY: selectedCanvasImageId ? (wy - (canvasImages.find(i => i.id === selectedCanvasImageId)?.y || 0)) : undefined,
                });

                addToHistory({
                    id: result.id,
                    url: result.url,
                    type: 'image',
                    prompt: prompt,
                    timestamp: Date.now(),
                    projectId: currentProjectId,
                    origin: 'generated'
                });
            } else {
                // Fallback to pure generation if edit returns null (unlikely)
                const results = await ImageGeneration.generateImages({
                    prompt: prompt,
                    count: 1,
                    aspectRatio: "1:1"
                });
                if (results.length > 0) {
                    const res = results[0]!;
                    addCanvasImage({
                        id: res.id,
                        base64: res.url,
                        x: wx, y: wy, width: ww, height: wh,
                        aspect: ww / wh,
                        projectId: currentProjectId,
                        prompt: prompt,
                        parentId: selectedCanvasImageId || undefined,
                        originalX: wx, originalY: wy,
                        originalWidth: ww, originalHeight: wh,
                        parentOffsetX: selectedCanvasImageId ? (wx - (canvasImages.find(i => i.id === selectedCanvasImageId)?.x || 0)) : undefined,
                        parentOffsetY: selectedCanvasImageId ? (wy - (canvasImages.find(i => i.id === selectedCanvasImageId)?.y || 0)) : undefined,
                    });

                    addToHistory({
                        id: res.id,
                        url: res.url,
                        type: 'image',
                        prompt: prompt,
                        timestamp: Date.now(),
                        projectId: currentProjectId,
                        origin: 'generated'
                    });
                }
            }
        } catch (e: unknown) {
            logger.error(e instanceof Error ? e.message : String(e));
            const isQuota = e instanceof Error && (e.name === 'QuotaExceededError' || ('code' in e && (e as { code?: string }).code === 'QUOTA_EXCEEDED'));
            if (isQuota && e instanceof Error) {
                toast.error(e.message || 'Quota exceeded during generation.');
            } else if (e instanceof Error) {
                toast.error(`Generation failed: ${e.message}`);
            } else {
                toast.error('Generation failed: An unknown error occurred.');
            }
        } finally {
            setIsGenerating(false);
            setTool('select');
        }
    };

    const handleGenerateVariations = async () => {
        if (!selectedCanvasImageId) return;
        const selectedImg = canvasImages.find(img => img.id === selectedCanvasImageId);
        if (!selectedImg) return;

        setIsGenerating(true);
        try {
            let base64Data = selectedImg.base64;
            let mimeType = 'image/png';

            if (base64Data.startsWith('http')) {
                const fetched = await fetchAsBase64(base64Data);
                base64Data = fetched.base64;
                mimeType = fetched.mimeType;
            } else if (base64Data.startsWith('data:')) {
                const parts = base64Data.split(',');
                mimeType = parts[0]?.split(':')[1]?.split(';')[0] || 'image/png';
                base64Data = parts[1] || '';
            }

            const prompt = selectedImg.prompt || "A visually stunning variation of this image, keeping the exact same structure and composition but enhancing the details.";

            // Run 4 parallel requests to bypass "Multiple candidates is not enabled for this model" error
            const generatePromises = Array.from({ length: 4 }).map(() =>
                ImageGeneration.generateImages({
                    prompt: prompt,
                    count: 1,
                    sourceImages: [{ mimeType, data: base64Data }]
                })
            );

            const resultsArrays = await Promise.all(generatePromises);
            const results = resultsArrays.flat();

            if (results && results.length > 0) {
                const padding = 40;
                const ww = selectedImg.width ?? 512;
                const wh = selectedImg.height ?? 512;
                
                const positions = [
                    { x: selectedImg.x + ww + padding, y: selectedImg.y },
                    { x: selectedImg.x + ww + padding, y: selectedImg.y + wh + padding },
                    { x: selectedImg.x, y: selectedImg.y + wh + padding },
                    { x: selectedImg.x + ww + padding + ww + padding, y: selectedImg.y }
                ];

                results.forEach((res, index) => {
                    const pos = positions[index % 4]!;
                    addCanvasImage({
                        id: res.id,
                        base64: res.url,
                        x: pos.x, y: pos.y, width: ww, height: wh,
                        aspect: ww / wh,
                        projectId: currentProjectId,
                        prompt: prompt,
                        parentId: selectedCanvasImageId,
                        originalX: pos.x, originalY: pos.y,
                        originalWidth: ww, originalHeight: wh,
                        parentOffsetX: pos.x - selectedImg.x,
                        parentOffsetY: pos.y - selectedImg.y,
                    });

                    addToHistory({
                        id: res.id,
                        url: res.url,
                        type: 'image',
                        prompt: prompt,
                        timestamp: Date.now(),
                        projectId: currentProjectId,
                        origin: 'generated'
                    });
                });
                
                toast.success(`Generated ${results.length} variations!`);
            }
        } catch (e: unknown) {
            logger.error(e instanceof Error ? e.message : String(e));
            toast.error('Failed to generate variations.');
        } finally {
            setIsGenerating(false);
        }
    };


    const handleCrop = async (sx: number, sy: number, w: number, h: number, adaptiveFill: boolean) => {
        setCropOverlay(null);
        if (adaptiveFill) {
            await handleGeneration(sx, sy, w, h, "Naturally extend the image to fill any empty space, matching the existing style, lighting, and composition.");
        } else {
            const scale = scaleRef.current;
            const offset = offsetRef.current;
            const wx = (sx - offset.x) / scale;
            const wy = (sy - offset.y) / scale;
            const ww = w / scale;
            const wh = h / scale;

            const canvas = canvasRef.current;
            if (!canvas) return;
            drawClean();

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const tCtx = tempCanvas.getContext('2d');
            if (!tCtx) return;

            tCtx.drawImage(canvas, sx, sy, w, h, 0, 0, w, h);

            const dataUrl = tempCanvas.toDataURL('image/png');
            
            canvasImages.forEach(img => removeCanvasImage(img.id));

            const newId = crypto.randomUUID();
            addCanvasImage({
                id: newId,
                base64: dataUrl,
                x: wx,
                y: wy,
                width: ww,
                height: wh,
                aspect: ww / wh,
                projectId: currentProjectId,
                prompt: "Cropped Canvas"
            });
            
            addToHistory({
                id: newId,
                url: dataUrl,
                type: 'image',
                prompt: "Cropped Canvas",
                timestamp: Date.now(),
                projectId: currentProjectId,
                origin: 'generated'
            });

            selectCanvasImage(newId);
            setTool('select');
            toast.success("Canvas cropped successfully!");
            requestDraw();
        }
    };

    const handleFlatten = () => {
        if (canvasImages.length <= 1) {
            toast.success("Nothing to flatten");
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        canvasImages.forEach(img => {
            const w = img.width ?? 0;
            const h = img.height ?? 0;
            if (img.x < minX) minX = img.x;
            if (img.y < minY) minY = img.y;
            if (img.x + w > maxX) maxX = img.x + w;
            if (img.y + h > maxY) maxY = img.y + h;
        });

        if (minX === Infinity) return;

        const w = maxX - minX;
        const h = maxY - minY;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tCtx = tempCanvas.getContext('2d');
        if (!tCtx) return;

        // Ensure we draw in the right order (z-index is array order)
        canvasImages.forEach(img => {
            const image = imageCache.current.get(img.id);
            if (image && image.complete && image.naturalWidth > 0) {
                tCtx.drawImage(image, img.x - minX, img.y - minY, img.width ?? 0, img.height ?? 0);
            }
        });

        const dataUrl = tempCanvas.toDataURL('image/png');
        
        // Remove old images
        canvasImages.forEach(img => removeCanvasImage(img.id));
        
        // Add new flattened image
        const newId = crypto.randomUUID();
        addCanvasImage({
            id: newId,
            base64: dataUrl,
            x: minX,
            y: minY,
            width: w,
            height: h,
            aspect: w / h,
            projectId: currentProjectId,
            prompt: "Flattened Canvas"
        });
        
        selectCanvasImage(newId);
        toast.success("Layers flattened successfully!");
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const state = useStore.getState();

        // Handle file drop from OS
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (!file?.type.startsWith('image/')) {
                toast.error("Only image files are supported for dropping on the canvas");
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                if (!dataUrl) return;
                
                const rect = canvasRef.current!.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;

                const scale = scaleRef.current;
                const offset = offsetRef.current;

                const wx = (mx - offset.x) / scale;
                const wy = (my - offset.y) / scale;

                const img = new window.Image();
                img.removeAttribute('crossOrigin');
                img.onload = () => {
                    const aspect = img.width / img.height;
                    const newId = crypto.randomUUID();
                    
                    let parentId: string | undefined = undefined;
                    let parentOffsetX: number | undefined = undefined;
                    let parentOffsetY: number | undefined = undefined;
                    
                    for (let i = canvasImages.length - 1; i >= 0; i--) {
                        const cImg = canvasImages[i]!;
                        const w = cImg.width ?? 0;
                        const h = cImg.height ?? 0;
                        if (wx >= cImg.x && wx <= cImg.x + w && wy >= cImg.y && wy <= cImg.y + h) {
                            parentId = cImg.id;
                            parentOffsetX = (wx - 150) - cImg.x;
                            parentOffsetY = (wy - (150 / aspect)) - cImg.y;
                            break;
                        }
                    }
                    
                    addCanvasImage({
                        id: newId,
                        base64: dataUrl,
                        x: wx - 150, y: wy - (150 / aspect),
                        width: 300, height: 300 / aspect,
                        aspect,
                        projectId: currentProjectId,
                        parentId,
                        originalX: wx - 150,
                        originalY: wy - (150 / aspect),
                        originalWidth: 300,
                        originalHeight: 300 / aspect,
                        parentOffsetX,
                        parentOffsetY,
                        prompt: file.name
                    });
                };
                img.src = dataUrl;
            };
            reader.readAsDataURL(file);
            return;
        }

        const id = e.dataTransfer.getData('text/plain');
        
        // Find in history, uploads, or file nodes
        let historyItem = state.generatedHistory.find(h => h.id === id) || state.uploadedImages.find(u => u.id === id);
        
        if (!historyItem) {
            const fileNode = state.fileNodes.find(f => f.id === id);
            if (fileNode) {
                const mime = fileNode.data?.mimeType || '';
                historyItem = {
                    id: fileNode.id,
                    type: mime.startsWith('image') ? 'image' : mime.startsWith('video') ? 'video' : 'text',
                    url: fileNode.data?.url || '',
                    thumbnailUrl: fileNode.data?.url || '',
                    prompt: fileNode.name,
                    timestamp: fileNode.updatedAt || 0,
                    projectId: fileNode.projectId || '',
                    origin: 'uploaded'
                } as HistoryItem;
            }
        }

        if (historyItem && (historyItem.type === 'image' || historyItem.type === 'video')) { // Allow videos as static frames for now
            const rect = canvasRef.current!.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const scale = scaleRef.current;
            const offset = offsetRef.current;

            const wx = (mx - offset.x) / scale;
            const wy = (my - offset.y) / scale;

            try {
                let dataUrl = historyItem.url;
                
                // If it's a remote URL, fetch and convert to Data URL to prevent canvas tainting
                if (dataUrl.startsWith('http')) {
                    const { base64, mimeType } = await fetchAsBase64(dataUrl);
                    dataUrl = `data:${mimeType};base64,${base64}`;
                }

                const img = new window.Image(); // Explicit window.Image to avoid conflict if imported
                if (dataUrl.startsWith('data:')) {
                    img.removeAttribute('crossOrigin');
                } else {
                    img.crossOrigin = 'anonymous';
                }
                img.onload = () => {
                    const aspect = img.width / img.height;
                    const newId = crypto.randomUUID();
                    
                    // If dropped on another image, set it as parent
                    let parentId: string | undefined = undefined;
                    let parentOffsetX: number | undefined = undefined;
                    let parentOffsetY: number | undefined = undefined;
                    
                    for (let i = canvasImages.length - 1; i >= 0; i--) {
                        const cImg = canvasImages[i]!;
                        const w = cImg.width ?? 0;
                        const h = cImg.height ?? 0;
                        if (wx >= cImg.x && wx <= cImg.x + w && wy >= cImg.y && wy <= cImg.y + h) {
                            parentId = cImg.id;
                            parentOffsetX = (wx - 150) - cImg.x;
                            parentOffsetY = (wy - (150 / aspect)) - cImg.y;
                            break;
                        }
                    }
                    
                    addCanvasImage({
                        id: newId,
                        base64: dataUrl,
                        x: wx - 150, y: wy - (150 / aspect),
                        width: 300, height: 300 / aspect,
                        aspect,
                        projectId: currentProjectId,
                        parentId,
                        originalX: wx - 150,
                        originalY: wy - (150 / aspect),
                        originalWidth: 300,
                        originalHeight: 300 / aspect,
                        parentOffsetX,
                        parentOffsetY
                    });
                };
                img.onerror = () => {
                    toast.error("Failed to load dropped image. The format may be unsupported.");
                    logger.error("Failed to load dropped image from URL:", dataUrl.substring(0, 50) + "...");
                };
                img.src = dataUrl;
            } catch (err) {
                toast.error("Failed to fetch image. It may not support cross-origin requests.");
                logger.error("Drop image error:", err);
            }
        }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const scale = scaleRef.current;
        const offset = offsetRef.current;

        const wx = (cx - offset.x) / scale;
        const wy = (cy - offset.y) / scale;

        // Find the top-most clicked image
        for (let i = canvasImages.length - 1; i >= 0; i--) {
            const img = canvasImages[i]!;
            const w = img.width ?? 0;
            const h = img.height ?? 0;
            if (wx >= img.x && wx <= img.x + w && wy >= img.y && wy <= img.y + h) {
                // Check if we can realign it to parent
                if (img.parentId && img.parentOffsetX !== undefined && img.parentOffsetY !== undefined) {
                    const parent = canvasImages.find(p => p.id === img.parentId);
                    if (parent) {
                        updateCanvasImage(img.id, {
                            x: parent.x + img.parentOffsetX,
                            y: parent.y + img.parentOffsetY,
                            width: img.originalWidth ?? img.width,
                            height: img.originalHeight ?? img.height
                        });
                        toast.success("Realigned to parent");
                        return;
                    }
                }
                
                // Fallback: Check if we can realign to original coords
                if (img.originalX !== undefined && img.originalY !== undefined) {
                    updateCanvasImage(img.id, {
                        x: img.originalX,
                        y: img.originalY,
                        width: img.originalWidth ?? img.width,
                        height: img.originalHeight ?? img.height
                    });
                    toast.success("Restored original position");
                }
                return;
            }
        }
    };

    const applyCropPreset = (targetW: number, targetH: number) => {
        if (!cropOverlay) return;
        const scale = scaleRef.current;
        // The preset sizes are in world coordinates for output, but cropOverlay expects screen coordinates
        const screenW = targetW * scale;
        const screenH = targetH * scale;
        const cx = cropOverlay.sx + cropOverlay.w / 2;
        const cy = cropOverlay.sy + cropOverlay.h / 2;
        setCropOverlay({
            sx: cx - screenW / 2,
            sy: cy - screenH / 2,
            w: screenW,
            h: screenH
        });
        requestDraw();
    };

    return (
        <div className="relative w-full h-full overflow-hidden bg-[#151515]">
            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
                onWheel={handleWheel}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="block cursor-crosshair touch-none"
            />

            {/* HUD */}
            <InfiniteCanvasHUD
                tool={tool}
                setTool={setTool}
                selectedCanvasImageId={selectedCanvasImageId}
                removeCanvasImage={removeCanvasImage}
                onFlatten={handleFlatten}
                onGenerateVariations={handleGenerateVariations}
            />

            {promptOverlay && (
                <div
                    className="absolute z-50 flex flex-col gap-2 p-3 bg-[#111] border border-white/10 rounded-lg shadow-2xl backdrop-blur-md"
                    style={{
                        left: Math.max(160, Math.min(promptOverlay.sx + promptOverlay.w / 2, window.innerWidth - 160)),
                        top: Math.min(promptOverlay.sy + promptOverlay.h + 10, window.innerHeight - 150),
                        transform: 'translateX(-50%)',
                        width: '300px'
                    }}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-xs text-white/70 font-medium">Generate & Outpaint</span>
                    </div>
                    <textarea
                        autoFocus
                        value={promptText}
                        onChange={e => setPromptText(e.target.value)}
                        placeholder="Describe what you want to see..."
                        className="w-full bg-black/40 border border-white/10 rounded p-2 text-sm text-white resize-none focus:outline-none focus:border-purple-500/50"
                        rows={3}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (promptText.trim()) {
                                    const { sx, sy, w, h } = promptOverlay;
                                    setPromptOverlay(null);
                                    handleGeneration(sx, sy, w, h, promptText.trim());
                                }
                            } else if (e.key === 'Escape') {
                                setPromptOverlay(null);
                                setTool('select');
                            }
                        }}
                    />
                    <div className="flex justify-end gap-2 mt-1">
                        <button 
                            onClick={() => { setPromptOverlay(null); setTool('select'); }}
                            className="px-3 py-1 text-xs text-white/50 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => {
                                if (promptText.trim()) {
                                    const { sx, sy, w, h } = promptOverlay;
                                    setPromptOverlay(null);
                                    handleGeneration(sx, sy, w, h, promptText.trim());
                                }
                            }}
                            disabled={!promptText.trim()}
                            className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            Generate <Send className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            )}

            {cropOverlay && (
                <div
                    className="absolute z-50 flex flex-col gap-2 p-3 bg-[#111] border border-white/10 rounded-lg shadow-2xl backdrop-blur-md"
                    style={{
                        left: Math.max(160, Math.min(cropOverlay.sx + cropOverlay.w / 2, window.innerWidth - 160)),
                        top: Math.min(cropOverlay.sy + cropOverlay.h + 10, window.innerHeight - 150),
                        transform: 'translateX(-50%)',
                        width: '300px'
                    }}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <Crop className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-white/70 font-medium">Crop & Fill</span>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-1 mb-1">
                            <button onClick={() => applyCropPreset(1024, 1024)} className="px-2 py-1 text-xs text-white/80 bg-white/5 hover:bg-white/10 rounded transition-colors flex-1 text-center whitespace-nowrap">1:1</button>
                            <button onClick={() => applyCropPreset(1200, 630)} className="px-2 py-1 text-xs text-white/80 bg-white/5 hover:bg-white/10 rounded transition-colors flex-1 text-center whitespace-nowrap">Facebook</button>
                            <button onClick={() => applyCropPreset(1080, 1350)} className="px-2 py-1 text-xs text-white/80 bg-white/5 hover:bg-white/10 rounded transition-colors flex-1 text-center whitespace-nowrap">IG Port.</button>
                            <button onClick={() => applyCropPreset(1080, 1080)} className="px-2 py-1 text-xs text-white/80 bg-white/5 hover:bg-white/10 rounded transition-colors flex-1 text-center whitespace-nowrap">IG Sq.</button>
                            <button onClick={() => applyCropPreset(1500, 500)} className="px-2 py-1 text-xs text-white/80 bg-white/5 hover:bg-white/10 rounded transition-colors flex-1 text-center whitespace-nowrap">Twitter</button>
                        </div>
                        <button 
                            onClick={() => handleCrop(cropOverlay.sx, cropOverlay.sy, cropOverlay.w, cropOverlay.h, false)}
                            className="w-full px-3 py-2 text-sm text-white bg-white/10 hover:bg-white/20 rounded transition-colors"
                        >
                            Standard Crop
                        </button>
                        <button 
                            onClick={() => handleCrop(cropOverlay.sx, cropOverlay.sy, cropOverlay.w, cropOverlay.h, true)}
                            className="w-full px-3 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded transition-colors flex items-center justify-center gap-2"
                        >
                            <Sparkles className="w-4 h-4" />
                            Adaptive Fill (AI)
                        </button>
                    </div>
                    <div className="flex justify-end gap-2 mt-1">
                        <button 
                            onClick={() => { setCropOverlay(null); setTool('select'); }}
                            className="px-3 py-1 text-xs text-white/50 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

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
