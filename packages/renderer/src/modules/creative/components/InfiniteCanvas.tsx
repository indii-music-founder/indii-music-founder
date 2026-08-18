import React, { useRef, useEffect, useState } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import type { CanvasImage } from '@/core/store/slices/creative/creativeHistorySlice';
import { useShallow } from 'zustand/react/shallow';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { Editing } from '@/services/image/EditingService';
import { imageAnalysisService, type DetectedObject } from '@/services/image/ImageAnalysisService';
import { Loader2, Sparkles, Send, Crop } from 'lucide-react';
import { InfiniteCanvasHUD } from './InfiniteCanvasHUD';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';
import { fetchAsBase64 } from '@/services/storage/safeStorageFetch';
import { readCreativeAssetDrag } from '@/services/creative/CreativeAssetDragService';

export default function InfiniteCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageUploadRef = useRef<HTMLInputElement>(null);
    const {
        canvasImages,
        addCanvasImage,
        updateCanvasImage,
        removeCanvasImage,
        selectedCanvasImageId,
        selectCanvasImage,
        currentProjectId,
        addToHistory,
        saveDesignVersion,
        failedVariationBatch,
        setFailedVariationBatch,
        setRightPanelTab
    } = useStore(useShallow(state => ({
        canvasImages: state.canvasImages,
        addCanvasImage: state.addCanvasImage,
        updateCanvasImage: state.updateCanvasImage,
        removeCanvasImage: state.removeCanvasImage,
        selectedCanvasImageId: state.selectedCanvasImageId,
        selectCanvasImage: state.selectCanvasImage,
        currentProjectId: state.currentProjectId,
        addToHistory: state.addToHistory,
        saveDesignVersion: state.saveDesignVersion,
        failedVariationBatch: state.failedVariationBatch,
        setFailedVariationBatch: state.setFailedVariationBatch,
        setRightPanelTab: state.setRightPanelTab
    })));
    const toast = useToast();

    // Camera State (Refs for performance)
    const scaleRef = useRef(1);
    const offsetRef = useRef({ x: 0, y: 0 });

    const [tool, setTool] = useState<'pan' | 'select' | 'generate' | 'crop'>('pan');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDetectingObjects, setIsDetectingObjects] = useState(false);
    const [promptOverlay, setPromptOverlay] = useState<{ sx: number, sy: number, w: number, h: number } | null>(null);
    const [cropOverlay, setCropOverlay] = useState<{ sx: number, sy: number, w: number, h: number } | null>(null);
    const [promptText, setPromptText] = useState("");
    // ISSUE-1362: the Adaptive Fill action had no prompt input — it always ran
    // a hardcoded extension prompt, so the user could not say what to change.
    // Default preserves the original behavior; the user can now override it.
    const [adaptiveFillPrompt, setAdaptiveFillPrompt] = useState("Naturally extend the image to fill any empty space, matching the existing style, lighting, and composition.");
    const [detectedObjects, setDetectedObjects] = useState<{ sourceImageId: string; objects: DetectedObject[] } | null>(null);
    const [flattenRevision, setFlattenRevision] = useState<{ flattenedId: string; sources: CanvasImage[] } | null>(null);

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

    // Keep the drawing surface aligned to the actual Studio workspace. Window
    // dimensions are larger than this panel whenever navigation or context rails
    // are visible, which otherwise leaves clipped, incorrectly targeted canvas space.
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = canvas?.parentElement;
        if (!canvas || !container) return;

        const resize = () => {
            const rect = container.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width || window.innerWidth));
            const height = Math.max(1, Math.floor(rect.height || window.innerHeight));
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                requestDraw();
            }
        };

        const observer = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(resize)
            : null;

        window.addEventListener('resize', resize);
        resize();
        observer?.observe(container);

        return () => {
            window.removeEventListener('resize', resize);
            observer?.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Draw Loop - only for Store/Tool changes
    useEffect(() => {
        requestDraw();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canvasImages, detectedObjects, selectedCanvasImageId, tool]);

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
                        if (typeof image!.removeAttribute === 'function') image!.removeAttribute('crossOrigin');
                        image!.src = `data:${mimeType};base64,${base64}`;
                    }).catch(err => {
                        logger.error("Failed to load canvas image via safe fetch:", src, err);
                        // Fallback
                        image!.crossOrigin = 'anonymous';
                        image!.src = src + (src.includes('?') ? '&' : '?') + 'cb=' + Date.now();
                    });
                } else {
                    if (typeof image.removeAttribute === 'function') image.removeAttribute('crossOrigin');
                    image.src = src;
                }

                image.onload = () => requestDraw();
                image.onerror = () => {
                    logger.error("Failed to load canvas image:", src);
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

        if (detectedObjects) {
            const sourceImage = canvasImages.find(img => img.id === detectedObjects.sourceImageId);
            if (sourceImage) {
                const labelPadX = 8 / scale;
                const labelPadY = 4 / scale;
                const labelHeight = 18 / scale;

                ctx.save();
                ctx.strokeStyle = 'rgba(168, 85, 247, 0.95)';
                ctx.fillStyle = 'rgba(168, 85, 247, 0.16)';
                ctx.lineWidth = 2 / scale;
                ctx.font = `${12 / scale}px ui-sans-serif, system-ui, sans-serif`;

                detectedObjects.objects.forEach((detected) => {
                    const x = sourceImage.x + ((detected.box.xmin / 1000) * sourceImage.width);
                    const y = sourceImage.y + ((detected.box.ymin / 1000) * sourceImage.height);
                    const w = ((detected.box.xmax - detected.box.xmin) / 1000) * sourceImage.width;
                    const h = ((detected.box.ymax - detected.box.ymin) / 1000) * sourceImage.height;

                    if (w <= 0 || h <= 0) return;

                    ctx.fillRect(x, y, w, h);
                    ctx.strokeRect(x, y, w, h);

                    const labelWidth = ctx.measureText(detected.label).width + labelPadX * 2;
                    const labelY = Math.max(sourceImage.y, y - labelHeight - (2 / scale));

                    ctx.fillStyle = 'rgba(17, 24, 39, 0.92)';
                    ctx.fillRect(x, labelY, labelWidth, labelHeight);
                    ctx.strokeRect(x, labelY, labelWidth, labelHeight);

                    ctx.fillStyle = '#f5f3ff';
                    ctx.fillText(detected.label, x + labelPadX, labelY + labelPadY + (8 / scale));
                    ctx.fillStyle = 'rgba(168, 85, 247, 0.16)';
                });

                ctx.restore();
            }
        }

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
     * Used for capturing clean image data before sending to Autonomous editing.
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
            const requestNonce = `${Date.now()}-${crypto.randomUUID()}`;
            const generatePromises = Array.from({ length: 4 }).map((_, requestIndex) =>
                ImageGeneration.generateImages({
                    prompt: prompt,
                    count: 1,
                    sourceImages: [{ mimeType, data: base64Data }],
                    // ImageGenerationService coalesces identical concurrent calls.
                    // A unique seed makes each requested variation a distinct job.
                    seed: `${requestNonce}-${requestIndex}`,
                })
            );

            const settledResults = await Promise.allSettled(generatePromises);
            const successfulResults = settledResults.flatMap((settled, requestIndex) => (
                settled.status === 'fulfilled'
                    ? settled.value.map((result) => ({ result, requestIndex }))
                    : []
            ));
            const failedCount = settledResults.filter((settled) => (
                settled.status === 'rejected' || settled.value.length === 0
            )).length;
            const failedSlots = settledResults.flatMap((settled, requestIndex) => (
                settled.status === 'rejected' || settled.value.length === 0 ? [requestIndex] : []
            ));

            if (successfulResults.length > 0) {
                const padding = 40;
                const ww = selectedImg.width ?? 512;
                const wh = selectedImg.height ?? 512;
                
                const positions = [
                    { x: selectedImg.x + ww + padding, y: selectedImg.y },
                    { x: selectedImg.x + ww + padding, y: selectedImg.y + wh + padding },
                    { x: selectedImg.x, y: selectedImg.y + wh + padding },
                    { x: selectedImg.x + ww + padding + ww + padding, y: selectedImg.y }
                ];

                successfulResults.forEach(({ result: res, requestIndex }) => {
                    const pos = positions[requestIndex % 4]!;
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
                
                if (failedCount > 0) {
                    setFailedVariationBatch({ source: { ...selectedImg }, prompt, mimeType, base64Data, projectId: currentProjectId, slots: failedSlots });
                    toast.warning(`Generated ${successfulResults.length} variation${successfulResults.length === 1 ? '' : 's'}; ${failedCount} failed.`);
                } else {
                    setFailedVariationBatch(null);
                    toast.success(`Generated ${successfulResults.length} variations!`);
                }
            } else {
                setFailedVariationBatch({ source: { ...selectedImg }, prompt, mimeType, base64Data, projectId: currentProjectId, slots: failedSlots });
                toast.error('All variation requests failed. Your source image is unchanged.');
            }
        } catch (e: unknown) {
            logger.error(e instanceof Error ? e.message : String(e));
            toast.error('Failed to generate variations.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRetryFailedVariations = async () => {
        const batch = failedVariationBatch;
        if (!batch || batch.projectId !== currentProjectId) {
            toast.error('Failed variation batch belongs to a different project and cannot be retried here.');
            return;
        }
        if (!canvasImages.some(image => image.id === batch.source.id)) {
            toast.error('The original variation source is no longer on this canvas.');
            return;
        }
        setIsGenerating(true);
        try {
            const retryNonce = `${Date.now()}-${crypto.randomUUID()}`;
            const settled = await Promise.allSettled(batch.slots.map((slot) => ImageGeneration.generateImages({
                prompt: batch.prompt, count: 1, sourceImages: [{ mimeType: batch.mimeType, data: batch.base64Data }],
                seed: `${retryNonce}-${slot}`,
            })));
            const stillFailed: number[] = [];
            const padding = 40;
            const width = batch.source.width ?? 512;
            const height = batch.source.height ?? 512;
            const positions = [
                { x: batch.source.x + width + padding, y: batch.source.y },
                { x: batch.source.x + width + padding, y: batch.source.y + height + padding },
                { x: batch.source.x, y: batch.source.y + height + padding },
                { x: batch.source.x + width + padding + width + padding, y: batch.source.y },
            ];
            let recovered = 0;
            settled.forEach((result, retryIndex) => {
                const slot = batch.slots[retryIndex]!;
                if (result.status !== 'fulfilled' || result.value.length === 0) {
                    stillFailed.push(slot);
                    return;
                }
                result.value.forEach(asset => {
                    const position = positions[slot]!;
                    addCanvasImage({ id: asset.id, base64: asset.url, x: position.x, y: position.y, width, height, aspect: width / height, projectId: currentProjectId, prompt: batch.prompt, parentId: batch.source.id, originalX: position.x, originalY: position.y, originalWidth: width, originalHeight: height, parentOffsetX: position.x - batch.source.x, parentOffsetY: position.y - batch.source.y });
                    addToHistory({ id: asset.id, url: asset.url, type: 'image', prompt: batch.prompt, timestamp: Date.now(), projectId: currentProjectId, origin: 'generated' });
                    recovered += 1;
                });
            });
            setFailedVariationBatch(stillFailed.length ? { ...batch, slots: stillFailed } : null);
            if (recovered > 0) toast.success(`Recovered ${recovered} failed variation${recovered === 1 ? '' : 's'}.`);
            if (stillFailed.length) toast.warning(`${stillFailed.length} variation slot${stillFailed.length === 1 ? '' : 's'} still failed and can be retried.`);
        } catch (error) {
            logger.error('[InfiniteCanvas] Failed variation retry error:', error);
            toast.error('Failed variations could not be retried. Your completed variants are safe.');
        } finally {
            setIsGenerating(false);
        }
    };


    const handleCrop = async (sx: number, sy: number, w: number, h: number, adaptiveFill: boolean) => {
        setCropOverlay(null);
        if (adaptiveFill) {
            // ISSUE-1362: use the user's prompt (defaulted to the standard
            // extension instruction) instead of a hardcoded string.
            const fillPrompt = adaptiveFillPrompt.trim() || "Naturally extend the image to fill any empty space, matching the existing style, lighting, and composition.";
            await handleGeneration(sx, sy, w, h, fillPrompt);
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

    const handleFlatten = async () => {
        if (canvasImages.length <= 1) {
            toast.success("Nothing to flatten");
            return;
        }

        const unavailableLayer = canvasImages.find((img) => {
            const image = imageCache.current.get(img.id);
            return !image || !image.complete || image.naturalWidth <= 0;
        });
        if (unavailableLayer) {
            toast.error(`Cannot flatten yet: layer ${unavailableLayer.id.slice(0, 8)} is still loading or unavailable.`);
            return;
        }

        // A flatten replaces every source layer. Persist the exact pre-flatten
        // document before the destructive state change so recovery survives a
        // reload, unlike the short-lived in-component Undo control.
        try {
            await saveDesignVersion(`Before flatten — ${new Date().toLocaleString()}`);
        } catch (error) {
            logger.error('Could not save a recoverable pre-flatten revision:', error);
            toast.error('Flatten was not performed because its recovery revision could not be saved.');
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

        let dataUrl: string;
        try {
            dataUrl = tempCanvas.toDataURL('image/png');
        } catch (error: unknown) {
            logger.error('Failed to flatten canvas:', error);
            toast.error('Could not flatten layers. The original layers were preserved.');
            return;
        }
        
        // Create the replacement only after every source was rendered. Keep an
        // in-memory revision so this destructive-looking action has an immediate undo.
        const sourceRevision = canvasImages.map(image => ({ ...image }));
        const newId = crypto.randomUUID();
        canvasImages.forEach(img => removeCanvasImage(img.id));
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
        setFlattenRevision({ flattenedId: newId, sources: sourceRevision });
        selectCanvasImage(newId);
        toast.success("Layers flattened successfully. Undo is available until the next flatten.");
    };

    const handleUndoFlatten = () => {
        if (!flattenRevision) return;
        const flattenedStillExists = canvasImages.some(image => image.id === flattenRevision.flattenedId);
        if (!flattenedStillExists) {
            setFlattenRevision(null);
            toast.error('Cannot undo flatten because its replacement layer was removed.');
            return;
        }
        removeCanvasImage(flattenRevision.flattenedId);
        flattenRevision.sources.forEach(image => addCanvasImage(image));
        selectCanvasImage(flattenRevision.sources[flattenRevision.sources.length - 1]?.id ?? null);
        setFlattenRevision(null);
        toast.success('Flatten undone. Original layers were restored.');
    };

    const handleZoomIn = () => {
        scaleRef.current = Math.min(scaleRef.current * 1.2, 5);
        requestDraw();
    };

    const handleZoomOut = () => {
        scaleRef.current = Math.max(scaleRef.current / 1.2, 0.1);
        requestDraw();
    };

    const handleDetectObjects = async () => {
        if (!canvasRef.current || isDetectingObjects) return;

        const targetImage = (selectedCanvasImageId
            ? canvasImages.find(image => image.id === selectedCanvasImageId)
            : null) ?? canvasImages[canvasImages.length - 1];

        if (!targetImage) {
            toast.info("Add an image before running object detection.");
            return;
        }

        setIsDetectingObjects(true);
        try {
            const sourceUrl = targetImage.base64;
            const dataUrl = sourceUrl.startsWith('http')
                ? await fetchAsBase64(sourceUrl).then(({ base64, mimeType }) => `data:${mimeType};base64,${base64}`)
                : sourceUrl;
            const objects = await imageAnalysisService.detectObjects(dataUrl);
            setDetectedObjects({ sourceImageId: targetImage.id, objects });

            if (objects.length > 0) {
                toast.success(`Detected ${objects.length} object${objects.length === 1 ? '' : 's'}.`);
            } else {
                toast.info('No prominent objects detected.');
            }
        } catch (error) {
            logger.error('[InfiniteCanvas] Object detection failed', error);
            setDetectedObjects(null);
            toast.error('Object detection failed.');
        } finally {
            setIsDetectingObjects(false);
            requestDraw();
        }
    };

    const addLocalImageFile = (
        file: File,
        placement?: { x: number; y: number; attachToParent?: boolean },
    ) => {
        if (!file.type.startsWith('image/')) {
            toast.error("Only image files are supported in Image Studio.");
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => toast.error(`Could not read ${file.name}.`);
        reader.onload = (event) => {
            const dataUrl = event.target?.result;
            const canvas = canvasRef.current;
            if (typeof dataUrl !== 'string' || !canvas) return;

            const image = new window.Image();
            image.onload = () => {
                const naturalWidth = image.naturalWidth || image.width;
                const naturalHeight = image.naturalHeight || image.height;
                if (!naturalWidth || !naturalHeight) {
                    toast.error(`Could not determine the dimensions of ${file.name}.`);
                    return;
                }

                const rect = canvas.getBoundingClientRect();
                const scale = scaleRef.current;
                const offset = offsetRef.current;
                const screenX = placement?.x ?? rect.width / 2;
                const screenY = placement?.y ?? rect.height / 2;
                const worldCenterX = (screenX - offset.x) / scale;
                const worldCenterY = (screenY - offset.y) / scale;
                const aspect = naturalWidth / naturalHeight;
                const maxDisplayDimension = Math.max(
                    160,
                    Math.min(512, (Math.min(rect.width, rect.height) * 0.65) / scale),
                );
                const fitScale = Math.min(1, maxDisplayDimension / Math.max(naturalWidth, naturalHeight));
                const width = Math.max(1, naturalWidth * fitScale);
                const height = Math.max(1, naturalHeight * fitScale);
                const x = worldCenterX - width / 2;
                const y = worldCenterY - height / 2;
                const newId = crypto.randomUUID();

                let parentId: string | undefined;
                let parentOffsetX: number | undefined;
                let parentOffsetY: number | undefined;
                if (placement?.attachToParent) {
                    for (let i = canvasImages.length - 1; i >= 0; i--) {
                        const candidate = canvasImages[i]!;
                        if (
                            worldCenterX >= candidate.x
                            && worldCenterX <= candidate.x + candidate.width
                            && worldCenterY >= candidate.y
                            && worldCenterY <= candidate.y + candidate.height
                        ) {
                            parentId = candidate.id;
                            parentOffsetX = x - candidate.x;
                            parentOffsetY = y - candidate.y;
                            break;
                        }
                    }
                }

                addCanvasImage({
                    id: newId,
                    base64: dataUrl,
                    x,
                    y,
                    width,
                    height,
                    aspect,
                    projectId: currentProjectId,
                    parentId,
                    originalX: x,
                    originalY: y,
                    originalWidth: width,
                    originalHeight: height,
                    parentOffsetX,
                    parentOffsetY,
                    prompt: file.name,
                });
                selectCanvasImage(newId);
                setTool('select');
                toast.success(`${file.name} added to Image Studio.`);
            };
            image.onerror = () => toast.error(`Could not decode ${file.name}.`);
            image.src = dataUrl;
        };
        reader.readAsDataURL(file);
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) addLocalImageFile(file);
        event.target.value = '';
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const state = useStore.getState();

        // Handle file drop from OS
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (!file) return;
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            addLocalImageFile(file, {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                attachToParent: true,
            });
            return;
        }

        const creativePayload = readCreativeAssetDrag(e.dataTransfer);
        const rawData = e.dataTransfer.getData('text/plain');
        let id = creativePayload?.asset.id || rawData;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let droppedPayload: any = creativePayload?.asset || null;

        if (!creativePayload) {
            try {
                const parsed = JSON.parse(rawData);
                if (parsed && typeof parsed === 'object' && parsed.id) {
                    id = parsed.id;
                    droppedPayload = parsed;
                }
            } catch (_) {
                // Keep original string if not valid JSON
            }
        }
        
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

        // If still not found and we have dropped JSON payload, reconstruct it
        if (!historyItem && droppedPayload && droppedPayload.url) {
            historyItem = {
                id: droppedPayload.id,
                url: droppedPayload.url,
                type: droppedPayload.type || 'image',
                prompt: droppedPayload.prompt || 'Clipboard Asset',
                timestamp: Date.now(),
                projectId: currentProjectId,
                origin: 'generated'
            } as HistoryItem;
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
            <input
                ref={imageUploadRef}
                type="file"
                accept="image/*"
                className="hidden"
                tabIndex={-1}
                data-testid="canvas-image-upload-input"
                onChange={handleImageUpload}
            />
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
                className="block w-full h-full cursor-crosshair touch-none"
                data-testid="infinite-canvas-surface"
            />

            {/* HUD */}
            <InfiniteCanvasHUD
                tool={tool}
                setTool={setTool}
                selectedCanvasImageId={selectedCanvasImageId}
                removeCanvasImage={removeCanvasImage}
                onFlatten={handleFlatten}
                onUndoFlatten={handleUndoFlatten}
                canUndoFlatten={!!flattenRevision}
                onGenerateVariations={handleGenerateVariations}
                onRetryFailedVariations={handleRetryFailedVariations}
                failedVariationCount={failedVariationBatch?.slots.length}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onDetectObjects={handleDetectObjects}
                onUploadImage={() => imageUploadRef.current?.click()}
                onBrowseAssets={() => setRightPanelTab('assets')}
                canFlatten={canvasImages.length > 1}
                canDetectObjects={canvasImages.length > 0}
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
                        <Sparkles className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-white/70 font-medium">Generate & Outpaint</span>
                    </div>
                    <textarea
                        autoFocus
                        value={promptText}
                        onChange={e => setPromptText(e.target.value)}
                        placeholder="Describe what you want to see..."
                        className="w-full bg-black/40 border border-white/10 rounded p-2 text-sm text-white resize-none focus:outline-none focus:border-green-500/50"
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
                            className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
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
                        {/* ISSUE-1362: Adaptive Fill prompt input — the user must be
                            able to say what to change, not only accept the default
                            extension instruction. */}
                        <textarea
                            value={adaptiveFillPrompt}
                            onChange={(e) => setAdaptiveFillPrompt(e.target.value)}
                            rows={2}
                            placeholder="Describe what to generate in the selected area (e.g. 'extend the background', 'remove the cup', 'fill with studio backdrop')..."
                            className="w-full px-3 py-2 text-sm bg-black/40 border border-white/10 rounded text-white placeholder-white/30 focus:ring-1 focus:ring-green-500/50 focus:border-green-500/30 outline-none resize-none"
                            data-testid="adaptive-fill-prompt"
                            aria-label="Adaptive fill prompt"
                        />
                        <button 
                            onClick={() => handleCrop(cropOverlay.sx, cropOverlay.sy, cropOverlay.w, cropOverlay.h, true)}
                            className="w-full px-3 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded transition-colors flex items-center justify-center gap-2"
                        >
                            <Sparkles className="w-4 h-4" />
                            Adaptive Fill (Autonomous)
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
                        <Loader2 size={48} className="animate-spin text-green-500" />
                        <p className="text-white font-bold animate-pulse">Dreaming...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
