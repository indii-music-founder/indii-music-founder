import React, { useState, memo } from 'react';
import {
    Folder,
    File,
    ChevronRight,
    MoreVertical,
    FileText,
    Image as ImageIcon,
    Music,
    Video,
    Plus,
    Upload
} from 'lucide-react';
import { FileNode } from '@/services/FileSystemService';
import { cn } from '@/lib/utils';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

// Reusing helper functions
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

interface FileTreeNodeProps {
    node: FileNode;
    depth?: number;
    nodeChildrenMap: Map<string, FileNode[]>;
    expandedFolderIds: string[];
    selectedFileNodeId: string | null;
    editingNodeId: string | null;
    dragOverId: string | null;

    // Callbacks
    onToggle: (id: string) => void;
    onSelect: (id: string) => void;
    onRenameSubmit: (id: string, newName: string) => void;
    onRenameStart: (id: string, currentName: string) => void;
    onRenameCancel: () => void;
    onDelete: (node: FileNode) => void;
    onCreateFolder: (node: FileNode) => void;
    onUploadTrigger: (parentId: string | null) => void;
    onMoveNode: (draggedId: string, targetId: string) => void;
    onFileUpload: (files: FileList, parentId: string) => void;
    onDragOverChange: (id: string | null) => void;
}

export const FileTreeNode = memo(({
    node,
    depth = 0,
    nodeChildrenMap,
    expandedFolderIds,
    selectedFileNodeId,
    editingNodeId,
    dragOverId,
    onToggle,
    onSelect,
    onRenameSubmit,
    onRenameStart,
    onRenameCancel,
    onDelete,
    onCreateFolder,
    onUploadTrigger,
    onMoveNode,
    onFileUpload,
    onDragOverChange
}: FileTreeNodeProps) => {
    const isExpanded = expandedFolderIds.includes(node.id);
    const isSelected = selectedFileNodeId === node.id;
    const isEditing = editingNodeId === node.id;
    const isDragOver = dragOverId === node.id;

    const children = nodeChildrenMap.get(node.id) || [];
    const hasChildren = children.length > 0;

    // Local state for rename input to prevent tree re-renders
    const [localEditName, setLocalEditName] = useState(node.name);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isEditing) return;
        if (node.type === 'folder') {
            onToggle(node.id);
        }
        onSelect(node.id);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isEditing) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (node.type === 'folder') {
                onToggle(node.id);
            }
            onSelect(node.id);
        }
    };

    const handleDragStart = (e: React.DragEvent) => {
        if (isEditing) {
            e.preventDefault();
            return;
        }
        e.stopPropagation();
        e.dataTransfer.setData('nodeId', node.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (node.type === 'folder') {
            if (dragOverId !== node.id) {
                onDragOverChange(node.id);
            }
            e.dataTransfer.dropEffect = 'move';
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragOverId === node.id) {
            onDragOverChange(null);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onDragOverChange(null);

        if (node.type !== 'folder') return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileUpload(e.dataTransfer.files, node.id);
            if (!expandedFolderIds.includes(node.id)) {
                onToggle(node.id);
            }
            return;
        }

        const draggedId = e.dataTransfer.getData('nodeId');
        if (draggedId && draggedId !== node.id) {
            onMoveNode(draggedId, node.id);
            if (!expandedFolderIds.includes(node.id)) {
                onToggle(node.id);
            }
        }
    };

    const submitRename = () => {
        onRenameSubmit(node.id, localEditName);
    };

    return (
        <div className="select-none text-xs">
            <div
                role="treeitem"
                aria-expanded={node.type === 'folder' ? isExpanded : undefined}
                aria-selected={isSelected}
                aria-label={node.name}
                tabIndex={0}
                className={cn(
                    "flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-white/5 transition-colors rounded-sm group relative border border-transparent outline-none focus-visible:ring-1 focus-visible:ring-blue-500",
                    isSelected && !isEditing && "bg-blue-500/20 hover:bg-blue-500/20 text-blue-200",
                    isDragOver && "bg-blue-500/10 border-blue-500/50"
                )}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={handleToggle}
                onKeyDown={handleKeyDown}
                draggable={!isEditing}
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

                {isEditing ? (
                    <div className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <input
                            type="text"
                            value={localEditName}
                            onChange={e => setLocalEditName(e.target.value)}
                            className="flex-1 bg-[#111] border border-blue-500/50 rounded px-1 py-0.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                            onKeyDown={e => {
                                if (e.key === 'Enter') submitRename();
                                if (e.key === 'Escape') onRenameCancel();
                            }}
                            onBlur={submitRename}
                        />
                    </div>
                ) : (
                    <span
                        className="truncate flex-1"
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            setLocalEditName(node.name);
                            onRenameStart(node.id, node.name);
                        }}
                    >
                        {node.name}
                    </span>
                )}

                {!isEditing && (
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Options for ${node.name}`}
                            >
                                <MoreVertical size={12} />
                            </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content className="min-w-[160px] bg-[#1c1c1c] border border-white/10 rounded-md shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                {node.type === 'folder' && (
                                    <>
                                        <DropdownMenu.Item
                                            className="text-xs text-gray-300 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer outline-none"
                                            onSelect={(e) => { e.preventDefault(); onCreateFolder(node); }}
                                        >
                                            <Plus size={12} /> New Folder
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            className="text-xs text-gray-300 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer outline-none"
                                            onSelect={(e) => { e.preventDefault(); onUploadTrigger(node.id); }}
                                        >
                                            <Upload size={12} /> Upload Files
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
                                    </>
                                )}
                                <DropdownMenu.Item
                                    className="text-xs text-gray-300 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer outline-none"
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        setLocalEditName(node.name);
                                        onRenameStart(node.id, node.name);
                                    }}
                                >
                                    <div className="w-3" /> Rename
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                    className="text-xs text-red-400 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer outline-none"
                                    onSelect={(e) => { e.preventDefault(); onDelete(node); }}
                                >
                                    <div className="w-3" /> Delete
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                )}
            </div>

            {isExpanded && node.type === 'folder' && (
                <div role="group" className="flex flex-col">
                    {children.length > 0 ? (
                        children.map((child: FileNode) => (
                            <FileTreeNode
                                key={child.id}
                                node={child}
                                depth={depth + 1}
                                nodeChildrenMap={nodeChildrenMap}
                                expandedFolderIds={expandedFolderIds}
                                selectedFileNodeId={selectedFileNodeId}
                                editingNodeId={editingNodeId}
                                dragOverId={dragOverId}
                                onToggle={onToggle}
                                onSelect={onSelect}
                                onRenameSubmit={onRenameSubmit}
                                onRenameStart={onRenameStart}
                                onRenameCancel={onRenameCancel}
                                onDelete={onDelete}
                                onCreateFolder={onCreateFolder}
                                onUploadTrigger={onUploadTrigger}
                                onMoveNode={onMoveNode}
                                onFileUpload={onFileUpload}
                                onDragOverChange={onDragOverChange}
                            />
                        ))
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
});

FileTreeNode.displayName = 'FileTreeNode';
