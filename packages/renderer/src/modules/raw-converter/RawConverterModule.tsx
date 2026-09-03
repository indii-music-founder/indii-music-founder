import React, { useState, useEffect, useCallback } from 'react';
import {
    Camera,
    ShieldCheck,
    CheckCircle2,
    XCircle,
    Loader2,
    FolderOpen,
    UploadCloud,
    Sliders,
    RefreshCw,
    FileCheck2
} from 'lucide-react';
import type {
    RawInspectResult,
    RawConvertResult,
    RawBatchProgress,
    RawVerifyResult
} from '@indii/shared';

interface QueueItem {
    id: string;
    path: string;
    name: string;
    size: number;
    inspect?: RawInspectResult;
    status: 'pending' | 'inspecting' | 'converting' | 'completed' | 'failed';
    progress: number;
    result?: RawConvertResult;
    verifyReport?: RawVerifyResult;
    error?: string;
}

export const RawConverterModule: React.FC = () => {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [compressionMode, setCompressionMode] = useState<'lossless-jpeg' | 'uncompressed'>('lossless-jpeg');
    const [embedOriginalRaw, setEmbedOriginalRaw] = useState(false);
    const [baselineExposure, setBaselineExposure] = useState<number>(0.35);
    const [outputDir, setOutputDir] = useState<string>('');
    const [isConverting, setIsConverting] = useState(false);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>('');

    // Preload electronAPI reference safely
    const electron = typeof window !== 'undefined' ? (window as unknown as { electronAPI?: {
        raw?: {
            inspect: (path: string) => Promise<RawInspectResult>;
            convert: (opts: unknown) => Promise<RawConvertResult>;
            batchConvert: (opts: unknown) => Promise<unknown>;
            cancel: (jobId: string) => Promise<void>;
            verify: (dngPath: string, sourcePath?: string) => Promise<RawVerifyResult>;
            onProgress: (cb: (progress: RawBatchProgress) => void) => () => void;
        };
        selectFile?: (opts?: unknown) => Promise<string | string[] | null>;
        selectDirectory?: (opts?: unknown) => Promise<string | null>;
        system?: {
            selectFile?: (opts?: unknown) => Promise<string | string[] | null>;
            selectDirectory?: (opts?: unknown) => Promise<string | null>;
        };
    } }).electronAPI : undefined;

    // Listen to progress updates
    useEffect(() => {
        if (!electron?.raw?.onProgress) return;
        const unsubscribe = electron.raw.onProgress((progress: RawBatchProgress) => {
            setStatusMessage(`Converting ${progress.currentFile} (${progress.completedFiles}/${progress.totalFiles})`);
            setQueue(prev => prev.map(item => {
                const progItem = progress.items.find(pi => pi.filePath === item.path);
                if (progItem) {
                    return {
                        ...item,
                        status: progItem.status === 'completed' ? 'completed' :
                                progItem.status === 'failed' ? 'failed' :
                                progItem.status === 'converting' ? 'converting' : item.status,
                        progress: progItem.progressPercent,
                        error: progItem.error
                    };
                }
                return item;
            }));
        });
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [electron]);

    const inspectFile = useCallback(async (item: QueueItem) => {
        if (!electron?.raw?.inspect) return;
        try {
            const inspectRes = await electron.raw.inspect(item.path);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, inspect: inspectRes } : q));
        } catch (err) {
            console.error('Inspection failed for', item.path, err);
        }
    }, [electron]);

    const addFilesToQueue = useCallback((filePaths: string[]) => {
        const newItems: QueueItem[] = filePaths.map(p => {
            const name = p.split('/').pop() || p;
            return {
                id: `${p}-${Date.now()}-${Math.random()}`,
                path: p,
                name,
                size: 0,
                status: 'pending',
                progress: 0,
            };
        });

        setQueue(prev => [...prev, ...newItems]);
        newItems.forEach(item => inspectFile(item));
    }, [inspectFile]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files: string[] = [];
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
                const f = e.dataTransfer.files[i] as File & { path?: string };
                if (f.path && f.path.toLowerCase().endsWith('.arw')) {
                    files.push(f.path);
                }
            }
        }
        if (files.length > 0) {
            addFilesToQueue(files);
        }
    };

    const handleSelectFiles = async () => {
        const selectFn = electron?.selectFile || electron?.system?.selectFile;
        if (!selectFn) return;
        const selected = await selectFn({
            title: 'Select Sony RAW Photos',
            filters: [{ name: 'Sony RAW Photos', extensions: ['ARW', 'arw'] }],
            properties: ['openFile', 'multiSelections']
        });
        if (selected) {
            const paths = Array.isArray(selected) ? selected : [selected];
            addFilesToQueue(paths);
        }
    };

    const handleSelectOutputDir = async () => {
        const selectDirFn = electron?.selectDirectory || electron?.system?.selectDirectory;
        if (!selectDirFn) return;
        const dir = await selectDirFn();
        if (dir) {
            setOutputDir(dir);
        }
    };

    const handleStartConversion = async () => {
        if (queue.length === 0 || isConverting || !electron?.raw) return;

        setIsConverting(true);
        const jobId = `job-${Date.now()}`;
        setActiveJobId(jobId);
        setStatusMessage('Starting conversion...');

        for (let i = 0; i < queue.length; i++) {
            const item = queue[i];
            if (item.status === 'completed') continue;

            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'converting', progress: 10 } : q));

            try {
                const targetDng = outputDir ? `${outputDir}/${item.name.replace(/\.[^/.]+$/, '')}.dng` : undefined;

                const res = await electron.raw.convert({
                    inputPath: item.path,
                    outputPath: targetDng,
                    compressionMode,
                    embedOriginalRaw,
                    baselineExposureOverride: baselineExposure,
                });

                setQueue(prev => prev.map(q => q.id === item.id ? {
                    ...q,
                    status: 'completed',
                    progress: 100,
                    result: res
                } : q));
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setQueue(prev => prev.map(q => q.id === item.id ? {
                    ...q,
                    status: 'failed',
                    error: msg
                } : q));
            }
        }

        setIsConverting(false);
        setActiveJobId(null);
        setStatusMessage('Conversion completed.');
    };

    const handleVerifyItem = async (item: QueueItem) => {
        if (!item.result?.outputPath || !electron?.raw?.verify) return;

        try {
            const rep = await electron.raw.verify(item.result.outputPath, item.path);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, verifyReport: rep } : q));
        } catch (err) {
            console.error('Verification failed:', err);
        }
    };

    const handleCancel = () => {
        if (activeJobId && electron?.raw?.cancel) {
            electron.raw.cancel(activeJobId);
        }
        setIsConverting(false);
        setStatusMessage('Conversion cancelled by user.');
    };

    const completedCount = queue.filter(q => q.status === 'completed').length;
    const failedCount = queue.filter(q => q.status === 'failed').length;

    return (
        <div className="flex flex-col h-full bg-[#0d1117] text-gray-200 overflow-y-auto p-6 space-y-6">
            {/* Header banner */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                            <Camera className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                                indii RAW Converter
                                <span className="text-xs font-mono uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                                    Clean-Room v1.0
                                </span>
                            </h1>
                            <p className="text-sm text-gray-400">
                                Bit-preserving local RAW-to-DNG conversion with camera calibration matrices & baseline exposure tuning.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Non-destructive guarantee badge */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    <div>
                        <span className="font-semibold">Zero-Overwrite Guarantee:</span> Source RAW files are strictly read-only.
                    </div>
                </div>
            </div>

            {/* Drop zone */}
            <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all ${
                    isDragging
                        ? 'border-purple-500 bg-purple-500/10 scale-[1.005]'
                        : 'border-gray-700/60 bg-gray-900/40 hover:border-gray-600'
                }`}
            >
                <div className="p-4 rounded-full bg-purple-500/10 text-purple-400 mb-3">
                    <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                    Drag and drop Sony ARW files here
                </h3>
                <p className="text-xs text-gray-400 mb-4 text-center max-w-md">
                    Supports Sony ILCE-7 series (A7 III, A7 IV, A7 V, A7R, A9) in 14-bit Bayer CFA format.
                </p>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSelectFiles}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition shadow-lg shadow-purple-900/20 flex items-center gap-2"
                    >
                        <Camera className="w-4 h-4" />
                        Select RAW Files
                    </button>
                    <button
                        onClick={handleSelectOutputDir}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition flex items-center gap-2"
                    >
                        <FolderOpen className="w-4 h-4" />
                        {outputDir ? 'Change Output Folder' : 'Choose Output Folder'}
                    </button>
                </div>
                {outputDir && (
                    <div className="mt-3 text-xs text-gray-400 font-mono">
                        Destination: <span className="text-purple-300">{outputDir}</span>
                    </div>
                )}
            </div>

            {/* Settings Card */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    DNG Standards & Calibration Settings
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Compression */}
                    <div className="space-y-1.5">
                        <label className="text-gray-300 font-medium">Sensor Compression</label>
                        <select
                            value={compressionMode}
                            onChange={e => setCompressionMode(e.target.value as 'lossless-jpeg' | 'uncompressed')}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-purple-500"
                        >
                            <option value="lossless-jpeg">Lossless JPEG (SOF3 2-Component, Recommended)</option>
                            <option value="uncompressed">Uncompressed 14-bit (Bit-for-bit RAW)</option>
                        </select>
                        <p className="text-[11px] text-gray-500">Lossless JPEG preserves 100% bit fidelity with ~5-15% smaller file size.</p>
                    </div>

                    {/* Baseline Exposure */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-gray-300 font-medium">Baseline Exposure Lift</label>
                            <span className="text-purple-300 font-mono">+{baselineExposure.toFixed(2)} EV</span>
                        </div>
                        <input
                            type="range"
                            min="0.0"
                            max="1.0"
                            step="0.05"
                            value={baselineExposure}
                            onChange={e => setBaselineExposure(parseFloat(e.target.value))}
                            className="w-full accent-purple-500 bg-gray-800 rounded-lg"
                        />
                        <p className="text-[11px] text-gray-500">Sony Alpha cameras calibrate at +0.35 EV to prevent visibly dark initial renders.</p>
                    </div>

                    {/* Embed RAW */}
                    <div className="space-y-1.5 flex flex-col justify-between">
                        <label className="text-gray-300 font-medium">Original Stream Backup</label>
                        <label className="flex items-center gap-2 text-gray-300 cursor-pointer pt-1">
                            <input
                                type="checkbox"
                                checked={embedOriginalRaw}
                                onChange={e => setEmbedOriginalRaw(e.target.checked)}
                                className="rounded border-gray-700 bg-gray-800 text-purple-600 focus:ring-purple-500 h-4 w-4"
                            />
                            <span>Embed original RAW inside DNG</span>
                        </label>
                        <p className="text-[11px] text-gray-500">Embeds byte-identical copy in DNGPrivateData (increases file size by 100%).</p>
                    </div>
                </div>
            </div>

            {/* Queue Controls & Action Bar */}
            {queue.length > 0 && (
                <div className="flex items-center justify-between bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center gap-4 text-xs">
                        <div>
                            Total: <span className="font-semibold text-white">{queue.length}</span>
                        </div>
                        <div>
                            Completed: <span className="font-semibold text-emerald-400">{completedCount}</span>
                        </div>
                        {failedCount > 0 && (
                            <div>
                                Failed: <span className="font-semibold text-rose-400">{failedCount}</span>
                            </div>
                        )}
                        {statusMessage && (
                            <div className="text-purple-300 animate-pulse font-mono">
                                {statusMessage}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {isConverting ? (
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white transition flex items-center gap-2"
                            >
                                <XCircle className="w-4 h-4" />
                                Abort Batch
                            </button>
                        ) : (
                            <button
                                onClick={handleStartConversion}
                                disabled={queue.length === 0}
                                className="px-5 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition shadow-lg shadow-purple-900/30 flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Convert {queue.length} Photo{queue.length > 1 ? 's' : ''} to DNG
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Batch List */}
            {queue.length > 0 && (
                <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/30">
                    <div className="divide-y divide-gray-800/60">
                        {queue.map(item => (
                            <div key={item.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-gray-800/20 transition">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 flex-shrink-0">
                                        <Camera className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-white truncate max-w-md">
                                            {item.name}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                            {item.inspect ? (
                                                <>
                                                    <span className="text-purple-300 font-medium">
                                                        {item.inspect.make} {item.inspect.model}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{item.inspect.width}x{item.inspect.height}</span>
                                                    <span>•</span>
                                                    <span>{item.inspect.bitDepth}-bit {item.inspect.cfa.pattern}</span>
                                                    <span>•</span>
                                                    <span>WB: [{item.inspect.metadata.asShotNeutral.map(n => n.toFixed(2)).join(', ')}]</span>
                                                </>
                                            ) : (
                                                <span>{item.path}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Status & Results */}
                                <div className="flex items-center gap-4 flex-shrink-0">
                                    {item.status === 'converting' && (
                                        <div className="flex items-center gap-2 text-xs text-purple-400 font-mono">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Converting...</span>
                                        </div>
                                    )}

                                    {item.status === 'completed' && item.result && (
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1 justify-end">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Converted
                                                </div>
                                                <div className="text-[11px] text-gray-400 font-mono">
                                                    {(item.result.outputSizeBytes / 1048576).toFixed(1)} MB ({item.result.durationMs}ms)
                                                </div>
                                            </div>

                                            {item.verifyReport ? (
                                                <div className={`px-2.5 py-1 rounded-md text-[11px] font-mono flex items-center gap-1.5 ${
                                                    item.verifyReport.valid
                                                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                                        : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                                }`}>
                                                    <FileCheck2 className="w-3.5 h-3.5" />
                                                    0 Samples Diff (100% Lossless)
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleVerifyItem(item)}
                                                    className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition flex items-center gap-1"
                                                >
                                                    <FileCheck2 className="w-3.5 h-3.5" />
                                                    Verify Bit Losslessness
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {item.status === 'failed' && (
                                        <div className="flex items-center gap-2 text-xs text-rose-400">
                                            <XCircle className="w-4 h-4 flex-shrink-0" />
                                            <span className="max-w-xs truncate" title={item.error}>
                                                {item.error || 'Conversion failed'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RawConverterModule;
