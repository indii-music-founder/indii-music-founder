import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Folder, File, Image as ImageIcon, Music, Video, FileText } from 'lucide-react';
import { FileNode } from '@/services/FileSystemService';
import { cn } from '@/lib/utils';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

interface FileTreeProps {
    nodes: FileNode[];
    parentId: string | null;
    level?: number;
}

export function FileTree({ nodes, parentId, level = 0 }: FileTreeProps) {
    const { 
        expandedFolderIds, 
        toggleFolder, 
        selectedFileNodeId, 
        setSelectedFileNode,
        moveNode,
        currentProjectId
    } = useStore(useShallow(state => ({
        expandedFolderIds: state.expandedFolderIds,
        toggleFolder: state.toggleFolder,
        selectedFileNodeId: state.selectedFileNodeId,
        setSelectedFileNode: state.setSelectedFileNode,
        moveNode: state.moveNode,
        currentProjectId: state.currentProjectId
    })));

    const children = nodes.filter(n => n.parentId === parentId).sort((a, b) => {
        // Folders first
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
    });

    if (children.length === 0) return null;

    const handleDragStart = (e: React.DragEvent, node: FileNode) => {
        e.dataTransfer.setData('text/plain', node.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, node: FileNode) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (node.type === 'folder') {
            e.currentTarget.classList.add('bg-blue-500/20');
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.currentTarget.classList.remove('bg-blue-500/20');
    };

    const handleDrop = (e: React.DragEvent, targetNode: FileNode) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-blue-500/20');
        
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId === targetNode.id) return; // Can't drop on self

        if (targetNode.type === 'folder' && currentProjectId) {
            moveNode(draggedId, { parentId: targetNode.id }, currentProjectId);
        }
    };

    const getFileIcon = (type?: string, className?: string) => {
        switch (type) {
            case 'image': return <ImageIcon className={className} size={16} />;
            case 'audio': return <Music className={className} size={16} />;
            case 'video': return <Video className={className} size={16} />;
            case 'document': return <FileText className={className} size={16} />;
            default: return <File className={className} size={16} />;
        }
    };

    return (
        <ul className="space-y-1 w-full">
            <AnimatePresence>
                {children.map(node => {
                    const isExpanded = expandedFolderIds.includes(node.id);
                    const isSelected = selectedFileNodeId === node.id;
                    
                    return (
                        <motion.li 
                            key={node.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="relative"
                        >
                            <div 
                                draggable
                                onDragStart={(e) => handleDragStart(e, node)}
                                onDragOver={(e) => handleDragOver(e, node)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, node)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (node.type === 'folder') {
                                        toggleFolder(node.id);
                                    } else {
                                        setSelectedFileNode(node.id);
                                    }
                                }}
                                style={{ paddingLeft: `${level * 12 + 8}px` }}
                                className={cn(
                                    "flex items-center py-1.5 pr-2 rounded-md cursor-pointer select-none transition-colors group",
                                    isSelected ? "bg-blue-500/20 text-blue-100" : "hover:bg-white/5 text-gray-300"
                                )}
                            >
                                <div className="w-5 flex items-center justify-center shrink-0">
                                    {node.type === 'folder' && (
                                        <button className="p-0.5 hover:bg-white/10 rounded">
                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {node.type === 'folder' ? (
                                        <Folder size={16} className={cn(
                                            isExpanded ? "text-blue-400 fill-blue-400/20" : "text-gray-400 fill-gray-400/20"
                                        )} />
                                    ) : (
                                        getFileIcon(node.fileType, "text-gray-400 group-hover:text-gray-300")
                                    )}
                                    <span className="text-sm truncate">{node.name}</span>
                                </div>
                            </div>
                            
                            {node.type === 'folder' && isExpanded && (
                                <div className="mt-1">
                                    <FileTree nodes={nodes} parentId={node.id} level={level + 1} />
                                </div>
                            )}
                        </motion.li>
                    );
                })}
            </AnimatePresence>
        </ul>
    );
}
