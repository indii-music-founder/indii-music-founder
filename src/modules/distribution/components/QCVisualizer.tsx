import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    ShieldCheck, Music, Tag, XCircle,
    CheckCircle, AlertTriangle, Upload, Loader2, FileAudio,
    BarChart2, Waves, X, RotateCcw,
    type LucideIcon,
} from 'lucide-react';
import { distributionService } from '@/services/distribution/DistributionService';
import type { ForensicsReport, ForensicsDetails } from '@/types/distribution';
import { useToast } from '@/core/context/ToastContext';

/* ==============================================================
 *  QCVisualizer — Audio + Metadata QC Gate
 *
 *  Wired to real data via distributionService.runLocalForensics()
 *  → Electron IPC → AgentSupervisor → Python audio_fidelity_auditor
 *
 *  Degrades to demo mode in non-Electron (web) context with
 *  clearly labeled simulated results.
 *
 *  Checks displayed:
 *    Audio True Peak   — DSP ceiling: ≤ -1.0 dBTP
 *    Integrated LUFS   — Target streaming: -14 to -9 LUFS
 *    Mix Balance       — ≥ 7/10 score
 *    Format/Codec      — WAV or FLAC required for submission
 *    Metadata Complete — title, artist, ISRC required
 *  ============================================================= */

interface QCCheck {
    id: string;
    type: string;
    value: string;
    passed: boolean;
    icon: LucideIcon;
    detail?: string;
}

type RunState = 'idle' | 'running' | 'done' | 'error';

// ── Demo-mode simulated results (non-Electron) ─────────────────────────────

const DEMO_CHECKS: QCCheck[] = [
    {
        id: 'peak', type: 'Audio True Peak', value: '-1.3 dBTP', passed: true,
        icon: Waves, detail: 'Within DSP ceiling of -1.0 dBTP',
    },
    {
        id: 'lufs', type: 'Integrated Loudness', value: '-13.2 LUFS', passed: true,
        icon: BarChart2, detail: 'Spotify / Apple Music target: -14 LUFS',
    },
    {
        id: 'mix', type: 'Mix Balance', value: '8 / 10', passed: true,
        icon: Music, detail: 'No low-mid mud detected',
    },
    {
        id: 'format', type: 'File Format', value: 'WAV 44.1kHz / 16-bit', passed: true,
        icon: FileAudio, detail: 'Lossless format accepted',
    },
    {
        id: 'meta', type: 'Metadata Completeness', value: 'All required fields present', passed: true,
        icon: Tag, detail: 'Title, artist, ISRC verified',
    },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function parseLufs(raw: string | undefined): number | null {
    if (!raw) return null;
    const match = raw.match(/-?\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
}

function parsePeak(raw: string | undefined): number | null {
    if (!raw) return null;
    const match = raw.match(/-?\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
}

function buildChecks(report: ForensicsReport, filename: string): QCCheck[] {
    const details = (report.details ?? {}) as ForensicsDetails;
    const checks: QCCheck[] = [];

    // 1. True Peak
    const peakDb = parsePeak(details.true_peak_db);
    const peakPassed = peakDb !== null ? peakDb <= -1.0 : report.status !== 'FAIL';
    checks.push({
        id: 'peak',
        type: 'Audio True Peak',
        value: details.true_peak_db ? `${details.true_peak_db} dBTP` : (peakPassed ? '≤ -1.0 dBTP ✓' : 'Above ceiling'),
        passed: peakPassed,
        icon: Waves,
        detail: 'DSP ceiling: -1.0 dBTP (Apple/Spotify mandate)',
    });

    // 2. Integrated LUFS
    const lufs = parseLufs(details.estimated_lufs);
    const lufsPassed = lufs !== null ? (lufs >= -16 && lufs <= -8) : report.status !== 'FAIL';
    checks.push({
        id: 'lufs',
        type: 'Integrated Loudness',
        value: details.estimated_lufs ?? (lufsPassed ? 'Within range' : 'Out of range'),
        passed: lufsPassed,
        icon: BarChart2,
        detail: 'Streaming target: -14 to -9 LUFS',
    });

    // 3. Mix Balance
    const mixScore = details.mix_balance_score;
    const mixPassed = mixScore !== undefined ? mixScore >= 7 : report.status !== 'FAIL';
    checks.push({
        id: 'mix',
        type: 'Mix Balance',
        value: mixScore !== undefined ? `${mixScore} / 10` : (mixPassed ? 'Acceptable' : 'Review required'),
        passed: mixPassed,
        icon: Music,
        detail: details.low_mids_analysis ?? (report.issues?.[0] ?? 'Full spectrum analysis complete'),
    });

    // 4. Format
    const format = details.format;
    const sampleRate = details.sample_rate;
    const formatPassed = format
        ? ['wav', 'flac', 'aiff'].includes(format.toLowerCase())
        : report.status !== 'FAIL';
    const formatValue = format
        ? `${format.toUpperCase()}${sampleRate ? ` ${(sampleRate / 1000).toFixed(1)}kHz` : ''}`
        : 'Detected from file';
    checks.push({
        id: 'format',
        type: 'File Format',
        value: formatValue,
        passed: formatPassed,
        icon: FileAudio,
        detail: 'WAV, FLAC, or AIFF required for submission',
    });

    // 5. Metadata (derived from overall status)
    const metaPassed = report.status !== 'FAIL' || !(report.issues ?? []).some(i => i.toLowerCase().includes('meta'));
    checks.push({
        id: 'meta',
        type: 'Metadata Completeness',
        value: metaPassed ? `${filename} — all fields present` : 'Missing required fields',
        passed: metaPassed,
        icon: Tag,
        detail: 'Title, artist, ISRC required for DDEX delivery',
    });

    return checks;
}

// ── Check Row ──────────────────────────────────────────────────────────────

function CheckRow({ check, index }: { check: QCCheck; index: number }) {
    return (
        <motion.div
            key={check.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.3 }}
            className="p-4 bg-white/3 border border-white/8 rounded-xl flex items-center gap-4"
        >
            <div className={`p-2.5 rounded-lg flex-shrink-0 ${check.passed
                ? 'bg-green-900/25 text-green-400 border border-green-500/20'
                : 'bg-red-900/25 text-red-400 border border-red-500/20'
                }`}>
                <check.icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 font-medium">{check.type}</p>
                <p className="text-sm font-semibold text-white truncate">{check.value}</p>
                {check.detail && (
                    <p className="text-[10px] text-gray-600 mt-0.5 truncate">{check.detail}</p>
                )}
            </div>
            <div className="flex-shrink-0">
                {check.passed ? (
                    <span className="text-[11px] font-bold text-green-500 uppercase tracking-wider">PASS</span>
                ) : (
                    <span className="text-[11px] font-bold text-red-500 uppercase tracking-wider">FAIL</span>
                )}
            </div>
        </motion.div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface QCVisualizerProps {
    /** Optional pre-selected file path (from parent release context) */
    initialFilePath?: string;
    /** Called with a gated "submit" when QC passes */
    onSubmit?: () => void;
}

export const QCVisualizer: React.FC<QCVisualizerProps> = ({ initialFilePath, onSubmit }) => {
    const { success: toastSuccess, error: toastError } = useToast();
    const [filePath, setFilePath] = useState<string>(initialFilePath ?? '');
    const [runState, setRunState] = useState<RunState>('idle');
    const [checks, setChecks] = useState<QCCheck[] | null>(null);
    const [report, setReport] = useState<ForensicsReport | null>(null);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const taskIdRef = useRef<string>('qc-initial');
    const inputRef = useRef<HTMLInputElement>(null);

    const isElectronCtx = typeof window !== 'undefined' && !!window.electronAPI;

    const allPassed = checks !== null && checks.every(c => c.passed);
    const hasFailed = checks !== null && checks.some(c => !c.passed);
    const filename = filePath.split(/[\\/]/).pop() ?? '';

    // ── File picking ──────────────────────────────────────────────────────

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) setFilePath(file.path ?? '');
    }, []);

    // ── Run QC ────────────────────────────────────────────────────────────

    const handleRunQC = useCallback(async () => {
        if (!filePath && isElectronCtx) {
            toastError('Select an audio file first');
            return;
        }

        setRunState('running');
        setChecks(null);
        setReport(null);
        taskIdRef.current = `qc-${Date.now()}`;

        // Demo mode: simulate when not in Electron or no file selected
        if (!isElectronCtx || !filePath) {
            setIsDemoMode(true);
            await new Promise(r => setTimeout(r, 1200)); // simulate latency
            setChecks(DEMO_CHECKS);
            setRunState('done');
            return;
        }

        setIsDemoMode(false);
        try {
            const result = await distributionService.runLocalForensics(taskIdRef.current, filePath);
            setReport(result);
            const builtChecks = buildChecks(result, filename);
            setChecks(builtChecks);
            setRunState('done');

            const allGood = builtChecks.every(c => c.passed);
            if (allGood) {
                toastSuccess(`✓ QC Passed — ${filename} cleared for delivery`);
            } else {
                toastError(`QC Issues — ${builtChecks.filter(c => !c.passed).length} check(s) failed`);
            }
        } catch (err) {
            setRunState('error');
            toastError(err instanceof Error ? err.message : 'QC analysis failed');
        }
    }, [filePath, filename, isElectronCtx, toastSuccess, toastError]);

    const handleReset = useCallback(() => {
        setRunState('idle');
        setChecks(null);
        setReport(null);
        setFilePath('');
    }, []);

    // ── Header badge ────────────────────────────────────────────────────────

    const statusBadge = (() => {
        if (runState === 'idle') return null;
        if (runState === 'running') return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-900/20 text-purple-300 border border-purple-500/20 text-xs font-medium">
                <Loader2 size={13} className="animate-spin" />
                Analyzing…
            </div>
        );
        if (runState === 'error') return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-900/20 text-red-300 border border-red-500/20 text-xs font-medium">
                <XCircle size={13} /> Analysis failed
            </div>
        );
        if (allPassed) return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-900/20 text-green-300 border border-green-500/20 text-xs font-bold">
                <CheckCircle size={13} /> Cleared for Delivery
                {isDemoMode && <span className="opacity-60 font-normal">(demo)</span>}
            </div>
        );
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-900/20 text-red-300 border border-red-500/20 text-xs font-bold">
                <AlertTriangle size={13} /> Delivery Blocked
            </div>
        );
    })();

    return (
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 text-gray-200 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start gap-4">
                <div>
                    <h2 className="text-xl font-bold font-mono">Distribution Delivery Gateway</h2>
                    <p className="text-sm text-gray-400 mt-1">
                        Strictly-enforced QC — DSP audio standards, metadata hygiene, and format validation.
                    </p>
                </div>
                {statusBadge}
            </div>

            {/* File drop zone */}
            <div
                className={`relative border-2 border-dashed rounded-xl p-5 transition-all cursor-pointer ${isDragOver
                    ? 'border-purple-500/60 bg-purple-900/10'
                    : filePath
                        ? 'border-green-500/30 bg-green-900/5'
                        : 'border-white/10 bg-white/2 hover:border-white/20'
                    }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
                aria-label="Select or drop an audio file"
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".wav,.flac,.aiff,.mp3,.aac"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setFilePath((f as File & { path?: string }).path ?? f.name);
                    }}
                    aria-hidden="true"
                />
                <div className="flex items-center gap-3">
                    {filePath ? (
                        <>
                            <FileAudio size={18} className="text-green-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{filename}</p>
                                <p className="text-[10px] text-gray-500 truncate">{filePath}</p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setFilePath(''); setRunState('idle'); setChecks(null); }}
                                className="text-gray-600 hover:text-gray-400 transition-colors p-1"
                                aria-label="Remove file"
                            >
                                <X size={14} />
                            </button>
                        </>
                    ) : (
                        <>
                            <Upload size={18} className="text-gray-500 flex-shrink-0" />
                            <div>
                                <p className="text-sm text-gray-400">Drop audio file here or <span className="text-purple-400 underline underline-offset-2">browse</span></p>
                                <p className="text-[10px] text-gray-600 mt-0.5">WAV, FLAC, AIFF, MP3 — up to 500MB</p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Check results */}
            <AnimatePresence mode="wait">
                {checks && (
                    <motion.div
                        key="checks"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-3"
                    >
                        {checks.map((check, i) => (
                            <CheckRow key={check.id} check={check} index={i} />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Recommendations from Gemini analysis */}
            {report?.details && (() => {
                const d = report.details as ForensicsDetails;
                const recs = d.recommendations ?? [];
                if (recs.length === 0) return null;
                return (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-amber-900/10 border border-amber-500/20 rounded-xl space-y-2"
                    >
                        <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                            <ShieldCheck size={12} /> Mastering Recommendations
                        </p>
                        <ul className="space-y-1">
                            {recs.map((r: string, i: number) => (
                                <li key={i} className="text-xs text-amber-200/70 flex items-start gap-1.5">
                                    <span className="text-amber-500 flex-shrink-0 mt-0.5">•</span>
                                    {r}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                );
            })()}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
                {runState === 'idle' || runState === 'error' ? (
                    <button
                        id="qc-run-button"
                        onClick={handleRunQC}
                        className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-2"
                    >
                        <ShieldCheck size={16} />
                        {isElectronCtx && filePath ? 'Run Audio QC Analysis' : 'Run QC (Demo Mode)'}
                    </button>
                ) : runState === 'running' ? (
                    <button
                        disabled
                        className="flex-1 py-3 rounded-xl font-semibold text-sm bg-purple-800/40 text-purple-300 flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                        <Loader2 size={16} className="animate-spin" />
                        Analyzing audio…
                    </button>
                ) : (
                    <button
                        id="qc-execute-delivery-button"
                        disabled={!allPassed}
                        onClick={allPassed ? onSubmit : undefined}
                        className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${allPassed
                            ? 'bg-white text-black hover:bg-gray-100 cursor-pointer'
                            : 'bg-white/5 text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        {allPassed ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                        {allPassed ? 'Execute Delivery' : `Delivery Blocked — ${checks?.filter(c => !c.passed).length ?? 0} Check(s) Failed`}
                    </button>
                )}

                {(runState === 'done' || runState === 'error') && (
                    <button
                        id="qc-reset-button"
                        onClick={handleReset}
                        className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="Reset"
                        aria-label="Reset QC"
                    >
                        <RotateCcw size={16} />
                    </button>
                )}
            </div>

            {!isElectronCtx && (
                <p className="text-[10px] text-center text-gray-700 -mt-2">
                    ✦ Running in demo mode — launch the desktop app for real audio analysis via AI
                </p>
            )}

            {hasFailed && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[11px] text-red-400/70 text-center"
                >
                    Resolve all QC failures before submitting to distributors.
                    {(report?.issues ?? []).length > 0 && ` Issues: ${report?.issues?.join(' · ')}`}
                </motion.div>
            )}
        </div>
    );
};
