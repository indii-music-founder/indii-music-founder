export type ReleaseAudioMeasurement = { format: 'wav' | 'flac'; sampleRate: number; bitDepth: number; channels: number };

const fourCC = (view: DataView, offset: number) => String.fromCharCode(...Array.from({ length: 4 }, (_, i) => view.getUint8(offset + i)));

/** Reads original container metadata; browser-decoded PCM and filename are not evidence. */
export async function measureReleaseAudio(file: File): Promise<ReleaseAudioMeasurement> {
  const view = new DataView(await file.arrayBuffer());
  if (view.byteLength < 12) throw new Error('The audio file is truncated or has no recognizable container header.');
  if (fourCC(view, 0) === 'RIFF' && fourCC(view, 8) === 'WAVE') {
    let offset = 12;
    while (offset + 8 <= view.byteLength) {
      const id = fourCC(view, offset), size = view.getUint32(offset + 4, true), data = offset + 8;
      if (data + size > view.byteLength) throw new Error('The WAV file is truncated.');
      if (id === 'fmt ') {
        if (size < 16) throw new Error('The WAV format header is invalid.');
        const codec = view.getUint16(data, true);
        if (codec !== 1 && codec !== 3) throw new Error(`WAV codec ${codec} is not an uncompressed PCM master.`);
        return { format: 'wav', channels: view.getUint16(data + 2, true), sampleRate: view.getUint32(data + 4, true), bitDepth: view.getUint16(data + 14, true) };
      }
      offset = data + size + (size % 2);
    }
    throw new Error('The WAV file has no format header.');
  }
  if (fourCC(view, 0) === 'fLaC') {
    if (view.byteLength < 42 || view.getUint8(4) !== 0) throw new Error('The FLAC STREAMINFO header is missing.');
    const length = (view.getUint8(5) << 16) | (view.getUint8(6) << 8) | view.getUint8(7);
    if (length !== 34 || view.byteLength < 42) throw new Error('The FLAC STREAMINFO header is truncated.');
    const packed = (BigInt(view.getUint32(18)) << 32n) | BigInt(view.getUint32(22));
    return { format: 'flac', sampleRate: Number((packed >> 44n) & 0xfffffn), channels: Number((packed >> 41n) & 7n) + 1, bitDepth: Number((packed >> 36n) & 31n) + 1 };
  }
  throw new Error('The file bytes are not a WAV or FLAC master, regardless of its filename.');
}

export function validateReleaseAudio({ sampleRate, bitDepth, channels }: ReleaseAudioMeasurement): string | null {
  if (sampleRate < 44_100) return `Sample rate must be at least 44.1 kHz (measured ${sampleRate} Hz).`;
  if (![16, 24].includes(bitDepth)) return `Bit depth must be 16-bit or 24-bit (measured ${bitDepth}-bit).`;
  if (channels !== 2) return `Release master must be stereo (measured ${channels} channels).`;
  return null;
}

export async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
