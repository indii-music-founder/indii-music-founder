import type { HistoryItem } from '@/core/types/history';
import type { FileNode } from '@/services/FileSystemService';

export const CREATIVE_ASSET_MIME = 'application/x-indii-creative-asset+json';

export type CreativeAssetType = HistoryItem['type'] | 'document' | 'other';
export type CreativeAssetDragSource =
    | 'gallery'
    | 'project-assets'
    | 'resource-tree'
    | 'creative-clipboard'
    | 'veo-dailies'
    | 'editor-library'
    | 'unknown';

export interface CreativeAssetDragPayload {
    version: 1;
    kind: 'creative-asset';
    source: CreativeAssetDragSource;
    asset: {
        id: string;
        type: CreativeAssetType;
        url: string;
        storageUri?: string;
        thumbnailUrl?: string;
        name: string;
        prompt: string;
        projectId?: string;
        parentId?: string;
    };
}

type WritableAsset = Pick<HistoryItem, 'id' | 'type' | 'url'> & Partial<HistoryItem>;

function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isAssetType(value: unknown): value is CreativeAssetType {
    return value === 'image'
        || value === 'video'
        || value === 'music'
        || value === 'text'
        || value === 'document'
        || value === 'other';
}

function isDragSource(value: unknown): value is CreativeAssetDragSource {
    return value === 'gallery'
        || value === 'project-assets'
        || value === 'resource-tree'
        || value === 'creative-clipboard'
        || value === 'veo-dailies'
        || value === 'editor-library'
        || value === 'unknown';
}

function isSafeAssetUrl(value: string): boolean {
    return /^(https?:\/\/|gs:\/\/|blob:|file:\/\/)/i.test(value)
        || /^data:(image|video|audio)\/[a-z0-9.+-]+[;,]/i.test(value);
}

function parsePayload(value: unknown): CreativeAssetDragPayload | null {
    if (!isObject(value) || value.version !== 1 || value.kind !== 'creative-asset' || !isObject(value.asset)) {
        return null;
    }

    const { asset } = value;
    if (
        typeof asset.id !== 'string'
        || !asset.id.trim()
        || !isAssetType(asset.type)
        || typeof asset.url !== 'string'
        || !isSafeAssetUrl(asset.url)
        || typeof asset.name !== 'string'
        || typeof asset.prompt !== 'string'
    ) {
        return null;
    }

    const source = isDragSource(value.source) ? value.source : 'unknown';
    return {
        version: 1,
        kind: 'creative-asset',
        source,
        asset: {
            id: asset.id,
            type: asset.type,
            url: asset.url,
            storageUri: typeof asset.storageUri === 'string' && asset.storageUri.startsWith('gs://') ? asset.storageUri : undefined,
            thumbnailUrl: typeof asset.thumbnailUrl === 'string' && isSafeAssetUrl(asset.thumbnailUrl) ? asset.thumbnailUrl : undefined,
            name: asset.name,
            prompt: asset.prompt,
            projectId: typeof asset.projectId === 'string' ? asset.projectId : undefined,
            parentId: typeof asset.parentId === 'string' ? asset.parentId : undefined,
        },
    };
}

function safeParseJson(value: string): unknown {
    if (value.length > 262_144) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

export function createCreativeAssetPayload(
    item: WritableAsset,
    source: CreativeAssetDragSource = 'unknown',
): CreativeAssetDragPayload {
    return {
        version: 1,
        kind: 'creative-asset',
        source,
        asset: {
            id: item.id,
            type: item.type,
            url: item.url,
            storageUri: item.storageUri,
            thumbnailUrl: item.thumbnailUrl,
            name: item.prompt || `Untitled ${item.type}`,
            prompt: item.prompt || '',
            projectId: item.projectId,
            parentId: item.parentId,
        },
    };
}

export function createResourceAssetPayload(node: FileNode): CreativeAssetDragPayload | null {
    if (node.type !== 'file' || !node.data?.url) return null;
    const type: CreativeAssetType = node.fileType === 'audio' ? 'music' : (node.fileType || 'other');
    return {
        version: 1,
        kind: 'creative-asset',
        source: 'resource-tree',
        asset: {
            id: node.id,
            type,
            url: node.data.url,
            thumbnailUrl: type === 'image' ? node.data.url : undefined,
            name: node.name,
            prompt: node.name,
            projectId: node.projectId,
        },
    };
}

/**
 * Writes the canonical payload plus the legacy formats still consumed by
 * older canvases and editor surfaces. Media remains a durable URL/storage
 * reference; file bytes and credentials never enter the drag payload.
 */
export function writeCreativeAssetDrag(
    dataTransfer: DataTransfer,
    itemOrPayload: WritableAsset | CreativeAssetDragPayload,
    source: CreativeAssetDragSource = 'unknown',
    effectAllowed: DataTransfer['effectAllowed'] = 'copy',
): CreativeAssetDragPayload {
    const payload = 'kind' in itemOrPayload
        ? itemOrPayload
        : createCreativeAssetPayload(itemOrPayload, source);
    const serialized = JSON.stringify(payload);

    dataTransfer.setData(CREATIVE_ASSET_MIME, serialized);
    dataTransfer.setData('application/json', JSON.stringify({
        type: 'asset',
        asset: {
            id: payload.asset.id,
            type: payload.asset.type,
            name: payload.asset.name,
            url: payload.asset.url,
            storageUri: payload.asset.storageUri,
        },
    }));
    // Asset-id fallback for legacy ingredient/canvas drop zones.
    dataTransfer.setData('text/plain', payload.asset.id);
    if (payload.asset.type === 'image') {
        dataTransfer.setData('image/url', payload.asset.url);
        dataTransfer.setData('image/name', payload.asset.name);
    }
    dataTransfer.effectAllowed = effectAllowed;
    return payload;
}

export function readCreativeAssetDrag(dataTransfer: DataTransfer): CreativeAssetDragPayload | null {
    const canonical = dataTransfer.getData(CREATIVE_ASSET_MIME);
    if (canonical) {
        const parsed = parsePayload(safeParseJson(canonical));
        if (parsed) return parsed;
    }

    const applicationJson = dataTransfer.getData('application/json');
    if (applicationJson) {
        const legacy = safeParseJson(applicationJson);
        if (isObject(legacy) && legacy.type === 'asset' && isObject(legacy.asset)) {
            const asset = legacy.asset;
            const parsed = parsePayload({
                version: 1,
                kind: 'creative-asset',
                source: 'unknown',
                asset: {
                    id: typeof asset.id === 'string' ? asset.id : `legacy-${Date.now()}`,
                    type: asset.type === 'audio' ? 'music' : asset.type,
                    url: asset.url,
                    storageUri: asset.storageUri,
                    name: typeof asset.name === 'string' ? asset.name : 'Dropped asset',
                    prompt: typeof asset.name === 'string' ? asset.name : 'Dropped asset',
                },
            });
            if (parsed) return parsed;
        }
    }

    // Creative Clipboard historically placed a complete asset object in text/plain.
    const plainText = dataTransfer.getData('text/plain');
    if (plainText.startsWith('{')) {
        const legacy = safeParseJson(plainText);
        if (isObject(legacy)) {
            return parsePayload({
                version: 1,
                kind: 'creative-asset',
                source: 'creative-clipboard',
                asset: {
                    id: legacy.id,
                    type: legacy.type,
                    url: legacy.url,
                    storageUri: legacy.storageUri,
                    thumbnailUrl: legacy.thumbnailUrl,
                    name: typeof legacy.prompt === 'string' ? legacy.prompt : 'Dropped asset',
                    prompt: typeof legacy.prompt === 'string' ? legacy.prompt : 'Dropped asset',
                    projectId: legacy.projectId,
                },
            });
        }
    }

    return null;
}

export function creativeAssetPayloadToHistoryItem(payload: CreativeAssetDragPayload): HistoryItem | null {
    const { asset } = payload;
    if (!['image', 'video', 'music', 'text'].includes(asset.type)) return null;
    return {
        id: asset.id,
        type: asset.type as HistoryItem['type'],
        url: asset.url,
        storageUri: asset.storageUri,
        thumbnailUrl: asset.thumbnailUrl,
        prompt: asset.prompt || asset.name,
        timestamp: Date.now(),
        projectId: asset.projectId || '',
        parentId: asset.parentId,
        origin: 'uploaded',
    };
}
