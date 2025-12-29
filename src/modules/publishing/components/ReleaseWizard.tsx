/**
 * ReleaseWizard Component
 * Step-by-step wizard for creating DDEX-compliant releases
 */

import React from 'react';
import {
  Music,
  Globe,
  Sparkles,
  Upload,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  X
} from 'lucide-react';
import { useDDEXRelease, WizardStep } from '../hooks/useDDEXRelease';
import type { DistributorId } from '@/services/distribution/types/distributor';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

// Step configuration
const STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: 'metadata', label: 'Metadata', icon: <Music size={18} /> },
  { id: 'distribution', label: 'Distribution', icon: <Globe size={18} /> },
  { id: 'ai_disclosure', label: 'AI Disclosure', icon: <Sparkles size={18} /> },
  { id: 'assets', label: 'Assets', icon: <Upload size={18} /> },
  { id: 'review', label: 'Review', icon: <CheckCircle size={18} /> }
];

// Available distributors
const DISTRIBUTORS: { id: DistributorId; name: string; logo?: string }[] = [
  { id: 'distrokid', name: 'DistroKid' },
  { id: 'tunecore', name: 'TuneCore' },
  { id: 'cdbaby', name: 'CD Baby' },
  { id: 'ditto', name: 'Ditto Music' },
  { id: 'unitedmasters', name: 'UnitedMasters' },
  { id: 'amuse', name: 'Amuse' },
  { id: 'awal', name: 'AWAL' },
  { id: 'symphonic', name: 'Symphonic' }
];

// Common territories
const TERRITORIES = [
  { code: 'Worldwide', name: 'Worldwide' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' }
];

// Genre options
const GENRES = [
  'Pop', 'Hip-Hop/Rap', 'R&B/Soul', 'Rock', 'Electronic', 'Dance',
  'Country', 'Jazz', 'Classical', 'Latin', 'Reggae', 'Metal',
  'Folk', 'Blues', 'World', 'Alternative', 'Indie', 'Punk'
];

interface ReleaseWizardProps {
  onClose?: () => void;
  onComplete?: (releaseId: string) => void;
}

export default function ReleaseWizard({ onClose, onComplete }: ReleaseWizardProps) {
  const {
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
    releaseId
  } = useDDEXRelease();

  // Handle submission
  const handleSubmit = async () => {
    try {
      const id = await submitRelease();
      onComplete?.(id);
    } catch (error) {
      console.error('Release submission failed:', error);
    }
  };

  // Render step indicator
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const isPast = STEPS.findIndex(s => s.id === currentStep) > index;
        const isValid = isStepValid(step.id);

        return (
          <React.Fragment key={step.id}>
            <button
              onClick={() => isPast && setCurrentStep(step.id)}
              disabled={!isPast}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg transition-all
                ${isActive ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : ''}
                ${isPast ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20 cursor-pointer' : ''}
                ${!isActive && !isPast ? 'bg-gray-800/50 text-gray-500' : ''}
              `}
            >
              {isPast && isValid ? (
                <CheckCircle size={18} className="text-green-400" />
              ) : (
                step.icon
              )}
              <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
            </button>
            {index < STEPS.length - 1 && (
              <ChevronRight size={16} className="text-gray-600" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  // Render metadata step
  const renderMetadataStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Track Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Track Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={metadata.trackTitle || ''}
            onChange={e => updateMetadata({ trackTitle: e.target.value })}
            placeholder="Enter track title"
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Artist Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Artist Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={metadata.artistName || ''}
            onChange={e => updateMetadata({ artistName: e.target.value })}
            placeholder="Enter artist name"
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Genre */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Genre <span className="text-red-400">*</span>
          </label>
          <select
            value={metadata.genre || ''}
            onChange={e => updateMetadata({ genre: e.target.value })}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="">Select genre</option>
            {GENRES.map(genre => (
              <option key={genre} value={genre}>{genre}</option>
            ))}
          </select>
        </div>

        {/* Release Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Release Type
          </label>
          <select
            value={metadata.releaseType || 'Single'}
            onChange={e => updateMetadata({ releaseType: e.target.value as 'Single' | 'EP' | 'Album' | 'Compilation' })}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="Single">Single</option>
            <option value="EP">EP</option>
            <option value="Album">Album</option>
            <option value="Compilation">Compilation</option>
          </select>
        </div>

        {/* Label Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Label Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={metadata.labelName || ''}
            onChange={e => updateMetadata({ labelName: e.target.value })}
            placeholder="Your label or 'Self-Released'"
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* DPID */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            DPID (DDEX Party ID)
          </label>
          <input
            type="text"
            value={metadata.dpid || ''}
            onChange={e => updateMetadata({ dpid: e.target.value.toUpperCase() })}
            placeholder="PA-DPIDA-XXXXXXXXXX-X"
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-blue-400 font-mono placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Release Date */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Release Date <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={metadata.releaseDate || ''}
            onChange={e => updateMetadata({ releaseDate: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Explicit Content */}
        <div className="md:col-span-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={metadata.explicit || false}
              onChange={e => updateMetadata({ explicit: e.target.checked })}
              className="w-5 h-5 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-gray-300">This release contains explicit content</span>
          </label>
        </div>
      </div>
    </div>
  );

  // Render distribution step
  const renderDistributionStep = () => (
    <div className="space-y-8">
      {/* Distributors */}
      <div>
        <h3 className="text-lg font-medium text-white mb-4">Select Distributors</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {DISTRIBUTORS.map(dist => (
            <button
              key={dist.id}
              onClick={() => toggleDistributor(dist.id)}
              className={`
                p-4 rounded-xl border transition-all text-left
                ${selectedDistributors.includes(dist.id)
                  ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                  : 'bg-gray-800/30 border-gray-700 text-gray-400 hover:border-gray-600'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{dist.name}</span>
                {selectedDistributors.includes(dist.id) && (
                  <CheckCircle size={18} className="text-blue-400" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Territories */}
      <div>
        <h3 className="text-lg font-medium text-white mb-4">Distribution Territories</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TERRITORIES.map(territory => {
            const isSelected = metadata.territories?.includes(territory.code);
            return (
              <button
                key={territory.code}
                onClick={() => {
                  const current = metadata.territories || [];
                  if (territory.code === 'Worldwide') {
                    updateMetadata({ territories: isSelected ? [] : ['Worldwide'] });
                  } else {
                    const withoutWorldwide = current.filter(t => t !== 'Worldwide');
                    updateMetadata({
                      territories: isSelected
                        ? withoutWorldwide.filter(t => t !== territory.code)
                        : [...withoutWorldwide, territory.code]
                    });
                  }
                }}
                className={`
                  px-4 py-2 rounded-lg border text-sm transition-all
                  ${isSelected
                    ? 'bg-green-500/10 border-green-500/50 text-green-400'
                    : 'bg-gray-800/30 border-gray-700 text-gray-400 hover:border-gray-600'
                  }
                `}
              >
                {territory.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Distribution Channels */}
      <div>
        <h3 className="text-lg font-medium text-white mb-4">Distribution Channels</h3>
        <div className="flex flex-wrap gap-3">
          {['streaming', 'download', 'physical'].map(channel => {
            const isSelected = metadata.distributionChannels?.includes(channel as 'streaming' | 'download' | 'physical');
            return (
              <button
                key={channel}
                onClick={() => {
                  const current = metadata.distributionChannels || [];
                  updateMetadata({
                    distributionChannels: isSelected
                      ? current.filter(c => c !== channel)
                      : [...current, channel as 'streaming' | 'download' | 'physical']
                  });
                }}
                className={`
                  px-4 py-2 rounded-lg border text-sm capitalize transition-all
                  ${isSelected
                    ? 'bg-purple-500/10 border-purple-500/50 text-purple-400'
                    : 'bg-gray-800/30 border-gray-700 text-gray-400 hover:border-gray-600'
                  }
                `}
              >
                {channel}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Render AI disclosure step
  const renderAIDisclosureStep = () => (
    <div className="space-y-6">
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <Sparkles className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-medium text-yellow-400 mb-1">ERN 4.3 AI Content Disclosure</h4>
            <p className="text-sm text-yellow-300/70">
              New DDEX standards require disclosure of AI-generated content.
              This helps platforms and listeners understand how the music was created.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="flex items-center gap-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700 cursor-pointer hover:border-gray-600 transition-all">
          <input
            type="checkbox"
            checked={metadata.aiGeneratedContent?.isFullyAIGenerated || false}
            onChange={e => updateMetadata({
              aiGeneratedContent: {
                ...metadata.aiGeneratedContent,
                isFullyAIGenerated: e.target.checked,
                isPartiallyAIGenerated: e.target.checked ? false : metadata.aiGeneratedContent?.isPartiallyAIGenerated
              } as ExtendedGoldenMetadata['aiGeneratedContent']
            })}
            className="w-5 h-5 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500"
          />
          <div>
            <span className="text-white font-medium">Fully AI-Generated</span>
            <p className="text-sm text-gray-400">The entire track was created using AI tools</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700 cursor-pointer hover:border-gray-600 transition-all">
          <input
            type="checkbox"
            checked={metadata.aiGeneratedContent?.isPartiallyAIGenerated || false}
            onChange={e => updateMetadata({
              aiGeneratedContent: {
                ...metadata.aiGeneratedContent,
                isPartiallyAIGenerated: e.target.checked,
                isFullyAIGenerated: e.target.checked ? false : metadata.aiGeneratedContent?.isFullyAIGenerated
              } as ExtendedGoldenMetadata['aiGeneratedContent']
            })}
            className="w-5 h-5 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500"
          />
          <div>
            <span className="text-white font-medium">Partially AI-Generated</span>
            <p className="text-sm text-gray-400">Some elements were created using AI tools</p>
          </div>
        </label>
      </div>

      {(metadata.aiGeneratedContent?.isFullyAIGenerated || metadata.aiGeneratedContent?.isPartiallyAIGenerated) && (
        <div className="space-y-4 mt-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              AI Tools Used
            </label>
            <input
              type="text"
              value={metadata.aiGeneratedContent?.aiToolsUsed?.join(', ') || ''}
              onChange={e => updateMetadata({
                aiGeneratedContent: {
                  ...metadata.aiGeneratedContent,
                  aiToolsUsed: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                } as ExtendedGoldenMetadata['aiGeneratedContent']
              })}
              placeholder="e.g., Suno, Udio, AIVA, Amper"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Separate multiple tools with commas</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Human Contribution Description
            </label>
            <textarea
              value={metadata.aiGeneratedContent?.humanContribution || ''}
              onChange={e => updateMetadata({
                aiGeneratedContent: {
                  ...metadata.aiGeneratedContent,
                  humanContribution: e.target.value
                } as ExtendedGoldenMetadata['aiGeneratedContent']
              })}
              placeholder="Describe any human creative input (lyrics, melody ideas, arrangement, mixing, etc.)"
              rows={3}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );

  // Render assets step
  const renderAssetsStep = () => (
    <div className="space-y-6">
      {/* Audio Upload */}
      <div className={`
        bg-gray-800/30 border-2 border-dashed rounded-xl p-8 text-center transition-all
        ${assets.audioFile ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700 hover:border-gray-600'}
      `}>
        {assets.audioFile ? (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">Audio Uploaded</h3>
            <p className="text-sm text-gray-400 mb-4">{assets.audioFile.format.toUpperCase()} • {(assets.audioFile.sizeBytes / (1024 * 1024)).toFixed(2)} MB</p>
            <button
              onClick={() => updateAssets({ audioFile: undefined })}
              className="text-sm text-red-400 hover:text-red-300"
            >
              Replace File
            </button>
          </div>
        ) : (
          <>
            <Upload size={48} className="mx-auto text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Upload Audio File</h3>
            <p className="text-sm text-gray-400 mb-4">
              WAV or FLAC, 44.1kHz or higher, 16-bit or 24-bit
            </p>
            <div className="relative inline-block">
              <input
                type="file"
                accept=".wav,.flac,.mp3"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await uploadAsset('audio', file);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <button className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors pointer-events-none">
                Choose File
              </button>
            </div>
            {uploadProgress.audio > 0 && uploadProgress.audio < 100 && (
              <div className="mt-4 w-full max-w-xs mx-auto bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress.audio}%` }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Cover Art Upload */}
      <div className={`
        bg-gray-800/30 border-2 border-dashed rounded-xl p-8 text-center transition-all
        ${assets.coverArt ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700 hover:border-gray-600'}
      `}>
        {assets.coverArt ? (
          <div className="flex flex-col items-center">
            <div className="w-32 h-32 mx-auto rounded-lg mb-4 overflow-hidden border border-gray-700">
              <img src={assets.coverArt.url} alt="Cover Art" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">Cover Art Uploaded</h3>
            <p className="text-sm text-gray-400 mb-4">{assets.coverArt.width}x{assets.coverArt.height} • {(assets.coverArt.sizeBytes / (1024 * 1024)).toFixed(2)} MB</p>
            <button
              onClick={() => updateAssets({ coverArt: undefined })}
              className="text-sm text-red-400 hover:text-red-300"
            >
              Replace Image
            </button>
          </div>
        ) : (
          <>
            <div className="w-32 h-32 mx-auto bg-gray-700 rounded-lg mb-4 flex items-center justify-center">
              <Music size={48} className="text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Upload Cover Art</h3>
            <p className="text-sm text-gray-400 mb-4">
              3000x3000 pixels, JPG or PNG, RGB color mode
            </p>
            <div className="relative inline-block">
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await uploadAsset('cover', file);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <button className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors pointer-events-none">
                Choose Image
              </button>
            </div>
            {uploadProgress.cover > 0 && uploadProgress.cover < 100 && (
              <div className="mt-4 w-full max-w-xs mx-auto bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress.cover}%` }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // Render review step
  const renderReviewStep = () => (
    <div className="space-y-6">
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex gap-3">
            <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
            <div>
              <h4 className="font-medium text-red-400 mb-2">Please fix the following issues:</h4>
              <ul className="text-sm text-red-300/70 list-disc list-inside space-y-1">
                {validationErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Metadata Summary */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
          <h4 className="font-medium text-white mb-3 flex items-center gap-2">
            <Music size={18} /> Track Details
          </h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-400">Title</dt>
              <dd className="text-white">{metadata.trackTitle || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Artist</dt>
              <dd className="text-white">{metadata.artistName || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Genre</dt>
              <dd className="text-white">{metadata.genre || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Release Date</dt>
              <dd className="text-white">{metadata.releaseDate || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Label</dt>
              <dd className="text-white">{metadata.labelName || '-'}</dd>
            </div>
          </dl>
        </div>

        {/* Assets Summary */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
          <h4 className="font-medium text-white mb-3 flex items-center gap-2">
            <Upload size={18} /> Assets
          </h4>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center ${assets.audioFile ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                <Music size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-400 text-xs">Audio File</p>
                <p className="text-white truncate">{assets.audioFile ? `${assets.audioFile.format.toUpperCase()} • ${(assets.audioFile.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : 'Missing'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded shrink-0 overflow-hidden ${assets.coverArt ? 'bg-green-500/20' : 'bg-red-500/20 text-red-400'}`}>
                {assets.coverArt ? (
                  <img src={assets.coverArt.url} alt="Cover Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music size={16} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-400 text-xs">Cover Art</p>
                <p className="text-white truncate">{assets.coverArt ? `${assets.coverArt.width}x${assets.coverArt.height} • ${(assets.coverArt.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : 'Missing'}</p>
              </div>
            </div>
          </dl>
        </div>

        {/* Distribution Summary */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
          <h4 className="font-medium text-white mb-3 flex items-center gap-2">
            <Globe size={18} /> Distribution
          </h4>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-400 mb-1">Distributors</dt>
              <dd className="text-white">
                {selectedDistributors.map(id =>
                  DISTRIBUTORS.find(d => d.id === id)?.name
                ).join(', ') || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400 mb-1">Territories</dt>
              <dd className="text-white">{metadata.territories?.join(', ') || '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-400 mb-1">Channels</dt>
              <dd className="text-white capitalize">
                {metadata.distributionChannels?.join(', ') || '-'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* AI Disclosure Summary */}
      {(metadata.aiGeneratedContent?.isFullyAIGenerated || metadata.aiGeneratedContent?.isPartiallyAIGenerated) && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
          <h4 className="font-medium text-yellow-400 mb-2 flex items-center gap-2">
            <Sparkles size={18} /> AI Content Disclosure
          </h4>
          <p className="text-sm text-gray-300">
            {metadata.aiGeneratedContent.isFullyAIGenerated
              ? 'This release is fully AI-generated'
              : 'This release contains AI-generated elements'
            }
            {metadata.aiGeneratedContent.aiToolsUsed?.length
              ? ` using ${metadata.aiGeneratedContent.aiToolsUsed.join(', ')}`
              : ''
            }.
          </p>
        </div>
      )}
    </div>
  );

  // Render submitting state
  const renderSubmittingState = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 size={48} className="text-blue-400 animate-spin mb-4" />
      <h3 className="text-xl font-medium text-white mb-2">Submitting Release</h3>
      <p className="text-gray-400">Please wait while we process your release...</p>
    </div>
  );

  // Render complete state
  const renderCompleteState = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
        <CheckCircle size={32} className="text-green-400" />
      </div>
      <h3 className="text-xl font-medium text-white mb-2">Release Created!</h3>
      <p className="text-gray-400 mb-6">
        Your release has been submitted for processing.
      </p>
      <p className="text-sm text-gray-500 mb-4">Release ID: {releaseId}</p>
      <button
        onClick={onClose}
        className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        Done
      </button>
    </div>
  );

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'metadata':
        return renderMetadataStep();
      case 'distribution':
        return renderDistributionStep();
      case 'ai_disclosure':
        return renderAIDisclosureStep();
      case 'assets':
        return renderAssetsStep();
      case 'review':
        return renderReviewStep();
      case 'submitting':
        return renderSubmittingState();
      case 'complete':
        return renderCompleteState();
      default:
        return null;
    }
  };

  // Don't show navigation for terminal states
  const showNavigation = !['submitting', 'complete'].includes(currentStep);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">Create Release</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        {showNavigation && (
          <div className="px-6 pt-6">
            {renderStepIndicator()}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderStepContent()}

          {/* Submit Error */}
          {submitError && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-sm text-red-400">{submitError}</p>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {showNavigation && (
          <div className="flex items-center justify-between p-6 border-t border-gray-800">
            <button
              onClick={goToPreviousStep}
              disabled={!canGoPrevious}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                ${canGoPrevious
                  ? 'text-gray-300 hover:text-white hover:bg-gray-800'
                  : 'text-gray-600 cursor-not-allowed'
                }
              `}
            >
              <ChevronLeft size={18} />
              Back
            </button>

            {currentStep === 'review' ? (
              <button
                onClick={handleSubmit}
                disabled={validationErrors.length > 0 || isSubmitting}
                className={`
                  flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors
                  ${validationErrors.length === 0
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Submit Release
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={goToNextStep}
                disabled={!canGoNext}
                className={`
                  flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors
                  ${canGoNext
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                Next
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

