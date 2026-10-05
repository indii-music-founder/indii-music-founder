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
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
    bloomIntensity?: number;
    motionVelocity?: number;
    artistName?: string;
    trackTitle?: string;
    coverArtPath?: string;
}

export interface BlenderRenderRequest {
    audioFilePath: string;
    outputVideoPath?: string;
    requestId?: string;
    templateId: BlenderTemplateId;
    bpm?: number;
    durationSeconds?: number;
    fps?: number;
    resolution?: BlenderResolution;
    aspectRatio?: BlenderAspectRatio;
    engine?: BlenderRenderEngine;
    visualTokens?: BlenderVisualTokens;
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

export interface BlenderRenderProgress {
    requestId: string;
    percentage: number;
    message?: string;
}
