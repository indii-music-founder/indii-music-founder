/**
 * useDDEXRelease Hook
 * Manages state for DDEX release creation workflow
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useStore } from '@/core/store';
import { DDEX_CONFIG } from '@/core/config/ddex';
import { StorageService } from '@/services/StorageService';
import { agentService } from '@/services/agent/AgentService';
import type { ExtendedGoldenMetadata, DDEXReleaseRecord } from '@/services/metadata/types';
import type { DistributorId, ReleaseAssets } from '@/services/distribution/types/distributor';
import { logger } from '@/utils/logger';

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
  | 'review'
  | 'submitting'
  | 'complete';

// Initial extended metadata
const INITIAL_EXTENDED_METADATA: Partial<ExtendedGoldenMetadata> = {
  trackTitle: '',
  artistName: '',
  isrc: '',
  explicit: false,
  genre: '',
  splits: [{ legalName: '', role: 'performer', percentage: 100, email: '' }],
  pro: 'None',
  publisher: 'Self-Published',
  containsSamples: false,
  samples: [],
  isGolden: false,
  releaseType: 'Single',
  releaseDate: new Date().toISOString().split('T')[0],
  territories: ['Worldwide'],
  distributionChannels: ['streaming', 'download'],
  labelName: DDEX_CONFIG.PARTY_NAME,
  dpid: DDEX_CONFIG.PARTY_ID,
  aiGeneratedContent: {
    isFullyAIGenerated: false,
    isPartiallyAIGenerated: false,
    aiToolsUsed: [],
    humanContribution: ''
  }
};

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

const STEP_ORDER: WizardStep[] = ['metadata', 'distribution', 'ai_disclosure', 'assets', 'review'];

/**
 * Extract real audio metadata (sample rate, bit depth) from a File using the Web Audio API.
 * Falls back to format-based defaults if AudioContext decoding fails.
 */
async function extractAudioMetadata(file: File): Promise<{ sampleRate: number; bitDepth: number }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();

    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const sampleRate = audioBuffer.sampleRate; // Real sample rate (e.g., 44100, 48000, 96000)

      // Bit depth: Web Audio API always decodes to 32-bit float internally.
      // We derive the original bit depth from the file extension / MIME type.
      const ext = file.name.split('.').pop()?.toLowerCase();
      let bitDepth = 16; // Default
      if (ext === 'wav') {
        // WAV files: check file size to estimate bit depth
        // size ≈ sampleRate * channels * (bitDepth/8) * duration
        const channels = audioBuffer.numberOfChannels;
        const duration = audioBuffer.duration;
        const expectedBytesPerSample = file.size / (sampleRate * channels * duration);
        if (expectedBytesPerSample >= 3.8) bitDepth = 32;
        else if (expectedBytesPerSample >= 2.8) bitDepth = 24;
        else bitDepth = 16;
      } else if (ext === 'flac') {
        // FLAC is typically 16 or 24-bit; estimate from file size ratio
        const rawPcmSize = audioBuffer.sampleRate * audioBuffer.numberOfChannels * 2 * audioBuffer.duration;
        bitDepth = file.size > rawPcmSize * 0.8 ? 24 : 16;
      } else if (ext === 'mp3' || ext === 'aac') {
        // Lossy formats: bit depth concept doesn't apply, but DSPs expect 16
        bitDepth = 16;
      }

      return { sampleRate, bitDepth };
    } finally {
      await audioContext.close();
    }
  } catch (error) {
    logger.warn('[useDDEXRelease] AudioContext decoding failed, using format defaults:', error);
    // Fallback: derive from file extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'wav') return { sampleRate: 44100, bitDepth: 24 };
    if (ext === 'flac') return { sampleRate: 44100, bitDepth: 24 };
    return { sampleRate: 44100, bitDepth: 16 };
  }
}

/**
 * Extract real image dimensions from an image URL using the Image API.
 * Returns { width, height } or falls back to 3000x3000 on error.
 */
async function extractImageDimensions(imageUrl: string): Promise<{ width: number; height: number }> {
  try {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = imageUrl;
    });
  } catch {
    logger.warn('[useDDEXRelease] Failed to extract image dimensions, using 3000x3000 default');
    return { width: 3000, height: 3000 };
  }
}

export function useDDEXRelease(): UseDDEXReleaseReturn {
  const { currentOrganizationId, organizations, userProfile } = useStore();

  // Get current organization
  const activeOrg = useMemo(() =>
    organizations.find(org => org.id === currentOrganizationId),
    [organizations, currentOrganizationId]
  );

  // For now, use a default project ID (can be enhanced later)
  const activeProjectId = 'default-project';

  // Get user's preferred distributor from onboarding profile
  const userDistributor = useMemo(() => {
    const profileDistributor = userProfile?.brandKit?.socials?.distributor?.toLowerCase();
    if (profileDistributor && DISTRIBUTOR_NAME_MAP[profileDistributor]) {
      return DISTRIBUTOR_NAME_MAP[profileDistributor];
    }
    return 'distrokid'; // Fallback default
  }, [userProfile?.brandKit?.socials?.distributor]);

  const [currentStep, setCurrentStep] = useState<WizardStep>('metadata');
  const [metadata, setMetadata] = useState<Partial<ExtendedGoldenMetadata>>(INITIAL_EXTENDED_METADATA);
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

    // Use a dedicated 'packaging' path to differentiate from analysis-only uploads
    const path = `orgs/${activeOrg.id}/releases/packaging/${Date.now()}_${file.name}`;

    try {
      const url = await StorageService.uploadFileWithProgress(
        file,
        path,
        (progress) => {
          setUploadProgress(prev => ({ ...prev, [type]: progress }));
        }
      );

      // Extract real metadata from audio file using Web Audio API
      if (type === 'audio') {
        const audioMetadata = await extractAudioMetadata(file);
        const audioInfo = {
          url,
          mimeType: file.type,
          sizeBytes: file.size,
          format: (file.name.split('.').pop()?.toLowerCase() || 'wav') as 'wav' | 'flac' | 'mp3' | 'aac',
          sampleRate: audioMetadata.sampleRate,
          bitDepth: audioMetadata.bitDepth,
        };
        updateAssets({ audioFile: audioInfo });
      } else {
        // Extract real image dimensions
        const dimensions = await extractImageDimensions(url);
        const coverInfo = {
          url,
          mimeType: file.type,
          sizeBytes: file.size,
          width: dimensions.width,
          height: dimensions.height,
        };
        updateAssets({ coverArt: coverInfo });
      }

      return url;
    } catch (error) {
      logger.error(`Error uploading ${type} asset:`, error);
      throw error;
    }
  }, [activeOrg, userProfile, updateAssets]);

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
        // AI disclosure is optional, no required fields
        break;

      case 'assets':
        if (!assets.audioFile) errors.push('Audio file is required');
        if (!assets.coverArt) errors.push('Cover art is required');
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
  }, [metadata, selectedDistributors, assets]);

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

    setIsSubmitting(true);
    setSubmitError(null);
    setCurrentStep('submitting');

    try {
      // Determine audio format, defaulting to 'wav' if aac or unknown
      const rawFormat = assets.audioFile?.format || 'wav';
      const audioFormat: AudioFormat = (rawFormat === 'aac' ? 'wav' : rawFormat) as AudioFormat;

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
          coverArtUrl: assets.coverArt?.url || '',
          coverArtWidth: assets.coverArt?.width || 3000,
          coverArtHeight: assets.coverArt?.height || 3000
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
      const docRef = await addDoc(collection(db, 'ddexReleases'), {
        ...releaseRecord,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update status to validating
      // Update status to complete
      await updateDoc(doc(db, 'ddexReleases', docRef.id), {
        status: 'metadata_complete',
        updatedAt: serverTimestamp()
      });

      setReleaseId(docRef.id);

      // Trigger definitive packaging via the Publishing Department Agent
      // This is the ONLY time music is packaged for distribution.
      try {
        await agentService.runAgent(
          'publishing',
          `Package the definitive assets for release ID: ${docRef.id}.
          Audio URL: ${assets.audioFile?.url}
          Cover Art URL: ${assets.coverArt?.url}`
        );
      } catch (agentError) {
        logger.warn('[useDDEXRelease] Agent packaging trigger failed:', agentError);
        // We don't fail the whole submission if the agent trigger fails,
        // since the record is already saved.
      }

      setCurrentStep('complete');

      return docRef.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit release';
      setSubmitError(errorMessage);
      setCurrentStep('review');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [activeOrg, activeProjectId, userProfile, metadata, assets, selectedDistributors]);

  // Reset wizard
  const resetWizard = useCallback(() => {
    setCurrentStep('metadata');
    setMetadata(INITIAL_EXTENDED_METADATA);
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
