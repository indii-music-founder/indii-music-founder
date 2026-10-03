import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import { mcpClientService } from '../mcp/MCPClientService';

export interface BlenderStatusResult {
    installed: boolean;
    executablePath: string | null;
    version: string | null;
    supportedEngines: string[];
    gpuAcceleration: string;
    liveConnected: boolean;
    setupInstructions?: string;
}

export interface BlenderRenderRequest {
    audioFilePath: string;
    outputVideoPath: string;
    templateId: string;
    bpm?: number;
    durationSeconds?: number;
    fps?: number;
    resolution?: string;
    aspectRatio?: string;
    engine?: string;
    visualTokens?: Record<string, unknown>;
}

export class BlenderService {
    /**
     * Inspects local Blender installation and capabilities.
     */
    async getStatus(): Promise<BlenderStatusResult> {
        try {
            const mcpResponse = await mcpClientService.executeTool('blender_get_status', {});
            const text = mcpResponse?.content?.[0]?.text;
            if (text) {
                return JSON.parse(text) as BlenderStatusResult;
            }
        } catch (err) {
            log.warn('[BlenderService] MCP status check error, running local fallback detection:', err);
        }

        // Direct fallback detection
        const defaultMacPath = '/Applications/Blender.app/Contents/MacOS/Blender';
        const installed = process.platform === 'darwin' ? fs.existsSync(defaultMacPath) : false;

        return {
            installed,
            executablePath: installed ? defaultMacPath : null,
            version: installed ? 'Blender' : null,
            supportedEngines: installed ? ['BLENDER_EEVEE_NEXT', 'CYCLES'] : [],
            gpuAcceleration: process.arch === 'arm64' ? 'Metal' : 'CPU',
            liveConnected: false,
            setupInstructions: installed ? undefined : 'Install via `brew install --cask blender` on macOS.'
        };
    }

    /**
     * Lists available procedural 3D music video templates.
     */
    async listTemplates(): Promise<unknown[]> {
        try {
            const mcpResponse = await mcpClientService.executeTool('blender_list_templates', {});
            const text = mcpResponse?.content?.[0]?.text;
            if (text) {
                return JSON.parse(text) as unknown[];
            }
        } catch (err) {
            log.warn('[BlenderService] MCP list templates error:', err);
        }
        return [];
    }

    /**
     * Executes a headless music video render.
     */
    async renderMusicVideo(
        request: BlenderRenderRequest,
        _onProgress?: (progress: unknown) => void
    ): Promise<{ success: boolean; outputPath: string; error?: string }> {
        log.info('[BlenderService] Initiating headless render:', request);

        // Security check on paths
        const audioPath = path.resolve(request.audioFilePath);
        const outputPath = path.resolve(request.outputVideoPath);

        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file does not exist: ${audioPath}`);
        }

        try {
            const result = await mcpClientService.executeTool('blender_render_music_video', {
                ...request,
                audioFilePath: audioPath,
                outputVideoPath: outputPath
            });

            const text = result?.content?.[0]?.text;
            if (text) {
                return JSON.parse(text);
            }
            return { success: !result?.isError, outputPath };
        } catch (error) {
            log.error('[BlenderService] Render execution failed:', error);
            return {
                success: false,
                outputPath,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Sends a command to the live interactive Blender addon.
     */
    async sendLiveCommand(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
        try {
            const result = await mcpClientService.executeTool('blender_live_command', { action, params });
            const text = result?.content?.[0]?.text;
            if (text) {
                return JSON.parse(text);
            }
            return result;
        } catch (error) {
            log.error('[BlenderService] Live command error:', error);
            throw error;
        }
    }
}

export const blenderService = new BlenderService();
