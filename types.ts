
export type OperationMode = 'generate' | 'edit' | 'reference' | 'video' | 'remix' | 'canvas' | 'showroom' | 'agent';

export type UploadedImage = {
  id: string;
  base64: string;
  mimeType: string;
  selected: boolean;
  selectionTimestamp: number;
  isAnchor: boolean;
  width: number;
  height: number;
  mask?: string | null;
  motionMask?: string | null;
  projectId?: string;
};

export type Project = { id: string, name: string, context: string };

export type SavedPrompt = {
    id: string;
    text: string;
    title: string;
    date: number;
};

export type CanvasImage = {
    id: string;
    base64: string;
    x: number;
    y: number;
    width: number;
    height: number;
    aspect: number;
    projectId?: string;
};

export type UploadedAudio = {
    id: string;
    base64: string; 
    mimeType: string;
    name: string;
};

export type HistoryItem = { 
    id: string, 
    base64: string,
    prompt: string, 
    timestamp: number, 
    type: 'image' | 'video',
    meta?: string,
    projectId?: string,
    parentId?: string
};

export type AgentMessage = {
    id: string;
    role: 'user' | 'model' | 'system';
    text: string;
    projectId: string;
    timestamp: number;
    attachments?: { mimeType: string, base64: string }[];
}

// Global declarations
declare global {
  interface AIStudio {
    openSelectKey: () => Promise<void>;
    hasSelectedApiKey: () => Promise<boolean>;
  }
  interface Window {
    aistudio?: AIStudio;
    JSZip?: any;
  }
}
