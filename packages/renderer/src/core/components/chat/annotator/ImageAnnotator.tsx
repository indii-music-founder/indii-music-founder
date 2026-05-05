import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/core/store';
import { AgentService } from '@/services/agent/AgentService';
import { Eraser, Trash2, CheckCircle2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface Annotation {
    id: string;
    color: string;
    cx: number;
    cy: number;
    r: number;
}

interface ImageAnnotatorProps {
    imageUrl: string;
    imageId: string;
    originalMessageId: string;
    agentId: string;
}

const COLORS = [
    { name: 'red', hex: '#ef4444' },
    { name: 'blue', hex: '#3b82f6' },
    { name: 'yellow', hex: '#eab308' }
];

export const ImageAnnotator: React.FC<ImageAnnotatorProps> = ({ imageUrl, imageId, originalMessageId, agentId }) => {
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [activeTool, setActiveTool] = useState<string>('#ef4444'); // default red
    const [prompts, setPrompts] = useState<{ [color: string]: string }>({ red: '', blue: '', yellow: '' });
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentCircle, setCurrentCircle] = useState<Annotation | null>(null);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    // Calculate natural image size vs rendered size to get proper coordinates
    useEffect(() => {
        if (imageRef.current) {
            const updateSize = () => {
                if (imageRef.current) {
                    setImageSize({
                        width: imageRef.current.naturalWidth,
                        height: imageRef.current.naturalHeight
                    });
                }
            };
            if (imageRef.current.complete) updateSize();
            else imageRef.current.onload = updateSize;
        }
    }, [imageUrl]);

    const drawCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawCircle = (ann: Annotation) => {
            ctx.beginPath();
            ctx.arc(ann.cx, ann.cy, ann.r, 0, 2 * Math.PI);
            ctx.strokeStyle = ann.color;
            ctx.lineWidth = 4;
            ctx.stroke();
            // Fill with low opacity
            ctx.fillStyle = `${ann.color}40`;
            ctx.fill();
        };

        annotations.forEach(drawCircle);
        if (currentCircle) drawCircle(currentCircle);
    };

    useEffect(() => {
        drawCanvas();
    }, [annotations, currentCircle]);

    const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        
        // Handle touch and mouse events
        let clientX = 0;
        let clientY = 0;
        
        if ('touches' in e) {
            const touchEvent = e as React.TouchEvent;
            clientX = touchEvent.touches[0]?.clientX || 0;
            clientY = touchEvent.touches[0]?.clientY || 0;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        // Map to canvas natural resolution
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (activeTool === 'eraser') {
            const { x, y } = getMousePos(e);
            // Find clicked annotation and remove
            const clicked = annotations.slice().reverse().find(ann => {
                const dx = ann.cx - x;
                const dy = ann.cy - y;
                return Math.sqrt(dx * dx + dy * dy) <= ann.r;
            });
            if (clicked) {
                setAnnotations(prev => prev.filter(a => a.id !== clicked.id));
            }
            return;
        }

        setIsDrawing(true);
        const { x, y } = getMousePos(e);
        setCurrentCircle({
            id: uuidv4(),
            color: activeTool,
            cx: x,
            cy: y,
            r: 0
        });
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !currentCircle || activeTool === 'eraser') return;
        const { x, y } = getMousePos(e);
        const dx = x - currentCircle.cx;
        const dy = y - currentCircle.cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        setCurrentCircle({ ...currentCircle, r });
    };

    const handlePointerUp = () => {
        if (isDrawing && currentCircle && currentCircle.r > 5) {
            setAnnotations(prev => [...prev, currentCircle]);
        }
        setIsDrawing(false);
        setCurrentCircle(null);
    };

    const handleApply = async () => {
        setIsSubmitting(true);
        try {
            // Build the prompt structure
            const redRegions = annotations.filter(a => a.color === '#ef4444');
            const blueRegions = annotations.filter(a => a.color === '#3b82f6');
            const yellowRegions = annotations.filter(a => a.color === '#eab308');

            const payload = {
                imageId,
                annotations: annotations.map(a => ({
                    color: COLORS.find(c => c.hex === a.color)?.name || 'unknown',
                    cx: Math.round(a.cx),
                    cy: Math.round(a.cy),
                    r: Math.round(a.r)
                })),
                colorPrompts: {
                    red: redRegions.length > 0 ? prompts.red : undefined,
                    blue: blueRegions.length > 0 ? prompts.blue : undefined,
                    yellow: yellowRegions.length > 0 ? prompts.yellow : undefined
                }
            };

            // Call the agent service directly to invoke the tool on the agent
            const agentService = new AgentService();
            await agentService.dispatchToolCall(agentId, 'edit_image_with_annotations', payload, originalMessageId);

        } catch (error) {
            console.error('Failed to submit annotations', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4 bg-gray-900 rounded-lg border border-white/10 mt-2">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="text-dept-creative">✏️</span> Inline Annotator
                </h3>
                <div className="flex items-center gap-2">
                    {COLORS.map(c => (
                        <button
                            key={c.hex}
                            onClick={() => setActiveTool(c.hex)}
                            className={`w-6 h-6 rounded-full transition-transform ${activeTool === c.hex ? 'scale-125 ring-2 ring-white' : ''}`}
                            style={{ backgroundColor: c.hex }}
                            title={c.name}
                        />
                    ))}
                    <div className="w-px h-6 bg-white/20 mx-1" />
                    <button
                        onClick={() => setActiveTool('eraser')}
                        className={`p-1.5 rounded transition-colors ${activeTool === 'eraser' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
                        title="Eraser"
                    >
                        <Eraser size={16} />
                    </button>
                    <button
                        onClick={() => setAnnotations([])}
                        className="p-1.5 rounded text-gray-400 hover:text-red-400 transition-colors"
                        title="Clear All"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            <div 
                ref={containerRef}
                className="relative bg-black rounded overflow-hidden cursor-crosshair border border-white/5 select-none"
                style={{ touchAction: 'none' }}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
                onTouchCancel={handlePointerUp}
            >
                <img 
                    ref={imageRef} 
                    src={imageUrl} 
                    alt="Annotation target" 
                    className="block w-full h-auto opacity-80 pointer-events-none" 
                />
                {imageSize.width > 0 && (
                    <canvas
                        ref={canvasRef}
                        width={imageSize.width}
                        height={imageSize.height}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                    />
                )}
            </div>

            <div className="flex flex-col gap-2">
                {COLORS.map(c => {
                    const hasAnnotations = annotations.some(a => a.color === c.hex);
                    return (
                        <div key={c.name} className={`flex items-center gap-2 transition-opacity ${hasAnnotations ? 'opacity-100' : 'opacity-40'}`}>
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                            <input
                                type="text"
                                placeholder={hasAnnotations ? `Prompt for ${c.name} regions...` : `Draw ${c.name} circles to enable`}
                                value={prompts[c.name]}
                                onChange={(e) => setPrompts({ ...prompts, [c.name]: e.target.value })}
                                disabled={!hasAnnotations}
                                className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-dept-creative disabled:cursor-not-allowed"
                            />
                        </div>
                    );
                })}
            </div>

            <button
                onClick={handleApply}
                disabled={isSubmitting || annotations.length === 0}
                className="flex items-center justify-center gap-2 w-full py-2 bg-dept-creative hover:bg-dept-creative/80 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-bold transition-colors"
            >
                {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <CheckCircle2 size={18} />
                )}
                {isSubmitting ? 'Applying Edits...' : 'Apply Edits'}
            </button>
        </div>
    );
};
