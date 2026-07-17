import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const FIREBASE_DOWNLOAD_HOSTS = new Set([
    'firebasestorage.googleapis.com',
    'storage.googleapis.com',
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_MASTER_BYTES = 20 * 1024 * 1024 * 1024;

interface CanonicalMasterPayload {
    content_hash: string;
    download_url: string;
    master_fingerprint: string;
    mime_type: string;
    original_file_name: string;
    size_bytes: number;
    storage_path: string;
}

interface MeasuredMasterProperties {
    bit_depth: number;
    channels: number;
    codec: 'PCM' | 'FLAC';
    container: 'wav' | 'flac';
    sample_rate: number;
}

export interface StagedCanonicalMasters {
    cleanup: () => Promise<void>;
    releaseData: Record<string, unknown>;
    stagingPath: string;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${label} is required.`);
    }
    return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
    const value = record[key];
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`Canonical master ${key} is required.`);
    }
    return value.trim();
}

function parseMasterAsset(value: unknown): CanonicalMasterPayload {
    const asset = requireRecord(value, 'Canonical master_asset');
    if ('local_path' in asset) {
        throw new Error('Canonical master local_path is reserved for the trusted desktop process.');
    }

    const rawSizeBytes = asset.size_bytes;
    const parsed: CanonicalMasterPayload = {
        content_hash: requireString(asset, 'content_hash').toLowerCase(),
        download_url: requireString(asset, 'download_url'),
        master_fingerprint: requireString(asset, 'master_fingerprint'),
        mime_type: requireString(asset, 'mime_type').toLowerCase(),
        original_file_name: requireString(asset, 'original_file_name'),
        size_bytes: typeof rawSizeBytes === 'number' ? rawSizeBytes : Number.NaN,
        storage_path: requireString(asset, 'storage_path'),
    };

    if (!SHA256_PATTERN.test(parsed.content_hash)) {
        throw new Error('Canonical master content_hash must be a SHA-256 digest.');
    }
    if (!parsed.mime_type.startsWith('audio/')) {
        throw new Error('Canonical master mime_type must identify audio.');
    }
    if (!Number.isSafeInteger(parsed.size_bytes) || parsed.size_bytes <= 0 || parsed.size_bytes > MAX_MASTER_BYTES) {
        throw new Error('Canonical master size_bytes is outside the supported range.');
    }
    if (path.basename(parsed.original_file_name) !== parsed.original_file_name || /[\0\r\n]/.test(parsed.original_file_name)) {
        throw new Error('Canonical master original_file_name is unsafe.');
    }

    const storageSegments = parsed.storage_path.split('/');
    if (
        storageSegments.length !== 4 ||
        storageSegments[0] !== 'masters' ||
        !storageSegments[1] ||
        storageSegments[2] !== parsed.content_hash ||
        !/^original\.[a-z0-9]{1,8}$/i.test(storageSegments[3] ?? '')
    ) {
        throw new Error('Canonical master storage_path is not a content-addressed master path.');
    }

    validateDownloadUrl(parsed.download_url, parsed.storage_path);
    return parsed;
}

function validateDownloadUrl(rawUrl: string, expectedStoragePath: string): void {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error('Canonical master download_url is invalid.');
    }

    if (url.protocol !== 'https:' || !FIREBASE_DOWNLOAD_HOSTS.has(url.hostname)) {
        throw new Error('Canonical master download_url must use Firebase Storage.');
    }

    let encodedObjectPath: string | undefined;
    if (url.hostname === 'firebasestorage.googleapis.com') {
        const segments = url.pathname.split('/').filter(Boolean);
        const objectIndex = segments.indexOf('o');
        encodedObjectPath = objectIndex >= 0 ? segments.slice(objectIndex + 1).join('/') : undefined;
        if (url.searchParams.get('alt') !== 'media') {
            throw new Error('Canonical master Firebase Storage URL must request media bytes.');
        }
    } else {
        const segments = url.pathname.split('/').filter(Boolean);
        encodedObjectPath = segments.length > 1 ? segments.slice(1).join('/') : undefined;
    }

    let decodedObjectPath = '';
    try {
        decodedObjectPath = encodedObjectPath ? decodeURIComponent(encodedObjectPath) : '';
    } catch {
        throw new Error('Canonical master Firebase Storage object path is invalid.');
    }
    if (decodedObjectPath !== expectedStoragePath) {
        throw new Error('Canonical master download URL does not match storage_path.');
    }
}

async function downloadAndVerify(asset: CanonicalMasterPayload, destination: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);

    try {
        const response = await fetch(asset.download_url, {
            method: 'GET',
            redirect: 'error',
            signal: controller.signal,
        });
        if (!response.ok || !response.body) {
            throw new Error(`Canonical master download failed with HTTP ${response.status}.`);
        }

        const contentLength = response.headers.get('content-length');
        if (contentLength && Number(contentLength) !== asset.size_bytes) {
            throw new Error('Canonical master size does not match stored metadata.');
        }

        const digest = crypto.createHash('sha256');
        const handle = await fs.open(destination, 'wx', 0o600);
        let bytesWritten = 0;
        try {
            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = Buffer.from(value);
                bytesWritten += chunk.byteLength;
                if (bytesWritten > asset.size_bytes) {
                    throw new Error('Canonical master download exceeded its declared size.');
                }
                digest.update(chunk);
                await handle.write(chunk);
            }
        } finally {
            await handle.close();
        }

        if (bytesWritten !== asset.size_bytes) {
            throw new Error('Canonical master size does not match stored metadata.');
        }
        if (digest.digest('hex') !== asset.content_hash) {
            throw new Error('Canonical master SHA-256 verification failed.');
        }
    } finally {
        clearTimeout(timeout);
    }
}

function validateMeasuredMaster(properties: MeasuredMasterProperties): void {
    if (properties.sample_rate < 44_100) {
        throw new Error(`Canonical master sample rate is below 44.1 kHz (${properties.sample_rate} Hz).`);
    }
    if (![16, 24].includes(properties.bit_depth)) {
        throw new Error(`Canonical master bit depth must be 16 or 24 (${properties.bit_depth} measured).`);
    }
    if (properties.channels !== 2) {
        throw new Error(`Canonical master must be stereo (${properties.channels} channels measured).`);
    }
}

async function inspectStagedMaster(filePath: string, asset: CanonicalMasterPayload): Promise<MeasuredMasterProperties> {
    const handle = await fs.open(filePath, 'r');
    const header = Buffer.alloc(64 * 1024);
    let bytesRead = 0;
    try {
        ({ bytesRead } = await handle.read(header, 0, header.length, 0));
    } finally {
        await handle.close();
    }

    const bytes = header.subarray(0, bytesRead);
    let properties: MeasuredMasterProperties;
    if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE') {
        let offset = 12;
        let formatOffset = -1;
        while (offset + 8 <= bytes.length) {
            const chunkSize = bytes.readUInt32LE(offset + 4);
            const dataOffset = offset + 8;
            if (bytes.toString('ascii', offset, offset + 4) === 'fmt ') {
                if (chunkSize < 16 || dataOffset + 16 > bytes.length) {
                    throw new Error('Canonical WAV master format header is truncated.');
                }
                formatOffset = dataOffset;
                break;
            }
            offset = dataOffset + chunkSize + (chunkSize % 2);
        }
        if (formatOffset < 0) throw new Error('Canonical WAV master has no readable format header.');
        const waveCodec = bytes.readUInt16LE(formatOffset);
        if (waveCodec !== 1 && waveCodec !== 3) {
            throw new Error(`Canonical WAV master uses compressed codec ${waveCodec}.`);
        }
        properties = {
            bit_depth: bytes.readUInt16LE(formatOffset + 14),
            channels: bytes.readUInt16LE(formatOffset + 2),
            codec: 'PCM',
            container: 'wav',
            sample_rate: bytes.readUInt32LE(formatOffset + 4),
        };
    } else if (bytes.length >= 42 && bytes.toString('ascii', 0, 4) === 'fLaC' && bytes[4] === 0) {
        const streamInfoLength = ((bytes[5] ?? 0) << 16) | ((bytes[6] ?? 0) << 8) | (bytes[7] ?? 0);
        if (streamInfoLength !== 34) throw new Error('Canonical FLAC master STREAMINFO header is invalid.');
        const packed = (BigInt(bytes.readUInt32BE(18)) << 32n) | BigInt(bytes.readUInt32BE(22));
        properties = {
            bit_depth: Number((packed >> 36n) & 31n) + 1,
            channels: Number((packed >> 41n) & 7n) + 1,
            codec: 'FLAC',
            container: 'flac',
            sample_rate: Number((packed >> 44n) & 0xfffffn),
        };
    } else {
        throw new Error('Canonical master bytes are not a supported WAV or FLAC container.');
    }

    const expectedExtension = `.${properties.container}`;
    const expectedMimeType = properties.container === 'wav' ? 'audio/wav' : 'audio/flac';
    if (path.extname(asset.storage_path).toLowerCase() !== expectedExtension || asset.mime_type !== expectedMimeType) {
        throw new Error('Canonical master container does not match its immutable storage metadata.');
    }
    validateMeasuredMaster(properties);
    return properties;
}

export async function stageCanonicalMasters(
    releaseData: Record<string, unknown>
): Promise<StagedCanonicalMasters> {
    const tracks = releaseData.tracks;
    if (!Array.isArray(tracks) || tracks.length === 0) {
        throw new Error('At least one canonical master track is required.');
    }

    // Validate every renderer-controlled field before creating files or issuing requests.
    const parsedTracks = tracks.map((track, index) => {
        const record = requireRecord(track, `Track ${index + 1}`);
        return { record, asset: parseMasterAsset(record.master_asset) };
    });

    const stagingPath = await fs.mkdtemp(path.join(os.tmpdir(), 'indii-ddex-master-'));
    const cleanup = () => fs.rm(stagingPath, { force: true, recursive: true });

    try {
        const stagedTracks: Record<string, unknown>[] = [];
        for (const [index, { record, asset }] of parsedTracks.entries()) {
            const extension = path.extname(asset.storage_path).toLowerCase();
            const stagedName = `${String(index + 1).padStart(2, '0')}-${asset.content_hash.slice(0, 16)}${extension}`;
            const localPath = path.join(stagingPath, stagedName);
            await downloadAndVerify(asset, localPath);
            const measured = await inspectStagedMaster(localPath, asset);

            stagedTracks.push({
                ...record,
                ...measured,
                filename: `resources/${stagedName}`,
                master_asset: {
                    audio_properties: measured,
                    content_hash: asset.content_hash,
                    local_path: localPath,
                    master_fingerprint: asset.master_fingerprint,
                    mime_type: asset.mime_type,
                    original_file_name: asset.original_file_name,
                    size_bytes: asset.size_bytes,
                    storage_path: asset.storage_path,
                },
            });
        }

        return {
            cleanup,
            releaseData: { ...releaseData, tracks: stagedTracks },
            stagingPath,
        };
    } catch (error) {
        await cleanup();
        throw error;
    }
}
