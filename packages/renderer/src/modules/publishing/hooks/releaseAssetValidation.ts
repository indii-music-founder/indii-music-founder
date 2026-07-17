import {
  measureMasterAudio,
  sha256Hex,
  validateMasterAudio,
  type MasterAudioProperties,
} from '@/services/audio/MasterAudioValidation';

export type ReleaseAudioMeasurement = MasterAudioProperties & { format: 'wav' | 'flac' };

/** Backward-compatible publishing aliases over the canonical master validator. */
export async function measureReleaseAudio(file: File): Promise<ReleaseAudioMeasurement> {
  const measurement = await measureMasterAudio(file);
  return { ...measurement, format: measurement.container };
}

export const validateReleaseAudio = validateMasterAudio;
export { sha256Hex };
