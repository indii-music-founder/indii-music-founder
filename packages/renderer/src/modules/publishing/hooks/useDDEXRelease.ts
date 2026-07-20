/**
 * useDDEXRelease Hook
 * Manages state for DDEX release creation workflow
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/services/firebase';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { INGESTION_CONFIG } from '@/core/config/ingestion';
import { masterAudioService } from '@/services/audio/MasterAudioService';
import { canonicalCoverArtService } from '@/services/distribution/CanonicalCoverArtService';
import { agentService } from '@/services/agent/AgentService';
import type { ExtendedGoldenMetadata, DDEXReleaseRecord } from '@/services/metadata/types';
import type { DistributorId, ReleaseAssets } from '@/services/distribution/types/distributor';
import { logger } from '@/utils/logger';
import { DEFAULT_PROJECT_ID } from '@/core/constants';
import { validateImageForDistributor } from '@/services/onboarding/DistributorContext';
import { measureReleaseAudio, sha256Hex, validateReleaseAudio } from './releaseAssetValidation';

// Map display names from onboarding to DistributorId
const DISTRIBUTOR_NAME_MAP: Record<string, DistributorId> = {
  'distrokid': 'distrokid',
  'tunecore': 'tunecore',
  'cd baby': 'cdbaby',
  'cdbaby': 'cdbaby',
  'symphonic': 'symphonic',
  'ditto': 'ditto',
  'ditto music': 'ditto',
  'unitedmasters': 'unitedmasters',
  'united masters': 'unitedmasters',
  'awal': 'awal',
  'amuse': 'amuse'
};

// Audio format type matching DDEXReleaseRecord
type AudioFormat = 'wav' | 'flac' | 'mp3';

// Wizard steps
export type WizardStep =
  | 'metadata'
  | 'distribution'
  | 'ai_disclosure'
  | 'assets'
  | 'harness'
  | 'review'
  | 'submitting'
  | 'complete';

// Initial extended metadata
// Factory, not a module constant: INGESTION_CONFIG getters throw when the
// ingestion env vars are absent (fail-closed by design), so they must not be
// read at import time or the whole app dies at boot instead of at wizard use.
const createInitialExtendedMetadata = (): Partial<ExtendedGoldenMetadata> => ({
  trackTitle: '',
  artistName: '',
  isrc: '',
  explicit: false,
  genre: '',
  splits: [],
  pro: 'None',
  publisher: 'Self-Published',
  containsSamples: false,
  samples: [],
  isGolden: false,
  releaseType: 'Single',
  releaseDate: new Date().toISOString().split('T')[0],
  territories: ['Worldwide'],
  distributionChannels: ['streaming', 'download'],
  labelName: INGESTION_CONFIG.ENTITY_NAME,
  dpid: INGESTION_CONFIG.SYSTEM_IDENTIFIER,
  aiGeneratedContent: {
    isFullyAIGenerated: false,
    isPartiallyAIGenerated: false,
    aiToolsUsed: [],
    humanContribution: ''
  }
});

// Initial assets
const INITIAL_ASSETS: Partial<ReleaseAssets> = {
  audioFile: undefined,
  coverArt: undefined
};

export interface UseDDEXReleaseReturn {
  // Current step
  currentStep: WizardStep;
  setCurrentStep: (step: WizardStep) => void;

  // Metadata
  metadata: Partial<ExtendedGoldenMetadata>;
  updateMetadata: (updates: Partial<ExtendedGoldenMetadata>) => void;

  // Distributors
  selectedDistributors: DistributorId[];
  toggleDistributor: (id: DistributorId) => void;

  // Assets
  assets: Partial<ReleaseAssets>;
  updateAssets: (updates: Partial<ReleaseAssets>) => void;
  uploadAsset: (type: 'audio' | 'cover', file: File) => Promise<string>;
  uploadProgress: { audio: number; cover: number };

  // Validation
  isStepValid: (step: WizardStep) => boolean;
  validationErrors: string[];

  // Navigation
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;

  // Submission
  submitRelease: () => Promise<string>;
  isSubmitting: boolean;
  submitError: string | null;
  releaseId: string | null;

  // Reset
  resetWizard: () => void;
}

const STEP_ORDER: WizardStep[] = ['metadata', 'distribution', 'ai_disclosure', 'assets', 'harness', 'review'];

/**
 * Extract real audio metadata (sample rate, bit depth) from a File using the Web Audio API.
 *
 * ISSUE-963: returns null on decode failure instead of fabricating
 * format-based defaults — a file that cannot be decoded must never be
 * displayed/stored as if it were measured.
 */
async function extractAudioMetadata(file: File): Promise<{ sampleRate: number; bitDepth: number; channels: number; format: 'wav' | 'flac'; hash: string } | null> {
  try {
    const measurement = await measureReleaseAudio(file);
    const validationError = validateReleaseAudio(measurement);
    if (validationError) throw new Error(validationError);
    return { ...measurement, hash: await sha256Hex(file) };
  } catch (error: unknown) {
    logger.warn('[useDDEXRelease] AudioContext decoding failed — file cannot be verified:', error);
    return null;
  }
}

/**
 * Extract real image dimensions from an image URL using the Image API.
 *
 * ISSUE-963: returns null on failure instead of fabricating a 3000x3000
 * default — an image that cannot be decoded must never be displayed/stored
 * as if its dimensions were measured.
 */
async function extractImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  const imageUrl = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = imageUrl;
    });
  } catch (error: unknown) {
    logger.warn('[useDDEXRelease] Failed to extract image dimensions — file cannot be verified:', error);
    return null;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export function useDDEXRelease(): UseDDEXReleaseReturn {
  const { currentOrganizationId, organizations, userProfile, currentProjectId } = useStore(
    useShallow(state => ({
      currentOrganizationId: state.currentOrganizationId,
      organizations: state.organizations,
      userProfile: state.userProfile,
      currentProjectId: state.currentProjectId,
    }))
  );

  // Get current organization
  const activeOrg = useMemo(() =>
    organizations.find(org => org.id === currentOrganizationId),
    [organizations, currentOrganizationId]
  );

  const activeProjectId = currentProjectId || DEFAULT_PROJECT_ID;

  // Get user's preferred distributor from onboarding profile
  const userDistributor = useMemo(() => {
    const profileDistributor = userProfile?.brandKit?.socials?.distributor?.toLowerCase();
    if (profileDistributor && DISTRIBUTOR_NAME_MAP[profileDistributor]) {
      return DISTRIBUTOR_NAME_MAP[profileDistributor];
    }
    return 'distrokid'; // Fallback default
  }, [userProfile?.brandKit?.socials?.distributor]);

  const [currentStep, setCurrentStep] = useState<WizardStep>('metadata');
  const [metadata, setMetadata] = useState<Partial<ExtendedGoldenMetadata>>(createInitialExtendedMetadata);
  const [selectedDistributors, setSelectedDistributors] = useState<DistributorId[]>([userDistributor]);
  const [assets, setAssets] = useState<Partial<ReleaseAssets>>(INITIAL_ASSETS);
  const [uploadProgress, setUploadProgress] = useState({ audio: 0, cover: 0 });

  // Sync distributor selection when userProfile changes (e.g., after onboarding)
  useEffect(() => {
    if (userDistributor && selectedDistributors.length === 1 && selectedDistributors[0] !== userDistributor) {
      // Only auto-update if user hasn't made manual selections
      setSelectedDistributors([userDistributor]);
    }
  }, [userDistributor, selectedDistributors]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [releaseId, setReleaseId] = useState<string | null>(null);

  // Update metadata
  const updateMetadata = useCallback((updates: Partial<ExtendedGoldenMetadata>) => {
    setMetadata(prev => ({ ...prev, ...updates }));
  }, []);

  // Toggle distributor selection
  const toggleDistributor = useCallback((id: DistributorId) => {
    setSelectedDistributors(prev =>
      prev.includes(id)
        ? prev.filter(d => d !== id)
        : [...prev, id]
    );
  }, []);

  // Update assets
  const updateAssets = useCallback((updates: Partial<ReleaseAssets>) => {
    setAssets(prev => ({ ...prev, ...updates }));
  }, []);

  // Upload asset
  const uploadAsset = useCallback(async (type: 'audio' | 'cover', file: File) => {
    if (!activeOrg?.id || !userProfile?.id) {
      throw new Error('Missing organization or user context');
    }

    // ISSUE-963: reject lossy audio formats before uploading any bytes —
    // MP3/AAC were previously accepted by the file picker (and by AAC-aware
    // extraction logic) despite the UI copy promising "WAV or FLAC" only,
    // and were silently relabeled as 'wav' at submission with no
    // transcoding. A release master must actually be lossless.
    if (type === 'audio') {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'wav' && ext !== 'flac') {
        const message = `"${file.name}" is a ${ext?.toUpperCase() || 'unrecognized'} file. Only WAV or FLAC masters are accepted for release delivery.`;
        setSubmitError(message);
        throw new Error(message);
      }
    }

    try {
      // A rejected master must not leave behind an orphaned package object.
      const audioMetadata = type === 'audio' ? await extractAudioMetadata(file) : null;
      const imageDimensions = type === 'cover' ? await extractImageDimensions(file) : null;
      if (type === 'audio' && !audioMetadata) {
        const message = `Could not decode or validate "${file.name}" — it may be corrupt or violate release-master requirements. It was not uploaded.`;
        setSubmitError(message);
        throw new Error(message);
      }
      if (type === 'cover' && !imageDimensions) {
        const message = `Could not read image dimensions for "${file.name}" — it may be corrupt or an unsupported format. It was not uploaded as cover art.`;
        setSubmitError(message);
        throw new Error(message);
      }
      if (type === 'audio') {
        // DDEX packaging references the same immutable, content-addressed
        // master as ingestion, analysis, video, and the track library.
        const masterFingerprint = metadata.masterFingerprint?.trim() || `SHA256-${audioMetadata.hash}`;
        setUploadProgress(prev => ({ ...prev, audio: 10 }));
        const masterAsset = await masterAudioService.persist(file, {
          userId: userProfile.id,
          masterFingerprint,
        });
        setUploadProgress(prev => ({ ...prev, audio: 100 }));

        const audioInfo = {
          url: masterAsset.downloadUrl,
          mimeType: file.type,
          sizeBytes: file.size,
          format: audioMetadata.format,
          sampleRate: audioMetadata.sampleRate,
          bitDepth: audioMetadata.bitDepth,
          hash: audioMetadata.hash,
          storagePath: masterAsset.storagePath,
          contentHash: masterAsset.contentHash,
          masterFingerprint: masterAsset.masterFingerprint,
        };
        setSubmitError(null);
        updateMetadata({
          userId: userProfile.id,
          masterFingerprint: masterAsset.masterFingerprint,
          masterAsset,
        });
        updateAssets({ audioFile: audioInfo });
        return masterAsset.downloadUrl;
      }

      // Cover art is a release-critical asset, not disposable packaging
      // collateral. Keep one immutable content-addressed object so the server
      // conformance audit can pin its generation and digest to the release.
      setUploadProgress(prev => ({ ...prev, cover: 10 }));
      const coverAsset = await canonicalCoverArtService.persistFile(file, {
        userId: userProfile.id,
        originalFileName: file.name,
      });
      setUploadProgress(prev => ({ ...prev, cover: 100 }));
      const coverInfo = {
        url: coverAsset.download_url,
        mimeType: coverAsset.mime_type,
        sizeBytes: coverAsset.size_bytes,
        width: imageDimensions.width,
        height: imageDimensions.height,
        storagePath: coverAsset.storage_path,
        contentHash: coverAsset.content_hash,
        generationProvenance: { source: 'uploaded' as const },
      };
      setSubmitError(null);
      updateAssets({ coverArt: coverInfo });
      return coverAsset.download_url;
    } catch (error: unknown) {
      logger.error(`Error uploading ${type} asset:`, error);
      throw error;
    }
  }, [activeOrg, userProfile, metadata.masterFingerprint, updateAssets, updateMetadata]);

  // Validation errors
  const getValidationErrors = useCallback((step: WizardStep): string[] => {
    const errors: string[] = [];

    switch (step) {
      case 'metadata':
        if (!metadata.trackTitle?.trim()) errors.push('Track title is required');
        if (!metadata.artistName?.trim()) errors.push('Artist name is required');
        if (!metadata.genre?.trim()) errors.push('Genre is required');
        if (!metadata.labelName?.trim()) errors.push('Label name is required');
        if (!metadata.releaseDate) errors.push('Release date is required');
        break;

      case 'distribution':
        if (selectedDistributors.length === 0) errors.push('Select at least one distributor');
        if (!metadata.territories?.length) errors.push('Select at least one territory');
        break;

      case 'ai_disclosure':
        // Autonomous disclosure is optional, no required fields
        break;

      case 'assets':
        if (!assets.audioFile) errors.push('Audio file is required');
        if (!assets.coverArt) errors.push('Cover art is required');
        if (assets.coverArt && userProfile) {
          const coverValidation = validateImageForDistributor(
            userProfile,
            assets.coverArt.width,
            assets.coverArt.height
          );
          errors.push(...coverValidation.errors.map(error => `Cover art: ${error}`));
        }
        break;

      case 'harness':
        // Harness compilation is recommended but non-blocking; review still gates release submission.
        break;

      case 'review':
        // Aggregate all errors
        return [
          ...getValidationErrors('metadata'),
          ...getValidationErrors('distribution'),
          ...getValidationErrors('assets')
        ];
    }

    return errors;
  }, [metadata, selectedDistributors, assets, userProfile]);

  const validationErrors = getValidationErrors(currentStep);

  // Check if step is valid
  const isStepValid = useCallback((step: WizardStep): boolean => {
    return getValidationErrors(step).length === 0;
  }, [getValidationErrors]);

  // Navigation
  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const canGoNext = currentStepIndex < STEP_ORDER.length - 1 && isStepValid(currentStep);
  const canGoPrevious = currentStepIndex > 0;

  const goToNextStep = useCallback(() => {
    if (canGoNext) {
      setCurrentStep(STEP_ORDER[currentStepIndex + 1]!);
    }
  }, [canGoNext, currentStepIndex]);

  const goToPreviousStep = useCallback(() => {
    if (canGoPrevious) {
      setCurrentStep(STEP_ORDER[currentStepIndex - 1]!);
    }
  }, [canGoPrevious, currentStepIndex]);

  // Submit release
  const submitRelease = useCallback(async (): Promise<string> => {
    if (!activeOrg?.id || !userProfile?.id) {
      throw new Error('Missing organization or user context');
    }

    // Navigation normally prevents this, but callers can invoke submission
    // directly. Recheck the real measured asset here so an undersized/non-square
    // cover can never enter the packaging record by bypassing the UI step.
    const assetErrors = getValidationErrors('assets');
    if (assetErrors.length > 0) {
      throw new Error(`Release assets are not ready: ${assetErrors.join('; ')}`);
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setCurrentStep('submitting');

    try {
      // ISSUE-964: a retry after a prior packaging failure reuses the
      // existing draft doc instead of creating a duplicate release record.
      let docId = releaseId;

      if (!docId) {
        // ISSUE-963: previously silently relabeled 'aac' as 'wav' here with
        // no transcoding, so a lossy AAC payload could be declared as a
        // lossless WAV master. uploadAsset() now rejects non-WAV/FLAC
        // formats before this point is ever reached; this is a defensive
        // second gate, not the primary enforcement.
        const rawFormat = assets.audioFile?.format;
        if (rawFormat !== 'wav' && rawFormat !== 'flac') {
          throw new Error(`Release audio must be WAV or FLAC (got "${rawFormat || 'unknown'}"). Re-upload a lossless master before submitting.`);
        }
        const audioFormat: AudioFormat = rawFormat;

        // Create release record
        const releaseRecord: Omit<DDEXReleaseRecord, 'id'> = {
          orgId: activeOrg.id,
          projectId: activeProjectId,
          userId: userProfile.id,
          metadata: metadata as ExtendedGoldenMetadata,
          assets: {
            audioUrl: assets.audioFile?.url || '',
            audioFormat,
            audioSampleRate: assets.audioFile?.sampleRate || 44100,
            audioBitDepth: assets.audioFile?.bitDepth || 16,
            ...(assets.audioFile?.storagePath ? { audioStoragePath: assets.audioFile.storagePath } : {}),
            ...(assets.audioFile?.contentHash ? { audioContentHash: assets.audioFile.contentHash } : {}),
            ...(assets.audioFile?.masterFingerprint ? { masterFingerprint: assets.audioFile.masterFingerprint } : {}),
            ...(metadata.isrc?.trim() ? { isrc: metadata.isrc.trim() } : {}),
            coverArtUrl: assets.coverArt?.url || '',
            coverArtWidth: assets.coverArt?.width || 3000,
            coverArtHeight: assets.coverArt?.height || 3000,
            ...(assets.coverArt?.storagePath ? { coverArtStoragePath: assets.coverArt.storagePath } : {}),
            ...(assets.coverArt?.contentHash ? { coverArtContentHash: assets.coverArt.contentHash } : {}),
            ...(assets.coverArt?.generationProvenance ? { coverArtGenerationProvenance: assets.coverArt.generationProvenance } : {}),
          },
          status: 'draft',
          distributors: selectedDistributors.map(id => ({
            distributorId: id,
            status: 'pending'
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Save to Firestore
        const docRef = await addDoc(collection(db, 'proprietaryIngestionReleases'), {
          ...releaseRecord,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        docId = docRef.id;
        setReleaseId(docId);
      }

      // A browser-measured image is only preflight evidence. Before a release
      // can enter packaging, the backend must inspect the immutable object and
      // attach the resulting receipt to this exact release record.
      try {
        const audit = httpsCallable<{ releaseId: string }, { status: 'compliant' | 'non_compliant' | 'unknown' }>(functions, 'auditReleaseArtworkForDelivery');
        const audited = await audit({ releaseId: docId });
        if (audited.data.status !== 'compliant') {
          throw new Error(`Cover art needs repair: server conformance status is ${audited.data.status}. Replace or re-export the artwork before packaging.`);
        }
      } catch (auditError: unknown) {
        const auditErrorMessage = auditError instanceof Error ? auditError.message : 'Cover-art conformance audit failed';
        await updateDoc(doc(db, 'proprietaryIngestionReleases', docId), {
          status: 'cover_art_audit_failed',
          coverArtAuditError: auditErrorMessage,
          updatedAt: serverTimestamp(),
        });
        throw new Error(`Release cover art was not verified: ${auditErrorMessage}`);
      }

      // ISSUE-964: packaging must succeed before the release is ever
      // marked metadata_complete. A failure here throws (propagating to
      // the outer catch below) instead of being logged and ignored, so
      // the record stays truthfully in packaging_failed with the real
      // error and can be retried without duplicating the draft.
      try {
        await agentService.runAgent(
          'publishing',
          `Package the definitive assets for release ID: ${docId}.
          Audio URL: ${assets.audioFile?.url}
          Canonical audio storage path: ${assets.audioFile?.storagePath || 'unavailable'}
          Master fingerprint: ${assets.audioFile?.masterFingerprint || metadata.masterFingerprint || 'unavailable'}
          ISRC: ${metadata.isrc || 'not assigned'}
          Cover Art URL: ${assets.coverArt?.url}`
        );
      } catch (agentError: unknown) {
        const packagingErrorMessage = agentError instanceof Error ? agentError.message : 'Packaging failed';
        logger.error('[useDDEXRelease] Definitive packaging failed:', agentError);
        await updateDoc(doc(db, 'proprietaryIngestionReleases', docId), {
          status: 'packaging_failed',
          packagingError: packagingErrorMessage,
          updatedAt: serverTimestamp()
        });
        throw new Error(`Packaging failed: ${packagingErrorMessage}. Your draft is saved — you can retry.`);
      }

      // Packaging confirmed — only now is it truthful to mark complete.
      await updateDoc(doc(db, 'proprietaryIngestionReleases', docId), {
        status: 'metadata_complete',
        updatedAt: serverTimestamp()
      });

      setCurrentStep('complete');

      return docId;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit release';
      setSubmitError(errorMessage);
      setCurrentStep('review');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [activeOrg, activeProjectId, userProfile, metadata, assets, selectedDistributors, releaseId, getValidationErrors]);

  // Reset wizard
  const resetWizard = useCallback(() => {
    setCurrentStep('metadata');
    setMetadata(createInitialExtendedMetadata());
    setSelectedDistributors([userDistributor]); // Use user's preferred distributor
    setAssets(INITIAL_ASSETS);
    setIsSubmitting(false);
    setSubmitError(null);
    setReleaseId(null);
  }, [userDistributor]);

  return {
    currentStep,
    setCurrentStep,
    metadata,
    updateMetadata,
    selectedDistributors,
    toggleDistributor,
    assets,
    updateAssets,
    uploadAsset,
    uploadProgress,
    isStepValid,
    validationErrors,
    goToNextStep,
    goToPreviousStep,
    canGoNext,
    canGoPrevious,
    submitRelease,
    isSubmitting,
    submitError,
    releaseId,
    resetWizard
  };
}
