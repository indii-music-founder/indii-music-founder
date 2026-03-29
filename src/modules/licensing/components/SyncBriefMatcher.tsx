/**
 * SyncBriefMatcher — Item 133 (PRODUCTION_200)
 * Parse ingested daily licensing briefs and automatically suggest which
 * catalog tracks fit the mood/BPM. Mood-score algorithm: cosine similarity
 * on mood tag overlap + BPM window matching.
 */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Music2, Film, Star, ChevronDown, ChevronUp, RefreshCw, Tag, Upload, FileCheck, X, Loader2, CheckCircle2 } from 'lucide-react';
import { licensingService } from '@/services/licensing/LicensingService';
import type { SyncBrief, SyncCatalogTrack as CatalogTrack, SyncMood as Mood } from '@/services/licensing/LicensingService';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db, auth } from '@/services/firebase';

function matchScore(brief: SyncBrief, track: CatalogTrack): number {
    // BPM fit: 1.0 if in range, decays outside
    const inRange = track.bpm >= brief.bpmMin && track.bpm <= brief.bpmMax;
    const bpmCenter = (brief.bpmMin + brief.bpmMax) / 2;
    const bpmWindow = (brief.bpmMax - brief.bpmMin) / 2 + 20;
    const bpmScore = inRange ? 1.0 : Math.max(0, 1 - Math.abs(track.bpm - bpmCenter) / bpmWindow);

    // Mood overlap: Jaccard-like
    const overlap = track.moods.filter(m => brief.moods.includes(m)).length;
    const union = new Set([...track.moods, ...brief.moods]).size;
    const moodScore = union === 0 ? 0 : overlap / union;

    return Math.round((bpmScore * 0.4 + moodScore * 0.6) * 100);
}

const TYPE_COLORS: Record<string, string> = {
    TV: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    Film: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    Ad: 'text-[#FFE135] bg-[#FFE135]/10 border-[#FFE135]/20',
    Game: 'text-green-400 bg-green-400/10 border-green-400/20',
    Trailer: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
};

function ScoreBadge({ score }: { score: number }) {
    const color = score >= 75 ? 'text-green-400 bg-green-400/10 border-green-400/20'
        : score >= 50 ? 'text-[#FFE135] bg-[#FFE135]/10 border-[#FFE135]/20'
            : 'text-neutral-500 bg-white/5 border-white/10';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black ${color}`}>
            <Star size={8} /> {score}%
        </span>
    );
}

/**
 * Item 310: Clearance Document Upload Modal
 *
 * Displayed when an artist wants to submit a matched track for a sync brief.
 * Requires uploading proof of clearance (contract, license, or clearance letter)
 * for any sampled elements before the submission can be sent.
 */
interface ClearanceUploadModalProps {
    brief: SyncBrief;
    track: CatalogTrack;
    onClose: () => void;
    onSubmitted: () => void;
}

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';

function ClearanceUploadModal({ brief, track, onClose, onSubmitted }: ClearanceUploadModalProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [status, setStatus] = useState<UploadStatus>('idle');
    const [error, setError] = useState('');
    const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uid = auth.currentUser?.uid;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (idx: number) => {
        setFiles(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
        if (!uid || files.length === 0) return;
        setStatus('uploading');
        setError('');
        const urls: string[] = [];
        try {
            for (const file of files) {
                const path = `users/${uid}/clearance/${brief.id}/${track.id}/${file.name}`;
                const fileRef = storageRef(storage, path);
                await uploadBytes(fileRef, file);
                const url = await getDownloadURL(fileRef);
                urls.push(url);
            }
            // Record clearance submission in Firestore
            await addDoc(collection(db, 'licensing_clearances'), {
                briefId: brief.id,
                briefProject: brief.project,
                trackId: track.id,
                trackTitle: track.title,
                trackISRC: track.isrc,
                userId: uid,
                clearanceDocUrls: urls,
                submittedAt: serverTimestamp(),
                status: 'pending_review',
            });
            setUploadedUrls(urls);
            setStatus('done');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
            setStatus('error');
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clearance-modal-title"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0d0d0f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5"
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 id="clearance-modal-title" className="text-sm font-bold text-white">
                            Upload Clearance Documents
                        </h2>
                        <p className="text-[10px] text-neutral-500 mt-0.5">
                            Submit proof of clearance for <span className="text-white">{track.title}</span> &rarr; <span className="text-indigo-400">{brief.project}</span>
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Close clearance upload" className="text-neutral-500 hover:text-white transition-colors">
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>

                {status !== 'done' ? (
                    <>
                        {/* What to upload */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-xs text-neutral-400 space-y-1">
                            <p className="font-semibold text-neutral-300 text-[11px]">Required if your track contains:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                                <li>Samples from third-party recordings</li>
                                <li>Interpolated melodies or chord progressions</li>
                                <li>Co-writer agreements for split compositions</li>
                            </ul>
                            <p className="text-[10px] pt-1">Accepted: PDF, JPG, PNG, DOCX</p>
                        </div>

                        {/* File list */}
                        {files.length > 0 && (
                            <ul className="space-y-2">
                                {files.map((f, i) => (
                                    <li key={i} className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
                                        <FileCheck size={12} className="text-indigo-400 flex-shrink-0" aria-hidden="true" />
                                        <span className="text-[11px] text-white flex-1 truncate">{f.name}</span>
                                        <span className="text-[10px] text-neutral-600">{(f.size / 1024).toFixed(0)}KB</span>
                                        <button
                                            onClick={() => removeFile(i)}
                                            aria-label={`Remove ${f.name}`}
                                            className="text-neutral-600 hover:text-red-400 transition-colors"
                                        >
                                            <X size={11} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {/* Upload button */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.docx"
                            onChange={handleFileChange}
                            className="sr-only"
                            aria-label="Select clearance documents"
                            id="clearance-file-input"
                        />
                        <label
                            htmlFor="clearance-file-input"
                            className="flex items-center justify-center gap-2 w-full py-3 border border-dashed border-white/10 rounded-xl text-[11px] text-neutral-500 hover:text-white hover:border-white/20 transition-all cursor-pointer"
                        >
                            <Upload size={13} aria-hidden="true" />
                            Click to add clearance documents
                        </label>

                        {/* Error */}
                        {status === 'error' && (
                            <p className="text-xs text-red-400">{error}</p>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] text-neutral-400 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={files.length === 0 || status === 'uploading'}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="Submit track with clearance documents"
                            >
                                {status === 'uploading' ? (
                                    <><Loader2 size={12} className="animate-spin" aria-hidden="true" />Uploading…</>
                                ) : (
                                    <><Upload size={12} aria-hidden="true" />Submit Track</>
                                )}
                            </button>
                        </div>
                    </>
                ) : (
                    /* Success state */
                    <div className="flex flex-col items-center py-6 gap-3 text-center">
                        <CheckCircle2 size={32} className="text-green-400" aria-hidden="true" />
                        <div>
                            <p className="text-sm font-semibold text-white">Submission received</p>
                            <p className="text-[10px] text-neutral-500 mt-1">
                                {uploadedUrls.length} document{uploadedUrls.length !== 1 ? 's' : ''} uploaded.
                                The licensor will review your clearance docs within 5 business days.
                            </p>
                        </div>
                        <button
                            onClick={onSubmitted}
                            className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] text-neutral-400 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

function BriefCard({ brief, catalog }: { brief: SyncBrief; catalog: CatalogTrack[] }) {
    const [open, setOpen] = useState(false);
    const [clearanceTrack, setClearanceTrack] = useState<CatalogTrack | null>(null);
    const [submittedTracks, setSubmittedTracks] = useState<Set<string>>(new Set());
    const matches = useMemo(() => catalog
        .map(t => ({ track: t, score: matchScore(brief, t) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4), [brief, catalog]);

    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors">
            {/* Brief header */}
            <button onClick={() => setOpen(o => !o)} className="w-full text-left p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest ${TYPE_COLORS[brief.type]}`}>
                                {brief.type}
                            </span>
                            <span className="text-xs font-bold text-white truncate">{brief.project}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-neutral-500 flex-wrap">
                            <span>{brief.network}</span>
                            <span>·</span>
                            <span>{brief.bpmMin}–{brief.bpmMax} BPM</span>
                            <span>·</span>
                            <span className="text-[#FFE135]">{brief.budget}</span>
                            <span>·</span>
                            <span className="text-red-400">Due {brief.deadline}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                            {brief.moods.map(m => (
                                <span key={m} className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-neutral-400">
                                    {m}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <ScoreBadge score={matches[0]?.score ?? 0} />
                        {open ? <ChevronUp size={14} className="text-neutral-600" /> : <ChevronDown size={14} className="text-neutral-600" />}
                    </div>
                </div>
            </button>

            {/* Matched tracks */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-3">
                            <p className="text-[10px] text-neutral-500 italic">{brief.description}</p>
                            <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Catalog Matches</div>
                            <div className="space-y-2">
                                {matches.map(({ track, score }) => {
                                    const submitted = submittedTracks.has(track.id);
                                    return (
                                        <div key={track.id} className="flex items-center gap-3 p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                                            <Music2 size={13} className="text-neutral-600 flex-shrink-0" aria-hidden="true" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-white truncate">{track.title}</div>
                                                <div className="text-[9px] text-neutral-600 mt-0.5">
                                                    {track.bpm} BPM · {track.duration} · {track.isrc}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1 flex-shrink-0 max-w-[80px] justify-end">
                                                {track.moods.filter(m => brief.moods.includes(m)).map(m => (
                                                    <span key={m} className="text-[8px] px-1.5 py-0.5 bg-[#FFE135]/10 border border-[#FFE135]/20 rounded-full text-[#FFE135]">{m}</span>
                                                ))}
                                            </div>
                                            <ScoreBadge score={score} />
                                            {/* Item 310: Submit with clearance docs */}
                                            {submitted ? (
                                                <span className="flex items-center gap-1 text-[9px] text-green-400 font-bold">
                                                    <CheckCircle2 size={10} aria-hidden="true" />Submitted
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => setClearanceTrack(track)}
                                                    aria-label={`Submit ${track.title} for ${brief.project} with clearance docs`}
                                                    className="flex items-center gap-1 px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-[9px] text-indigo-400 font-bold transition-colors whitespace-nowrap"
                                                >
                                                    <Upload size={9} aria-hidden="true" />
                                                    Submit
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Clearance Upload Modal — rendered in BriefCard to scope to this brief */}
            <AnimatePresence>
                {clearanceTrack && (
                    <ClearanceUploadModal
                        brief={brief}
                        track={clearanceTrack}
                        onClose={() => setClearanceTrack(null)}
                        onSubmitted={() => {
                            setSubmittedTracks(prev => new Set([...prev, clearanceTrack.id]));
                            setClearanceTrack(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

export function SyncBriefMatcher() {
    const [briefs, setBriefs] = useState<SyncBrief[]>([]);
    const [catalog, setCatalog] = useState<CatalogTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<SyncBrief['type'] | 'All'>('All');

    const load = useCallback(async () => {
        try {
            setError(null);
            const [loadedBriefs, loadedCatalog] = await Promise.all([
                licensingService.getSyncBriefs(),
                licensingService.getCatalogTracksForSync(),
            ]);
            setBriefs(loadedBriefs);
            setCatalog(loadedCatalog);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load sync briefs');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
    };

    const filtered = filter === 'All' ? briefs : briefs.filter(b => b.type === filter);
    const highMatchCount = useMemo(
        () => briefs.filter(b => catalog.some(t => matchScore(b, t) >= 75)).length,
        [briefs, catalog]
    );
    const topBudget = briefs.reduce((top, b) => {
        const val = parseInt(b.budget.replace(/[^0-9]/g, ''), 10) || 0;
        return val > top ? val : top;
    }, 0);
    const topBudgetLabel = topBudget >= 100000 ? '$100K+' : topBudget >= 50000 ? '$50K+' : topBudget >= 10000 ? `$${Math.round(topBudget / 1000)}K+` : topBudget > 0 ? `$${topBudget.toLocaleString()}` : '—';

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-bold text-white">Sync Brief Matcher</h4>
                    <p className="text-[10px] text-neutral-500 mt-0.5">
                        Daily briefs matched against your catalog by mood + BPM
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                        {(['All', 'TV', 'Film', 'Ad', 'Game', 'Trailer'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setFilter(t)}
                                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${filter === t ? 'bg-indigo-500 text-white' : 'text-neutral-500 hover:text-white'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-neutral-400 hover:text-white transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                        Refresh Briefs
                    </button>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: 'Open Briefs', value: loading ? '…' : briefs.length, icon: <Film size={13} />, color: 'text-indigo-400' },
                    { label: 'High Match (75%+)', value: loading ? '…' : highMatchCount, icon: <Star size={13} />, color: 'text-[#FFE135]' },
                    { label: 'Catalog Tracks', value: loading ? '…' : catalog.length, icon: <Music2 size={13} />, color: 'text-green-400' },
                    { label: 'Top Budget', value: loading ? '…' : topBudgetLabel, icon: <Zap size={13} />, color: 'text-purple-400' },
                ].map(s => (
                    <div key={s.label} className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                        <div className={`${s.color} mb-1`}>{s.icon}</div>
                        <div className="text-lg font-black text-white">{s.value}</div>
                        <div className="text-[9px] text-neutral-600 uppercase tracking-widest">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Brief cards */}
            <div className="space-y-3">
                {loading ? (
                    <div className="flex items-center gap-2 text-[10px] text-neutral-500 py-6 justify-center">
                        <RefreshCw size={11} className="animate-spin" />
                        Loading briefs…
                    </div>
                ) : error ? (
                    <div className="text-center py-8 text-[11px] text-red-400">
                        {error}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-8 text-[11px] text-neutral-600">
                        No briefs found{filter !== 'All' ? ` for type "${filter}"` : ''}
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                            <Tag size={10} />
                            Click a brief to see matched catalog tracks
                        </div>
                        {filtered.map(brief => <BriefCard key={brief.id} brief={brief} catalog={catalog} />)}
                    </>
                )}
            </div>
        </div>
    );
}
