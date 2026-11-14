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

function isHistoryRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) &&
        (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export class ElectronPlatformAdapter implements PlatformBridge {
    private get api(): Window['electronAPI'] | undefined {
        return typeof window !== 'undefined' ? window.electronAPI : undefined;
    }

    getCapabilities(): PlatformCapabilities {
        const api = this.api;
        let webHistoryAvailable = false;
        try { webHistoryAvailable = typeof localStorage !== 'undefined'; } catch { /* Browser policy can deny the storage getter. */ }
        return {
            isElectron: Boolean(api),
            canSelectDirectory: Boolean(api?.selectDirectory),
            canSelectFile: Boolean(api?.selectFile),
            // The pure-TS compiler ships in the renderer bundle, so live
            // preview works on the web too; desktop additionally exposes IPC.
            canCompileVideoPreview: true,
            canRenderVideoLocally: Boolean(api?.video?.render),
            canPersistLocalHistory: Boolean(api?.agent?.saveHistory) || webHistoryAvailable,
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
            const result = await this.api.agent.saveHistory(id, data);
            if (!result.success) throw new Error(result.error || 'Failed to save local history.');
            return;
        }

        // Match HistoryStore.save: a session update is a shallow patch, not a
        // replacement of the messages and other fields in the existing cache.
        if (typeof localStorage === 'undefined') throw new Error('Local history storage is unavailable.');
        if (!id) throw new Error('A session ID is required for local history.');
        if (!isHistoryRecord(data)) throw new Error('Local history updates must be plain objects.');
        const key = `indii_session_history_${id}`;
        const previous = localStorage.getItem(key);
        const existing: unknown = previous === null ? {} : JSON.parse(previous);
        if (!isHistoryRecord(existing)) throw new Error('Existing local history is not a session object.');
        // Parse, validate and serialize before writing so a malformed patch or
        // corrupt cache cannot silently replace the original stored bytes.
        const serialized = JSON.stringify({ ...existing, ...data });
        localStorage.setItem(key, serialized);
    }

    async deleteHistory(id: string): Promise<void> {
        if (this.api?.agent?.deleteHistory) {
            const result = await this.api.agent.deleteHistory(id);
            if (!result.success) throw new Error(result.error || 'Failed to delete local history.');
            return;
        }

        if (typeof localStorage === 'undefined') throw new Error('Local history storage is unavailable.');
        if (!id) throw new Error('A session ID is required for local history.');
        localStorage.removeItem(`indii_session_history_${id}`);
    }
}

export const platformBridge: PlatformBridge = new ElectronPlatformAdapter();
