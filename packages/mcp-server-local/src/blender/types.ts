export type BlenderTemplateId =
    | 'audio_reactive_tunnel'
    | 'vinyl_turntable'
    | 'chrome_text'
    | 'spectrum_bars'
    | 'concert_stage';

export type BlenderAspectRatio = '16:9' | '9:16' | '1:1';
export type BlenderResolution = '720p' | '1080p' | '4k';
export type BlenderRenderEngine = 'BLENDER_EEVEE_NEXT' | 'CYCLES' | 'WORKBENCH';

export interface BlenderStatus {
    installed: boolean;
    executablePath: string | null;
    version: string | null;
    supportedEngines: BlenderRenderEngine[];
    gpuAcceleration: 'Metal' | 'CUDA' | 'OptiX' | 'HIP' | 'CPU' | 'None';
    liveConnected: boolean;
    setupInstructions?: string;
}

export interface BlenderVisualTokens {
    primaryColor?: string; // Hex e.g. '#FF0055'
    secondaryColor?: string; // Hex e.g. '#00F0FF'
    backgroundColor?: string; // Hex e.g. '#050510'
    bloomIntensity?: number; // 0.0 - 5.0
    motionVelocity?: number; // Speed multiplier 0.5 - 3.0
    cameraOrbitSpeed?: number;
    artistName?: string;
    trackTitle?: string;
    coverArtPath?: string;
}

export interface BlenderRenderOptions {
    audioFilePath: string;
    outputVideoPath: string;
    templateId: BlenderTemplateId;
    bpm?: number;
    durationSeconds?: number;
    fps?: number; // Default 30 or 60
    resolution?: BlenderResolution; // Default '1080p'
    aspectRatio?: BlenderAspectRatio; // Default '16:9'
    engine?: BlenderRenderEngine; // Default 'BLENDER_EEVEE_NEXT'
    samples?: number; // Render sample count e.g. 64
    visualTokens?: BlenderVisualTokens;
    customScriptPath?: string;
}

export interface BlenderRenderProgress {
    jobId: string;
    status: 'queued' | 'initializing' | 'baking_audio' | 'rendering' | 'completed' | 'failed';
    currentFrame: number;
    totalFrames: number;
    percentage: number;
    elapsedSeconds: number;
    estimatedSecondsRemaining: number;
    message?: string;
}

export interface BlenderTemplateInfo {
    id: BlenderTemplateId;
    name: string;
    description: string;
    recommendedAspectRatio: BlenderAspectRatio;
    defaultDurationSeconds: number;
    supportsCoverArt: boolean;
    supportsCustomText: boolean;
    tags: string[];
}
