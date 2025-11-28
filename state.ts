
import { OperationMode, UploadedImage, Project, SavedPrompt, CanvasImage, UploadedAudio, HistoryItem, AgentMessage } from './types';

interface AppState {
    currentMode: OperationMode;
    lastPromptVideoModeId: string;
    uploadedImages: UploadedImage[];
    remixContent: { base64: string, mimeType: string, width: number, height: number } | null;
    remixStyle: { base64: string, mimeType: string, width: number, height: number } | null;
    showroomAsset: { base64: string, mimeType: string } | null;
    currentMockup: { base64: string, mimeType: string } | null;
    projects: Project[];
    currentProjectId: string;
    savedPrompts: SavedPrompt[];
    canvasImages: CanvasImage[];
    uploadedAudio: UploadedAudio | null;
    currentAnnotationId: string | null;
    isDrawing: boolean;
    currentTool: 'brush' | 'eraser';
    currentBrushColor: string;
    generatedHistory: HistoryItem[];
    currentLightboxIndex: number;
    activeHistoryId: string | null;
    canvasTool: 'pan' | 'generate';
    selectedCanvasImageId: string | null;
    agentHistory: AgentMessage[]; // Item 3: Memory Vault
}

export const state: AppState = {
    currentMode: 'generate',
    lastPromptVideoModeId: 'agent-mode',
    uploadedImages: [],
    remixContent: null,
    remixStyle: null,
    showroomAsset: null,
    currentMockup: null,
    projects: [{ id: 'default', name: 'Default Project', context: '' }],
    currentProjectId: 'default',
    savedPrompts: [],
    canvasImages: [],
    uploadedAudio: null,
    currentAnnotationId: null,
    isDrawing: false,
    currentTool: 'brush',
    currentBrushColor: 'rgba(220, 38, 38, 0.6)',
    generatedHistory: [],
    currentLightboxIndex: 0,
    activeHistoryId: null,
    canvasTool: 'pan',
    selectedCanvasImageId: null,
    agentHistory: []
};
