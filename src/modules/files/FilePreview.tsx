import React from 'react';
import { useStore } from '@/core/store';
import { FileNode } from '@/services/FileSystemService';
import { FileText, Image as ImageIcon, Music, Video, File, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FilePreview() {
    const { selectedFileNodeId, fileNodes } = useStore();

    const selectedNode = fileNodes.find((n: FileNode) => n.id === selectedFileNodeId);

    if (!selectedNode) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <File size={48} className="mb-4 opacity-50" />
                <p>Select a file to preview</p>
            </div>
        );
    }

    if (selectedNode.type === 'folder') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Folder size={48} className="mb-4 opacity-50" />
                <h2 className="text-xl font-medium mt-2">{selectedNode.name}</h2>
                <p className="text-sm opacity-50">Folder</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-[#0d1117]">
            <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-[#0d1117]">
                <span className="text-blue-400">
                    {getFileIcon(selectedNode.fileType)}
                </span>
                <h2 className="text-lg font-medium text-gray-200">{selectedNode.name}</h2>
            </div>
            <div className="flex-1 flex items-center justify-center p-8 overflow-hidden bg-[#111]">
                {renderContent(selectedNode)}
            </div>
        </div>
    );
}

function renderContent(node: FileNode) {
    if (node.fileType === 'image') {
        const url = node.data?.url;
        if (url) return <img src={url} alt={node.name} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/5" />;
        return (
            <div className="flex flex-col items-center text-gray-500">
                <ImageIcon size={48} className="mb-4 opacity-20" />
                <p className="italic">No image data available</p>
            </div>
        );
    }
    if (node.fileType === 'video') {
        const url = node.data?.url;
        if (url) return <video src={url} controls className="max-w-full max-h-full rounded-lg shadow-2xl border border-white/5" />;
        return (
            <div className="flex flex-col items-center text-gray-500">
                <Video size={48} className="mb-4 opacity-20" />
                <p className="italic">No video data available</p>
            </div>
        );
    }

    // Default for generic or unsupported
    return (
        <div className="text-center">
            <div className="text-6xl mb-4 opacity-20 flex justify-center text-gray-400">
                {getFileIcon(node.fileType, 64)}
            </div>
            <p className="text-gray-500 mt-4">Preview not supported for this file type</p>
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
