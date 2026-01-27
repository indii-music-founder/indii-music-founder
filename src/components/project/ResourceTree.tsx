import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StorageService } from '@/services/StorageService';
import {
    Plus,
    Loader2,
    Upload
} from 'lucide-react';
import { useStore } from '@/core/store';
import { FileNode } from '@/services/FileSystemService';
import { cn } from '@/lib/utils';
import { useToast } from '@/core/context/ToastContext';
import { FileTreeNode } from './FileTreeNode';

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
    const [uploadTargetId, setUploadTargetId] = useState<string | null>(null); // Folder to upload to

    useEffect(() => {
        if (currentProjectId) {
            fetchFileNodes(currentProjectId);
        }
    }, [currentProjectId, fetchFileNodes]);

    // Optimization: Pre-calculate children map to avoid O(N^2) filtering in renderNode
    const { rootNodes, nodeChildrenMap } = useMemo(() => {
        const map = new Map<string, FileNode[]>();
        const roots: FileNode[] = [];

        fileNodes.forEach((node: FileNode) => {
            if (node.parentId) {
                if (!map.has(node.parentId)) {
                    map.set(node.parentId, []);
                }
                map.get(node.parentId)!.push(node);
            } else {
                roots.push(node);
            }
        });

        return { rootNodes: roots, nodeChildrenMap: map };
    }, [fileNodes]);

    // Helpers
    const getFileTypeFromMime = useCallback((mime: string): FileNode['fileType'] => {
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('video/')) return 'video';
        if (mime.startsWith('audio/')) return 'audio';
        return 'document';
    }, []);

    const handleFileUpload = useCallback(async (files: FileList | null, parentId: string | null = null) => {
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
    }, [currentProjectId, userProfile, toast, getFileTypeFromMime, createFileNode]);

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        handleFileUpload(e.target.files, uploadTargetId);
        // Reset input
        if (e.target) e.target.value = '';
        setUploadTargetId(null);
    }, [handleFileUpload, uploadTargetId]);

    const triggerUpload = useCallback((parentId: string | null) => {
        setUploadTargetId(parentId);
        fileInputRef.current?.click();
    }, []);

    const handleRootDrop = useCallback(async (e: React.DragEvent) => {
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
            moveNode(draggedId, { parentId: null }, currentProjectId);
        }
    }, [handleFileUpload, currentProjectId, moveNode]);

    const handleCreateRootFolder = useCallback(() => {
        if (currentProjectId && userProfile?.id) {
            createFolder('New Folder', null, currentProjectId, userProfile.id);
        }
    }, [currentProjectId, userProfile, createFolder]);

    // Callback Wrappers
    const handleToggle = useCallback((id: string) => toggleFolder(id), [toggleFolder]);
    const handleSelect = useCallback((id: string) => setSelectedFileNode(id), [setSelectedFileNode]);

    const handleRenameStart = useCallback((id: string) => {
        setEditingNodeId(id);
    }, []);

    const handleRenameSubmit = useCallback(async (id: string, newName: string) => {
        if (newName && newName.trim() !== "") {
            // Store's renameNode typically makes an API call, it's safe to call.
             await renameNode(id, newName.trim());
        }
        setEditingNodeId(null);
    }, [renameNode]);

    const handleRenameCancel = useCallback(() => {
        setEditingNodeId(null);
    }, []);

    const handleDelete = useCallback(async (node: FileNode) => {
        if (window.confirm(`Are you sure you want to delete ${node.name}?`)) {
            await deleteNode(node.id);
        }
    }, [deleteNode]);

    const handleCreateFolder = useCallback(async (node: FileNode) => {
        if (currentProjectId && userProfile?.id) {
            await createFolder("New Folder", node.id, currentProjectId, userProfile.id);
            if (!expandedFolderIds.includes(node.id)) {
                toggleFolder(node.id);
            }
        }
    }, [currentProjectId, userProfile, createFolder, expandedFolderIds, toggleFolder]);

    const handleMoveNode = useCallback((draggedId: string, targetId: string) => {
        if (currentProjectId) {
            moveNode(draggedId, { parentId: targetId }, currentProjectId);
        }
    }, [currentProjectId, moveNode]);

    const handleDragOverChange = useCallback((id: string | null) => {
        setDragOverId(id);
    }, []);

    const handleChildFileUpload = useCallback((files: FileList, parentId: string) => {
        handleFileUpload(files, parentId);
    }, [handleFileUpload]);


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
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                        title="Upload File"
                        aria-label="Upload File"
                    >
                        <Upload size={14} />
                    </button>
                    <button
                        onClick={handleCreateRootFolder}
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                        title="New Folder"
                        aria-label="New Folder"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            <div
                className="flex-1 overflow-y-auto custom-scrollbar"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleRootDrop}
                role="tree"
            >
                {rootNodes.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 text-xs">
                        No resources in this project.
                        <br />Drag files here to upload.
                    </div>
                ) : (
                    <div className="space-y-0.5 min-h-full pb-10">
                        {rootNodes.map((node: FileNode) => (
                            <FileTreeNode
                                key={node.id}
                                node={node}
                                nodeChildrenMap={nodeChildrenMap}
                                expandedFolderIds={expandedFolderIds}
                                selectedFileNodeId={selectedFileNodeId}
                                editingNodeId={editingNodeId}
                                dragOverId={dragOverId}
                                onToggle={handleToggle}
                                onSelect={handleSelect}
                                onRenameSubmit={handleRenameSubmit}
                                onRenameStart={handleRenameStart}
                                onRenameCancel={handleRenameCancel}
                                onDelete={handleDelete}
                                onCreateFolder={handleCreateFolder}
                                onUploadTrigger={triggerUpload}
                                onMoveNode={handleMoveNode}
                                onFileUpload={handleChildFileUpload}
                                onDragOverChange={handleDragOverChange}
                            />
                        ))}
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
                aria-label="Upload files"
            />
        </div>
    );
};
