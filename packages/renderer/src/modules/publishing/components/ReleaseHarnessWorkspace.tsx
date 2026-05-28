import React, { useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, Database, GitBranch, Loader2, Music2, Save, Sparkles } from 'lucide-react';
import { useStore } from '@/core/store';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { releaseHarnessService, saveReleaseHarnessRun, type ReleaseHarnessResult } from '@/services/release-harness';
import { IdentifierService } from '@/services/identity/IdentifierService';
import { ISWCService } from '@/services/publishing/ISWCService';

interface ReleaseHarnessWorkspaceProps {
  metadata: Partial<ExtendedGoldenMetadata>;
  selectedStores: string[];
  audioFile?: File;
  projectId?: string;
  onApplyMetadata?: (metadata: Partial<ExtendedGoldenMetadata>) => void;
  onSaved?: (runId: string) => void;
}

export function ReleaseHarnessWorkspace({
  metadata,
  selectedStores,
  audioFile,
  projectId = 'default-project',
  onApplyMetadata,
  onSaved,
}: ReleaseHarnessWorkspaceProps) {
  const { userProfile, analyticsReports } = useStore(state => ({
    userProfile: state.userProfile,
    analyticsReports: state.analyticsReports,
  }));
  const [result, setResult] = useState<ReleaseHarnessResult | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingIdentifiers, setIsGeneratingIdentifiers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const compile = async () => {
    if (!userProfile?.id || userProfile.id === 'pending') {
      setError('User profile is required before compiling a release harness.');
      return;
    }
    setIsCompiling(true);
    setError(null);
    setSavedId(null);
    try {
      const harness = await releaseHarnessService.compileReleaseHarness({
        userId: userProfile.id,
        projectId,
        audioFile,
        userProfile,
        analyticsReports,
        metadata,
        selectedStores,
        releaseIntent: {
          title: metadata.trackTitle,
          releaseType: mapReleaseType(metadata.releaseType),
        },
      });
      setResult(harness);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compile release harness.');
    } finally {
      setIsCompiling(false);
    }
  };

  const save = async () => {
    if (!result) return;
    setIsSaving(true);
    setError(null);
    try {
      const id = await saveReleaseHarnessRun(result);
      setSavedId(id);
      onSaved?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save harness run.');
    } finally {
      setIsSaving(false);
    }
  };

  const generateIdentifiers = async () => {
    setIsGeneratingIdentifiers(true);
    setError(null);
    try {
      const updates: Partial<ExtendedGoldenMetadata> = {};
      if (!metadata.isrc) updates.isrc = await IdentifierService.nextISRC();
      if (!metadata.upc) updates.upc = await IdentifierService.nextUPC();
      if (!metadata.catalogNumber) updates.catalogNumber = buildCatalogNumber(metadata.artistName, metadata.trackTitle);
      const work = !metadata.iswc && metadata.trackTitle ? await createISWCWorkDraft(metadata, updates.isrc) : undefined;
      onApplyMetadata?.(updates);
      if (result) {
        setResult({
          ...result,
          metadataDraft: { ...result.metadataDraft, ...updates },
          distributionReadiness: {
            ...result.distributionReadiness,
            identifiers: {
              isrc: updates.isrc ?? result.distributionReadiness.identifiers.isrc,
              upc: updates.upc ?? result.distributionReadiness.identifiers.upc,
              iswc: result.distributionReadiness.identifiers.iswc,
              iswcStatus: result.distributionReadiness.identifiers.iswc ? 'registered' : work ? 'draft' : result.distributionReadiness.identifiers.iswcStatus,
              workId: work?.id ?? result.distributionReadiness.identifiers.workId,
              catalogNumber: updates.catalogNumber ?? result.distributionReadiness.identifiers.catalogNumber,
              missing: result.distributionReadiness.identifiers.missing.filter(id => id === 'iswc' || !(id in updates)),
            },
          },
          warnings: [
            ...result.warnings,
            ...(work ? [`ISWC work draft created (${work.id}); official ISWC remains pending until registration confirmation.`] : []),
          ],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate release identifiers.');
    } finally {
      setIsGeneratingIdentifiers(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-purple-200">
              <GitBranch size={20} />
              <h3 className="text-lg font-semibold">Release Harness</h3>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-gray-300">
              Compile this release from song DNA, artist memory, and DDEX readiness before final review.
            </p>
          </div>
          <button
            type="button"
            onClick={compile}
            disabled={isCompiling}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCompiling ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            Compile Harness
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {result ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SummaryPanel
              icon={<Music2 size={18} />}
              title="Song DNA"
              value={`${Math.round(result.releaseDna.energy * 100)}% energy`}
              lines={[
                result.releaseDna.genreSignals.slice(0, 3).join(', ') || 'Genre needs metadata/audio analysis',
                result.releaseDna.moodSignals.slice(0, 3).join(', ') || 'Mood signals pending',
                `Short-form fit ${Math.round(result.releaseDna.commercialFit.shortForm * 100)}%`,
              ]}
            />
            <SummaryPanel
              icon={<Database size={18} />}
              title="Artist Memory"
              value={`${Math.round(result.artistOperatingModel.confidence * 100)}% confidence`}
              lines={[
                result.artistOperatingModel.identity.careerStage || 'Career stage not set',
                result.artistOperatingModel.identity.goals.slice(0, 2).join(', ') || 'Goals not set',
                result.artistOperatingModel.preferences.preferredChannels.join(', '),
              ]}
            />
            <SummaryPanel
              icon={<CheckCircle2 size={18} />}
              title="DDEX Readiness"
              value={result.distributionReadiness.ddexPackageReady ? 'Package-ready' : 'Needs work'}
              lines={[
                result.distributionReadiness.authorityLevel.replace('_', ' '),
                result.distributionReadiness.identifiers.missing.length
                  ? `Needs ${result.distributionReadiness.identifiers.missing.map(id => id.toUpperCase()).join(', ')}`
                  : 'ISRC, UPC, ISWC, and catalog number present',
                result.distributionReadiness.rightsWarnings.slice(0, 1).join(', ') || 'No rights warning detected',
              ]}
            />
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm text-gray-400">Recommended strategy</div>
                <h3 className="mt-1 text-xl font-semibold text-white">{result.recommendedStrategy.name}</h3>
                <div className="mt-2 text-sm text-gray-300">
                  Score {result.recommendedStrategy.score} / Primary channel {result.recommendedStrategy.primaryChannel}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onApplyMetadata?.(result.metadataDraft)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-100 hover:bg-gray-800"
                >
                  <Bot size={16} />
                  Apply Metadata Draft
                </button>
                <button
                  type="button"
                  onClick={generateIdentifiers}
                  disabled={isGeneratingIdentifiers}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-100 hover:bg-gray-800 disabled:opacity-60"
                >
                  {isGeneratingIdentifiers ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                  Generate / Prepare Identifiers
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Harness Run
                </button>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-gray-300">
              {result.recommendedStrategy.rationale.map(item => <li key={item}>- {item}</li>)}
            </ul>
            {savedId && <div className="mt-4 text-sm text-green-300">Saved harness run {savedId}.</div>}
          </div>

          {(result.warnings.length > 0 || result.assumptions.length > 0) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ListPanel title="Warnings" items={result.warnings} />
              <ListPanel title="Assumptions" items={result.assumptions} />
            </div>
          )}

          <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-5">
            <h3 className="text-base font-semibold text-white">Timeline Draft</h3>
            <div className="mt-4 space-y-3">
              {result.timelineDraft.map(item => (
                <div key={`${item.offsetDays}-${item.title}`} className="flex gap-3 text-sm">
                  <div className="w-14 shrink-0 text-purple-300">{item.offsetDays >= 0 ? `+${item.offsetDays}` : item.offsetDays}d</div>
                  <div>
                    <div className="font-medium text-gray-100">{item.title}</div>
                    <div className="text-gray-400">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-6 text-sm text-gray-400">
          Run the compiler to generate the strategy, readiness report, and draft timeline.
        </div>
      )}
    </div>
  );
}

function buildCatalogNumber(artistName?: string, title?: string): string {
  const seed = `${artistName ?? 'INDII'} ${title ?? 'RELEASE'}`
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.slice(0, 3))
    .join('')
    .slice(0, 10);
  return `IND-${seed || 'REL'}-${new Date().getFullYear()}`;
}

async function createISWCWorkDraft(metadata: Partial<ExtendedGoldenMetadata>, generatedIsrc?: string) {
  const title = metadata.trackTitle;
  if (!title) return undefined;
  const splits = metadata.splits?.length ? metadata.splits : [{ legalName: metadata.artistName || 'Unknown Writer', percentage: 100 }];
  const total = splits.reduce((sum, split) => sum + split.percentage, 0);
  if (total !== 100) return undefined;
  return ISWCService.registerWork({
    title,
    composers: splits.map(split => ({
      name: split.legalName || metadata.artistName || 'Unknown Writer',
      share: split.percentage,
      role: ('role' in split && split.role === 'songwriter') ? 'CA' : 'C',
      pro: metadata.pro,
    })),
    associatedISRCs: [metadata.isrc ?? generatedIsrc].filter((value): value is string => Boolean(value)),
    language: metadata.language,
    isInstrumental: metadata.isInstrumental,
  });
}

function SummaryPanel({ icon, title, value, lines }: { icon: React.ReactNode; title: string; value: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
      <div className="flex items-center gap-2 text-gray-300">
        {icon}
        <div className="text-sm font-medium">{title}</div>
      </div>
      <div className="mt-3 text-lg font-semibold text-white">{value}</div>
      <div className="mt-3 space-y-1 text-sm text-gray-400">
        {lines.map(line => <div key={line}>{line}</div>)}
      </div>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-gray-400">
        {(items.length ? items : ['None']).map(item => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}

function mapReleaseType(type?: ExtendedGoldenMetadata['releaseType']): 'single' | 'ep' | 'album' | undefined {
  if (type === 'EP') return 'ep';
  if (type === 'Album' || type === 'Compilation') return 'album';
  if (type === 'Single') return 'single';
  return undefined;
}
