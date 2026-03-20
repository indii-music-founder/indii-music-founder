import { logger } from '@/utils/logger';
import { alwaysOnMemoryEngine } from './AlwaysOnMemoryEngine';
import {
    ALL_SUPPORTED_EXTENSIONS,
    SUPPORTED_TEXT_EXTENSIONS,
    SUPPORTED_MEDIA_EXTENSIONS,
} from '@/types/AlwaysOnMemory';

/**
 * Electron filesystem API shape expected by the inbox watcher.
 * The actual `window.electronAPI` interface is declared globally in the Electron preload.
 * We use a local interface here to avoid conflicting with other global augmentations.
 */
interface ElectronFsAPI {
    listFiles: (path: string) => Promise<InboxFile[]>;
    readTextFile: (path: string) => Promise<string>;
    readBinaryFile: (path: string) => Promise<Uint8Array>;
    mkdir: (path: string) => Promise<void>;
}

// ============================================================================
// TYPES
// ============================================================================

interface InboxFile {
    name: string;
    path: string;
    extension: string;
    sizeBytes: number;
}

interface InboxWatcherConfig {
    /** Path to watch (default: ~/indiiOS/memory-inbox/) */
    inboxPath: string;
    /** Polling interval in ms (default: 5000) */
    pollIntervalMs: number;
    /** Maximum file size to process in bytes (default: 20MB) */
    maxFileSizeBytes: number;
}

const DEFAULT_INBOX_CONFIG: InboxWatcherConfig = {
    inboxPath: '~/indiiOS/memory-inbox',
    pollIntervalMs: 5000,
    maxFileSizeBytes: 20 * 1024 * 1024,
};

// ============================================================================
// INBOX WATCHER
// ============================================================================

/**
 * MemoryInboxWatcher — Electron IPC-based file watcher for the Always-On Memory Agent.
 *
 * Watches a configurable folder for new files and ingests them into the memory system.
 * Supports all 27 file types from Google's reference implementation.
 *
 * **Electron Only**: Uses the `window.electronAPI` IPC bridge to interact with the filesystem.
 * In web mode, this service is a graceful no-op — all methods return safely without errors.
 *
 * Flow:
 * 1. Poll the inbox folder via IPC for new files
 * 2. Skip already-processed files (tracked in a local Set)
 * 3. Read file bytes via IPC
 * 4. Route to MemoryIngestionPipeline (text files → ingestText, media → ingestFile)
 * 5. Mark file as processed
 */
export class MemoryInboxWatcher {
    private config: InboxWatcherConfig;
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private processedFiles = new Set<string>();
    private isRunning = false;
    private userId: string = '';

    constructor(config?: Partial<InboxWatcherConfig>) {
        this.config = { ...DEFAULT_INBOX_CONFIG, ...config };
    }

    /**
     * Safely get the Electron fs API, avoiding TypeScript global type conflicts.
     */
    private getElectronFs(): ElectronFsAPI | null {
        if (typeof window === 'undefined') return null;
        const api = window.electronAPI;
        return api?.fs ?? null;
    }

    /**
     * Check if we're running in an Electron environment with the required IPC API.
     */
    private get isElectronAvailable(): boolean {
        return this.getElectronFs() !== null;
    }

    /**
     * Start watching the inbox folder.
     *
     * @param userId - The user to ingest files for
     */
    public async start(userId: string): Promise<void> {
        if (!this.isElectronAvailable) {
            logger.info('[MemoryInboxWatcher] Not in Electron — inbox watcher disabled');
            return;
        }

        if (this.isRunning) {
            logger.warn('[MemoryInboxWatcher] Already running');
            return;
        }

        this.userId = userId;
        this.isRunning = true;

        // Ensure the inbox directory exists
        try {
            const fs = this.getElectronFs();
            if (fs) await fs.mkdir(this.config.inboxPath);
        } catch {
            // Directory may already exist — that's fine
        }

        // Start polling
        this.pollTimer = setInterval(() => {
            this.pollInbox().catch(err => {
                logger.error('[MemoryInboxWatcher] Poll error:', err);
            });
        }, this.config.pollIntervalMs);

        logger.info(
            `[MemoryInboxWatcher] 👁️ Watching: ${this.config.inboxPath} ` +
            `(poll: ${this.config.pollIntervalMs / 1000}s, supports: text, images, audio, video, PDFs)`
        );
    }

    /**
     * Stop watching.
     */
    public stop(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.isRunning = false;
        logger.info('[MemoryInboxWatcher] Stopped');
    }

    /**
     * Get the number of processed files.
     */
    public get processedCount(): number {
        return this.processedFiles.size;
    }

    // ========================================================================
    // PRIVATE - POLLING
    // ========================================================================

    /**
     * Poll the inbox folder for new files.
     */
    private async pollInbox(): Promise<void> {
        const fs = this.getElectronFs();
        if (!fs) return;

        try {
            // List files in the inbox folder
            const files: InboxFile[] = await fs.listFiles(this.config.inboxPath);

            for (const file of files) {
                // Skip hidden files
                if (file.name.startsWith('.')) continue;

                // Skip already processed files
                if (this.processedFiles.has(file.path)) continue;

                // Check if the extension is supported
                const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
                if (!ALL_SUPPORTED_EXTENSIONS.has(ext)) continue;

                // Skip files that are too large
                if (file.sizeBytes > this.config.maxFileSizeBytes) {
                    const sizeMB = (file.sizeBytes / (1024 * 1024)).toFixed(1);
                    logger.warn(
                        `[MemoryInboxWatcher] ⚠️ Skipping ${file.name} (${sizeMB}MB) — exceeds limit`
                    );
                    this.processedFiles.add(file.path);
                    continue;
                }

                // Process the file
                try {
                    await this.processFile(file, ext);
                } catch (err) {
                    logger.error(`[MemoryInboxWatcher] Error processing ${file.name}:`, err);
                }

                // Mark as processed regardless of success/failure
                this.processedFiles.add(file.path);
            }
        } catch (error) {
            logger.error('[MemoryInboxWatcher] Inbox polling failed:', error);
        }
    }

    /**
     * Process a single file from the inbox.
     */
    private async processFile(file: InboxFile, ext: string): Promise<void> {
        const fs = this.getElectronFs();
        if (!fs) return;

        const engine = alwaysOnMemoryEngine;
        if (!engine.running) {
            logger.warn('[MemoryInboxWatcher] Engine not running, skipping file');
            return;
        }

        if (SUPPORTED_TEXT_EXTENSIONS.has(ext)) {
            // Text file — read as string
            logger.info(`[MemoryInboxWatcher] 📄 New text file: ${file.name}`);
            const text: string = await fs.readTextFile(file.path);
            if (text.trim()) {
                await engine.ingest(text.slice(0, 10000), file.name);
            }
        } else if (SUPPORTED_MEDIA_EXTENSIONS[ext]) {
            // Media file — read as bytes
            logger.info(`[MemoryInboxWatcher] 🖼️ New media file: ${file.name}`);
            const bytes: Uint8Array = await fs.readBinaryFile(file.path);
            const mimeType = SUPPORTED_MEDIA_EXTENSIONS[ext];
            await engine.ingestFile(bytes, file.name, mimeType);
        }
    }
}

// Singleton instance
export const memoryInboxWatcher = new MemoryInboxWatcher();
