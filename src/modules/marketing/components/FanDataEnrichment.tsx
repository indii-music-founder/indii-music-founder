import React, { useState, useRef } from 'react';
import {
    Upload, Users, Database, Download, Loader2,
    CheckCircle, BarChart2, AlertCircle, X, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FanEnrichment } from '@/services/marketing/FanEnrichmentService';
import { FanRecord, EnrichedFanData, EnrichmentProvider, EnrichmentProgress } from '../types';
import { logger } from '@/utils/logger';

export default function FanDataEnrichment() {
    const [provider, setProvider] = useState<EnrichmentProvider>('Clearbit');
    const [file, setFile] = useState<File | null>(null);
    const [parsedFans, setParsedFans] = useState<FanRecord[]>([]);
    const [enrichedFans, setEnrichedFans] = useState<EnrichedFanData[]>([]);
    const [status, setStatus] = useState<EnrichmentProgress['status']>('idle');
    const [progress, setProgress] = useState(0);
    const [currentEmail, setCurrentEmail] = useState<string | undefined>();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        try {
            setFile(selectedFile);
            setStatus('loading');
            const fans = await FanEnrichment.parseCSV(selectedFile);
            setParsedFans(fans);
            setStatus('idle');
            setErrorMessage(null);
        } catch (err: any) {
            logger.error("[FanEnrichment] Parse error:", err);
            setErrorMessage(err.message || "Failed to parse CSV");
            setStatus('error');
            setFile(null);
            setParsedFans([]);
        }
    };

    const handleEnrich = async () => {
        if (parsedFans.length === 0) return;

        setStatus('processing');
        setProgress(0);
        setErrorMessage(null);

        try {
            const results = await FanEnrichment.enrichFans(
                parsedFans,
                provider,
                (p) => {
                    setProgress(Math.round((p.processed / p.total) * 100));
                    setCurrentEmail(p.currentEmail);
                }
            );
            setEnrichedFans(results);
            setStatus('completed');
        } catch (err: any) {
            logger.error("[FanEnrichment] Enrichment error:", err);
            setErrorMessage(err.message || "Enrichment failed");
            setStatus('error');
        }
    };

    const handleExport = () => {
        if (enrichedFans.length === 0) return;

        const headers = ['email', 'firstName', 'lastName', 'location', 'ageRange', 'incomeBracket', 'topGenre'];
        const csvContent = [
            headers.join(','),
            ...enrichedFans.map(f => [
                f.email,
                f.firstName || '',
                f.lastName || '',
                f.location || '',
                f.ageRange || '',
                f.incomeBracket || '',
                f.topGenre || ''
            ].map(v => `"${v}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `enriched_fans_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const reset = () => {
        setFile(null);
        setParsedFans([]);
        setEnrichedFans([]);
        setStatus('idle');
        setProgress(0);
        setErrorMessage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const isProcessing = status === 'processing';
    const isCompleted = status === 'completed';

    return (
        <div className="h-full flex flex-col p-6 lg:p-10 relative overflow-y-auto custom-scrollbar">
            {/* Background blur */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-dept-marketing/5 blur-3xl rounded-full pointer-events-none" />

            <div className="max-w-4xl w-full mx-auto z-10 space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-dept-marketing/20 flex items-center justify-center">
                                <Database className="text-dept-marketing" size={20} />
                            </div>
                            Fan Data Enrichment
                        </h2>
                        <p className="text-sm text-gray-500 mt-1 font-medium italic">
                            HYPER-TARGETING VIA DEMOGRAPHIC INTELLIGENCE
                        </p>
                    </div>

                    {(file || isCompleted) && !isProcessing && (
                        <button
                            onClick={reset}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-all uppercase font-bold tracking-widest"
                        >
                            <Trash2 size={14} /> Clear
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Configuration */}
                    <div className="lg:col-span-5 space-y-6">
                        {/* Upload Section */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">
                                1. Source Data
                            </label>
                            <label className={`flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer bg-black/20 group h-48 relative overflow-hidden ${file ? 'border-dept-marketing/50' : 'border-white/10 hover:border-dept-marketing/30'
                                }`}>
                                <div className="absolute inset-0 bg-gradient-to-br from-dept-marketing/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                <AnimatePresence mode="wait">
                                    {file ? (
                                        <motion.div
                                            key="file-active"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="flex flex-col items-center gap-2 z-10"
                                        >
                                            <div className="w-12 h-12 rounded-full bg-dept-marketing/20 flex items-center justify-center text-dept-marketing">
                                                <CheckCircle size={24} />
                                            </div>
                                            <span className="text-sm font-bold text-white text-center truncate max-w-[200px]">
                                                {file.name}
                                            </span>
                                            <span className="text-xs text-dept-marketing font-semibold">
                                                {parsedFans.length} contacts found
                                            </span>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="file-empty"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex flex-col items-center gap-3 z-10"
                                        >
                                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-500 group-hover:scale-110 transition-transform">
                                                <Upload size={24} />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs font-bold text-gray-300">Drop Fan CSV</p>
                                                <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-tight font-medium">Click to browse local files</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="sr-only"
                                    onChange={handleFileUpload}
                                    disabled={isProcessing}
                                />
                            </label>
                        </div>

                        {/* Provider Selection */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">
                                2. Intelligence Provider
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {(['Clearbit', 'Apollo'] as const).map(p => (
                                    <button
                                        key={p}
                                        disabled={isProcessing}
                                        onClick={() => setProvider(p)}
                                        className={`relative p-4 rounded-xl border transition-all text-left group overflow-hidden ${provider === p
                                            ? 'bg-dept-marketing/10 border-dept-marketing text-white shadow-lg shadow-dept-marketing/10'
                                            : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-black uppercase tracking-tighter">{p}</span>
                                            {provider === p && <CheckCircle size={14} className="text-dept-marketing" />}
                                        </div>
                                        <p className="text-[9px] opacity-60 font-medium">
                                            {p === 'Clearbit' ? 'Best for B2C & interests' : 'Best for reach & demographic depth'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <button
                            onClick={handleEnrich}
                            disabled={!file || parsedFans.length === 0 || isProcessing || isCompleted}
                            className="w-full relative group overflow-hidden py-4 rounded-2xl bg-dept-marketing text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-dept-marketing/20 disabled:opacity-30 disabled:grayscale transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            <div className="flex items-center justify-center gap-2 relative z-10">
                                {isProcessing ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Enriching Intelligence...
                                    </>
                                ) : isCompleted ? (
                                    <>
                                        <CheckCircle size={16} />
                                        Enrichment Complete
                                    </>
                                ) : (
                                    <>
                                        <BarChart2 size={16} />
                                        Run High-Fidelity Enrichment
                                    </>
                                )}
                            </div>
                        </button>

                        {/* Error Message */}
                        <AnimatePresence>
                            {errorMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-3"
                                >
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold uppercase tracking-tight mb-1">Error Occurred</p>
                                        <p className="opacity-80 font-medium">{errorMessage}</p>
                                    </div>
                                    <button onClick={() => setErrorMessage(null)} className="ml-auto hover:text-white">
                                        <X size={14} />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right Column: Results & Progress */}
                    <div className="lg:col-span-7 flex flex-col min-h-[400px]">
                        <AnimatePresence mode="wait">
                            {isProcessing ? (
                                <motion.div
                                    key="processing"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex-1 flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-3xl p-10 mt-6 lg:mt-0"
                                >
                                    <div className="relative mb-8">
                                        <svg className="w-32 h-32 transform -rotate-90">
                                            <circle
                                                cx="64"
                                                cy="64"
                                                r="58"
                                                stroke="currentColor"
                                                strokeWidth="3"
                                                fill="transparent"
                                                className="text-white/5"
                                            />
                                            <motion.circle
                                                cx="64"
                                                cy="64"
                                                r="58"
                                                stroke="currentColor"
                                                strokeWidth="3"
                                                fill="transparent"
                                                strokeDasharray="364.4"
                                                animate={{ strokeDashoffset: 364.4 - (364.4 * progress) / 100 }}
                                                className="text-dept-marketing"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-2xl font-black text-white">{progress}%</span>
                                        </div>
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-lg font-bold text-white">Aggregating Persona Hooks</p>
                                        <p className="text-xs text-gray-500 font-mono italic">
                                            Processing: {currentEmail || 'Initializing...'}
                                        </p>
                                    </div>
                                </motion.div>
                            ) : enrichedFans.length > 0 ? (
                                <motion.div
                                    key="results"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex-1 flex flex-col gap-4 mt-6 lg:mt-0"
                                >
                                    <div className="flex items-center justify-between px-1">
                                        <p className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                                            <CheckCircle size={16} className="text-green-400" />
                                            {enrichedFans.length} Profiles Enriched
                                        </p>
                                        <button
                                            onClick={handleExport}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-400 hover:bg-green-500/20 transition-all uppercase tracking-widest"
                                        >
                                            <Download size={14} /> Export CSV
                                        </button>
                                    </div>

                                    {/* Table */}
                                    <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
                                        <div className="overflow-auto max-h-[500px] custom-scrollbar">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-white/5 bg-white/5 sticky top-0 z-20">
                                                        {['Identity', 'Location', 'Psychographic', 'Intelligence'].map(h => (
                                                            <th key={h} className="px-5 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                                                {h}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {enrichedFans.map((fan, i) => (
                                                        <tr key={i} className="hover:bg-white/[0.03] transition-colors group">
                                                            <td className="px-5 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-bold text-white truncate max-w-[150px]">
                                                                        {fan.firstName ? `${fan.firstName} ${fan.lastName || ''}` : 'Anonymous'}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-500 font-mono truncate max-w-[150px]">
                                                                        {fan.email}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <span className="text-[10px] text-gray-400 font-medium">
                                                                    {fan.location || 'Unknown'}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-[10px] text-gray-300 font-bold uppercase tracking-tighter">
                                                                        {fan.ageRange || 'N/A'}
                                                                    </span>
                                                                    <span className="text-[9px] text-gray-500 uppercase font-medium">
                                                                        {fan.incomeBracket || 'N/A'}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {fan.topGenre && (
                                                                        <span className="px-2 py-0.5 rounded-full bg-dept-marketing/20 text-dept-marketing text-[9px] font-black uppercase tracking-tight">
                                                                            {fan.topGenre}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex-1 flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 border-dashed rounded-3xl p-10 mt-6 lg:mt-0"
                                >
                                    <Users size={48} className="text-gray-700 mb-4" />
                                    <div className="text-center space-y-1">
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Enrichment Pipeline Offline</p>
                                        <p className="text-xs text-gray-600 font-medium">Upload a fan source to begin demographic mapping.</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
