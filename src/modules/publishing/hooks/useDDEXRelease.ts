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
import type { ExtendedGoldenMetadata, DDEXReleaseRecord } from '@/services/metadata/types';
import type { DistributorId, ReleaseAssets } from '@/services/distribution/types/distributor';

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

    const path = `orgs/${activeOrg.id}/releases/pending/${Date.now()}_${file.name}`;

    try {
      const url = await StorageService.uploadFileWithProgress(
        file,
        path,
        (progress) => {
          setUploadProgress(prev => ({ ...prev, [type]: progress }));
        }
      );

      // Extract metadata from file if audio
      if (type === 'audio') {
        const audioInfo = {
          url,
          mimeType: file.type,
          sizeBytes: file.size,
          format: (file.name.split('.').pop()?.toLowerCase() || 'wav') as 'wav' | 'flac' | 'mp3' | 'aac',
          sampleRate: 44100, // Placeholder, would ideally use audio context to detect
          bitDepth: 16       // Placeholder
        };
        updateAssets({ audioFile: audioInfo });
      } else {
        const coverInfo = {
          url,
          mimeType: file.type,
          sizeBytes: file.size,
          width: 3000,  // Placeholder
          height: 3000  // Placeholder
        };
        updateAssets({ coverArt: coverInfo });
      }

      return url;
    } catch (error) {
      console.error(`Error uploading ${type} asset:`, error);
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
      setCurrentStep(STEP_ORDER[currentStepIndex + 1]);
    }
  }, [canGoNext, currentStepIndex]);

  const goToPreviousStep = useCallback(() => {
    if (canGoPrevious) {
      setCurrentStep(STEP_ORDER[currentStepIndex - 1]);
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
      await updateDoc(doc(db, 'ddexReleases', docRef.id), {
        status: 'metadata_complete',
        updatedAt: serverTimestamp()
      });

      setReleaseId(docRef.id);
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
