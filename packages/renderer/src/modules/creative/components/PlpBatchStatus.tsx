import { AlertCircle, CheckCircle2, LoaderCircle, RefreshCw, Rocket } from 'lucide-react';
import { getEligiblePlpSlots, getPlpBatchCounts, type PlpBatch } from '../plpBatch';

interface PlpBatchStatusProps {
    batch: PlpBatch;
    isProjectActive: boolean;
    onRetry: (slotIndex: number) => void;
    onLaunch: () => void;
}

export default function PlpBatchStatus({ batch, isProjectActive, onRetry, onLaunch }: PlpBatchStatusProps) {
    const counts = getPlpBatchCounts(batch);
    const eligibleCount = getEligiblePlpSlots(batch).length;
    const allVariantsEligible = eligibleCount === batch.slots.length;
    const canLaunch = isProjectActive
        && counts.queued === 0
        && allVariantsEligible
        && batch.launchStatus === 'idle';

    return (
        <section
            aria-label="PLP batch status"
            className="absolute right-3 top-3 z-[130] flex max-h-[calc(100%-1.5rem)] w-[min(26rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border border-indigo-400/30 bg-black/90 text-white shadow-2xl backdrop-blur-xl"
        >
            <header className="border-b border-white/10 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">PLP creative batch</p>
                        <p className="mt-1 text-xs text-white/60">Only completed, playable assets can launch.</p>
                    </div>
                    <div className="text-right text-xs font-semibold text-white/80">
                        {counts.completed}/15 ready
                    </div>
                </div>
                <div className="mt-3 flex gap-3 text-[11px] font-medium" aria-live="polite">
                    <span>{counts.completed} completed</span>
                    <span>{counts.queued} queued</span>
                    <span>{counts.failed} failed</span>
                </div>
            </header>

            <div className="min-h-0 overflow-y-auto px-3 py-2">
                <ul className="space-y-1" aria-label="PLP variant slots">
                    {batch.slots.map(slot => {
                        const label = `${slot.kind === 'image' ? 'Image' : 'Video'} ${slot.kind === 'image' ? slot.index + 1 : slot.index - 9}`;
                        return (
                            <li key={slot.index} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2 text-xs">
                                {slot.status === 'completed' && <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-400" />}
                                {slot.status === 'queued' && <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-sky-400" />}
                                {slot.status === 'failed' && <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-400" />}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold">{label}</span>
                                        <span className="capitalize text-white/55">{slot.status}</span>
                                    </div>
                                    {slot.status === 'failed' && slot.error && (
                                        <p className="mt-0.5 truncate text-[11px] text-rose-200" title={slot.error}>{slot.error}</p>
                                    )}
                                </div>
                                {slot.status === 'failed' && (
                                    <button
                                        type="button"
                                        onClick={() => onRetry(slot.index)}
                                        disabled={!isProjectActive}
                                        className="inline-flex items-center gap-1 rounded-md border border-rose-300/30 px-2 py-1 font-semibold text-rose-100 hover:bg-rose-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label={`Retry ${label}`}
                                    >
                                        <RefreshCw aria-hidden="true" className="h-3 w-3" />
                                        Retry
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>

            <footer className="border-t border-white/10 p-3">
                {!isProjectActive && (
                    <p className="mb-2 text-xs text-amber-200">Switch back to this batch's project to retry or launch.</p>
                )}
                <button
                    type="button"
                    onClick={onLaunch}
                    disabled={!canLaunch}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
                >
                    <Rocket aria-hidden="true" className="h-4 w-4" />
                    {batch.launchStatus === 'launched'
                        ? 'Campaign launched'
                        : batch.launchStatus === 'attention_required'
                            ? 'Verify campaign status before retrying'
                            : batch.launchStatus === 'launching'
                                ? 'Launching campaign…'
                                : counts.queued > 0
                                    ? 'Waiting for queued variants'
                                    : !allVariantsEligible
                                        ? 'Retry failed variants before launch'
                                        : `Review and launch ${eligibleCount} eligible variants`}
                </button>
            </footer>
        </section>
    );
}
