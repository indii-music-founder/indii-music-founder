import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '@/services/StorageService';
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
    Loader2,
    Upload,
    Check,
    X
} from 'lucide-react';
import { useStore } from '@/core/store';
import { FileNode } from '@/services/FileSystemService';
import { cn } from '@/lib/utils';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useToast } from '@/core/context/ToastContext';

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
        createFileNode,
        isFileSystemLoading
    } = useStore();

    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    // Rename State
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [uploadTargetId, setUploadTargetId] = useState<string | null>(null); // Folder to upload to

    useEffect(() => {
        if (currentProjectId) {
            fetchFileNodes(currentProjectId);
        }
    }, [currentProjectId, fetchFileNodes]);

    const rootNodes = fileNodes.filter((node: FileNode) => !node.parentId);

    // Helpers
    const getFileTypeFromMime = (mime: string): FileNode['fileType'] => {
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('video/')) return 'video';
        if (mime.startsWith('audio/')) return 'audio';
        return 'document';
    };

    const handleFileUpload = async (files: FileList | null, parentId: string | null = null) => {
        if (!files || files.length === 0 || !currentProjectId || !userProfile?.id) return;

        let uploadedCount = 0;
        const totalFiles = files.length;
        const toastId = toast.loading(`Uploading ${totalFiles} file(s)...`);

        try {
            for (let i = 0; i < totalFiles; i++) {
                const file = files[i];
                const fileType = getFileTypeFromMime(file.type);

                // unique storage path: projects/{projectId}/{userId}/{timestamp}_{filename}
                const timestamp = Date.now();
                // Sanitize filename to avoid path issues
                const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const storagePath = `projects/${currentProjectId}/${userProfile.id}/${timestamp}_${sanitizedName}`;

                try {
                    const downloadUrl = await StorageService.uploadFile(file, storagePath);

                    await createFileNode(
                        file.name,
                        parentId,
                        currentProjectId,
                        userProfile.id,
                        fileType,
                        {
                            url: downloadUrl,
                            storagePath,
                            size: file.size,
                            mimeType: file.type
                        }
                    );
                    uploadedCount++;
                } catch (error) {
                    console.error(`Failed to upload ${file.name}:`, error);
                    toast.error(`Failed to upload ${file.name}`);
                }
            }

            if (uploadedCount > 0) {
                toast.success(`Successfully uploaded ${uploadedCount} file(s)`);
            }
        } catch (error) {
            console.error("Upload process error:", error);
            toast.error("An error occurred during upload");
        } finally {
            toast.dismiss(toastId);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFileUpload(e.target.files, uploadTargetId);
        // Reset input
        if (e.target) e.target.value = '';
        setUploadTargetId(null);
    };

    const triggerUpload = (parentId: string | null) => {
        setUploadTargetId(parentId);
        fileInputRef.current?.click();
    };

    // Recursive renderer
    const renderNode = (node: FileNode, depth: number = 0) => {
        const isExpanded = expandedFolderIds.includes(node.id);
        const isSelected = selectedFileNodeId === node.id;
        const hasChildren = fileNodes.some((n: FileNode) => n.parentId === node.id);
        const children = fileNodes.filter((n: FileNode) => n.parentId === node.id);
        const isEditing = editingNodeId === node.id;

        const handleToggle = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (isEditing) return;
            if (node.type === 'folder') {
                toggleFolder(node.id);
            }
            setSelectedFileNode(node.id);
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
                setDragOverId(node.id);
                e.dataTransfer.dropEffect = 'move'; // Or copy for files
            }
        };

        const handleDragLeave = (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (dragOverId === node.id) {
                setDragOverId(null);
            }
        };

        const handleDrop = async (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverId(null);

            if (node.type !== 'folder') return;

            // Check for Files
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                await handleFileUpload(e.dataTransfer.files, node.id);
                // Expand folder if not expanded
                if (!expandedFolderIds.includes(node.id)) {
                    toggleFolder(node.id);
                }
                return;
            }

            // Check for Nodes
            const draggedId = e.dataTransfer.getData('nodeId');
            if (draggedId && draggedId !== node.id && currentProjectId) {
                moveNode(draggedId, { parentId: node.id }, currentProjectId);
                if (!expandedFolderIds.includes(node.id)) {
                    toggleFolder(node.id);
                }
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
                await createFolder("New Folder", node.id, currentProjectId, userProfile.id);
                if (!expandedFolderIds.includes(node.id)) {
                    toggleFolder(node.id);
                }
            }
        };

        const startRename = (e: Event) => {
            e.preventDefault();
            setEditingNodeId(node.id);
            setEditName(node.name);
        };

        const submitRename = async () => {
            if (editName && editName !== node.name && editName.trim() !== "") {
                await renameNode(node.id, editName.trim());
            }
            setEditingNodeId(null);
        };

        const cancelRename = () => {
            setEditingNodeId(null);
        };

        return (
            <div key={node.id} className="select-none text-xs">
                <div
                    className={cn(
                        "flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-white/5 transition-colors rounded-sm group relative border border-transparent",
                        isSelected && !isEditing && "bg-blue-500/20 hover:bg-blue-500/20 text-blue-200",
                        dragOverId === node.id && "bg-blue-500/10 border-blue-500/50"
                    )}
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                    onClick={handleToggle}
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
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="flex-1 bg-[#111] border border-blue-500/50 rounded px-1 py-0.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                                onKeyDown={e => {
                                    if (e.key === 'Enter') submitRename();
                                    if (e.key === 'Escape') cancelRename();
                                }}
                                onBlur={submitRename}
                            />
                        </div>
                    ) : (
                        <span className="truncate flex-1" onDoubleClick={(e) => { e.stopPropagation(); setEditingNodeId(node.id); setEditName(node.name); }}>
                            {node.name}
                        </span>
                    )}

                    {/* Context Actions */}
                    {!isEditing && (
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
                                        <>
                                            <DropdownMenu.Item
                                                className="text-xs text-gray-300 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer outline-none"
                                                onSelect={handleCreateFolder}
                                            >
                                                <Plus size={12} /> New Folder
                                            </DropdownMenu.Item>
                                            <DropdownMenu.Item
                                                className="text-xs text-gray-300 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer outline-none"
                                                onSelect={(e) => { e.preventDefault(); triggerUpload(node.id); }}
                                            >
                                                <Upload size={12} /> Upload Files
                                            </DropdownMenu.Item>
                                            <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
                                        </>
                                    )}
                                    <DropdownMenu.Item
                                        className="text-xs text-gray-300 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer outline-none"
                                        onSelect={startRename}
                                    >
                                        {/* Placeholder for alignment if no icon */}
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
                    )}
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

    const handleRootDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Handle files dropped on root
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await handleFileUpload(e.dataTransfer.files, null);
            return;
        }

        const draggedId = e.dataTransfer.getData('nodeId');
        if (draggedId && currentProjectId) {
            // Move to root
            // If already at root (parentId is undefined/null), check if it's redundant but moveNode handles it? 
            // Better to check node to avoid unnecessary calls if possible, but store handles update.
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
                        onClick={() => triggerUpload(null)}
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                        title="Upload File"
                    >
                        <Upload size={14} />
                    </button>
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
                        <br />Drag files here to upload.
                    </div>
                ) : (
                    <div className="space-y-0.5 min-h-full pb-10">
                        {rootNodes.map((node: FileNode) => renderNode(node))}
                    </div>
                )}
            </div>

            {/* Hidden Input for Uploads */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                onChange={handleFileInputChange}
            />
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
