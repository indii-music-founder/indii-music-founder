
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import log from 'electron-log';

export interface SongMetadata {
    id: string;
    artist: string;
    title: string;
    album?: string;
    splits?: Record<string, number>;
}

export class APIService {
    private getCacheDir(): string {
        try {
            return path.join(app.getPath('userData'), 'metadata-cache', 'tracks');
        } catch {
            return path.join(os.tmpdir(), 'indii-metadata-cache', 'tracks');
        }
    }

    private getCacheFilePath(hash: string): string {
        const safeHash = hash.replace(/[^a-zA-Z0-9_-]/g, '');
        return path.join(this.getCacheDir(), `${safeHash}.json`);
    }

    async getCachedMetadata(hash: string): Promise<SongMetadata | null> {
        try {
            const cachePath = this.getCacheFilePath(hash);
            const content = await fs.promises.readFile(cachePath, 'utf-8');
            const data = JSON.parse(content) as SongMetadata;
            log.info(`[APIService] Resolved song metadata from local offline cache for hash: ${hash}`);
            return data;
        } catch {
            return null;
        }
    }

    async saveCachedMetadata(hash: string, metadata: SongMetadata): Promise<void> {
        try {
            const cacheDir = this.getCacheDir();
            await fs.promises.mkdir(cacheDir, { recursive: true });
            const cachePath = this.getCacheFilePath(hash);
            await fs.promises.writeFile(cachePath, JSON.stringify(metadata, null, 2), 'utf-8');
            log.info(`[APIService] Cached song metadata locally for hash: ${hash}`);
        } catch (err) {
            log.warn(`[APIService] Failed to cache song metadata locally for hash: ${hash}`, err);
        }
    }

    async getSongMetadata(hash: string, token?: string): Promise<SongMetadata | null> {
        const lookupUrl = process.env.METADATA_LOOKUP_URL;
        if (!lookupUrl) {
            return await this.getCachedMetadata(hash);
        }

        try {
            const url = new URL(lookupUrl);
            url.searchParams.set('hash', hash);

            const response = await fetch(url, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                signal: AbortSignal.timeout(10000),
            });

            if (response.status === 404) return null;
            if (!response.ok) {
                throw new Error(`Metadata lookup failed: ${response.status} ${response.statusText}`);
            }

            const metadata = await response.json() as SongMetadata;
            await this.saveCachedMetadata(hash, metadata);
            return metadata;
        } catch (error) {
            log.warn(`[APIService] Network metadata lookup failed, attempting offline cache fallback: ${error instanceof Error ? error.message : String(error)}`);
            const cached = await this.getCachedMetadata(hash);
            if (cached) {
                return cached;
            }
            throw error;
        }
    }
}

export const apiService = new APIService();
