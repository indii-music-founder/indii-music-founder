import React, { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, FileQuestion, Shield, ShieldAlert } from 'lucide-react';
import { LegalService } from '@/services/legal/LegalService';
import type { PotentialClaimConflict, RightsClaim } from '@indii/shared';

interface ClaimsInboxTabProps {
    initialClaims?: RightsClaim[];
}

export function ClaimsInboxTab({ initialClaims }: ClaimsInboxTabProps) {
    const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'CONFLICTS_ONLY'>('ALL');
    const [claims, setClaims] = useState<RightsClaim[]>(initialClaims ?? []);
    const [events, setEvents] = useState<NonNullable<Parameters<typeof LegalService.getClaimsInbox>[0]>['events']>([]);
    const [storageTruncated, setStorageTruncated] = useState(false);
    const [loadState, setLoadState] = useState<'loading' | 'ready' | 'unavailable'>(initialClaims === undefined ? 'loading' : 'ready');
    const [reloadKey, setReloadKey] = useState(0);
    const [targetEntityId, setTargetEntityId] = useState('');
    const [claimantEntityId, setClaimantEntityId] = useState('');
    const [claimType, setClaimType] = useState<RightsClaim['type']>('MASTER');
    const [territories, setTerritories] = useState('WW');
    const [evidenceUri, setEvidenceUri] = useState('');
    const [intakeNote, setIntakeNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [intakeError, setIntakeError] = useState<string | null>(null);

    useEffect(() => {
        if (initialClaims !== undefined) {
            setClaims(initialClaims);
            setEvents([]);
            setStorageTruncated(false);
            setLoadState('ready');
            return;
        }
        let cancelled = false;
        setLoadState('loading');
        void LegalService.loadCanonicalClaimsInbox().then(input => {
            if (cancelled) return;
            setClaims(input.claims);
            setEvents(input.events);
            setStorageTruncated(input.storageTruncated);
            setLoadState('ready');
        }).catch(() => {
            if (!cancelled) setLoadState('unavailable');
        });
        return () => { cancelled = true; };
    }, [initialClaims, reloadKey]);

    const handleDeclareClaim = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        setIntakeError(null);
        try {
            const uri = evidenceUri.trim();
            const result = await LegalService.declareCanonicalRightsClaim({
                targetEntityId: targetEntityId.trim(),
                ...(claimantEntityId.trim() ? { claimantEntityId: claimantEntityId.trim() } : {}),
                type: claimType,
                territoryCodes: territories.split(',').map(code => code.trim()).filter(Boolean),
                ...(uri ? { evidence: [{ id: `owner-evidence:${Date.now()}`, type: 'OTHER' as const, uri }] } : {}),
                ...(intakeNote.trim() ? { note: intakeNote.trim() } : {}),
            });
            setClaims(current => [...current, result.claim]);
            setEvents(current => [...current, result.event]);
            setTargetEntityId('');
            setClaimantEntityId('');
            setEvidenceUri('');
            setIntakeNote('');
        } catch (error) {
            setIntakeError(error instanceof Error ? error.message : 'Could not save this claim.');
        } finally {
            setSaving(false);
        }
    };

    const projection = useMemo(() => {
        return LegalService.getClaimsInbox({
            claims,
            events,
        });
    }, [claims, events]);

    const displayedItems = useMemo(() => {
        if (filterStatus === 'CONFLICTS_ONLY') {
            return projection.items.filter(item => item.hasPotentialConflict);
        }
        return projection.items;
    }, [projection, filterStatus]);

    const conflictsByClaimId = useMemo(() => {
        const map = new Map<string, PotentialClaimConflict[]>();
        for (const conflict of projection.potentialConflicts) {
            const first = map.get(conflict.firstClaimId) || [];
            first.push(conflict);
            map.set(conflict.firstClaimId, first);

            const second = map.get(conflict.secondClaimId) || [];
            second.push(conflict);
            map.set(conflict.secondClaimId, second);
        }
        return map;
    }, [projection.potentialConflicts]);

    return (
        <div className="space-y-6" data-testid="claims-inbox-container">
            {/* Header / Summary Banner */}
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="text-amber-400" size={18} />
                        <h3 className="text-base font-bold text-white">Advisory Claims Inbox</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                        Surfaces overlapping rights assertions and advisory conflicts. This is an objective read-model that does not alter copyright ownership or submit platform takedowns without legal review.
                    </p>
                </div>
                {loadState === 'ready' && <div className="flex items-center gap-3">
                    <button
                        onClick={() => setFilterStatus('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            filterStatus === 'ALL'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-white/5 text-gray-400 hover:text-white'
                        }`}
                        data-testid="filter-all-claims"
                    >
                        All Claims ({projection.items.length})
                    </button>
                    <button
                        onClick={() => setFilterStatus('CONFLICTS_ONLY')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                            filterStatus === 'CONFLICTS_ONLY'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-white/5 text-gray-400 hover:text-white'
                        }`}
                        data-testid="filter-conflicts-only"
                    >
                        <AlertTriangle size={12} />
                        Conflicts ({projection.potentialConflicts.length})
                    </button>
                </div>}
            </div>

            {loadState !== 'ready' ? (
                <div className="rounded-xl border border-dashed border-white/10 p-10 text-center" role="status">
                    <FileQuestion className="text-amber-400 mx-auto mb-3" size={32} />
                    <p className="text-sm font-medium text-gray-200">
                        {loadState === 'loading' ? 'Loading recorded claims…' : 'Claims data is unavailable'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                        {loadState === 'loading'
                            ? 'The inbox has not verified whether any claims are recorded yet.'
                            : 'The owner-scoped claim source could not be read. No conclusion about disputes or catalog status is available.'}
                    </p>
                    {loadState === 'unavailable' && (
                        <button className="mt-4 px-3 py-1.5 rounded-lg bg-white/10 text-xs text-white" onClick={() => setReloadKey(value => value + 1)}>
                            Retry
                        </button>
                    )}
                </div>
            ) : displayedItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-12 text-center flex flex-col items-center justify-center">
                    <Shield className="text-gray-500 mb-3" size={36} />
                    <p className="text-sm font-medium text-gray-300">No claims are recorded in this indii inbox</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-md">
                        External rights sources and catalog completeness have not been verified. This empty inbox is not a clearance or ownership finding.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {displayedItems.map((item) => {
                        const isExpanded = selectedClaimId === item.claim.id;
                        const conflicts = conflictsByClaimId.get(item.claim.id) || [];

                        return (
                            <div
                                key={item.claim.id}
                                className={`rounded-xl border transition-all ${
                                    item.hasPotentialConflict
                                        ? 'bg-amber-950/10 border-amber-500/30'
                                        : 'bg-white/[0.02] border-white/5'
                                }`}
                                data-testid={`claim-item-${item.claim.id}`}
                            >
                                <div
                                    onClick={() => setSelectedClaimId(isExpanded ? null : item.claim.id)}
                                    className="p-4 flex items-center justify-between cursor-pointer select-none"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="text-gray-400">
                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-white">
                                                    {item.claim.id}
                                                </span>
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/10 text-gray-300">
                                                    {item.claim.type}
                                                </span>
                                                {item.hasPotentialConflict && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                                        <AlertTriangle size={10} />
                                                        Conflict Detected
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1 flex items-center gap-4">
                                                <span>Target: <code className="text-gray-300">{item.claim.targetEntityId}</code></span>
                                                {item.claim.claimantEntityId && (
                                                    <span>Claimant: <code className="text-gray-300">{item.claim.claimantEntityId}</code></span>
                                                )}
                                                <span>Evidence References: {item.evidenceCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                            {item.queueStatus}
                                        </span>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3">
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Review Reasons</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {item.reviewReasons.map((reason) => (
                                                    <span
                                                        key={reason}
                                                        className="px-2 py-1 rounded text-xs bg-white/5 text-gray-300 border border-white/10"
                                                    >
                                                        {reason}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Submitted provenance and evidence (unverified)</h4>
                                            <p className="text-xs text-gray-300">Source: {item.claim.provenance.state} / {item.claim.provenance.sourceType}</p>
                                            {item.claim.provenance.note && <p className="text-xs text-gray-400 mt-1">Note: {item.claim.provenance.note}</p>}
                                            {item.claim.provenance.evidence.length > 0 ? (
                                                <ul className="mt-2 space-y-1">
                                                    {item.claim.provenance.evidence.map(reference => (
                                                        <li key={reference.id} className="text-xs text-gray-400 break-all">
                                                            {reference.type}{reference.description ? ` — ${reference.description}` : ''}
                                                            {reference.uri && <div>Reference: {reference.uri}</div>}
                                                            {reference.contentSha256 && <div>SHA-256: {reference.contentSha256}</div>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <p className="text-xs text-gray-500">No evidence references were submitted with this assertion.</p>}
                                        </div>

                                        {conflicts.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                    <AlertTriangle size={12} />
                                                    Overlapping Scope Assertions
                                                </h4>
                                                <div className="space-y-1.5">
                                                    {conflicts.map((c, i) => (
                                                        <div
                                                            key={i}
                                                            className="p-2.5 rounded bg-black/40 border border-amber-500/20 text-xs text-amber-200/90"
                                                        >
                                                            <span>Disputed Right: <strong>{c.claimType}</strong> across claim pair <code>{c.firstClaimId}</code> and <code>{c.secondClaimId}</code></span>
                                                            <p className="text-[11px] text-gray-400 mt-0.5">
                                                                Human review required: verify co-publishing agreements, split sheets, or territorial carveouts.
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {loadState === 'ready' && storageTruncated && (
                <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
                    The stored inbox exceeds its display limit. Some claims or events are omitted, so this view is incomplete.
                </div>
            )}

            {loadState === 'ready' && (
                <form onSubmit={handleDeclareClaim} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3" data-testid="declare-rights-claim-form">
                    <div>
                        <h4 className="text-sm font-semibold text-white">Record an owner-declared claim</h4>
                        <p className="text-xs text-gray-500 mt-1">This saves your assertion for review. It does not verify ownership, contact another party, or clear rights.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        <label className="text-xs text-gray-400">Canonical target ID
                            <input required value={targetEntityId} onChange={event => setTargetEntityId(event.target.value)} className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
                        </label>
                        <label className="text-xs text-gray-400">Claimant canonical ID (optional)
                            <input value={claimantEntityId} onChange={event => setClaimantEntityId(event.target.value)} className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
                        </label>
                        <label className="text-xs text-gray-400">Right asserted
                            <select value={claimType} onChange={event => setClaimType(event.target.value as RightsClaim['type'])} className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-white">
                                {(['MASTER', 'COMPOSITION', 'PUBLISHING', 'PERFORMANCE', 'MECHANICAL', 'SYNC', 'OTHER'] as const).map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </label>
                        <label className="text-xs text-gray-400">Territory codes (comma-separated)
                            <input value={territories} onChange={event => setTerritories(event.target.value)} placeholder="WW or US,CA" className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
                        </label>
                        <label className="text-xs text-gray-400 md:col-span-2">Evidence reference URL (optional)
                            <input type="url" value={evidenceUri} onChange={event => setEvidenceUri(event.target.value)} className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
                        </label>
                    </div>
                    <label className="block text-xs text-gray-400">Review note (optional)
                        <textarea value={intakeNote} onChange={event => setIntakeNote(event.target.value)} maxLength={2000} rows={2} className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
                    </label>
                    {intakeError && <p role="alert" className="text-xs text-red-300">{intakeError}</p>}
                    <button disabled={saving} className="rounded-lg bg-blue-500/20 px-3 py-2 text-xs font-semibold text-blue-200 disabled:opacity-50">
                        {saving ? 'Saving assertion…' : 'Record for review'}
                    </button>
                </form>
            )}
        </div>
    );
}
