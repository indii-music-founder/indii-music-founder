
import { OperationMode, UploadedImage, Project, SavedPrompt, CanvasImage, UploadedAudio, HistoryItem, AgentMessage } from './types';
import { events, APP_EVENTS } from './events';

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
    agentHistory: AgentMessage[];
}

const initialState: AppState = {
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

// Proxy to intercept writes and emit events
export const state = new Proxy<AppState>(initialState, {
    set(target, property, value) {
        // @ts-ignore
        target[property] = value;

        // Emit general state change (for debug/persistence)
        events.emit(APP_EVENTS.STATE_CHANGED, { key: property, value });

        // Specific events for critical state
        if (property === 'currentMode') events.emit(APP_EVENTS.MODE_CHANGED, value);

        return true;
    }
});

// Helper for bulk updates without spamming events (optional, can just assign)
export function setState(newState: Partial<AppState>) {
    Object.assign(state, newState);
}
