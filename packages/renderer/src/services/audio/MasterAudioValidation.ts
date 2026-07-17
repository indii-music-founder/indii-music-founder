export interface MasterAudioProperties {
    bitDepth: number;
    channels: number;
    codec: 'PCM' | 'FLAC';
    container: 'wav' | 'flac';
    sampleRate: number;
}

function fourCC(view: DataView, offset: number): string {
    return String.fromCharCode(...Array.from({ length: 4 }, (_, index) => view.getUint8(offset + index)));
}

async function readFileBytes(file: File): Promise<ArrayBuffer> {
    if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();

    return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Unable to read master audio bytes.'));
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(file);
    });
}

function measureBytes(bytes: ArrayBuffer): MasterAudioProperties {
    const view = new DataView(bytes);
    if (view.byteLength < 12) {
        throw new Error('The master is truncated or has no recognizable WAV or FLAC container header.');
    }

    if (fourCC(view, 0) === 'RIFF' && fourCC(view, 8) === 'WAVE') {
        let offset = 12;
        while (offset + 8 <= view.byteLength) {
            const id = fourCC(view, offset);
            const size = view.getUint32(offset + 4, true);
            const dataOffset = offset + 8;
            if (dataOffset + size > view.byteLength) throw new Error('The WAV master is truncated.');
            if (id === 'fmt ') {
                if (size < 16) throw new Error('The WAV master format header is invalid.');
                const codec = view.getUint16(dataOffset, true);
                if (codec !== 1 && codec !== 3) {
                    throw new Error(`WAV codec ${codec} is not an uncompressed PCM master.`);
                }
                return {
                    bitDepth: view.getUint16(dataOffset + 14, true),
                    channels: view.getUint16(dataOffset + 2, true),
                    codec: 'PCM',
                    container: 'wav',
                    sampleRate: view.getUint32(dataOffset + 4, true),
                };
            }
            offset = dataOffset + size + (size % 2);
        }
        throw new Error('The WAV master has no format header.');
    }

    if (fourCC(view, 0) === 'fLaC') {
        if (view.byteLength < 42 || view.getUint8(4) !== 0) {
            throw new Error('The FLAC master STREAMINFO header is missing.');
        }
        const length = (view.getUint8(5) << 16) | (view.getUint8(6) << 8) | view.getUint8(7);
        if (length !== 34) throw new Error('The FLAC master STREAMINFO header is truncated.');
        const packed = (BigInt(view.getUint32(18)) << 32n) | BigInt(view.getUint32(22));
        return {
            bitDepth: Number((packed >> 36n) & 31n) + 1,
            channels: Number((packed >> 41n) & 7n) + 1,
            codec: 'FLAC',
            container: 'flac',
            sampleRate: Number((packed >> 44n) & 0xfffffn),
        };
    }

    throw new Error('The file bytes are not a WAV or FLAC master, regardless of filename or MIME type.');
}

export function validateMasterAudio(properties: MasterAudioProperties): string | null {
    if (properties.sampleRate < 44_100) {
        return `Sample rate must be at least 44.1 kHz (measured ${properties.sampleRate} Hz).`;
    }
    if (![16, 24].includes(properties.bitDepth)) {
        return `Bit depth must be 16-bit or 24-bit (measured ${properties.bitDepth}-bit).`;
    }
    if (properties.channels !== 2) {
        return `Release master must be stereo (measured ${properties.channels} channels).`;
    }
    return null;
}

export async function measureMasterAudio(file: File): Promise<MasterAudioProperties> {
    return measureBytes(await readFileBytes(file));
}

export async function sha256Hex(file: File): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', await readFileBytes(file));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function inspectCanonicalMaster(file: File): Promise<{
    audioProperties: MasterAudioProperties;
    contentHash: string;
}> {
    const bytes = await readFileBytes(file);
    const audioProperties = measureBytes(bytes);
    const validationError = validateMasterAudio(audioProperties);
    if (validationError) throw new Error(validationError);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const contentHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return { audioProperties, contentHash };
}
