import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, Play, Pause, XCircle, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useStore } from '@/core/store';
import {
    WhiteGloveIngestionService,
    WHITE_GLOVE_MAX_BYTES,
    detectWhiteGloveAssetType,
    type WhiteGloveImportResult,
} from '@/services/ingestion/WhiteGloveIngestionService';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';

const formatBytes = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

function describeResult(result: WhiteGloveImportResult): string {
    if (result.status === 'processing') return 'Analyzing…';
    if (result.status === 'error') return 'We could not analyze this file. It is stored; try uploading it again.';
    const m = result.metadata;
    if (m?.files) return `${m.files.length} file${m.files.length === 1 ? '' : 's'} in archive`;
    const details = [
        typeof m?.bpm === 'number' ? `${Math.round(m.bpm)} BPM` : null,
        m?.key ?? null,
        m?.genre ?? null,
        m?.mood ?? null,
    ].filter(Boolean);
    return details.length > 0 ? details.join(' · ') : 'Stored';
}

export const WhiteGloveIngestionHub: React.FC = () => {
    const user = useStore(state => state.user);
    const uploadQueue = useStore(state => state.uploadQueue);
    const toast = useToast();
    const [isDragging, setIsDragging] = useState(false);
    const [uploadIds, setUploadIds] = useState<string[]>([]);
    const [results, setResults] = useState<WhiteGloveImportResult[] | null>(null);
    const [resultsError, setResultsError] = useState<string | null>(null);
    const uid = user?.uid ?? null;

    useEffect(() => {
        if (!uid) return;
        return WhiteGloveIngestionService.subscribeToResults(
            uid,
            (next) => { setResults(next); setResultsError(null); },
            (error) => {
                logger.error('[WhiteGloveIngestionHub] Failed to load import results', error);
                setResultsError('Could not load your import results. Refresh to try again.');
            },
        );
    }, [uid]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (!uid) return;
        acceptedFiles.forEach(file => {
            if (file.size >= WHITE_GLOVE_MAX_BYTES) {
                toast.error(`${file.name} is larger than 500 MB.`);
                return;
            }
            WhiteGloveIngestionService.enqueueAsset(file, detectWhiteGloveAssetType(file), uid)
                .then((id) => setUploadIds((ids) => [...ids, id]))
                .catch((error: unknown) => {
                    logger.error('[WhiteGloveIngestionHub] Failed to start upload', error);
                    toast.error(`Could not upload ${file.name}.`);
                });
        });
    }, [uid, toast]);

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        onDragEnter: () => setIsDragging(true),
        onDragLeave: () => setIsDragging(false),
        onDropAccepted: () => setIsDragging(false),
        onDropRejected: () => setIsDragging(false)
    });

    // Only this hub's uploads that are still moving; finished ones appear in Import results.
    const activeUploads = uploadQueue.filter(item => uploadIds.includes(item.id) && item.status !== 'post-processing' && item.status !== 'success');

    return (
        <div className="flex flex-col h-full w-full max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Guided Import</h1>
                <p className="text-gray-400">
                    Bring in your existing catalog. Tracks are analyzed for BPM, key, genre, and mood; ZIP archives are indexed.
                </p>
            </div>

            <Card
                {...getRootProps()}
                className={`border-2 border-dashed bg-black/40 backdrop-blur-md transition-all duration-300 ease-in-out cursor-pointer group ${
                    isDragging ? 'border-green-500 bg-green-500/10' : 'border-gray-800 hover:border-green-500/50 hover:bg-gray-900/50'
                }`}
            >
                <input {...getInputProps()} aria-label="Choose files to import" />
                <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-6">
                    <div className={`p-4 rounded-full transition-colors duration-300 ${isDragging ? 'bg-green-500/20 text-green-400' : 'bg-gray-900 text-gray-500 group-hover:bg-green-500/10 group-hover:text-green-400'}`}>
                        <UploadCloud size={40} strokeWidth={1.5} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-white">Drag & drop files here, or click to choose</h3>
                        <p className="text-sm text-gray-400 max-w-sm mx-auto">
                            Audio, video, images, documents, and ZIP archives, up to 500 MB each.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {activeUploads.length > 0 && (
                <section className="space-y-4" aria-label="Uploads in progress">
                    <h2 className="text-base font-semibold text-white">Uploading ({activeUploads.length})</h2>
                    <div className="grid gap-4">
                        {activeUploads.map(item => (
                            <Card key={item.id} className="bg-gray-900/50 border-gray-800 overflow-hidden">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="p-3 bg-black rounded-lg text-green-400">
                                        <File size={24} />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="font-medium text-white truncate max-w-[300px]" title={item.fileName}>
                                                {item.fileName}
                                            </p>
                                            <span className="text-xs font-mono text-gray-400">{formatBytes(item.fileSize)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Progress
                                                value={item.progress}
                                                className="h-1.5 flex-1"
                                                indicatorClassName={item.status === 'error' ? 'bg-red-500' : 'bg-green-500'}
                                            />
                                            <span className="text-xs font-medium w-16 text-right text-gray-400">{Math.round(item.progress)}%</span>
                                        </div>
                                        <span className={`text-xs capitalize ${item.status === 'error' ? 'text-red-400' : 'text-gray-500'}`}>
                                            {item.status === 'error' ? 'Upload failed' : item.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {item.status === 'uploading' && (
                                            <Button variant="ghost" size="icon" aria-label={`Pause ${item.fileName}`} onClick={(e) => { e.stopPropagation(); WhiteGloveIngestionService.pauseUpload(item.id); }} className="text-gray-400 hover:text-white">
                                                <Pause size={18} />
                                            </Button>
                                        )}
                                        {item.status === 'paused' && (
                                            <Button variant="ghost" size="icon" aria-label={`Resume ${item.fileName}`} onClick={(e) => { e.stopPropagation(); WhiteGloveIngestionService.resumeUpload(item.id); }} className="text-gray-400 hover:text-white">
                                                <Play size={18} />
                                            </Button>
                                        )}
                                        {(item.status === 'uploading' || item.status === 'paused') && (
                                            <Button variant="ghost" size="icon" aria-label={`Cancel ${item.fileName}`} onClick={(e) => { e.stopPropagation(); WhiteGloveIngestionService.cancelUpload(item.id); }} className="text-gray-400 hover:text-red-400">
                                                <XCircle size={18} />
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            )}

            <section className="space-y-3" aria-label="Import results">
                <h2 className="text-base font-semibold text-white">Import results</h2>
                {resultsError ? (
                    <p className="text-sm text-red-400">{resultsError}</p>
                ) : results === null ? (
                    <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>
                ) : results.length === 0 ? (
                    <p className="text-sm text-gray-500">Nothing imported yet. Files you drop above will appear here once they finish uploading.</p>
                ) : (
                    <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900/40">
                        {results.map(result => (
                            <li key={result.id} className="flex items-center gap-3 px-4 py-3">
                                {result.status === 'processed' ? (
                                    <CheckCircle2 size={18} className="text-green-400 shrink-0" aria-label="Analyzed" />
                                ) : result.status === 'error' ? (
                                    <AlertTriangle size={18} className="text-amber-400 shrink-0" aria-label="Analysis failed" />
                                ) : (
                                    <Loader2 size={18} className="text-blue-400 animate-spin shrink-0" aria-label="Analyzing" />
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-white truncate" title={result.fileName}>{result.fileName}</p>
                                    <p className="text-xs text-gray-400 truncate">{describeResult(result)}</p>
                                </div>
                                {result.size ? <span className="text-xs font-mono text-gray-500">{formatBytes(result.size)}</span> : null}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
};

export default WhiteGloveIngestionHub;
