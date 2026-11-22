import { useTranslation } from 'react-i18next';
/**
 * ReleaseWizard Component
 * Step-by-step wizard for creating DDEX-compliant releases
 */

import React, { useState } from 'react';
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
import { ReleaseHarnessWorkspace } from './ReleaseHarnessWorkspace';
// ISSUE-1440: shared disclosure + dropdown primitives for denser steps.
import SectionCard from '@/components/ui/SectionCard';
import {
  DropdownMenu,
  DropdownMenuTriggerButton,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/DropdownMenu';
import type { DistributorId } from '@/services/distribution/types/distributor';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { logger } from '@/utils/logger';
import { readCreativeAssetDrag } from '@/services/creative/CreativeAssetDragService';

// Step configuration
const STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: 'metadata', label: 'Metadata', icon: <Music size={14} /> },
  { id: 'distribution', label: 'Distribution', icon: <Globe size={14} /> },
  { id: 'ai_disclosure', label: 'AI Disclosure', icon: <Sparkles size={14} /> },
  { id: 'assets', label: 'Assets', icon: <Upload size={14} /> },
  { id: 'harness', label: 'Harness', icon: <Sparkles size={14} /> },
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

/**
 * ISSUE-1707: the tools field parsed and trimmed on every keystroke, so a
 * space typed after a word vanished ("Flow Music" became "FlowMusic").
 * It keeps what the artist typed and only derives the list from it.
 */
export function parseAiTools(text: string): string[] {
  return text.split(',').map(part => part.trim()).filter(Boolean);
}

function AiToolsField({ tools, placeholder, onChange }: {
  tools: string[] | undefined;
  placeholder?: string;
  onChange: (tools: string[]) => void;
}) {
  const [text, setText] = useState(() => (tools ?? []).join(', '));
  return (
    <input
      type="text"
      value={text}
      onChange={e => { setText(e.target.value); onChange(parseAiTools(e.target.value)); }}
      placeholder={placeholder}
      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-publishing/50 transition-colors"
    />
  );
}

export default function ReleaseWizard({ onClose, onComplete }: ReleaseWizardProps) {
  const { t } = useTranslation();
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
    uploadCoverByUrl,
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
    submitStage,
    releaseId
  } = useDDEXRelease();

  // ISSUE-1440: optional identifier fields are secondaries — collapsed by default
  // so the required metadata grid stays scannable.
  const [advancedMetadataOpen, setAdvancedMetadataOpen] = useState(false);

  // ISSUE-1468: Escape key dismisses the wizard dialog cleanly
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle submission
  const handleSubmit = async () => {
    try {
      const id = await submitRelease();
      onComplete?.(id);
    } catch (error: unknown) {
      logger.error('Release submission failed:', error);
    }
  };

  // Render step indicator
  const renderStepIndicator = () => (
    <ol aria-label="Release steps" className="flex items-center gap-1.5 mb-5">
      {STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const isPast = STEPS.findIndex(s => s.id === currentStep) > index;
        const isValid = isStepValid(step.id);

        return (
          <li key={step.id} className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={() => isPast && setCurrentStep(step.id)}
              disabled={!isPast}
              aria-current={isActive ? 'step' : undefined}
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors
                ${isActive ? 'bg-dept-publishing/15 text-dept-publishing border-dept-publishing/30' : ''}
                ${isPast ? 'bg-white/5 text-dept-publishing border-white/10 hover:bg-white/10 cursor-pointer' : ''}
                ${!isActive && !isPast ? 'bg-transparent text-gray-600 border-white/5' : ''}
              `}
            >
              {isPast && isValid ? (
                <CheckCircle size={14} className="text-dept-publishing shrink-0" />
              ) : (
                <span className="shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{step.icon}</span>
              )}
              <span className="hidden sm:inline truncate">{step.label}</span>
            </button>
            {index < STEPS.length - 1 && (
              <span aria-hidden="true" className="w-2 h-px bg-white/10 shrink-0" />
            )}
          </li>
        );
      })}
    </ol>
  );

  // Render metadata step
  const renderMetadataStep = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Track Title */}
        <div>
          <label htmlFor="trackTitle" className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
            Track Title <span className="text-red-400">*</span>
          </label>
          <input
            id="trackTitle"
            type="text"
            value={metadata.trackTitle || ''}
            onChange={e => updateMetadata({ trackTitle: e.target.value })}
            placeholder={t('publishing.hints.track_title')}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-publishing/50 transition-colors"
          />
        </div>

        {/* Artist Name */}
        <div>
          <label htmlFor="artistName" className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
            Artist Name <span className="text-red-400">*</span>
          </label>
          <input
            id="artistName"
            type="text"
            value={metadata.artistName || ''}
            onChange={e => updateMetadata({ artistName: e.target.value })}
            placeholder={t('publishing.hints.artist_name')}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-publishing/50 transition-colors"
          />
        </div>

        {/* Genre */}
        <div>
          <label htmlFor="genre" className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
            Genre <span className="text-red-400">*</span>
          </label>
          <select
            id="genre"
            value={metadata.genre || ''}
            onChange={e => updateMetadata({ genre: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dept-publishing/50 transition-colors"
          >
            <option value="">Select genre</option>
            {GENRES.map(genre => (
              <option key={genre} value={genre}>{genre}</option>
            ))}
          </select>
        </div>

        {/* Release Type */}
        <div>
          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
            Release Type
          </label>
          <select
            value={metadata.releaseType || 'Single'}
            onChange={e => updateMetadata({ releaseType: e.target.value as 'Single' | 'EP' | 'Album' | 'Compilation' })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dept-publishing/50 transition-colors"
          >
            <option value="Single">Single</option>
            <option value="EP">EP</option>
            <option value="Album">Album</option>
            <option value="Compilation">Compilation</option>
          </select>
        </div>

        {/* Label Name */}
        <div>
          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
            Label Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={metadata.labelName || ''}
            onChange={e => updateMetadata({ labelName: e.target.value })}
            placeholder={t('publishing.hints.label_name')}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-publishing/50 transition-colors"
          />
        </div>

        {/* ISSUE-1440: DPID / ISRC / BPM / Key / Energy moved into the collapsed
            "Advanced metadata" disclosure below — optional secondaries were
            inflating the required grid. */}

        {/* Release Date */}
        <div>
          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
            Release Date <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={metadata.releaseDate || ''}
            onChange={e => updateMetadata({ releaseDate: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dept-publishing/50 transition-colors"
          />
        </div>

        {/* Explicit Content */}
        <div className="md:col-span-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={metadata.explicit || false}
              onChange={e => updateMetadata({ explicit: e.target.checked })}
              className="w-4 h-4 rounded bg-white/5 border-white/20 text-dept-publishing focus:ring-dept-publishing/50"
            />
            <span className="text-gray-300">This release contains explicit content</span>
          </label>
        </div>

        {/* ISSUE-1440: optional identifiers/descriptors behind a collapsed disclosure. */}
        <div className="md:col-span-2">
          <SectionCard
            title="Advanced metadata (optional)"
            icon={<Sparkles size={12} className="text-dept-publishing" />}
            isOpen={advancedMetadataOpen}
            onToggle={() => setAdvancedMetadataOpen(open => !open)}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                  DPID (DDEX Party ID)
                </label>
                <input
                  type="text"
                  value={metadata.dpid || ''}
                  onChange={e => updateMetadata({ dpid: e.target.value.toUpperCase() })}
                  placeholder={t('publishing.hints.pro_work_id')}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-dept-publishing font-mono placeholder:text-gray-600 focus:outline-none focus:border-dept-publishing/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                  ISRC code
                </label>
                <input
                  type="text"
                  value={metadata.isrc || ''}
                  onChange={e => updateMetadata({ isrc: e.target.value.toUpperCase() })}
                  placeholder={t('publishing.hints.isrc_optional')}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-dept-publishing font-mono placeholder:text-gray-600 focus:outline-none focus:border-dept-publishing/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                  BPM
                </label>
                <input
                  type="number"
                  value={metadata.bpm || ''}
                  onChange={e => updateMetadata({ bpm: parseFloat(e.target.value) || undefined })}
                  placeholder={t('publishing.hints.bpm_example')}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-publishing/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                  Key
                </label>
                <input
                  type="text"
                  value={metadata.key || ''}
                  onChange={e => updateMetadata({ key: e.target.value })}
                  placeholder={t('publishing.hints.key_example')}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-publishing/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                  Energy
                </label>
                <input
                  type="number"
                  value={metadata.energy || ''}
                  onChange={e => updateMetadata({ energy: parseFloat(e.target.value) || undefined })}
                  placeholder={t('publishing.hints.confidence_score')}
                  step="0.01"
                  min="0"
                  max="1"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-publishing/50 transition-colors"
                />
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );

  // Render distribution step
  const renderDistributionStep = () => {
    const isDesktop = typeof window !== 'undefined' && !!window.electronAPI;
    // ISSUE-1440: 8 territory toggle buttons collapsed into one multi-select.
    const selectedTerritories = metadata.territories || [];
    const territoryLabel = selectedTerritories.includes('Worldwide')
      ? 'Worldwide'
      : selectedTerritories.length > 0
        ? `${selectedTerritories.length} ${selectedTerritories.length === 1 ? 'territory' : 'territories'} selected`
        : 'Select territories';

    return (
      <div className="space-y-6">
        {!isDesktop && (
          <div className="bg-dept-publishing/5 border border-dept-publishing/20 rounded-xl p-3 flex gap-3">
            <AlertCircle size={16} className="text-dept-publishing shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-dept-publishing mb-1">Desktop App Required</h4>
              <p className="text-xs text-gray-300 leading-relaxed">
                Delivery to streaming platforms runs from the indii desktop app. 
                Please open this project in the Desktop App to select distributors and deliver your release.
              </p>
            </div>
          </div>
        )}

        {/* Distributors — ISSUE-1440: compact selectable list instead of large cards. */}
        <div className={!isDesktop ? "opacity-50 pointer-events-none" : ""}>
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-3">Select Distributors</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {DISTRIBUTORS.map(dist => (
              <button
                key={dist.id}
                onClick={() => toggleDistributor(dist.id)}
                disabled={!isDesktop}
                className={`
                  px-3 py-2.5 rounded-lg border transition-all text-xs text-left flex items-center justify-between
                  ${selectedDistributors.includes(dist.id)
                    ? 'bg-dept-publishing/10 border-dept-publishing/40 text-dept-publishing'
                    : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20'
                  }
                `}
              >
                <span className="font-bold">{dist.name}</span>
                {selectedDistributors.includes(dist.id) && (
                  <CheckCircle size={14} className="text-dept-publishing shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Territories — ISSUE-1440: toggle grid → multi-select dropdown with
            Worldwide default semantics preserved. */}
        <div className={!isDesktop ? "opacity-50 pointer-events-none" : ""}>
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-3">Distribution Territories</h3>
          <DropdownMenu>
            <DropdownMenuTriggerButton data-testid="territories-select" disabled={!isDesktop}>
              <span>{territoryLabel}</span>
            </DropdownMenuTriggerButton>
            <DropdownMenuContent>
              {TERRITORIES.map(territory => {
                const isSelected = selectedTerritories.includes(territory.code);
                return (
                  <DropdownMenuCheckboxItem
                    key={territory.code}
                    checked={isSelected}
                    onSelect={event => {
                      // Keep the menu open — this is a multi-select, not a pick-one.
                      event.preventDefault();
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
                  >
                    {territory.name}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Distribution Channels */}
        <div className={!isDesktop ? "opacity-50 pointer-events-none" : ""}>
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-3">Distribution Channels</h3>
          <div className="flex flex-wrap gap-3">
            {['streaming', 'download', 'physical'].map(channel => {
              const isSelected = metadata.distributionChannels?.includes(channel as 'streaming' | 'download' | 'physical');
              return (
                <button
                  key={channel}
                  disabled={!isDesktop}
                  onClick={() => {
                    const current = metadata.distributionChannels || [];
                    updateMetadata({
                      distributionChannels: isSelected
                        ? current.filter(c => c !== channel)
                        : [...current, channel as 'streaming' | 'download' | 'physical']
                    });
                  }}
                  className={`
                    px-3 py-1.5 rounded-lg border text-xs capitalize transition-colors
                    ${isSelected
                      ? 'bg-dept-publishing/10 border-dept-publishing/40 text-dept-publishing'
                      : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20'
                    }
                  `}
                >
                  {channel}
                </button>
              );
            })}
          </div>
        </div>

        {/* YouTube Content ID */}
        <div className={!isDesktop ? "opacity-50 pointer-events-none" : ""}>
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-3">YouTube Content ID</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
              <input
                type="checkbox"
                disabled={!isDesktop}
                checked={metadata.youtubeContentIdOptIn || false}
                onChange={e => updateMetadata({ youtubeContentIdOptIn: e.target.checked })}
                className="w-4 h-4 rounded bg-white/5 border-white/20 text-dept-publishing focus:ring-dept-publishing/50"
              />
              <div>
                <span className="text-white text-xs font-bold">Opt-in to YouTube Content ID</span>
                <p className="text-xs text-gray-400">Monetize videos using your music across YouTube (requires eligible content)</p>
              </div>
            </label>

            {metadata.youtubeContentIdOptIn && (
              <div className="pl-12">
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                  Content ID Policy
                </label>
                <select
                  disabled={!isDesktop}
                  value={metadata.youtubeContentIdPolicy || 'monetize'}
                  onChange={e => updateMetadata({ youtubeContentIdPolicy: e.target.value as 'monetize' | 'track' | 'block' })}
                  className="w-full max-w-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dept-publishing/50 transition-colors"
                >
                  <option value="monetize">Monetize (Show Ads)</option>
                  <option value="track">Track Only (No Ads)</option>
                  <option value="block">Block Copies</option>
                </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

  // Render Autonomous disclosure step
  const renderAIDisclosureStep = () => (
    <div className="space-y-4">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
        <div className="flex gap-3">
          <Sparkles className="text-amber-400 flex-shrink-0 mt-0.5" size={16} />
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-1">AI Content Disclosure</h4>
            <p className="text-xs text-amber-300/80">
              Streaming platforms ask you to say how AI was used in making a release.
              This helps them and listeners understand how the music was created.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
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
            className="w-4 h-4 rounded bg-white/5 border-white/20 text-dept-publishing focus:ring-dept-publishing/50"
          />
          <div>
            <span className="text-white text-xs font-bold">Fully AI-Generated</span>
            <p className="text-xs text-gray-400">The whole track was generated with AI tools</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
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
            className="w-4 h-4 rounded bg-white/5 border-white/20 text-dept-publishing focus:ring-dept-publishing/50"
          />
          <div>
            <span className="text-white text-xs font-bold">Partially AI-Generated</span>
            <p className="text-xs text-gray-400">Some elements were created with AI tools</p>
          </div>
        </label>
      </div>

      {(metadata.aiGeneratedContent?.isFullyAIGenerated || metadata.aiGeneratedContent?.isPartiallyAIGenerated) && (
        <div className="space-y-4 mt-6">
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
              AI Tools Used
            </label>
            <AiToolsField
              tools={metadata.aiGeneratedContent?.aiToolsUsed}
              placeholder={t('publishing.hints.ai_tools_example')}
              onChange={aiToolsUsed => updateMetadata({
                aiGeneratedContent: {
                  ...metadata.aiGeneratedContent,
                  aiToolsUsed
                } as ExtendedGoldenMetadata['aiGeneratedContent']
              })}
            />
            <p className="text-xs text-gray-500 mt-1">Separate multiple tools with commas</p>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
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
              placeholder={t('publishing.hints.human_input_desc')}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-publishing/50 transition-colors resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );

  // Render assets step
  const renderAssetsStep = () => (
    <div className="space-y-4">
      {/* Audio Upload */}
      <div className={`
        bg-white/[0.03] border border-dashed rounded-xl p-5 text-center transition-colors
        ${assets.audioFile ? 'border-dept-publishing/40 bg-dept-publishing/5' : 'border-white/15 hover:border-white/30'}
      `}>
        {assets.audioFile ? (
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 bg-dept-publishing/15 rounded-full flex items-center justify-center mb-3">
              <CheckCircle size={20} className="text-dept-publishing" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Audio Uploaded</h3>
            <p className="text-xs text-gray-400 mb-3">{assets.audioFile.format.toUpperCase()} • {(assets.audioFile.sizeBytes / (1024 * 1024)).toFixed(2)} MB</p>
            <button
              onClick={() => updateAssets({ audioFile: undefined })}
              className="text-xs font-bold uppercase tracking-widest text-red-400 hover:text-red-300"
            >
              Replace File
            </button>
          </div>
        ) : (
          <>
            <Upload size={24} className="mx-auto text-gray-500 mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">Upload Audio File</h3>
            <p className="text-xs text-gray-400 mb-3">
              WAV or FLAC, 44.1kHz or higher, 16-bit or 24-bit
            </p>
            <div className="relative inline-block">
              <input
                type="file"
                accept=".wav,.flac"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) {
                    try {
                      await uploadAsset('audio', file);
                    } catch (err: unknown) {
                      logger.error('Audio upload failed:', err);
                    }
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <button className="px-4 py-2 bg-white text-black font-black text-xs uppercase tracking-widest rounded-lg hover:bg-gray-200 transition-colors pointer-events-none">
                Choose File
              </button>
            </div>
            {uploadProgress.audio > 0 && uploadProgress.audio < 100 && (
              <div className="mt-3 w-full max-w-xs mx-auto bg-white/10 rounded-full h-1">
                <div
                  className="bg-dept-publishing h-1 rounded-full transition-all"
                  style={{ width: `${uploadProgress.audio}%` }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Cover Art Upload */}
      <div
        className={`
        bg-white/[0.03] border border-dashed rounded-xl p-5 text-center transition-colors
        ${assets.coverArt ? 'border-dept-publishing/40 bg-dept-publishing/5' : 'border-white/15 hover:border-white/30'}
      `}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={async (e) => {
          e.preventDefault();
          const creative = readCreativeAssetDrag(e.dataTransfer);
          if (creative && creative.asset.type === 'image') {
            try {
              await uploadCoverByUrl(creative.asset.url);
            } catch (err: unknown) {
              logger.error('Cover art drop failed:', err);
            }
          }
        }}
      >
        {assets.coverArt ? (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 mx-auto rounded-lg mb-3 overflow-hidden border border-white/10">
              <img src={assets.coverArt.url} alt="Cover Art" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Cover Art Uploaded</h3>
            <p className="text-xs text-gray-400 mb-3">{assets.coverArt.width}x{assets.coverArt.height} • {(assets.coverArt.sizeBytes / (1024 * 1024)).toFixed(2)} MB</p>
            <button
              onClick={() => updateAssets({ coverArt: undefined })}
              className="text-xs font-bold uppercase tracking-widest text-red-400 hover:text-red-300"
            >
              Replace Image
            </button>
          </div>
        ) : (
          <>
            <div className="w-10 h-10 mx-auto bg-white/5 rounded-lg mb-3 flex items-center justify-center">
              <Music size={24} className="text-gray-500" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Upload Cover Art</h3>
            <p className="text-xs text-gray-400 mb-3">
              3000x3000 pixels, JPG or PNG, RGB color mode
            </p>
            <p className="text-[11px] text-gray-500 mb-2">
              or drag a created image from Project Assets / Gallery
            </p>
            <div className="relative inline-block">
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) {
                    try {
                      await uploadAsset('cover', file);
                    } catch (err: unknown) {
                      logger.error('Cover art upload failed:', err);
                    }
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <button className="px-4 py-2 bg-white text-black font-black text-xs uppercase tracking-widest rounded-lg hover:bg-gray-200 transition-colors pointer-events-none">
                Choose Image
              </button>
            </div>
            {uploadProgress.cover > 0 && uploadProgress.cover < 100 && (
              <div className="mt-3 w-full max-w-xs mx-auto bg-white/10 rounded-full h-1">
                <div
                  className="bg-dept-publishing h-1 rounded-full transition-all"
                  style={{ width: `${uploadProgress.cover}%` }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ISSUE-1707: say why Next is disabled once a file is attached but unusable. */}
      {assets.coverArt && validationErrors.some(error => error.startsWith('Cover art:')) && (
        <div role="alert" data-testid="release-assets-error" className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2.5">
          <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={14} />
          <div className="text-xs text-red-300/80 space-y-1">
            {validationErrors.filter(error => error.startsWith('Cover art:')).map((error, i) => (
              <p key={i}>{error}</p>
            ))}
            <p className="text-red-300/60">Use Replace Image to pick a different file.</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderHarnessStep = () => (
    <ReleaseHarnessWorkspace
      metadata={metadata}
      selectedStores={selectedDistributors}
      onApplyMetadata={updateMetadata}
    />
  );

  // Render review step
  const renderReviewStep = () => (
    <div className="space-y-4">
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <div className="flex gap-3">
            <AlertCircle className="text-red-400 flex-shrink-0" size={16} />
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-red-400 mb-2">Please fix the following issues:</h4>
              <ul className="text-xs text-red-300/70 list-disc list-inside space-y-1">
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
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-white mb-3 flex items-center gap-2">
            <Music size={14} /> Track Details
          </h4>
          <dl className="space-y-2 text-xs">
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
            {metadata.bpm && (
              <div className="flex justify-between">
                <dt className="text-gray-400">BPM</dt>
                <dd className="text-white">{metadata.bpm}</dd>
              </div>
            )}
            {metadata.key && (
              <div className="flex justify-between">
                <dt className="text-gray-400">Key</dt>
                <dd className="text-white">{metadata.key}</dd>
              </div>
            )}
            {metadata.energy && (
              <div className="flex justify-between">
                <dt className="text-gray-400">Energy</dt>
                <dd className="text-white capitalize">{metadata.energy}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Assets Summary */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-white mb-3 flex items-center gap-2">
            <Upload size={14} /> Assets
          </h4>
          <dl className="space-y-3 text-xs">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center ${assets.audioFile ? 'bg-dept-publishing/15 text-dept-publishing' : 'bg-red-500/20 text-red-400'}`}>
                <Music size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-400 text-xs">Audio File</p>
                <p className="text-white truncate">{assets.audioFile ? `${assets.audioFile.format.toUpperCase()} • ${(assets.audioFile.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : 'Missing'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded shrink-0 overflow-hidden ${assets.coverArt ? 'bg-dept-publishing/15' : 'bg-red-500/20 text-red-400'}`}>
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
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-white mb-3 flex items-center gap-2">
            <Globe size={14} /> Distribution
          </h4>
          <dl className="space-y-2 text-xs">
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
            <div>
              <dt className="text-gray-400 mb-1">Content ID</dt>
              <dd className="text-white">
                {metadata.youtubeContentIdOptIn ? `Enabled (${metadata.youtubeContentIdPolicy})` : 'Disabled'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Autonomous Disclosure Summary */}
      {(metadata.aiGeneratedContent?.isFullyAIGenerated || metadata.aiGeneratedContent?.isPartiallyAIGenerated) && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-2">
            <Sparkles size={14} /> AI Content Disclosure
          </h4>
          <p className="text-xs text-gray-300">
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
    <div className="flex flex-col items-center justify-center py-8">
      <Loader2 size={28} className="text-dept-publishing animate-spin mb-3" />
      <h3 className="text-sm font-black uppercase tracking-widest text-white mb-1">Submitting Release</h3>
      <p className="text-xs text-gray-400" role="status" aria-live="polite" data-testid="release-submit-stage">
        {submitStage ? `${submitStage}…` : 'Please wait while we process your release…'}
      </p>
    </div>
  );

  // Render complete state
  const renderCompleteState = () => (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="w-10 h-10 bg-dept-publishing/15 rounded-full flex items-center justify-center mb-3">
        <CheckCircle size={20} className="text-dept-publishing" />
      </div>
      <h3 className="text-sm font-black uppercase tracking-widest text-white mb-1">Release Created</h3>
      <p className="text-xs text-gray-400 mb-4">
        Your release has been submitted for processing.
      </p>
      <p className="text-[11px] font-mono text-gray-500 mb-4">Release ID: {releaseId}</p>
      <button
        onClick={onClose}
        className="px-5 py-2 bg-white text-black font-black text-xs uppercase tracking-widest rounded-lg hover:bg-gray-200 transition-colors"
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
      case 'harness':
        return renderHarnessStep();
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-wizard-title"
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
    >
      <div className="bg-[#0e0e0e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 id="release-wizard-title" className="text-lg font-black text-white uppercase tracking-tighter italic">Create Release</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            title="Close"
            className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Indicator */}
        {showNavigation && (
          <div className="px-6 pt-4">
            {renderStepIndicator()}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-5">
          {renderStepContent()}

          {/* Submit Error */}
          {submitError && (
            <div role="alert" data-testid="release-wizard-error" className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-xs text-red-400">{submitError}</p>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {showNavigation && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
            <button
              onClick={goToPreviousStep}
              disabled={!canGoPrevious}
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors
                ${canGoPrevious
                  ? 'text-gray-400 hover:text-white hover:bg-white/5'
                  : 'text-gray-700 cursor-not-allowed'
                }
              `}
            >
              <ChevronLeft size={14} />
              Back
            </button>

            {currentStep === 'review' ? (
              <button
                onClick={handleSubmit}
                disabled={validationErrors.length > 0 || isSubmitting}
                className={`
                  flex items-center gap-2 px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-colors
                  ${validationErrors.length === 0
                    ? 'bg-dept-publishing text-black hover:bg-dept-publishing/80'
                    : 'bg-white/10 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} />
                    Submit Release
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={goToNextStep}
                disabled={!canGoNext}
                className={`
                  flex items-center gap-2 px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-colors
                  ${canGoNext
                    ? 'bg-white text-black hover:bg-gray-200'
                    : 'bg-white/10 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                Next
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
