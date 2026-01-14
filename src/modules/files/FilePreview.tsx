import React from 'react';
import { useStore } from '@/core/store';
import { FileNode } from '@/services/FileSystemService';
import { FileText, Image as ImageIcon, Music, Video, File, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilePreviewProps {
    variant?: 'default' | 'compact';
}

export default function FilePreview({ variant = 'default' }: FilePreviewProps) {
    const { selectedFileNodeId, fileNodes } = useStore();

    const selectedNode = fileNodes.find((n: FileNode) => n.id === selectedFileNodeId);

    if (!selectedNode) {
        return (
            <div className={cn(
                "flex flex-col items-center justify-center h-full text-gray-500",
                variant === 'compact' ? "p-4" : "p-8"
            )}>
                <File size={variant === 'compact' ? 24 : 48} className="mb-4 opacity-50" />
                <p className={variant === 'compact' ? "text-xs" : ""}>Select a file to preview</p>
            </div>
        );
    }

    if (selectedNode.type === 'folder') {
        return (
            <div className={cn(
                "flex flex-col items-center justify-center h-full text-gray-500",
                variant === 'compact' ? "p-4" : "p-8"
            )}>
                <Folder size={variant === 'compact' ? 24 : 48} className="mb-4 opacity-50" />
                <h2 className={cn("font-medium mt-2", variant === 'compact' ? "text-sm" : "text-xl")}>{selectedNode.name}</h2>
                <p className="text-xs opacity-50">Folder</p>
            </div>
        )
    }

    return (
        <div className={cn("flex flex-col h-full bg-bg-dark", variant === 'compact' && "bg-transparent")}>
            {variant === 'default' && (
                <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-bg-dark">
                    <span className="text-blue-400">
                        {getFileIcon(selectedNode.fileType)}
                    </span>
                    <h2 className="text-lg font-medium text-gray-200">{selectedNode.name}</h2>
                </div>
            )}
            <div className={cn(
                "flex-1 flex items-center justify-center overflow-hidden bg-[#111]",
                variant === 'compact' ? "p-2 bg-transparent" : "p-8"
            )}>
                {renderContent(selectedNode, variant)}
            </div>
        </div>
    );
}

function renderContent(node: FileNode, variant: 'default' | 'compact' = 'default') {
    if (node.fileType === 'image') {
        const url = node.data?.url;
        if (url) return <img src={url} alt={node.name} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/5" />;
        return (
            <div className="flex flex-col items-center text-gray-500">
                <ImageIcon size={variant === 'compact' ? 24 : 48} className="mb-4 opacity-20" />
                <p className={cn("italic", variant === 'compact' && "text-[10px]")}>No image data available</p>
            </div>
        );
    }
    if (node.fileType === 'video') {
        const url = node.data?.url;
        if (url) return <video src={url} controls className="max-w-full max-h-full rounded-lg shadow-2xl border border-white/5" />;
        return (
            <div className="flex flex-col items-center text-gray-500">
                <Video size={variant === 'compact' ? 24 : 48} className="mb-4 opacity-20" />
                <p className={cn("italic", variant === 'compact' && "text-[10px]")}>No video data available</p>
            </div>
        );
    }

    // Default for generic or unsupported
    return (
        <div className="text-center">
            <div className={cn("opacity-20 flex justify-center text-gray-400", variant === 'compact' ? "text-2xl" : "text-6xl mb-4")}>
                {getFileIcon(node.fileType, variant === 'compact' ? 32 : 64)}
            </div>
            <p className={cn("text-gray-500 mt-4", variant === 'compact' && "text-[10px] mt-2")}>Preview not supported</p>
        </div>
    )
}

function getFileIcon(type?: FileNode['fileType'], size = 24) {
    switch (type) {
        case 'image': return <ImageIcon size={size} />;
        case 'audio': return <Music size={size} />;
        case 'video': return <Video size={size} />;
        case 'document': return <FileText size={size} />;
        default: return <File size={size} />;
    }
}
