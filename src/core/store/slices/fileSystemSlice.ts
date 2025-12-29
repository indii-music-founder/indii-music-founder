import { StateCreator } from 'zustand';
import { StoreState } from '..';
import { FileNode, fileSystemService } from '@/services/FileSystemService';

export interface FileSystemSlice {
    fileNodes: FileNode[];
    selectedFileNodeId: string | null;
    expandedFolderIds: string[];
    isFileSystemLoading: boolean;
    fileSystemError: string | null;
    draggingFileNodeId: string | null;

    // Actions
    fetchFileNodes: (projectId: string) => Promise<void>;
    createFolder: (name: string, parentId: string | null, projectId: string, userId: string) => Promise<void>;
    createFileNode: (name: string, parentId: string | null, projectId: string, userId: string, fileType: FileNode['fileType'], data?: any) => Promise<void>;
    moveNode: (nodeId: string, transform: { parentId: string | null; newIndex?: number }, projectId: string) => Promise<void>;
    renameNode: (nodeId: string, newName: string) => Promise<void>;
    deleteNode: (nodeId: string) => Promise<void>;

    // UI State Actions
    setSelectedFileNode: (nodeId: string | null) => void;
    toggleFolder: (folderId: string) => void;
    setDraggingFileNode: (nodeId: string | null) => void;
}

export const createFileSystemSlice: StateCreator<StoreState, [], [], FileSystemSlice> = (set, get) => ({
    fileNodes: [],
    selectedFileNodeId: null,
    expandedFolderIds: [],
    isFileSystemLoading: false,
    fileSystemError: null,
    draggingFileNodeId: null,

    fetchFileNodes: async (projectId: string) => {
        set({ isFileSystemLoading: true, fileSystemError: null });
        try {
            const nodes = await fileSystemService.getProjectNodes(projectId);
            set({ fileNodes: nodes });
        } catch (error: any) {
            set({ fileSystemError: error.message });
            console.error('Error fetching file nodes:', error);
        } finally {
            set({ isFileSystemLoading: false });
        }
    },

    createFolder: async (name, parentId, projectId, userId) => {
        try {
            const newNode = await fileSystemService.createNode({
                name,
                type: 'folder',
                parentId,
                projectId,
                userId
            });
            set((state: StoreState) => ({
                fileNodes: [...state.fileNodes, newNode],
                expandedFolderIds: [...state.expandedFolderIds, newNode.id]
            }));
        } catch (error: any) {
            set({ fileSystemError: error.message });
            console.error('Error creating folder:', error);
        }
    },

    createFileNode: async (name, parentId, projectId, userId, fileType, data) => {
        try {
            const newNode = await fileSystemService.createNode({
                name,
                type: 'file',
                fileType,
                parentId,
                projectId,
                userId,
                data
            });
            set((state: StoreState) => ({
                fileNodes: [...state.fileNodes, newNode],
                selectedFileNodeId: newNode.id
            }));
        } catch (error: any) {
            set({ fileSystemError: error.message });
            console.error('Error creating file:', error);
        }
    },

    moveNode: async (nodeId, transform, projectId) => {
        // Optimistic update
        const previousNodes = get().fileNodes;
        set((state: StoreState) => ({
            fileNodes: state.fileNodes.map((node: FileNode) =>
                node.id === nodeId
                    ? { ...node, parentId: transform.parentId }
                    : node
            )
        }));

        try {
            await fileSystemService.updateNode(nodeId, { parentId: transform.parentId });
            const nodes = await fileSystemService.getProjectNodes(projectId);
            set({ fileNodes: nodes });
        } catch (error: any) {
            // Revert on error
            set({ fileNodes: previousNodes, fileSystemError: error.message });
            console.error('Error moving node:', error);
        }
    },

    renameNode: async (nodeId, newName) => {
        // Optimistic
        const previousNodes = get().fileNodes;
        set((state: StoreState) => ({
            fileNodes: state.fileNodes.map((n: FileNode) => n.id === nodeId ? { ...n, name: newName } : n)
        }));

        try {
            await fileSystemService.updateNode(nodeId, { name: newName });
        } catch (error: any) {
            set({ fileNodes: previousNodes, fileSystemError: error.message });
            console.error('Error renaming node:', error);
        }
    },

    deleteNode: async (nodeId) => {
        // Optimistic
        const previousNodes = get().fileNodes;
        const nodesToDelete = [nodeId];

        // Basic recursive finding of children to remove from UI immediately
        const findChildren = (id: string) => {
            previousNodes.forEach((n: FileNode) => {
                if (n.parentId === id) {
                    nodesToDelete.push(n.id);
                    findChildren(n.id);
                }
            });
        };
        findChildren(nodeId);

        set((state: StoreState) => ({
            fileNodes: state.fileNodes.filter((n: FileNode) => !nodesToDelete.includes(n.id)),
            selectedFileNodeId: state.selectedFileNodeId === nodeId ? null : state.selectedFileNodeId
        }));

        try {
            await fileSystemService.deleteNode(nodeId);
            await fileSystemService.deleteFolderRecursive(nodeId, previousNodes);
        } catch (error: any) {
            set({ fileNodes: previousNodes, fileSystemError: error.message });
            console.error('Error deleting node:', error);
        }
    },

    setSelectedFileNode: (nodeId) => set({ selectedFileNodeId: nodeId }),

    toggleFolder: (folderId) => set((state: StoreState) => {
        const isExpanded = state.expandedFolderIds.includes(folderId);
        return {
            expandedFolderIds: isExpanded
                ? state.expandedFolderIds.filter((id: string) => id !== folderId)
                : [...state.expandedFolderIds, folderId]
        };
    }),

    setDraggingFileNode: (nodeId) => set({ draggingFileNodeId: nodeId })
});
