/**
 * FreeMiniCampaignService.ts
 *
 * Implements the core business logic for the Verified Free Experience (ISSUE-1421).
 *
 * Requirements:
 * 1. 1 track + 1 image (or generated starting image).
 * 2. Guided coordination into a mini campaign pack:
 *    - 1:1 square cover artwork
 *    - 9:16 portrait story artwork
 *    - Gemini-identified and Jev-selected 15-second audio teaser
 * 3. Exports contain NO indii watermark or forced branding.
 * 4. The artist chooses whether to save generated previews to their library or
 *    remove in-session copies; the temporary source upload is deleted after analysis.
 */

import { CloudStorageService } from '@/services/CloudStorageService';
import { ref, uploadBytes } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { storage } from '@/services/firebase';
import type { SongSectionMetadata } from '@/config/typesafeJudgments';
import type { HistoryItem } from '@/core/types/history';

export interface MiniCampaignTrackMeta {
    title: string;
    durationSeconds: number;
    clipStartSeconds: number;
    clipDurationSeconds: number;
}

export interface MiniCampaignAssetItem {
    id: string;
    type: 'square_cover' | 'story_promo' | 'audio_clip';
    title: string;
    url: string;
    aspectRatio: '1:1' | '9:16' | 'audio';
    storageUri?: string;
    downloadExtension?: 'wav' | 'mp3' | 'm4a';
    isWatermarked: false;
}

export interface MiniCampaignPack {
    id: string;
    title: string;
    artistName: string;
    createdAt: string;
    trackMeta: MiniCampaignTrackMeta;
    assets: MiniCampaignAssetItem[];
    storageUris: string[];
    watermarkPolicy: 'NONE';
    audioHook?: { section: string; potential: number; strategy: string };
}

export interface SaveOrDeleteResult {
    action: 'saved' | 'deleted';
    purgedUrisCount: number;
    message: string;
    timestamp: string;
    savedAssetsCount?: number;
}

export const FREE_CAMPAIGN_LIMITS = Object.freeze({
    maxAudioSizeBytes: 35 * 1024 * 1024, // 35 MB
    maxVisualSizeBytes: 15 * 1024 * 1024, // 15 MB
    maxAudioDurationSeconds: 420, // 7 minutes
    defaultClipDurationSeconds: 15,
    allowedAudioMimeTypes: [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/mp4',
        'audio/x-m4a',
        'audio/aac',
        'audio/ogg',
        'audio/webm',
        'audio/flac',
    ],
    allowedVisualMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
    ],
});

export class FreeMiniCampaignService {
    private static async resolveAssetDataUrl(url: string): Promise<string> {
        if (url.startsWith('data:')) return url;
        const blob = await (await fetch(url)).blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Could not prepare a campaign asset for your library.'));
            reader.readAsDataURL(blob);
        });
    }

    private static async savePackToLibrary(pack: MiniCampaignPack, projectId?: string): Promise<number> {
        const { StorageService } = await import('@/services/StorageService');
        for (const asset of pack.assets) {
            const historyItem: HistoryItem = {
                id: asset.id,
                type: asset.type === 'audio_clip' ? 'music' : 'image',
                url: await this.resolveAssetDataUrl(asset.url),
                prompt: `${pack.title} — ${asset.title}${pack.audioHook ? ` · ${pack.audioHook.strategy}` : ''}`,
                timestamp: Date.now(),
                projectId: projectId || 'default',
                meta: 'free-mini-campaign',
                origin: 'generated',
            };
            await StorageService.saveItem(historyItem);
        }
        return pack.assets.length;
    }

    /** Upload a temporary private copy, let Gemini identify moments, then remove the source. */
    static async analyzeSongForHook(file: File, userId: string, durationSeconds: number): Promise<SongSectionMetadata[]> {
        if (!userId) throw new Error('Sign in to analyze the track for a teaser moment.');
        const id = crypto.randomUUID();
        const extensionByMime: Record<string, string> = {
            'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
            'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/flac': 'flac',
            'audio/ogg': 'ogg', 'audio/webm': 'webm',
        };
        const extension = extensionByMime[file.type.toLowerCase()];
        if (!extension) throw new Error('This audio format cannot be analyzed for teaser moments.');

        const storagePath = `tmp/audio-analysis/${userId}/free-campaign/${id}.${extension}`;
        try {
            await uploadBytes(ref(storage, storagePath), file, { contentType: file.type });
            const analyze = httpsCallable<
                { storagePath: string; durationSeconds: number },
                { candidates: SongSectionMetadata[] }
            >(getFunctions(), 'analyzeCampaignAudio');
            const result = await analyze({ storagePath, durationSeconds });
            return result.data.candidates;
        } finally {
            try { await CloudStorageService.deleteStorageUri(storagePath); } catch { /* Storage lifecycle removes abandoned temporary uploads. */ }
        }
    }

    /**
     * Validates an uploaded song file for the free mini-campaign.
     */
    static validateAudioFile(file: File): void {
        if (!file) {
            throw new Error('An audio file is required to start your mini-campaign.');
        }

        if (file.size > FREE_CAMPAIGN_LIMITS.maxAudioSizeBytes) {
            const sizeMb = Math.round(file.size / (1024 * 1024));
            throw new Error(
                `Audio file size (${sizeMb}MB) exceeds the 35MB limit for the free campaign experience. Choose a smaller file.`,
            );
        }

        const isAllowedType = FREE_CAMPAIGN_LIMITS.allowedAudioMimeTypes.some(
            type => file.type.toLowerCase().includes(type.split('/')[1]) || file.type.toLowerCase() === type,
        );

        if (!isAllowedType && file.type) {
            throw new Error(
                `Unsupported audio format (${file.type}). Please upload a standard MP3, WAV, AAC, M4A, or FLAC track.`,
            );
        }
    }

    /**
     * Inspects the duration of an audio file in a browser environment.
     */
    static async getAudioDuration(file: File): Promise<number> {
        if (typeof window === 'undefined' || typeof Audio === 'undefined') {
            return 180; // Safe default in SSR / non-browser test environment
        }

        return new Promise<number>((resolve, reject) => {
            const audio = new Audio();
            const objectUrl = URL.createObjectURL(file);
            audio.preload = 'metadata';

            audio.onloadedmetadata = () => {
                URL.revokeObjectURL(objectUrl);
                const duration = audio.duration;
                if (!Number.isFinite(duration) || duration <= 0) {
                    reject(new Error('Could not read track duration. Ensure the audio file is not corrupt.'));
                } else if (duration > FREE_CAMPAIGN_LIMITS.maxAudioDurationSeconds) {
                    reject(
                        new Error(
                            `Track duration (${Math.round(duration / 60)} minutes) exceeds the 7-minute maximum for the guided campaign. Please choose a shorter track.`,
                        ),
                    );
                } else {
                    resolve(duration);
                }
            };

            audio.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Unable to decode audio metadata from the uploaded file.'));
            };

            audio.src = objectUrl;
        });
    }

    /** Decode the supplied track and export a real, trimmed PCM WAV teaser. */
    static async createAudioClip(
        file: File,
        startSeconds = 0,
        durationSeconds: number = FREE_CAMPAIGN_LIMITS.defaultClipDurationSeconds,
    ): Promise<{ url: string; durationSeconds: number }> {
        const AudioContextConstructor = window.AudioContext
            || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) throw new Error('Audio preview export is not available in this browser.');

        const context = new AudioContextConstructor();
        try {
            const source = await context.decodeAudioData(await file.arrayBuffer());
            const startFrame = Math.min(source.length, Math.max(0, Math.floor(startSeconds * source.sampleRate)));
            const endFrame = Math.min(source.length, startFrame + Math.floor(durationSeconds * source.sampleRate));
            if (endFrame <= startFrame) throw new Error('The selected teaser range does not contain audio.');

            const channels = Array.from({ length: source.numberOfChannels }, (_, channel) =>
                source.getChannelData(channel).slice(startFrame, endFrame),
            );
            const wav = this.encodePcmWav(channels, source.sampleRate);
            return {
                url: URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })),
                durationSeconds: (endFrame - startFrame) / source.sampleRate,
            };
        } finally {
            await context.close();
        }
    }

    private static encodePcmWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
        const channelCount = channels.length;
        const frameCount = channels[0]?.length ?? 0;
        const bytesPerSample = 2;
        const dataSize = frameCount * channelCount * bytesPerSample;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        const writeText = (offset: number, value: string) => {
            for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
        };

        writeText(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeText(8, 'WAVE');
        writeText(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, channelCount, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
        view.setUint16(32, channelCount * bytesPerSample, true);
        view.setUint16(34, bytesPerSample * 8, true);
        writeText(36, 'data');
        view.setUint32(40, dataSize, true);

        let offset = 44;
        for (let frame = 0; frame < frameCount; frame++) {
            for (let channel = 0; channel < channelCount; channel++) {
                const sample = Math.max(-1, Math.min(1, channels[channel]?.[frame] ?? 0));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
                offset += bytesPerSample;
            }
        }
        return buffer;
    }

    /**
     * Validates an uploaded artwork image for the free mini-campaign.
     */
    static validateVisualFile(file: File): void {
        if (!file) {
            throw new Error('A visual image file is required.');
        }

        if (file.size > FREE_CAMPAIGN_LIMITS.maxVisualSizeBytes) {
            const sizeMb = Math.round(file.size / (1024 * 1024));
            throw new Error(
                `Visual image size (${sizeMb}MB) exceeds the 15MB limit. Please upload a web-ready image.`,
            );
        }

        const isAllowedType = FREE_CAMPAIGN_LIMITS.allowedVisualMimeTypes.includes(file.type.toLowerCase());
        if (!isAllowedType && file.type) {
            throw new Error(
                `Unsupported image format (${file.type}). Please upload a JPEG, PNG, or WebP image.`,
            );
        }
    }

    /**
     * Assembles a coordinated mini-campaign pack containing:
     * - 1:1 Square Cover Artwork
     * - 9:16 Portrait Story Artwork
     * - Gemini-identified and Jev-selected 15-second audio teaser
     * Guarantee: NO watermark or forced branding on any asset.
     */
    static createMiniCampaignPack(params: {
        title: string;
        artistName: string;
        visualUrl: string;
        squareVisualUrl?: string;
        storyVisualUrl?: string;
        audioUrl: string;
        durationSeconds: number;
        clipStartSeconds?: number;
        audioHook?: MiniCampaignPack['audioHook'];
        storageUris?: string[];
    }): MiniCampaignPack {
        const title = params.title.trim() || 'Untitled Single';
        const artistName = params.artistName.trim() || 'Independent Artist';
        const durationSeconds = params.durationSeconds > 0 ? params.durationSeconds : 180;
        const clipStartSeconds = Math.max(0, params.clipStartSeconds ?? 0);
        const clipDurationSeconds = Math.min(
            FREE_CAMPAIGN_LIMITS.defaultClipDurationSeconds,
            Math.max(1, durationSeconds - clipStartSeconds),
        );

        const packId = `minicamp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

        const assets: MiniCampaignAssetItem[] = [
            {
                id: `${packId}_square`,
                type: 'square_cover',
                title: `${title} — Square Cover (1:1)`,
                url: params.squareVisualUrl || params.visualUrl,
                aspectRatio: '1:1',
                storageUri: params.storageUris?.[0],
                isWatermarked: false,
            },
            {
                id: `${packId}_story`,
                type: 'story_promo',
                title: `${title} — Story & Reels Promo (9:16)`,
                url: params.storyVisualUrl || params.visualUrl,
                aspectRatio: '9:16',
                storageUri: params.storageUris?.[1],
                isWatermarked: false,
            },
            {
                id: `${packId}_audio_clip`,
                type: 'audio_clip',
                title: `${title} — 15s Teaser Clip`,
                url: params.audioUrl,
                aspectRatio: 'audio',
                storageUri: params.storageUris?.[2],
                downloadExtension: 'wav',
                isWatermarked: false,
            },
        ];

        return {
            id: packId,
            title,
            artistName,
            createdAt: new Date().toISOString(),
            trackMeta: {
                title,
                durationSeconds,
                clipStartSeconds,
                clipDurationSeconds,
            },
            assets,
            storageUris: params.storageUris ?? [],
            watermarkPolicy: 'NONE',
            audioHook: params.audioHook,
        };
    }

    /**
     * Crops visual assets to their claimed aspect ratio (1:1 or 9:16) via HTML Canvas,
     * returning a data URL containing valid PNG bytes.
     */
    static async cropVisualToAspectRatio(
        imageUrl: string,
        targetRatio: '1:1' | '9:16',
    ): Promise<string> {
        if (
            typeof document === 'undefined' ||
            typeof Image === 'undefined' ||
            (typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom'))
        ) {
            return imageUrl;
        }

        return new Promise<string>((resolve) => {
            const img = new Image();
            // Setting crossOrigin on blob: or data: URLs triggers CORS load errors in browsers.
            // Only set anonymous crossOrigin for external http(s) endpoints.
            if (!imageUrl.startsWith('blob:') && !imageUrl.startsWith('data:')) {
                img.crossOrigin = 'anonymous';
            }

            const timeoutId = setTimeout(() => {
                resolve(imageUrl);
            }, 3000);

            img.onload = () => {
                clearTimeout(timeoutId);
                try {
                    const naturalW = img.naturalWidth || img.width;
                    const naturalH = img.naturalHeight || img.height;

                    if (!naturalW || !naturalH) {
                        resolve(imageUrl);
                        return;
                    }

                    let sourceX = 0;
                    let sourceY = 0;
                    let sourceW = naturalW;
                    let sourceH = naturalH;

                    if (targetRatio === '1:1') {
                        const size = Math.min(naturalW, naturalH);
                        sourceX = Math.round((naturalW - size) / 2);
                        sourceY = Math.round((naturalH - size) / 2);
                        sourceW = size;
                        sourceH = size;
                    } else if (targetRatio === '9:16') {
                        const targetRatioVal = 9 / 16;
                        const currentRatioVal = naturalW / naturalH;
                        if (currentRatioVal > targetRatioVal) {
                            const fittedWidth = Math.round(naturalH * targetRatioVal);
                            sourceX = Math.round((naturalW - fittedWidth) / 2);
                            sourceW = fittedWidth;
                        } else {
                            const fittedHeight = Math.round(naturalW / targetRatioVal);
                            sourceY = Math.round((naturalH - fittedHeight) / 2);
                            sourceH = fittedHeight;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = sourceW;
                    canvas.height = sourceH;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(imageUrl);
                        return;
                    }

                    ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
                    resolve(canvas.toDataURL('image/png'));
                } catch {
                    resolve(imageUrl);
                }
            };

            img.onerror = () => {
                clearTimeout(timeoutId);
                resolve(imageUrl);
            };

            img.src = imageUrl;
        });
    }

    /**
     * Triggers a direct browser file download without branding.
     * Accurately crops visual assets to their claimed aspect ratio (1:1 / 9:16)
     * and sets matching file extensions for image and audio media.
     */
    static async downloadAsset(asset: MiniCampaignAssetItem, filename?: string): Promise<void> {
        if (typeof document === 'undefined') return;

        let downloadUrl = asset.url;
        let extension = 'png';

        if (asset.type === 'audio_clip') {
            if (asset.downloadExtension) {
                extension = asset.downloadExtension;
            } else if (asset.url.includes('.wav') || asset.url.endsWith('.wav')) {
                extension = 'wav';
            } else if (asset.url.includes('.m4a') || asset.url.endsWith('.m4a')) {
                extension = 'm4a';
            } else {
                extension = 'mp3';
            }
        } else if (asset.aspectRatio === '1:1' || asset.aspectRatio === '9:16') {
            try {
                downloadUrl = await this.cropVisualToAspectRatio(asset.url, asset.aspectRatio);
            } catch {
                downloadUrl = asset.url;
            }

            if (downloadUrl.startsWith('data:image/png')) {
                extension = 'png';
            } else if (downloadUrl.startsWith('data:image/jpeg') || downloadUrl.includes('.jpg') || downloadUrl.includes('.jpeg')) {
                extension = 'jpg';
            } else if (downloadUrl.startsWith('data:image/webp') || downloadUrl.includes('.webp')) {
                extension = 'webp';
            } else {
                extension = 'png';
            }
        } else if (asset.url.includes('.jpg') || asset.url.includes('.jpeg')) {
            extension = 'jpg';
        }

        const effectiveName =
            filename ||
            `${asset.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${extension}`;

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = effectiveName;
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Enforces the artist's privacy choice:
     * - 'save': Preserves files in the user's project library.
     * - 'delete': Removes generated preview copies from the active browser session.
     */
    static async enforceSaveOrDelete(
        choice: 'save' | 'delete',
        pack: MiniCampaignPack,
        projectId?: string,
    ): Promise<SaveOrDeleteResult> {
        const timestamp = new Date().toISOString();

        if (choice === 'save') {
            const savedAssetsCount = await this.savePackToLibrary(pack, projectId);
            return {
                action: 'saved',
                purgedUrisCount: 0,
                savedAssetsCount,
                message: `${savedAssetsCount} campaign assets from "${pack.title}" are saved to your creative library.`,
                timestamp,
            };
        }

        // Choice is 'delete': purge any explicitly attached storage URIs and revoke preview URLs.
        let purgedCount = 0;
        const errors: string[] = [];

        for (const uri of pack.storageUris) {
            if (!uri) continue;
            try {
                await CloudStorageService.deleteStorageUri(uri);
                purgedCount++;
            } catch (err: unknown) {
                // If the object was already deleted or not found, proceed safely
                const errorMessage = err instanceof Error ? err.message : String(err);
                if (!errorMessage.includes('object-not-found')) {
                    errors.push(errorMessage);
                }
            }
        }

        // Revoke local object URLs if applicable
        if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            for (const asset of pack.assets) {
                if (asset.url.startsWith('blob:')) {
                    try {
                        URL.revokeObjectURL(asset.url);
                    } catch {
                        // Ignore object URL revocation failures
                    }
                }
            }
        }

        if (errors.length > 0) {
            console.warn('[FreeMiniCampaignService] Some storage objects encountered warnings during purge:', errors);
        }

        return {
            action: 'deleted',
            purgedUrisCount: purgedCount,
            message: `${purgedCount > 0 ? `${purgedCount} stored object${purgedCount === 1 ? '' : 's'} deleted. ` : ''}In-session previews for "${pack.title}" were removed.${errors.length > 0 ? ' Some stored objects could not be deleted.' : ''} Any files already downloaded remain on your device.`,
            timestamp,
        };
    }
}
