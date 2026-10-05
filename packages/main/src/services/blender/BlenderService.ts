import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { randomUUID } from 'crypto';
import { accessControlService } from '../../security/AccessControlService';
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';
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
    outputVideoPath?: string;
    requestId?: string;
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
            await mcpClientService.connectLocal();
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
            gpuAcceleration: 'None',
            liveConnected: false,
            setupInstructions: installed ? undefined : 'Install via `brew install --cask blender` on macOS.'
        };
    }

    /**
     * Lists available procedural 3D music video templates.
     */
    async listTemplates(): Promise<unknown[]> {
        try {
            await mcpClientService.connectLocal();
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
        onProgress?: RequestOptions['onprogress'],
        signal?: AbortSignal
    ): Promise<{ success: boolean; outputPath: string; error?: string }> {
        log.info('[BlenderService] Initiating headless render:', request);

        // Security check on paths
        const audioPath = path.resolve(request.audioFilePath);
        const defaultDirectory = path.join(app.getPath('userData'), 'blender-renders');
        fs.mkdirSync(defaultDirectory, { recursive: true });
        const outputPath = request.outputVideoPath ? path.resolve(request.outputVideoPath)
            : path.join(defaultDirectory, `${randomUUID()}.mp4`);
        if (!accessControlService.verifyAccess(audioPath)) throw new Error('Select an authorized audio file before rendering.');
        if (!accessControlService.verifyWriteTargetDirectory(outputPath)) throw new Error('Choose an authorized output folder.');
        if (fs.existsSync(outputPath)) throw new Error('Choose a new output filename; existing files will not be overwritten.');
        const coverArt = request.visualTokens?.coverArtPath;
        if (typeof coverArt === 'string' && coverArt && !accessControlService.verifyAccess(coverArt)) {
            throw new Error('Select an authorized cover image before rendering.');
        }

        if (!['.wav', '.mp3', '.flac', '.m4a', '.aiff', '.aif', '.ogg'].includes(path.extname(audioPath).toLowerCase())) {
            throw new Error('Choose a supported music file.');
        }
        if (path.extname(outputPath).toLowerCase() !== '.mp4') throw new Error('Blender output must be an MP4 video.');
        if (typeof coverArt === 'string' && coverArt && (!['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(coverArt).toLowerCase())
            || !fs.statSync(coverArt).isFile())) throw new Error('Choose a supported cover image.');
        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file does not exist: ${audioPath}`);
        }

        if (!fs.statSync(audioPath).isFile()) throw new Error('The selected music source is not a file.');

        try {
            await mcpClientService.connectLocal();
            const result = await mcpClientService.executeTool('blender_render_music_video', {
                ...request,
                audioFilePath: audioPath,
                outputVideoPath: outputPath
            }, { onprogress: onProgress || (() => {}), signal, timeout: 300000,
                resetTimeoutOnProgress: true, maxTotalTimeout: 2 * 60 * 60 * 1000 });

            const text = result?.content?.[0]?.text;
            if (text) {
                return JSON.parse(text);
            }
            return { success: false, outputPath, error: 'Blender did not return a verified render result.' };
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
            await mcpClientService.connectLocal();
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
