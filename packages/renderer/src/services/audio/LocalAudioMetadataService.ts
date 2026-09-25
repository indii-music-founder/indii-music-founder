import type { Provenance } from '@shared/schemas/musicEntity';

export type LocalAudioMetadataField = 'title' | 'artist' | 'album' | 'isrc';

export interface LocalAudioMetadataReport {
    filename: string;
    fields: Array<{ field: LocalAudioMetadataField; value: string }>;
    provenance: Provenance;
    mode: 'LOCAL_ONLY';
    networkCalls: 0;
    persisted: false;
}

const MAX_TAG_BLOCK_BYTES = 256 * 1024;
const MAX_TAG_COUNT = 2048;
const MAX_CONTAINER_BLOCKS = 4096;
const MAX_REPORTED_FIELDS = 64;
const MAX_FIELD_LENGTH = 1024;
const FIELD_NAMES = new Set<LocalAudioMetadataField>(['title', 'artist', 'album', 'isrc']);

function ascii(bytes: Uint8Array): string {
    return String.fromCharCode(...bytes);
}

async function readBytes(file: Blob, start: number, end: number): Promise<Uint8Array> {
    const chunk = file.slice(start, end);
    if (typeof chunk.arrayBuffer === 'function') return new Uint8Array(await chunk.arrayBuffer());

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.onerror = () => reject(reader.error || new Error('Unable to read local metadata bytes.'));
        reader.readAsArrayBuffer(chunk);
    });
}

function decodeTag(bytes: Uint8Array): string {
    return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/g, '').trim().slice(0, MAX_FIELD_LENGTH);
}

function isRangeValid(offset: number, length: number, size: number): boolean {
    return Number.isSafeInteger(offset) && Number.isSafeInteger(length) && offset >= 0 && length >= 0 && offset + length <= size;
}

export class LocalAudioMetadataService {
    async inspect(file: File | Blob): Promise<LocalAudioMetadataReport> {
        if (!file || typeof file.slice !== 'function' || typeof file.size !== 'number') {
            throw new Error('Local metadata inspection requires an in-memory File or Blob.');
        }

        const header = await readBytes(file, 0, 12);
        let fields: LocalAudioMetadataReport['fields'] = [];

        if (header.length >= 12 && ascii(header.subarray(0, 4)) === 'RIFF' && ascii(header.subarray(8, 12)) === 'WAVE') {
            const riffLength = new DataView(header.buffer, header.byteOffset, header.byteLength).getUint32(4, true);
            if (riffLength >= 4) fields = await this.readWaveInfo(file, Math.min(file.size, riffLength + 8));
        } else if (header.length >= 4 && ascii(header.subarray(0, 4)) === 'fLaC') {
            fields = await this.readFlacComments(file);
        }

        const provenance: Provenance = {
            state: 'DETECTED',
            sourceType: 'SYSTEM',
            sourceId: 'local-embedded-audio-metadata',
            evidence: [{
                id: `local-metadata-${file.size}-${file.type || 'unknown'}`,
                type: 'OTHER',
                description: 'Embedded audio tags read from the user-selected local file; values remain unconfirmed.',
            }],
            observedAt: new Date().toISOString(),
            note: 'Embedded tags are unconfirmed detections, not canonical identity, rights, registration, or clearance facts.',
        };

        return {
            filename: typeof File !== 'undefined' && file instanceof File ? file.name : 'audio',
            fields,
            provenance,
            mode: 'LOCAL_ONLY',
            networkCalls: 0,
            persisted: false,
        };
    }

    private async readWaveInfo(file: Blob, riffEnd: number): Promise<LocalAudioMetadataReport['fields']> {
        const fields: LocalAudioMetadataReport['fields'] = [];
        let offset = 12;
        let chunkCount = 0;

        while (isRangeValid(offset, 8, riffEnd) && chunkCount < MAX_CONTAINER_BLOCKS && fields.length < MAX_REPORTED_FIELDS) {
            chunkCount += 1;
            const chunkHeader = await readBytes(file, offset, offset + 8);
            const chunkId = ascii(chunkHeader.subarray(0, 4));
            const view = new DataView(chunkHeader.buffer, chunkHeader.byteOffset, chunkHeader.byteLength);
            const chunkLength = view.getUint32(4, true);
            const dataOffset = offset + 8;
            if (!isRangeValid(dataOffset, chunkLength, riffEnd)) break;

            if (chunkId === 'LIST' && chunkLength >= 4 && chunkLength <= MAX_TAG_BLOCK_BYTES) {
                const list = await readBytes(file, dataOffset, dataOffset + chunkLength);
                if (ascii(list.subarray(0, 4)) === 'INFO') {
                    this.readWaveInfoList(list.subarray(4), fields);
                }
            }

            const advance = 8 + chunkLength + (chunkLength % 2);
            if (advance < 8 || !isRangeValid(offset, advance, riffEnd)) break;
            offset += advance;
        }

        return fields;
    }

    private readWaveInfoList(bytes: Uint8Array, fields: LocalAudioMetadataReport['fields']): void {
        const fieldByChunk: Record<string, LocalAudioMetadataField> = {
            INAM: 'title', IART: 'artist', IPRD: 'album', ISRC: 'isrc',
        };
        let offset = 0;
        let count = 0;
        while (isRangeValid(offset, 8, bytes.length) && count < MAX_TAG_COUNT) {
            count += 1;
            const id = ascii(bytes.subarray(offset, offset + 4));
            const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
            const length = view.getUint32(4, true);
            const valueStart = offset + 8;
            if (!isRangeValid(valueStart, length, bytes.length)) break;
            const field = fieldByChunk[id];
            if (field) {
                const value = decodeTag(bytes.subarray(valueStart, valueStart + length));
                if (value && fields.length < MAX_REPORTED_FIELDS) fields.push({ field, value });
            }
            const advance = 8 + length + (length % 2);
            if (advance < 8) break;
            offset += advance;
        }
    }

    private async readFlacComments(file: Blob): Promise<LocalAudioMetadataReport['fields']> {
        const fields: LocalAudioMetadataReport['fields'] = [];
        let offset = 4;
        let isLastBlock = false;
        let blockCount = 0;

        while (!isLastBlock && isRangeValid(offset, 4, file.size) && blockCount < MAX_CONTAINER_BLOCKS && fields.length < MAX_REPORTED_FIELDS) {
            blockCount += 1;
            const blockHeader = await readBytes(file, offset, offset + 4);
            const blockType = blockHeader[0]! & 0x7f;
            isLastBlock = (blockHeader[0]! & 0x80) !== 0;
            const blockLength = (blockHeader[1]! << 16) | (blockHeader[2]! << 8) | blockHeader[3]!;
            const dataOffset = offset + 4;
            if (!isRangeValid(dataOffset, blockLength, file.size)) break;

            if (blockType === 4 && blockLength <= MAX_TAG_BLOCK_BYTES) {
                const block = await readBytes(file, dataOffset, dataOffset + blockLength);
                this.readVorbisComments(block, fields);
            }
            offset = dataOffset + blockLength;
        }

        return fields;
    }

    private readVorbisComments(bytes: Uint8Array, fields: LocalAudioMetadataReport['fields']): void {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let offset = 0;
        const readLength = (): number | null => {
            if (!isRangeValid(offset, 4, bytes.length)) return null;
            const length = view.getUint32(offset, true);
            offset += 4;
            if (!isRangeValid(offset, length, bytes.length)) return null;
            return length;
        };

        const vendorLength = readLength();
        if (vendorLength === null) return;
        offset += vendorLength;
        const commentCount = readLength();
        if (commentCount === null) return;

        const fieldByName: Record<string, LocalAudioMetadataField> = {
            TITLE: 'title', ARTIST: 'artist', ALBUM: 'album', ISRC: 'isrc',
        };
        const boundedCount = Math.min(commentCount, MAX_TAG_COUNT);
        for (let index = 0; index < boundedCount; index += 1) {
            const length = readLength();
            if (length === null) return;
            const comment = decodeTag(bytes.subarray(offset, offset + length));
            offset += length;
            const separator = comment.indexOf('=');
            if (separator < 1) continue;
            const fieldName = comment.slice(0, separator).toUpperCase();
            const field = fieldByName[fieldName];
            const value = comment.slice(separator + 1, separator + 1 + MAX_FIELD_LENGTH).trim();
            if (field && value && FIELD_NAMES.has(field) && fields.length < MAX_REPORTED_FIELDS) {
                fields.push({ field, value });
            }
        }
    }
}

export const localAudioMetadataService = new LocalAudioMetadataService();
