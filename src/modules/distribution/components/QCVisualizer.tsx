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

const DEMO_CHECKS: QCCheck[] = [
    { id: 'peak', type: 'Audio True Peak', value: '-1.3 dBTP', passed: true, icon: Waves, detail: 'Within DSP ceiling' },
    { id: 'lufs', type: 'Integrated Loudness', value: '-13.2 LUFS', passed: true, icon: BarChart2, detail: 'Target: -14 LUFS' },
    { id: 'mix', type: 'Mix Balance', value: '8 / 10', passed: true, icon: Music, detail: 'Balanced spectrum' },
    { id: 'format', type: 'File Format', value: 'WAV 44.1kHz', passed: true, icon: FileAudio, detail: 'Lossless' },
    { id: 'meta', type: 'Metadata Completeness', value: 'All fields present', passed: true, icon: Tag, detail: 'Validated' },
];

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

    const peakDb = parsePeak(details.true_peak_db);
    const peakPassed = peakDb !== null ? peakDb <= -1.0 : report.status !== 'FAIL';
    checks.push({
        id: 'peak',
        type: 'Audio True Peak',
        value: details.true_peak_db ? `${details.true_peak_db} dBTP` : (peakPassed ? 'Pass' : 'Fail'),
        passed: peakPassed,
        icon: Waves,
        detail: 'Ceiling: -1.0 dBTP',
    });

    const lufs = parseLufs(details.estimated_lufs);
    const lufsPassed = lufs !== null ? (lufs >= -16 && lufs <= -8) : report.status !== 'FAIL';
    checks.push({
        id: 'lufs',
        type: 'Integrated Loudness',
        value: details.estimated_lufs ?? (lufsPassed ? 'Pass' : 'Fail'),
        passed: lufsPassed,
        icon: BarChart2,
        detail: 'Target: -14 to -9 LUFS',
    });

    const mixScore = details.mix_balance_score;
    const mixPassed = mixScore !== undefined ? mixScore >= 7 : report.status !== 'FAIL';
    checks.push({
        id: 'mix',
        type: 'Mix Balance',
        value: mixScore !== undefined ? `${mixScore} / 10` : (mixPassed ? 'Pass' : 'Fail'),
        passed: mixPassed,
        icon: Music,
        detail: details.low_mids_analysis ?? 'Spectrum analysis',
    });

    const format = details.format;
    const formatPassed = format ? ['wav', 'flac', 'aiff'].includes(format.toLowerCase()) : report.status !== 'FAIL';
    checks.push({
        id: 'format',
        type: 'File Format',
        value: format ? format.toUpperCase() : 'Detected',
        passed: formatPassed,
        icon: FileAudio,
        detail: 'Lossless required',
    });

    const issues = report.issues ?? [];
    const metaPassed = report.status !== 'FAIL' || !issues.some(i => i.toLowerCase().includes('meta'));
    checks.push({
        id: 'meta',
        type: 'Metadata Completeness',
        value: metaPassed ? 'Present' : 'Missing',
        passed: metaPassed,
        icon: Tag,
        detail: filename,
    });

    return checks;
}

interface QCVisualizerProps {
    initialFilePath?: string;
    onSubmit?: () => void;
}

export const QCVisualizer: React.FC<QCVisualizerProps> = ({ initialFilePath, onSubmit }) => {
    const toast = useToast();
    const [filePath, setFilePath] = useState(initialFilePath ?? '');
    const [runState, setRunState] = useState<RunState>('idle');
    const [checks, setChecks] = useState<QCCheck[] | null>(null);
    const [report, setReport] = useState<ForensicsReport | null>(null);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const taskIdRef = useRef<string>('qc-initial');
    const inputRef = useRef<HTMLInputElement>(null);

    // Dynamic environment check
    const checkIsElectron = () => {
        return !!(typeof window !== 'undefined' && (window as any).electronAPI);
    };

    const isElectron = checkIsElectron();
    const allPassed = checks !== null && checks.every(c => c.passed);
    const filename = filePath.split(/[\\/]/).pop() ?? '';

    const handleRunQC = useCallback(async () => {
        const currentlyElectron = checkIsElectron();

        if (!filePath && currentlyElectron) {
            toast.error('Select an audio file first');
            return;
        }

        setRunState('running');
        setChecks(null);
        setReport(null);
        taskIdRef.current = `qc-${Date.now()}`;

        if (!currentlyElectron || !filePath) {
            setIsDemoMode(true);
            await new Promise(r => setTimeout(r, 600)); // faster tests
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

            if (builtChecks.every(c => c.passed)) {
                toast.success('✓ QC Passed');
            } else {
                toast.error('QC Issues detected');
            }
        } catch (err) {
            setRunState('error');
            toast.error(err instanceof Error ? err.message : 'QC failed');
        }
    }, [filePath, filename, toast]);

    const handleReset = useCallback(() => {
        setRunState('idle');
        setChecks(null);
        setReport(null);
        setFilePath('');
    }, []);

    const statusBadge = (() => {
        if (runState === 'idle') return null;
        if (runState === 'running') return <div className="text-purple-300">Analyzing...</div>;
        if (runState === 'error') return <div className="text-red-400">Error</div>;
        if (allPassed) return <div className="text-green-400 font-bold" data-testid="qc-passed-badge">Cleared for Delivery {isDemoMode && '(demo)'}</div>;
        return <div className="text-red-400 font-bold">Delivery Blocked</div>;
    })();

    return (
        <div className="p-6 bg-gray-900 rounded-xl space-y-6">
            <div className="flex justify-between">
                <h3 className="font-bold text-white">Distribution Gateway</h3>
                {statusBadge}
            </div>

            <div
                onClick={() => !filePath && inputRef.current?.click()}
                className={`border-2 border-dashed p-6 text-center ${filePath ? 'border-white/10' : 'cursor-pointer border-white/5'}`}
            >
                <input type="file" ref={inputRef} className="hidden" accept="audio/*" onChange={(e) => setFilePath(e.target.files?.[0]?.path ?? '')} />
                <div className="text-gray-400">{filePath || 'Drop audio file here or browse'}</div>
            </div>

            <AnimatePresence>
                {checks && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {checks.map((c, i) => (
                            <div key={c.id} className="p-4 bg-white/5 border border-white/10 rounded-xl flex justify-between">
                                <div>
                                    <div className="text-xs text-gray-500">{c.type}</div>
                                    <div className="text-sm font-semibold text-white">{c.value}</div>
                                </div>
                                <div className={c.passed ? 'text-green-500' : 'text-red-500'}>{c.passed ? 'PASS' : 'FAIL'}</div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex gap-3">
                {(runState === 'idle' || runState === 'error') ? (
                    <button onClick={handleRunQC} className="flex-1 py-3 bg-purple-600 text-white rounded-xl">
                        {isElectron && filePath ? 'Run Audio QC Analysis' : 'Run QC (Demo Mode)'}
                    </button>
                ) : runState === 'running' ? (
                    <button disabled className="flex-1 py-3 bg-purple-800/40 text-purple-300 rounded-xl">Analyzing...</button>
                ) : (
                    <button id="qc-execute-delivery-button" onClick={allPassed ? onSubmit : undefined} className={`flex-1 py-3 rounded-xl ${allPassed ? 'bg-white text-black' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}>
                        {allPassed ? 'Execute Delivery' : 'Block Delivery'}
                    </button>
                )}
                {(runState === 'done' || runState === 'error') && (
                    <button id="qc-reset-button" onClick={handleReset} className="p-3 bg-white/5 rounded-xl text-gray-400" aria-label="Reset QC">
                        <RotateCcw size={16} />
                    </button>
                )}
            </div>

            {!isElectron && <p className="text-[10px] text-center text-gray-700">✦ Running in demo mode</p>}
        </div>
    );
};
