import React, { useState, useEffect } from 'react';
import {
    Folder,
    File,
    ChevronRight,
    ChevronDown,
    MoreVertical,
    FileText,
    Image as ImageIcon,
    Music,
    Video,
    Plus,
    Loader2
} from 'lucide-react';
import { useStore } from '@/core/store';
import { FileNode } from '@/services/FileSystemService';
import { cn } from '@/lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface ResourceTreeProps {
    className?: string;
}

export const ResourceTree: React.FC<ResourceTreeProps> = ({ className }) => {
    const {
        currentProjectId,
        userProfile,
        fileNodes,
        fetchFileNodes,
        expandedFolderIds,
        toggleFolder,
        selectedFileNodeId,
        setSelectedFileNode,
        createFolder,
        deleteNode,
        moveNode,
        renameNode,
        isFileSystemLoading
    } = useStore();

    const [dragOverId, setDragOverId] = useState<string | null>(null);

    useEffect(() => {
        if (currentProjectId) {
            fetchFileNodes(currentProjectId);
        }
    }, [currentProjectId, fetchFileNodes]);

    const rootNodes = fileNodes.filter((node: FileNode) => !node.parentId);

    // Simple recursive renderer
    const renderNode = (node: FileNode, depth: number = 0) => {
        const isExpanded = expandedFolderIds.includes(node.id);
        const isSelected = selectedFileNodeId === node.id;
        const hasChildren = fileNodes.some((n: FileNode) => n.parentId === node.id);
        const children = fileNodes.filter((n: FileNode) => n.parentId === node.id);

        const handleToggle = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (node.type === 'folder') {
                toggleFolder(node.id);
            }
            setSelectedFileNode(node.id);
        };

        const handleDragStart = (e: React.DragEvent) => {
            e.stopPropagation();
            e.dataTransfer.setData('nodeId', node.id);
            e.dataTransfer.effectAllowed = 'move';
        };

        const handleDragOver = (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (node.type === 'folder' && node.id !== e.dataTransfer.getData('nodeId')) {
                setDragOverId(node.id);
                e.dataTransfer.dropEffect = 'move';
            }
        };

        const handleDragLeave = (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (dragOverId === node.id) {
                setDragOverId(null);
            }
        };

        const handleDrop = (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const draggedId = e.dataTransfer.getData('nodeId');
            setDragOverId(null);

            if (draggedId && draggedId !== node.id && node.type === 'folder' && currentProjectId) {
                // Prevent dropping into self or children (simple check)
                moveNode(draggedId, { parentId: node.id }, currentProjectId);
            }
        };

        const handleDelete = async (e: Event) => {
            e.preventDefault();
            if (window.confirm(`Are you sure you want to delete ${node.name}?`)) {
                await deleteNode(node.id);
            }
        };

        const handleCreateFolder = async (e: Event) => {
            e.preventDefault();
            if (currentProjectId && userProfile?.id) {
                // Create folder INSIDE the current node
                await createFolder("New Folder", node.id, currentProjectId, userProfile.id);
                if (!expandedFolderIds.includes(node.id)) {
                    toggleFolder(node.id);
                }
            }
        };

        const handleRename = async (e: Event) => {
            e.preventDefault();
            const newName = window.prompt("Enter new name:", node.name);
            if (newName && newName !== node.name) {
                await renameNode(node.id, newName);
            }
        };

        return (
            <div key={node.id} className="select-none">
                <div
                    className={cn(
                        "flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-white/5 transition-colors rounded-sm group relative border border-transparent",
                        isSelected && "bg-blue-500/20 hover:bg-blue-500/20 text-blue-200",
                        dragOverId === node.id && "bg-blue-500/10 border-blue-500/50"
                    )}
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                    onClick={handleToggle}
                    draggable
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <span className="opacity-70 hover:opacity-100 p-0.5">
                        {node.type === 'folder' && (
                            hasChildren || children.length === 0 ? (
                                <ChevronRight
                                    size={12}
                                    className={cn("transition-transform", isExpanded && "rotate-90")}
                                />
                            ) : <div className="w-3" />
                        )}
                        {node.type === 'file' && <div className="w-3" />}
                    </span>

                    <span className={cn("text-blue-400", node.type === 'file' && getFileIconColor(node.fileType))}>
                        {node.type === 'folder' ? (
                            isExpanded ? <Folder size={14} className="fill-blue-400/20" /> : <Folder size={14} />
                        ) : (
                            getFileIcon(node.fileType)
                        )}
                    </span>

                    <span className="text-xs truncate flex-1">{node.name}</span>

                    {/* Context Actions */}
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MoreVertical size={12} />
                            </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content className="min-w-[160px] bg-[#1c1c1c] border border-white/10 rounded-md shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                {node.type === 'folder' && (
                                    <DropdownMenu.Item
                                        className="text-xs text-gray-300 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer outline-none"
                                        onSelect={handleCreateFolder}
                                    >
                                        <Plus size={12} /> New Folder
                                    </DropdownMenu.Item>
                                )}
                                <DropdownMenu.Item
                                    className="text-xs text-gray-300 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer outline-none"
                                    onSelect={handleRename}
                                >
                                    <div className="w-3" /> Rename
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                    className="text-xs text-red-400 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer outline-none"
                                    onSelect={handleDelete}
                                >
                                    <div className="w-3" /> Delete
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                </div>

                {isExpanded && node.type === 'folder' && (
                    <div className="flex flex-col">
                        {children.length > 0 ? (
                            children.map((child: FileNode) => renderNode(child, depth + 1))
                        ) : (
                            <div
                                className="text-[10px] text-gray-500 py-1 pl-[calc(1rem+12px)] italic"
                                style={{ paddingLeft: `${(depth + 1) * 12 + 24}px` }}
                            >
                                Empty
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const handleRootDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData('nodeId');

        if (draggedId && currentProjectId) {
            // Move to root
            moveNode(draggedId, { parentId: null }, currentProjectId);
        }
    };

    const handleCreateRootFolder = () => {
        if (currentProjectId && userProfile?.id) {
            createFolder('New Folder', null, currentProjectId, userProfile.id);
        }
    };

    if (!currentProjectId) {
        return (
            <div className={cn("flex flex-col items-center justify-center h-full text-gray-500", className)}>
                <div className="text-xs">No project selected</div>
            </div>
        )
    }

    if (isFileSystemLoading && fileNodes.length === 0) {
        return (
            <div className={cn("flex items-center justify-center h-40", className)}>
                <Loader2 className="animate-spin text-gray-500" size={16} />
            </div>
        )
    }

    return (
        <div className={cn("flex flex-col h-full", className)}>
            <div className="flex items-center justify-between p-2 mb-2 border-b border-white/5">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Resources</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleCreateRootFolder}
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                        title="New Folder"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            <div
                className="flex-1 overflow-y-auto custom-scrollbar"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleRootDrop}
            >
                {rootNodes.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 text-xs">
                        No resources in this project.
                    </div>
                ) : (
                    <div className="space-y-0.5 min-h-full pb-10">
                        {rootNodes.map((node: FileNode) => renderNode(node))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Helpers
function getFileIcon(type?: FileNode['fileType']) {
    switch (type) {
        case 'image': return <ImageIcon size={14} />;
        case 'audio': return <Music size={14} />;
        case 'video': return <Video size={14} />;
        case 'document': return <FileText size={14} />;
        default: return <File size={14} />;
    }
}

function getFileIconColor(type?: FileNode['fileType']) {
    switch (type) {
        case 'image': return 'text-purple-400';
        case 'audio': return 'text-pink-400';
        case 'video': return 'text-blue-400';
        case 'document': return 'text-yellow-400';
        default: return 'text-gray-400';
    }
}
