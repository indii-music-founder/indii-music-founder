import { describe, expect, it } from 'vitest';
import { measureReleaseAudio, validateReleaseAudio } from './releaseAssetValidation';

function file(bytes: Uint8Array, name: string): File {
  // jsdom's File lacks arrayBuffer; production browser File always implements it.
  return { name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as unknown as File;
}

function wav({ rate = 44_100, bits = 24, channels = 2, codec = 1 }: { rate?: number; bits?: number; channels?: number; codec?: number } = {}) {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);
  bytes.set([...new TextEncoder().encode('RIFF')], 0); view.setUint32(4, 36, true); bytes.set([...new TextEncoder().encode('WAVEfmt ')], 8);
  view.setUint32(16, 16, true); view.setUint16(20, codec, true); view.setUint16(22, channels, true); view.setUint32(24, rate, true);
  view.setUint16(34, bits, true); bytes.set([...new TextEncoder().encode('data')], 36);
  return file(bytes, 'master.wav');
}

describe('release asset audio validation', () => {
  it('measures PCM WAV headers instead of trusting the filename', async () => {
    await expect(measureReleaseAudio(wav())).resolves.toMatchObject({ format: 'wav', sampleRate: 44_100, bitDepth: 24, channels: 2 });
  });
  it('rejects renamed data and non-stereo/low-rate masters with measured reasons', async () => {
    await expect(measureReleaseAudio(file(new TextEncoder().encode('not audio'), 'master.wav'))).rejects.toThrow(/truncated|not a WAV or FLAC/);
    expect(validateReleaseAudio(await measureReleaseAudio(wav({ channels: 1 })))).toMatch(/stereo/);
    expect(validateReleaseAudio(await measureReleaseAudio(wav({ rate: 22_050 })))).toMatch(/44.1 kHz/);
  });
  it('rejects compressed WAV codec headers', async () => {
    await expect(measureReleaseAudio(wav({ codec: 85 }))).rejects.toThrow(/not an uncompressed PCM/);
  });
});
