import React, { useState, useMemo } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileQuestion, HelpCircle, Shield, ShieldAlert, Sparkles } from 'lucide-react';
import { LegalService } from '@/services/legal/LegalService';
import type { ClaimsInboxItem, PotentialClaimConflict, RightsClaim } from '@indii/shared';

interface ClaimsInboxTabProps {
    initialClaims?: RightsClaim[];
}

export function ClaimsInboxTab({ initialClaims }: ClaimsInboxTabProps) {
    const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'CONFLICTS_ONLY'>('ALL');

    const projection = useMemo(() => {
        return LegalService.getClaimsInbox({
            claims: initialClaims || [],
        });
    }, [initialClaims]);

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
                <div className="flex items-center gap-3">
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
                </div>
            </div>

            {/* Claims Table / List */}
            {displayedItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-12 text-center flex flex-col items-center justify-center">
                    <Shield className="text-gray-500 mb-3" size={36} />
                    <p className="text-sm font-medium text-gray-300">No active advisory claims found</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-md">
                        Your catalog currently has no overlapping claimant assertions or unresolved external disputes registered.
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
                                                <span>Evidence Items: {item.evidenceCount}</span>
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
        </div>
    );
}
