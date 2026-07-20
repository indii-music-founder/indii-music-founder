import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const FIREBASE_DOWNLOAD_HOSTS = new Set(['firebasestorage.googleapis.com', 'storage.googleapis.com']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_COVER_BYTES = 50 * 1024 * 1024;

export interface CanonicalCoverAsset {
    content_hash: string;
    download_url: string;
    mime_type: 'image/jpeg' | 'image/png';
    original_file_name: string;
    size_bytes: number;
    storage_path: string;
}

export interface StagedCanonicalCover {
    cleanup: () => Promise<void>;
    coverAsset: Omit<CanonicalCoverAsset, 'download_url'> & { local_path: string; width: number; height: number; color_space: 'rgb' };
}

function requireString(value: unknown, name: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Canonical cover ${name} is required.`);
    return value.trim();
}

function firebaseObjectPath(rawUrl: string): string {
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new Error('Canonical cover download_url is invalid.'); }
    if (url.protocol !== 'https:' || !FIREBASE_DOWNLOAD_HOSTS.has(url.hostname)) {
        throw new Error('Canonical cover download_url must use Firebase Storage.');
    }
    const segments = url.pathname.split('/').filter(Boolean);
    let encoded: string | undefined;
    if (url.hostname === 'firebasestorage.googleapis.com') {
        const objectIndex = segments.indexOf('o');
        encoded = objectIndex >= 0 ? segments.slice(objectIndex + 1).join('/') : undefined;
        if (url.searchParams.get('alt') !== 'media') {
            throw new Error('Canonical cover Firebase Storage URL must request media bytes.');
        }
    } else {
        encoded = segments.length > 1 ? segments.slice(1).join('/') : undefined;
    }
    if (!encoded) throw new Error('Canonical cover Storage path is invalid.');
    try { return decodeURIComponent(encoded); } catch { throw new Error('Canonical cover Storage path is invalid.'); }
}

function parseCoverAsset(value: unknown): CanonicalCoverAsset {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Canonical cover_asset is required.');
    const asset = value as Record<string, unknown>;
    if ('local_path' in asset) throw new Error('Canonical cover local_path is reserved for the trusted desktop process.');
    const content_hash = requireString(asset.content_hash, 'content_hash').toLowerCase();
    const download_url = requireString(asset.download_url, 'download_url');
    const mime_type = requireString(asset.mime_type, 'mime_type').toLowerCase() as CanonicalCoverAsset['mime_type'];
    const original_file_name = requireString(asset.original_file_name, 'original_file_name');
    const storage_path = requireString(asset.storage_path, 'storage_path');
    const size_bytes = typeof asset.size_bytes === 'number' ? asset.size_bytes : Number.NaN;
    if (!SHA256_PATTERN.test(content_hash)) throw new Error('Canonical cover content_hash must be a SHA-256 digest.');
    if (!['image/jpeg', 'image/png'].includes(mime_type)) throw new Error('Canonical cover must be JPEG or PNG.');
    if (!Number.isSafeInteger(size_bytes) || size_bytes <= 0 || size_bytes > MAX_COVER_BYTES) throw new Error('Canonical cover size_bytes is outside the supported range.');
    if (path.basename(original_file_name) !== original_file_name || /[\0\r\n]/.test(original_file_name)) throw new Error('Canonical cover original_file_name is unsafe.');
    const segments = storage_path.split('/');
    if (segments.length !== 4 || segments[0] !== 'covers' || !segments[1] || segments[2] !== content_hash || !/^original\.(?:jpe?g|png)$/i.test(segments[3] ?? '')) {
        throw new Error('Canonical cover storage_path is not a content-addressed artwork path.');
    }
    if (firebaseObjectPath(download_url) !== storage_path) throw new Error('Canonical cover download URL does not match storage_path.');
    return { content_hash, download_url, mime_type, original_file_name, size_bytes, storage_path };
}

function inspectImage(bytes: Buffer, mimeType: CanonicalCoverAsset['mime_type']): { width: number; height: number; color_space: 'rgb' } {
    if (mimeType === 'image/png') {
        if (bytes.length < 26 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Canonical cover bytes are not PNG.');
        const colorType = bytes[25];
        if (colorType === 6 || colorType === 4) throw new Error('Canonical cover must not use transparent PNG artwork.');
        if (colorType !== 2) throw new Error('Canonical PNG cover must use RGB truecolor encoding.');
        return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), color_space: 'rgb' };
    }
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Canonical cover bytes are not JPEG.');
    for (let offset = 2; offset + 9 < bytes.length;) {
        if (bytes[offset] !== 0xff) { offset += 1; continue; }
        const marker = bytes[offset + 1] ?? 0;
        const length = bytes.readUInt16BE(offset + 2);
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) {
            if (bytes[offset + 9] !== 3) throw new Error('Canonical JPEG cover must use RGB color encoding.');
            return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7), color_space: 'rgb' };
        }
        offset += 2 + length;
    }
    throw new Error('Canonical JPEG cover has no readable dimensions.');
}

export async function stageCanonicalCoverArt(value: unknown): Promise<StagedCanonicalCover> {
    const asset = parseCoverAsset(value);
    const stagingPath = await fs.mkdtemp(path.join(os.tmpdir(), 'indii-ddex-cover-'));
    const extension = asset.mime_type === 'image/png' ? '.png' : '.jpg';
    const localPath = path.join(stagingPath, `${asset.content_hash.slice(0, 16)}${extension}`);
    const cleanup = () => fs.rm(stagingPath, { recursive: true, force: true });
    try {
        const response = await fetch(asset.download_url, { method: 'GET', redirect: 'error' });
        if (!response.ok) throw new Error(`Canonical cover download failed with HTTP ${response.status}.`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.byteLength !== asset.size_bytes) throw new Error('Canonical cover size does not match stored metadata.');
        if (crypto.createHash('sha256').update(bytes).digest('hex') !== asset.content_hash) throw new Error('Canonical cover SHA-256 verification failed.');
        const { width, height, color_space } = inspectImage(bytes, asset.mime_type);
        if (width < 3000 || height < 3000 || width !== height) throw new Error(`Canonical cover must be square and at least 3000px (measured ${width}x${height}).`);
        await fs.writeFile(localPath, bytes, { mode: 0o600, flag: 'wx' });
        const { download_url: _downloadUrl, ...stagedAsset } = asset;
        return { cleanup, coverAsset: { ...stagedAsset, local_path: localPath, width, height, color_space } };
    } catch (error) {
        await cleanup();
        throw error;
    }
}
