import { useEffect, useState } from 'react';
import { Check, Clock3, X } from 'lucide-react';
import type { ArtistContext } from '@indii/shared';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { songIntakeReviewService } from '@/services/ingestion/SongIntakeReviewService';

interface SongIntakeQuestionnaireProps {
    metadata: ExtendedGoldenMetadata;
    artistContext?: ArtistContext;
    onSaved: (metadata: ExtendedGoldenMetadata) => void;
    onDismiss: () => void;
}

const recordingKinds = [
    ['ORIGINAL', 'Original'], ['REMIX', 'Remix'], ['REMASTER', 'Remaster'], ['LIVE', 'Live recording'],
    ['ALTERNATE', 'Alternate mix'], ['INSTRUMENTAL', 'Instrumental'], ['ACAPELLA', 'Acapella'], ['EDIT', 'Edit'], ['COVER', 'Cover'],
] as const;

const yesNoKeys = new Set(['release.history', 'video.officialDesignation', 'migration.intent', 'dispute.intent']);

function suggestedAnswer(metadata: ExtendedGoldenMetadata, key: string): string {
    const intake = metadata.songIntake;
    const previous = intake?.confirmations[key]?.value;
    if (typeof previous === 'string') return previous;
    if (key === 'recording.title') return intake?.embeddedTags.title?.value ?? metadata.trackTitle ?? '';
    if (key === 'recording.artist') return intake?.embeddedTags.artist?.value ?? metadata.artistName ?? '';
    if (key.startsWith('identifier.confirm.')) return intake?.embeddedTags[key.slice('identifier.confirm.'.length)]?.value ?? '';
    return '';
}

export function SongIntakeQuestionnaire({ metadata, artistContext, onSaved, onDismiss }: SongIntakeQuestionnaireProps) {
    const questions = metadata.songIntake?.questions ?? [];
    const question = questions[0];
    const [draft, setDraft] = useState(() => question ? suggestedAnswer(metadata, question.key) : '');
    const [sampleDetails, setSampleDetails] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!question) return;
        setDraft(suggestedAnswer(metadata, question.key));
        setSampleDetails('');
    }, [metadata, question]);

    if (!question) return null;

    const save = async (value: string | boolean) => {
        setBusy(true);
        setError(null);
        try {
            const updated = await songIntakeReviewService.answer(metadata, question.key, value, artistContext);
            onSaved(updated);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not save this answer.');
        } finally {
            setBusy(false);
        }
    };

    const isYesNo = yesNoKeys.has(question.key);
    const isRecordingKind = question.key === 'recording.kind';
    const isSampleQuestion = question.key === 'rights.samples';
    const sourceRelationshipNeedsLink = question.key === 'recording.sourceRelationship';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="presentation">
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="song-intake-title"
                className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#11151d] p-5 shadow-2xl"
            >
                <header className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-300">Song intake · {questions.length} open</p>
                        <h2 id="song-intake-title" className="mt-1 text-lg font-semibold text-white">Confirm what you know</h2>
                        <p className="mt-1 text-xs text-neutral-400">Audio inspection stays separate from your answers. Rights answers are saved as your declaration, not legal clearance.</p>
                    </div>
                    <button type="button" aria-label="Review later" onClick={onDismiss} className="rounded-lg p-2 text-neutral-400 hover:bg-white/10 hover:text-white">
                        <X size={16} />
                    </button>
                </header>

                <div className="space-y-3">
                    <p className="text-sm font-medium text-white">{question.prompt}</p>
                    <p className="text-xs text-neutral-400">{question.reason}</p>

                    {isRecordingKind ? (
                        <div className="space-y-3">
                            <select aria-label="Recording type" value={draft} onChange={event => setDraft(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white">
                                <option value="">Choose a type</option>
                                {recordingKinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                            <button type="button" disabled={busy || !draft} onClick={() => void save(draft)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50">
                                <Check size={15} /> Save answer
                            </button>
                        </div>
                    ) : isYesNo ? (
                        <div className="flex gap-2">
                            <button type="button" onClick={() => void save(true)} disabled={busy} className="flex-1 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white hover:border-green-400/50 disabled:opacity-50">Yes</button>
                            <button type="button" onClick={() => void save(false)} disabled={busy} className="flex-1 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white hover:border-green-400/50 disabled:opacity-50">No</button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <textarea
                                aria-label="Your answer"
                                value={draft}
                                onChange={event => setDraft(event.target.value)}
                                rows={question.key.startsWith('rights.') || sourceRelationshipNeedsLink ? 4 : 2}
                                className="w-full resize-y rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white placeholder:text-neutral-600"
                                placeholder={question.key.startsWith('identifier.confirm.') ? 'Confirm or correct the detected identifier' : 'Type your answer'}
                            />
                            {isSampleQuestion && /^yes\b/i.test(draft.trim()) && (
                                <textarea aria-label="Sample source or clearance details" value={sampleDetails} onChange={event => setSampleDetails(event.target.value)} rows={2} className="w-full resize-y rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white placeholder:text-neutral-600" placeholder="Describe the source and its license or clearance status" />
                            )}
                            {sourceRelationshipNeedsLink && <p className="text-xs text-amber-200">We’ll keep this question open until the source is linked to a canonical catalog entity.</p>}
                            <button
                                type="button"
                                disabled={busy || !draft.trim() || (isSampleQuestion && /^yes\b/i.test(draft.trim()) && !sampleDetails.trim())}
                                onClick={() => void save(isSampleQuestion && /^yes\b/i.test(draft.trim()) ? `${draft.trim()} — ${sampleDetails.trim()}` : draft)}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Check size={15} /> Save answer
                            </button>
                        </div>
                    )}

                    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
                    <button type="button" onClick={onDismiss} className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white">
                        <Clock3 size={13} /> Review later — nothing will be discarded
                    </button>
                </div>
            </section>
        </div>
    );
}
