/**
 * PlatformBridgeService
 *
 * Provides a clean cross-platform abstraction layer that decouples UI components,
 * custom hooks, and state logic from the Electron IPC bridge (`window.electronAPI`).
 *
 * In Electron: Delegates directly to the IPC bridge.
 * In Web Browser: Provides web-standard fallbacks (e.g. localStorage/IndexedDB, graceful degradations)
 * without crashing or leaking platform-specific internals into business logic.
 */

import { logger } from '@/utils/logger';
import { compileProjectForWebPreview } from '@/services/video/webPreviewCompiler';
import type { IndiiVideoProject } from '@indii/shared';

export interface PlatformCapabilities {
    isElectron: boolean;
    canSelectDirectory: boolean;
    canSelectFile: boolean;
    canCompileVideoPreview: boolean;
    canRenderVideoLocally: boolean;
    canPersistLocalHistory: boolean;
}

export interface PlatformBridge {
    getCapabilities(): PlatformCapabilities;
    isElectron(): boolean;
    getPlatform(): Promise<string>;
    getAppVersion(): Promise<string>;
    selectDirectory(options?: { title?: string }): Promise<string | null>;
    selectFile(options?: { title?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null>;
    canCompileVideoPreview(): boolean;
    compileVideoPreview(project: unknown): Promise<string>;
    canRenderVideoLocally(): boolean;
    saveHistory(id: string, data: unknown): Promise<void>;
    deleteHistory(id: string): Promise<void>;
}

export class ElectronPlatformAdapter implements PlatformBridge {
    private get api(): Window['electronAPI'] | undefined {
        return typeof window !== 'undefined' ? window.electronAPI : undefined;
    }

    getCapabilities(): PlatformCapabilities {
        const api = this.api;
        return {
            isElectron: Boolean(api),
            canSelectDirectory: Boolean(api?.selectDirectory),
            canSelectFile: Boolean(api?.selectFile),
            // The pure-TS compiler ships in the renderer bundle, so live
            // preview works on the web too; desktop additionally exposes IPC.
            canCompileVideoPreview: true,
            canRenderVideoLocally: Boolean(api?.video?.render),
            canPersistLocalHistory: Boolean(api?.agent?.saveHistory),
        };
    }

    isElectron(): boolean {
        return typeof window !== 'undefined' && Boolean(window.electronAPI);
    }

    async getPlatform(): Promise<string> {
        if (this.api?.getPlatform) {
            return this.api.getPlatform();
        }
        if (typeof navigator !== 'undefined') {
            return navigator.platform || 'web';
        }
        return 'unknown';
    }

    async getAppVersion(): Promise<string> {
        if (this.api?.getAppVersion) {
            return this.api.getAppVersion();
        }
        return 'web-1.0.0';
    }

    async selectDirectory(options?: { title?: string }): Promise<string | null> {
        if (!this.api?.selectDirectory) {
            throw new Error('Directory selection is only available in the desktop application.');
        }
        return this.api.selectDirectory(options);
    }

    async selectFile(options?: { title?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> {
        if (!this.api?.selectFile) {
            throw new Error('File selection bridge is only available in the desktop application.');
        }
        const result = await this.api.selectFile(options);
        return typeof result === 'string' ? result : null;
    }

    canCompileVideoPreview(): boolean {
        // Pure-TS compiler runs in every environment; see compileVideoPreview.
        return true;
    }

    async compileVideoPreview(project: unknown): Promise<string> {
        if (this.api?.video?.compilePreview) {
            // Desktop: compile through main so preview and final render share
            // the exact same temp-dir document + sidecar flow.
            return this.api.video.compilePreview(project as Parameters<NonNullable<NonNullable<Window['electronAPI']>['video']>['compilePreview']>[0]);
        }
        // Web: compile locally with the same pure compiler, then re-plumb the
        // document for the in-browser player (sidecar + runtime + CSP paths).
        return compileProjectForWebPreview(project as IndiiVideoProject);
    }

    canRenderVideoLocally(): boolean {
        return Boolean(this.api?.video?.render);
    }

    async saveHistory(id: string, data: unknown): Promise<void> {
        if (this.api?.agent?.saveHistory) {
            await this.api.agent.saveHistory(id, data);
            return;
        }

        // Web fallback: persist to localStorage with isolation
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(`indii_session_history_${id}`, JSON.stringify(data));
            }
        } catch (e) {
            logger.warn(`[PlatformBridge] Failed to save history to web storage for ${id}:`, e);
        }
    }

    async deleteHistory(id: string): Promise<void> {
        if (this.api?.agent?.deleteHistory) {
            await this.api.agent.deleteHistory(id);
            return;
        }

        // Web fallback: remove from localStorage
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(`indii_session_history_${id}`);
            }
        } catch (e) {
            logger.warn(`[PlatformBridge] Failed to remove history from web storage for ${id}:`, e);
        }
    }
}

export const platformBridge: PlatformBridge = new ElectronPlatformAdapter();
