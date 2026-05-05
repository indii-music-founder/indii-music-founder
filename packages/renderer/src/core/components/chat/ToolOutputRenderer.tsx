import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { Sparkles, Edit2, Bug, Lightbulb } from 'lucide-react';
import { ImageAnnotator } from './annotator/ImageAnnotator';
import { DocumentAnnotator } from './annotator/DocumentAnnotator';

interface ImageRendererProps {
    src?: string;
    alt?: string;
    messageId?: string;
    agentId?: string;
}

export const ImageRenderer: React.FC<ImageRendererProps> = ({ src, alt, messageId, agentId }) => {
    const { openImageInStudio } = useStore.getState();
    const [showAnnotator, setShowAnnotator] = useState(false);

    const handleClick = () => {
        if (!src || !messageId || !agentId) return;
        
        openImageInStudio({
            imageId: crypto.randomUUID(),
            sourceUrl: src,
            sourceMessageId: messageId,
            agentId: agentId,
            prompt: alt || 'Imported Image'
        });
    };

    return (
        <div className="flex flex-col gap-2">
            <div
                className="group relative inline-block my-2 cursor-pointer rounded-lg overflow-hidden border border-white/10 shadow-lg transition-transform hover:scale-[1.02]"
                onClick={handleClick}
            >
                <img
                    src={src}
                    alt={alt}
                    className="max-w-full h-auto rounded-lg"
                    style={{ maxHeight: '400px' }}
                />

                {/* Permanent Corner Badge for Touch/Mobile */}
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full shadow-lg md:hidden flex items-center gap-2 border border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Open in Studio</span>
                </div>

                {/* Hover Overlay for Desktop */}
                <div className="absolute inset-0 bg-black/50 items-center justify-center transition-opacity duration-200 opacity-0 md:group-hover:opacity-100 hidden md:flex">
                    <div className="bg-dept-creative text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-xl transform scale-100 hover:scale-105 transition-transform" data-testid="open-in-studio-badge">
                        <span>✏️ Open in Studio</span>
                    </div>
                </div>

                {/* Annotator Toggle Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowAnnotator(!showAnnotator);
                    }}
                    className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white p-2 rounded-full shadow-lg border border-white/10 hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
                    title="Inline Annotator"
                >
                    <Edit2 size={16} />
                </button>
            </div>

            {showAnnotator && src && messageId && agentId && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <ImageAnnotator 
                        imageUrl={src} 
                        imageId={messageId + '_img'} 
                        originalMessageId={messageId} 
                        agentId={agentId} 
                    />
                </div>
            )}
        </div>
    );
};

interface ToolOutputProps {
    toolName: string;
    idx: number;
    url: string;
    prompt?: string;
    messageId?: string;
    agentId?: string;
}

export const ToolImageOutput: React.FC<ToolOutputProps> = ({ toolName, idx, url, prompt, messageId, agentId }) => {
    const label = toolName === 'generate_image' ? 'GENERATED ASSET' :
        toolName === 'batch_edit_images' ? 'EDITED ASSET' :
            toolName === 'render_cinematic_grid' ? 'CINEMATIC GRID' :
                toolName === 'extract_grid_frame' ? 'EXTRACTED FRAME' :
                    'HIGH-RES ASSET';

    return (
        <div className="bg-black/40 rounded-xl p-4 border border-white/10">
            <div className="text-xs text-dept-creative mb-2 font-mono flex items-center gap-2 uppercase tracking-wider">
                <Sparkles size={12} />
                {label} {idx + 1}
            </div>
            <ImageRenderer src={url} alt={prompt || `Generated Image ${idx + 1}`} messageId={messageId} agentId={agentId} />
        </div>
    );
};

interface DocumentRendererProps {
    url?: string;
    name?: string;
    messageId?: string;
    agentId?: string;
}

export const DocumentRenderer: React.FC<DocumentRendererProps> = ({ url, name, messageId, agentId }) => {
    const [showAnnotator, setShowAnnotator] = useState(false);

    if (!url) return null;

    return (
        <div className="flex flex-col gap-2">
            <div className="group relative bg-white/5 rounded-lg border border-white/10 p-4 hover:bg-white/10 transition-colors">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <span className="text-xl">📄</span>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white truncate max-w-[200px]">{name || 'Document'}</div>
                            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">PDF Document</div>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAnnotator(!showAnnotator)}
                        className={`p-2 rounded-full transition-all ${showAnnotator ? 'bg-dept-creative text-white shadow-lg shadow-dept-creative/20' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                        title="Annotate Document"
                    >
                        <Edit2 size={16} />
                    </button>
                </div>
            </div>

            {showAnnotator && url && messageId && agentId && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <DocumentAnnotator 
                        documentUrl={url} 
                        documentId={messageId + '_doc'} 
                        originalMessageId={messageId} 
                        agentId={agentId} 
                    />
                </div>
            )}
        </div>
    );
};

export const ToolDocumentOutput: React.FC<ToolOutputProps> = ({ toolName, idx, url, prompt, messageId, agentId }) => {
    const label = toolName === 'generate_contract' ? 'GENERATED CONTRACT' :
        toolName === 'edit_document_with_annotations' ? 'ANNOTATED DOCUMENT' :
            'DOCUMENT ASSET';

    return (
        <div className="bg-black/40 rounded-xl p-4 border border-white/10">
            <div className="text-xs text-dept-creative mb-2 font-mono flex items-center gap-2 uppercase tracking-wider">
                <Sparkles size={12} />
                {label} {idx + 1}
            </div>
            <DocumentRenderer url={url} name={prompt || `Document ${idx + 1}`} messageId={messageId} agentId={agentId} />
        </div>
    );
};

interface ToolFeedbackOutputProps {
    toolName: string;
    title: string;
    severity?: string;
    priority?: string;
    markdownBody: string;
}

export const ToolFeedbackOutput: React.FC<ToolFeedbackOutputProps> = ({ toolName, title, severity, priority, markdownBody }) => {
    const isBug = toolName === 'report_bug';
    const label = isBug ? 'BUG TICKET LOGGED' : 'FEATURE TICKET LOGGED';
    const badgeColor = isBug ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30';
    const Icon = isBug ? Bug : Lightbulb;
    
    return (
        <div className="bg-black/40 rounded-xl p-4 border border-white/10 my-2">
            <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-mono flex items-center gap-2 uppercase tracking-wider text-gray-400">
                    <Icon size={14} className={isBug ? "text-red-400" : "text-green-400"} />
                    {label}
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeColor}`}>
                    {severity || priority || 'Logged'}
                </div>
            </div>
            <div className="font-bold text-sm text-white mb-2">{title}</div>
            <div className="text-xs text-gray-400 line-clamp-3">
                {markdownBody.split('### Description')[1]?.split('###')[0]?.trim() || "See detailed report."}
            </div>
        </div>
    );
};
