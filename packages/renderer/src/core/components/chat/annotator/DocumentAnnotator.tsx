import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/core/store';
import { AgentService } from '@/services/agent/AgentService';
import { Eraser, Trash2, CheckCircle2, ChevronLeft, ChevronRight, Highlighter, StickyNote } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface DocAnnotation {
    id: string;
    pageNumber: number;
    type: 'highlight' | 'sticky_note';
    x: number;
    y: number;
    width?: number;
    height?: number;
    color: string;
    content?: string;
}

interface DocumentAnnotatorProps {
    documentUrl: string;
    documentId: string;
    originalMessageId: string;
    agentId: string;
}

const COLORS = [
    { name: 'yellow', hex: '#fde047' },
    { name: 'blue', hex: '#3b82f6' },
    { name: 'green', hex: '#22c55e' }
];

export const DocumentAnnotator: React.FC<DocumentAnnotatorProps> = ({ documentUrl, documentId, originalMessageId, agentId }) => {
    const [pdf, setPdf] = useState<any>(null);
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [annotations, setAnnotations] = useState<DocAnnotation[]>([]);
    const [activeTool, setActiveTool] = useState<'highlight' | 'sticky_note' | 'eraser'>('highlight');
    const [activeColor, setActiveColor] = useState('#fde047');
    const [globalInstruction, setGlobalInstruction] = useState('');
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentRect, setCurrentRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [renderScale, setRenderScale] = useState(1.5);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Load PDF
    useEffect(() => {
        const loadPdf = async () => {
            try {
                const loadingTask = pdfjsLib.getDocument(documentUrl);
                const pdfDoc = await loadingTask.promise;
                setPdf(pdfDoc);
                setNumPages(pdfDoc.numPages);
                renderPage(pdfDoc, 1);
            } catch (error) {
                console.error('Error loading PDF:', error);
            }
        };
        loadPdf();
    }, [documentUrl]);

    const renderPage = async (pdfDoc: any, pageNum: number) => {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        await page.render(renderContext).promise;

        // Resize annotation canvas to match
        if (annotationCanvasRef.current) {
            annotationCanvasRef.current.width = canvas.width;
            annotationCanvasRef.current.height = canvas.height;
            drawAnnotations();
        }
    };

    useEffect(() => {
        if (pdf) renderPage(pdf, currentPage);
    }, [currentPage, pdf, renderScale]);

    const drawAnnotations = () => {
        const canvas = annotationCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        annotations.filter(a => a.pageNumber === currentPage).forEach(ann => {
            ctx.fillStyle = ann.type === 'highlight' ? `${ann.color}40` : ann.color;
            ctx.strokeStyle = ann.color;
            ctx.lineWidth = 2;

            if (ann.type === 'highlight' && ann.width && ann.height) {
                ctx.fillRect(ann.x, ann.y, ann.width, ann.height);
                ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
            } else if (ann.type === 'sticky_note') {
                ctx.beginPath();
                ctx.arc(ann.x, ann.y, 8, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            }
        });

        if (currentRect && activeTool === 'highlight') {
            ctx.fillStyle = `${activeColor}20`;
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = 2;
            ctx.fillRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
            ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
        }
    };

    useEffect(() => {
        drawAnnotations();
    }, [annotations, currentRect, currentPage]);

    const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = annotationCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        
        let clientX = 0;
        let clientY = 0;
        
        if ('touches' in e) {
            clientX = e.touches[0]?.clientX || 0;
            clientY = e.touches[0]?.clientY || 0;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        const { x, y } = getMousePos(e);

        if (activeTool === 'eraser') {
            setAnnotations(prev => prev.filter(ann => {
                if (ann.pageNumber !== currentPage) return true;
                if (ann.type === 'sticky_note') {
                    const dist = Math.sqrt((ann.x - x) ** 2 + (ann.y - y) ** 2);
                    return dist > 15;
                } else {
                    return !(x >= ann.x && x <= ann.x + (ann.width || 0) && y >= ann.y && y <= ann.y + (ann.height || 0));
                }
            }));
            return;
        }

        if (activeTool === 'sticky_note') {
            const newAnn: DocAnnotation = {
                id: uuidv4(),
                pageNumber: currentPage,
                type: 'sticky_note',
                x,
                y,
                color: activeColor,
                content: ''
            };
            setAnnotations(prev => [...prev, newAnn]);
            return;
        }

        setIsDrawing(true);
        setCurrentRect({ x, y, w: 0, h: 0 });
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !currentRect || activeTool !== 'highlight') return;
        const { x, y } = getMousePos(e);
        setCurrentRect({
            ...currentRect,
            w: x - currentRect.x,
            h: y - currentRect.y
        });
    };

    const handlePointerUp = () => {
        if (isDrawing && currentRect && (Math.abs(currentRect.w) > 5 || Math.abs(currentRect.h) > 5)) {
            const newAnn: DocAnnotation = {
                id: uuidv4(),
                pageNumber: currentPage,
                type: 'highlight',
                x: currentRect.w < 0 ? currentRect.x + currentRect.w : currentRect.x,
                y: currentRect.h < 0 ? currentRect.y + currentRect.h : currentRect.y,
                width: Math.abs(currentRect.w),
                height: Math.abs(currentRect.h),
                color: activeColor
            };
            setAnnotations(prev => [...prev, newAnn]);
        }
        setIsDrawing(false);
        setCurrentRect(null);
    };

    const handleApply = async () => {
        setIsSubmitting(true);
        try {
            const payload = {
                documentId,
                annotations: annotations.map(a => ({
                    pageNumber: a.pageNumber,
                    type: a.type,
                    x: Math.round(a.x),
                    y: Math.round(a.y),
                    width: a.width ? Math.round(a.width) : undefined,
                    height: a.height ? Math.round(a.height) : undefined,
                    color: a.color,
                    content: a.content
                })),
                globalInstruction
            };

            const agentService = new AgentService();
            await agentService.dispatchToolCall(agentId, 'edit_document_with_annotations', payload, originalMessageId);

        } catch (error) {
            console.error('Failed to submit document annotations', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4 bg-gray-900 rounded-lg border border-white/10 mt-2 max-w-full">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="text-dept-creative">📄</span> Document Annotator
                </h3>
                
                <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/5">
                    <button
                        onClick={() => setActiveTool('highlight')}
                        className={`p-1.5 rounded transition-colors ${activeTool === 'highlight' ? 'bg-dept-creative text-white' : 'text-gray-400 hover:text-white'}`}
                        title="Highlight Area"
                    >
                        <Highlighter size={16} />
                    </button>
                    <button
                        onClick={() => setActiveTool('sticky_note')}
                        className={`p-1.5 rounded transition-colors ${activeTool === 'sticky_note' ? 'bg-dept-creative text-white' : 'text-gray-400 hover:text-white'}`}
                        title="Add Sticky Note"
                    >
                        <StickyNote size={16} />
                    </button>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <button
                        onClick={() => setActiveTool('eraser')}
                        className={`p-1.5 rounded transition-colors ${activeTool === 'eraser' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'}`}
                        title="Eraser"
                    >
                        <Eraser size={16} />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {COLORS.map(c => (
                        <button
                            key={c.hex}
                            onClick={() => setActiveColor(c.hex)}
                            className={`w-6 h-6 rounded-full transition-transform ${activeColor === c.hex ? 'scale-125 ring-2 ring-white' : ''}`}
                            style={{ backgroundColor: c.hex }}
                            title={c.name}
                        />
                    ))}
                    <div className="w-px h-6 bg-white/20 mx-1" />
                    <button
                        onClick={() => setAnnotations([])}
                        className="p-1.5 rounded text-gray-400 hover:text-red-400 transition-colors"
                        title="Clear All"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Page Navigation */}
            <div className="flex items-center justify-center gap-4 bg-black/20 p-2 rounded-lg">
                <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={20} />
                </button>
                <span className="text-xs font-mono text-gray-400">
                    PAGE <span className="text-white font-bold">{currentPage}</span> / {numPages || '?'}
                </span>
                <button
                    onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                    disabled={currentPage === numPages}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            <div 
                ref={containerRef}
                className="relative bg-black rounded overflow-auto cursor-crosshair border border-white/5 select-none max-h-[600px] custom-scrollbar"
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
                <div className="relative inline-block">
                    <canvas ref={canvasRef} className="block" />
                    <canvas
                        ref={annotationCanvasRef}
                        className="absolute inset-0 pointer-events-none"
                    />
                </div>
            </div>

            {/* Annotation Content Editor */}
            <div className="flex flex-col gap-3">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Notes & Instructions</div>
                
                {annotations.filter(a => a.type === 'sticky_note').map((a, idx) => (
                    <div key={a.id} className="flex items-center gap-3 bg-black/40 p-2 rounded border border-white/5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                        <div className="text-[10px] font-mono text-gray-500 shrink-0">P{a.pageNumber} NOTE {idx + 1}</div>
                        <input
                            type="text"
                            placeholder="Instruction for this spot..."
                            value={a.content || ''}
                            onChange={(e) => {
                                const newAnns = [...annotations];
                                const index = newAnns.findIndex(ann => ann.id === a.id);
                                if (index !== -1 && newAnns[index]) {
                                    newAnns[index]!.content = e.target.value;
                                    setAnnotations(newAnns);
                                }
                            }}
                            className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none placeholder:text-gray-600"
                        />
                        <button 
                            onClick={() => setAnnotations(prev => prev.filter(ann => ann.id !== a.id))}
                            className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}

                <textarea
                    placeholder="Global instructions for this document edit..."
                    value={globalInstruction}
                    onChange={(e) => setGlobalInstruction(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-dept-creative min-h-[80px] resize-none"
                />
            </div>

            <button
                onClick={handleApply}
                disabled={isSubmitting || (annotations.length === 0 && !globalInstruction)}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-dept-creative hover:bg-dept-creative/80 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-bold transition-colors shadow-lg shadow-dept-creative/10"
            >
                {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <CheckCircle2 size={18} />
                )}
                {isSubmitting ? 'Sending to Agent...' : 'Apply Document Edits'}
            </button>
        </div>
    );
};
