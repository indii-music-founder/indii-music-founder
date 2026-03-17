/**
 * Item 312: Label Deal Recoupment Tracking
 *
 * Tracks label deal advances and their recoupment status in real-time.
 * Each deal stores:
 *   - advanceAmount: total label advance paid to artist
 *   - recoupedAmount: earnings applied toward recoupment so far
 *   - dealDate: when the deal was signed
 *   - label: label name
 *   - notes: optional deal notes
 *
 * Firestore collection: `label_deals` (per-user subcollection would require
 * a migration — for now reads/writes top-level with userId field).
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
    collection, query, where, orderBy, onSnapshot,
    addDoc, serverTimestamp, doc, updateDoc,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { Skeleton, SkeletonList } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';
import { TrendingUp, Plus, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LabelDeal {
    id: string;
    label: string;
    advanceAmount: number;
    recoupedAmount: number;
    dealDate: string;   // ISO date string
    notes?: string;
    userId: string;
    createdAt: unknown;
}

type RecoupStatus = 'recouped' | 'on-track' | 'at-risk';

function getStatus(deal: LabelDeal): RecoupStatus {
    const pct = deal.advanceAmount > 0 ? deal.recoupedAmount / deal.advanceAmount : 0;
    if (pct >= 1) return 'recouped';
    if (pct >= 0.5) return 'on-track';
    return 'at-risk';
}

const STATUS_META: Record<RecoupStatus, { label: string; color: string; icon: React.ReactNode }> = {
    recouped: {
        label: 'Recouped',
        color: 'text-green-400 bg-green-400/10 border-green-400/20',
        icon: <CheckCircle2 size={12} />,
    },
    'on-track': {
        label: 'On Track',
        color: 'text-dept-royalties bg-dept-royalties/10 border-dept-royalties/20',
        icon: <TrendingUp size={12} />,
    },
    'at-risk': {
        label: 'At Risk',
        color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
        icon: <AlertTriangle size={12} />,
    },
};

// ── Add Deal Modal ─────────────────────────────────────────────────────────────

interface AddDealFormProps {
    onSave: (data: Omit<LabelDeal, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
    onCancel: () => void;
}

function AddDealForm({ onSave, onCancel }: AddDealFormProps) {
    const [label, setLabel] = useState('');
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [recoupedAmount, setRecoupedAmount] = useState('0');
    const [dealDate, setDealDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave({
            label,
            advanceAmount: parseFloat(advanceAmount) || 0,
            recoupedAmount: parseFloat(recoupedAmount) || 0,
            dealDate,
            notes: notes || undefined,
        });
        setSaving(false);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-black/40 border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">New Label Deal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label htmlFor="ld-label" className="text-xs text-gray-400 font-medium">Label Name</label>
                    <input
                        id="ld-label"
                        required
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        placeholder="e.g. Indie Records LLC"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-royalties"
                    />
                </div>
                <div className="space-y-1">
                    <label htmlFor="ld-date" className="text-xs text-gray-400 font-medium">Deal Date</label>
                    <input
                        id="ld-date"
                        type="date"
                        required
                        value={dealDate}
                        onChange={e => setDealDate(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dept-royalties"
                    />
                </div>
                <div className="space-y-1">
                    <label htmlFor="ld-advance" className="text-xs text-gray-400 font-medium">Advance Amount (USD)</label>
                    <input
                        id="ld-advance"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={advanceAmount}
                        onChange={e => setAdvanceAmount(e.target.value)}
                        placeholder="50000"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-royalties"
                    />
                </div>
                <div className="space-y-1">
                    <label htmlFor="ld-recouped" className="text-xs text-gray-400 font-medium">Already Recouped (USD)</label>
                    <input
                        id="ld-recouped"
                        type="number"
                        min="0"
                        step="0.01"
                        value={recoupedAmount}
                        onChange={e => setRecoupedAmount(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dept-royalties"
                    />
                </div>
            </div>
            <div className="space-y-1">
                <label htmlFor="ld-notes" className="text-xs text-gray-400 font-medium">Notes (optional)</label>
                <textarea
                    id="ld-notes"
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Key deal terms, royalty rate, etc."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-royalties resize-none"
                />
            </div>
            <div className="flex gap-3 justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-dept-royalties hover:bg-dept-royalties/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Save Deal'}
                </button>
            </div>
        </form>
    );
}

// ── Deal Row ───────────────────────────────────────────────────────────────────

function DealRow({ deal, onUpdateRecouped }: { deal: LabelDeal; onUpdateRecouped: (id: string, amount: number) => void }) {
    const [expanded, setExpanded] = useState(false);
    const [editAmount, setEditAmount] = useState(String(deal.recoupedAmount));
    const status = getStatus(deal);
    const meta = STATUS_META[status];
    const pct = deal.advanceAmount > 0 ? Math.min(deal.recoupedAmount / deal.advanceAmount, 1) : 0;
    const remaining = Math.max(deal.advanceAmount - deal.recoupedAmount, 0);

    return (
        <motion.div
            layout
            className="bg-black/30 border border-white/8 rounded-xl overflow-hidden"
        >
            {/* Summary row */}
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/5 transition-colors"
                aria-expanded={expanded}
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white text-sm truncate">{deal.label}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${meta.color}`}>
                            {meta.icon}{meta.label}
                        </span>
                    </div>
                    <div className="text-xs text-gray-500">{formatDate(deal.dealDate)}</div>
                </div>
                <div className="text-right hidden sm:block">
                    <div className="text-xs text-gray-500 mb-0.5">Advance</div>
                    <div className="text-sm font-mono text-white">{formatCurrency(deal.advanceAmount)}</div>
                </div>
                <div className="text-right hidden md:block">
                    <div className="text-xs text-gray-500 mb-0.5">Recouped</div>
                    <div className="text-sm font-mono text-white">{formatCurrency(deal.recoupedAmount)}</div>
                </div>
                <div className="text-right w-16">
                    <div className="text-xs text-gray-500 mb-0.5">Progress</div>
                    <div className="text-sm font-bold text-white">{formatPercent(pct, undefined, 0)}</div>
                </div>
                {expanded ? <ChevronUp size={14} className="text-gray-500 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />}
            </button>

            {/* Progress bar */}
            <div className="h-1 bg-white/5 mx-4">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${status === 'recouped' ? 'bg-green-400' : status === 'on-track' ? 'bg-dept-royalties' : 'bg-amber-400'}`}
                    style={{ width: `${pct * 100}%` }}
                />
            </div>

            {/* Expanded detail */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 border-t border-white/5 space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <div className="text-xs text-gray-500 mb-0.5">Advance</div>
                                    <div className="font-mono text-white">{formatCurrency(deal.advanceAmount)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-0.5">Recouped</div>
                                    <div className="font-mono text-white">{formatCurrency(deal.recoupedAmount)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-0.5">Remaining</div>
                                    <div className="font-mono text-white">{formatCurrency(remaining)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-0.5">Progress</div>
                                    <div className="font-mono text-white">{formatPercent(pct, undefined, 1)}</div>
                                </div>
                            </div>
                            {deal.notes && (
                                <p className="text-xs text-gray-400 bg-white/3 rounded-lg p-3 border border-white/5">{deal.notes}</p>
                            )}
                            {/* Update recouped amount */}
                            <div className="flex items-center gap-3">
                                <label htmlFor={`recoup-${deal.id}`} className="text-xs text-gray-400 whitespace-nowrap">Update recouped:</label>
                                <input
                                    id={`recoup-${deal.id}`}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editAmount}
                                    onChange={e => setEditAmount(e.target.value)}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-dept-royalties"
                                />
                                <button
                                    onClick={() => onUpdateRecouped(deal.id, parseFloat(editAmount) || 0)}
                                    className="px-3 py-1.5 bg-dept-royalties/20 hover:bg-dept-royalties/30 border border-dept-royalties/30 rounded-lg text-xs text-dept-royalties font-medium transition-colors"
                                >
                                    Update
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function LabelDealRecoupment() {
    const [deals, setDeals] = useState<LabelDeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const uid = auth.currentUser?.uid;

    // Subscribe to label_deals for this user
    useEffect(() => {
        if (!uid) { setLoading(false); return; }
        const q = query(
            collection(db, 'label_deals'),
            where('userId', '==', uid),
            orderBy('createdAt', 'desc'),
        );
        const unsub = onSnapshot(q, snap => {
            setDeals(snap.docs.map(d => ({ id: d.id, ...d.data() } as LabelDeal)));
            setLoading(false);
        }, () => setLoading(false));
        return unsub;
    }, [uid]);

    const handleAddDeal = useCallback(async (data: Omit<LabelDeal, 'id' | 'userId' | 'createdAt'>) => {
        if (!uid) return;
        await addDoc(collection(db, 'label_deals'), {
            ...data,
            userId: uid,
            createdAt: serverTimestamp(),
        });
        setShowAddForm(false);
    }, [uid]);

    const handleUpdateRecouped = useCallback(async (dealId: string, amount: number) => {
        await updateDoc(doc(db, 'label_deals', dealId), { recoupedAmount: amount });
    }, []);

    // ── Summary stats ──────────────────────────────────────────────────────────
    const totalAdvance = deals.reduce((s, d) => s + d.advanceAmount, 0);
    const totalRecouped = deals.reduce((s, d) => s + d.recoupedAmount, 0);
    const totalRemaining = Math.max(totalAdvance - totalRecouped, 0);
    const overallPct = totalAdvance > 0 ? totalRecouped / totalAdvance : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white">Label Deal Recoupment</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Track advances and recoupment status across all label deals</p>
                </div>
                <button
                    onClick={() => setShowAddForm(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 bg-dept-royalties hover:bg-dept-royalties/90 text-white rounded-xl text-sm font-medium transition-colors"
                    aria-expanded={showAddForm}
                >
                    <Plus size={14} aria-hidden="true" />
                    Add Deal
                </button>
            </div>

            {/* Add form */}
            <AnimatePresence>
                {showAddForm && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                    >
                        <AddDealForm onSave={handleAddDeal} onCancel={() => setShowAddForm(false)} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Summary cards */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
            ) : deals.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                        <div className="text-xs text-gray-500 mb-1">Total Advance</div>
                        <div className="text-2xl font-black text-white">{formatCurrency(totalAdvance)}</div>
                    </div>
                    <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                        <div className="text-xs text-gray-500 mb-1">Total Recouped</div>
                        <div className="text-2xl font-black text-dept-royalties">{formatCurrency(totalRecouped)}</div>
                        <div className="mt-2 h-1 bg-white/5 rounded-full">
                            <div
                                className="h-full bg-dept-royalties rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(overallPct * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                    <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                        <div className="text-xs text-gray-500 mb-1">Still Owed to Label</div>
                        <div className="text-2xl font-black text-white">{formatCurrency(totalRemaining)}</div>
                        <div className="text-xs text-gray-500 mt-1">{formatPercent(1 - overallPct, undefined, 0)} remaining</div>
                    </div>
                </div>
            ) : null}

            {/* Deal list */}
            {loading ? (
                <SkeletonList rows={3} />
            ) : deals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/10 rounded-2xl">
                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-gray-600 mb-3">
                        <Clock size={20} aria-hidden="true" />
                    </div>
                    <p className="text-gray-400 font-medium">No label deals tracked yet</p>
                    <p className="text-gray-600 text-sm mt-1">Add your first deal to start tracking recoupment.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {deals.map(deal => (
                        <DealRow key={deal.id} deal={deal} onUpdateRecouped={handleUpdateRecouped} />
                    ))}
                </div>
            )}
        </div>
    );
}
