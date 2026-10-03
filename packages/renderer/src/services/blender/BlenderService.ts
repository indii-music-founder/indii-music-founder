import { logger } from '@/utils/logger';
import { mcpClientService } from '@/services/agent/harness/McpClientService';
import type {
    BlenderStatus,
    BlenderRenderRequest,
    BlenderTemplateInfo
} from './types';

export const FALLBACK_TEMPLATES: BlenderTemplateInfo[] = [
    {
        id: 'audio_reactive_tunnel',
        name: 'Audio-Reactive Cyber Tunnel',
        description: 'Infinite geometric warp tunnel flying forward synced to song BPM. Neon rings and walls pulse with sub-bass.',
        recommendedAspectRatio: '16:9',
        defaultDurationSeconds: 30,
        supportsCoverArt: false,
        supportsCustomText: true,
        tags: ['cyberpunk', 'neon', 'electronic', 'visualizer']
    },
    {
        id: 'vinyl_turntable',
        name: '3D Vinyl Record Turntable Showcase',
        description: 'Photorealistic spinning 12" vinyl record on an audiophile turntable with the artist album art on the center label.',
        recommendedAspectRatio: '16:9',
        defaultDurationSeconds: 30,
        supportsCoverArt: true,
        supportsCustomText: true,
        tags: ['vinyl', 'turntable', 'album-art', 'photorealistic']
    },
    {
        id: 'chrome_text',
        name: '3D Liquid Chrome & Metallic Typography',
        description: 'Extruded high-gloss liquid chrome 3D typography of artist name and song title floating in zero-gravity.',
        recommendedAspectRatio: '9:16',
        defaultDurationSeconds: 15,
        supportsCoverArt: false,
        supportsCustomText: true,
        tags: ['chrome', 'typography', 'shorts', 'tiktok', 'canvas']
    },
    {
        id: 'spectrum_bars',
        name: '3D Circular Audio Spectrum Waveform',
        description: 'Circular 3D geometric equalizer bars undulating around a central pulsating orb, directly mapped to audio frequency bins.',
        recommendedAspectRatio: '1:1',
        defaultDurationSeconds: 30,
        supportsCoverArt: true,
        supportsCustomText: false,
        tags: ['equalizer', 'spectrum', 'audio-reactive', 'square']
    },
    {
        id: 'concert_stage',
        name: 'Virtual Concert Stage & Moving-Head Spotlights',
        description: '3D concert arena stage with robotic moving-head beams, laser sweeps, and LED video backdrop reacting to audio energy.',
        recommendedAspectRatio: '16:9',
        defaultDurationSeconds: 30,
        supportsCoverArt: true,
        supportsCustomText: true,
        tags: ['concert', 'stage', 'spotlights', 'arena', 'lighting']
    }
];

interface McpToolResult {
    content?: Array<{ type?: string; text?: string }>;
    isError?: boolean;
}

class FrontendBlenderService {
    /**
     * Inspects Blender installation and execution capabilities.
     */
    async getStatus(): Promise<BlenderStatus> {
        // 1. Check Electron Desktop bridge
        if (typeof window !== 'undefined' && window.electronAPI?.blender?.getStatus) {
            try {
                return await window.electronAPI.blender.getStatus();
            } catch (err) {
                logger.warn('[FrontendBlenderService] Electron getStatus error:', err);
            }
        }

        // 2. Fall back to MCP Client service
        try {
            const result = (await mcpClientService.executeTool('blender_get_status', {})) as McpToolResult;
            const text = result?.content?.[0]?.text;
            if (text) {
                return JSON.parse(text) as BlenderStatus;
            }
        } catch (err) {
            logger.debug('[FrontendBlenderService] MCP status check unavailable:', err);
        }

        // 3. Fallback when running on web without desktop/MCP bridge
        return {
            installed: false,
            executablePath: null,
            version: null,
            supportedEngines: [],
            gpuAcceleration: 'None',
            liveConnected: false,
            setupInstructions: 'Blender 3D video generation requires the indii desktop studio app or local MCP runner.'
        };
    }

    /**
     * Retrieves the list of available 3D procedural music video templates.
     */
    async listTemplates(): Promise<BlenderTemplateInfo[]> {
        if (typeof window !== 'undefined' && window.electronAPI?.blender?.listTemplates) {
            try {
                const list = await window.electronAPI.blender.listTemplates();
                if (Array.isArray(list) && list.length > 0) return list;
            } catch (err) {
                logger.warn('[FrontendBlenderService] Electron listTemplates error:', err);
            }
        }

        try {
            const result = (await mcpClientService.executeTool('blender_list_templates', {})) as McpToolResult;
            const text = result?.content?.[0]?.text;
            if (text) {
                return JSON.parse(text) as BlenderTemplateInfo[];
            }
        } catch {
            // Use static fallback list
        }

        return FALLBACK_TEMPLATES;
    }

    /**
     * Initiates a headless Blender render of a 3D music video.
     */
    async renderMusicVideo(
        request: BlenderRenderRequest
    ): Promise<{ success: boolean; outputPath: string; error?: string }> {
        logger.info('[FrontendBlenderService] Initiating 3D render:', request);

        if (typeof window !== 'undefined' && window.electronAPI?.blender?.renderMusicVideo) {
            return await window.electronAPI.blender.renderMusicVideo(request);
        }

        try {
            const payload = request as unknown as Record<string, unknown>;
            const result = (await mcpClientService.executeTool('blender_render_music_video', payload)) as McpToolResult;
            const text = result?.content?.[0]?.text;
            if (text) {
                return JSON.parse(text);
            }
            return { success: !result?.isError, outputPath: request.outputVideoPath };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { success: false, outputPath: request.outputVideoPath, error: msg };
        }
    }

    /**
     * Sends an action to the live interactive Blender session.
     */
    async sendLiveCommand(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
        if (typeof window !== 'undefined' && window.electronAPI?.blender?.sendLiveCommand) {
            return await window.electronAPI.blender.sendLiveCommand(action, params);
        }

        return await mcpClientService.executeTool('blender_live_command', { action, params });
    }
}

export const blenderService = new FrontendBlenderService();
