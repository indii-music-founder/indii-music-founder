import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getStorage } from 'firebase-admin/storage';

const MAX_MEDIA_BYTES = 512 * 1024 * 1024;
const MEDIA_TYPE = /^(video|audio|image)\//;

export function ownedRenderMediaSource(source: string, bucket: string, uid: string): string {
    let objectPath: string;
    if (source.startsWith('gs://')) {
        const prefix = `gs://${bucket}/`;
        if (!source.startsWith(prefix)) throw new Error('Render media must use the project Storage bucket.');
        objectPath = source.slice(prefix.length);
    } else {
        const url = new URL(source);
        if (url.protocol !== 'https:' || url.port || url.username || url.password) throw new Error('Render media must use a trusted HTTPS Storage URL.');
        if (url.hostname === 'storage.googleapis.com') {
            const prefix = `/${bucket}/`;
            if (!url.pathname.startsWith(prefix)) throw new Error('Render media must use the project Storage bucket.');
            objectPath = decodeURIComponent(url.pathname.slice(prefix.length));
        } else if (url.hostname === 'firebasestorage.googleapis.com') {
            const match = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname);
            if (!match || match[1] !== bucket) throw new Error('Render media must use the project Storage bucket.');
            objectPath = decodeURIComponent(match[2]!);
        } else {
            throw new Error('External render media URLs are not supported. Upload the asset to your project first.');
        }
    }
    if (!objectPath || objectPath.includes('\\') || [...objectPath].some(character => character.charCodeAt(0) < 32) || objectPath.split('/').some(part => !part || part === '..' || part === '.')) {
        throw new Error('Render media object path is invalid.');
    }
    const prefixes = [`users/${uid}/`, `creative/${uid}/`, `videos/${uid}/`, `masters/${uid}/`];
    if (!prefixes.some(prefix => objectPath.startsWith(prefix))) throw new Error('Render media does not belong to this job owner.');
    return objectPath;
}

export async function downloadOwnedRenderMedia(source: string, destination: string, uid: string, remainingBytes = 2 * 1024 * 1024 * 1024): Promise<number> {
    const bucket = getStorage().bucket();
    const objectPath = ownedRenderMediaSource(source, bucket.name, uid);
    const object = bucket.file(objectPath);
    const [metadata] = await object.getMetadata();
    const size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_MEDIA_BYTES || size > remainingBytes) throw new Error('Render media exceeds the 512 MB object or 2 GB job limit.');
    if (!MEDIA_TYPE.test(metadata.contentType ?? '')) throw new Error('Render media has an unsupported content type.');
    const generation = Number(metadata.generation);
    if (!Number.isSafeInteger(generation) || generation <= 0 || !metadata.md5Hash) throw new Error('Render media is missing pinned integrity metadata.');
    const digest = createHash('md5');
    let received = 0;
    const limit = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            received += chunk.length;
            if (received > MAX_MEDIA_BYTES || received > size) return callback(new Error('Render media stream exceeded its verified size.'));
            digest.update(chunk);
            callback(null, chunk);
        },
    });
    try {
        await pipeline(bucket.file(objectPath, { generation }).createReadStream(), limit, createWriteStream(destination), { signal: AbortSignal.timeout(5 * 60_000) });
        if (received !== size || digest.digest('base64') !== metadata.md5Hash) throw new Error('Render media checksum does not match Storage metadata.');
        return received;
    } catch (error) {
        await rm(destination, { force: true }).catch(() => undefined);
        throw error;
    }
}
