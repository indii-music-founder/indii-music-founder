import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, CheckCircle, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { logger } from '@/utils/logger';

interface UpdateProgress {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
}

export const UpdaterMonitor: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle');
    const [progress, setProgress] = useState<UpdateProgress | null>(null);
    const [version, setVersion] = useState<string>('');
    const [isVisible, setIsVisible] = useState(false);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const api = window.electronAPI;
        if (!api?.updater?.onChecking) return;

        const unsubs = [
            api.updater.onChecking(() => {
                logger.info('[Updater] Checking for updates...');
                setStatus('checking');
                setIsVisible(true);
            }),
            api.updater.onAvailable((info: { version: string }) => {
                logger.info(`[Updater] Update available: ${info.version}`);
                setVersion(info.version);
                setStatus('available');
                setIsVisible(true);
            }),
            api.updater.onNotAvailable(() => {
                logger.info('[Updater] No update available');
                setTimeout(() => setIsVisible(false), 3000);
            }),
            api.updater.onProgress((data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => {
                setStatus('downloading');
                setProgress(data as UpdateProgress);
                setIsVisible(true);
            }),
            api.updater.onDownloaded((info: { version: string }) => {
                logger.info(`[Updater] Update downloaded: ${info.version}`);
                setStatus('downloaded');
                setIsVisible(true);
            }),
            api.updater.onError((err: { message: string }) => {
                logger.error('[Updater] Error:', err.message);
                setError(err.message);
                setStatus('error');
                setIsVisible(true);
            })
        ];

        return () => unsubs.forEach(unsub => unsub());
    }, []);

    const handleInstall = () => {
        window.electronAPI?.updater?.install();
    };

    const close = () => setIsVisible(false);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className="fixed bottom-6 right-6 z-[9999] w-80 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
                >
                    <div className="p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`p-2 rounded-lg ${status === 'error' ? 'bg-red-500/20 text-red-400' :
                                    status === 'downloaded' ? 'bg-emerald-500/20 text-emerald-400' :
                                        'bg-purple-500/20 text-purple-400'
                                    }`}>
                                    {status === 'checking' && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    {status === 'available' && <Download className="w-4 h-4 animate-bounce" />}
                                    {status === 'downloading' && <Download className="w-4 h-4 animate-pulse" />}
                                    {status === 'downloaded' && <CheckCircle className="w-4 h-4" />}
                                    {status === 'error' && <AlertTriangle className="w-4 h-4" />}
                                </div>
                                <span className="text-sm font-bold text-white tracking-tight">
                                    {status === 'checking' && 'Checking Updates...'}
                                    {status === 'available' && 'Update Ready'}
                                    {status === 'downloading' && 'Downloading...'}
                                    {status === 'downloaded' && 'Update Ready'}
                                    {status === 'error' && 'Update Failed'}
                                </span>
                            </div>
                            <button onClick={close} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>

                        {status === 'downloading' && progress && (
                            <div className="space-y-2">
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress.percent}%` }}
                                        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                                    <span>{progress.percent.toFixed(1)}%</span>
                                    <span>{(progress.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s</span>
                                </div>
                            </div>
                        )}

                        {status === 'downloaded' && (
                            <div className="space-y-3">
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Version <span className="text-purple-400 font-mono">{version}</span> has been downloaded and is ready to install.
                                </p>
                                <button
                                    onClick={handleInstall}
                                    className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-purple-900/20 active:scale-[0.98]"
                                >
                                    Restart and Install
                                </button>
                            </div>
                        )}

                        {status === 'error' && (
                            <p className="text-xs text-red-400/80 font-medium bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                                {error || 'An unexpected error occurred during update.'}
                            </p>
                        )}

                        {status === 'available' && !progress && (
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Preparing to download update <span className="text-purple-400 font-mono">{version}</span>...
                            </p>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
