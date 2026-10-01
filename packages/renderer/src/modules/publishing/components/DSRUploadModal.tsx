import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { X, Upload, FileText, AlertCircle, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';
import FileUpload from '@/components/kokonutui/file-upload';
import { MAX_ROYALTY_REPORT_BYTES } from '@/services/distribution/proprietary-ingestion/EarningsUploadService';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';

interface DSRUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (file: File) => Promise<void>;
}

export const DSRUploadModal: React.FC<DSRUploadModalProps> = ({ isOpen, onClose, onProcess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();

    const handleFileChange = async (files: File[]) => {
        if (files.length === 0) return;
        const selectedFile = files[0]!;
        if (selectedFile.size <= 0 || selectedFile.size > MAX_ROYALTY_REPORT_BYTES) {
            setFile(null);
            setError('Choose a report file between 1 byte and 6 MB.');
            return;
        }
        setFile(selectedFile);
        setError(null);
    };

    const handleProcess = async () => {
        if (!file) return;

        setIsParsing(true);
        setError(null);
        try {
            // onProcess must reject on failure (ISSUE-966) — this is the single
            // terminal-messaging boundary: close + parent's own success toast only
            // fire if that promise actually resolves. On failure, the parsed
            // preview and file stay intact for retry, and the error is shown here.
            await onProcess(file);
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to process report data.';
            logger.error('Error importing royalty report:', err);
            setError(message);
            toast.error(message);
        } finally {
            setIsParsing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-2xl bg-[#121212] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-800">
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Upload Sales Report</h2>
                            <p className="text-sm text-gray-500 mt-1">Process DSR, TSV, or CSV reports from DSPs.</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {!file ? (
                            <div className="space-y-4">
                                <FileUpload
                                    onFilesSelected={handleFileChange}
                                    acceptedFileTypes={['.tsv', '.csv']}
                                    maxFileSize={MAX_ROYALTY_REPORT_BYTES}
                                />

                                <p className="text-xs text-gray-500">DistroKid TSV and TuneCore CSV reports up to 6 MB are parsed securely when you import.</p>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3"
                                    >
                                        <AlertCircle className="text-red-500 shrink-0" size={20} />
                                        <p className="text-sm text-red-200/80 leading-relaxed">{error}</p>
                                    </motion.div>
                                )}
                            </div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-6"
                            >
                                {/* File Info */}
                                <div className="flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-800 rounded-2xl">
                                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                                        <FileText className="text-blue-400" size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-white">{file?.name}</h4>
                                        <p className="text-xs text-gray-500">{(file?.size || 0) / 1024 / 1024 < 1 ? `${Math.round((file?.size || 0) / 1024)} KB` : `${((file?.size || 0) / 1024 / 1024).toFixed(2)} MB`}</p>
                                    </div>
                                    <CheckCircle2 className="text-green-500" size={20} />
                                </div>

                                <div className="p-4 bg-gray-900/30 border border-gray-800 rounded-xl">
                                    <p className="font-bold text-white">Ready to import</p>
                                    <p className="mt-1 text-xs text-gray-500">The server will validate the report rows, totals, and reporting period before saving anything.</p>
                                </div>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3"
                                    >
                                        <AlertCircle className="text-red-500 shrink-0" size={20} />
                                        <p className="text-sm text-red-200/80 leading-relaxed">{error}</p>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-800 bg-gray-900/20 flex items-center justify-between">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 text-sm font-bold text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>

                        {file && (
                            <button
                                onClick={handleProcess}
                                disabled={isParsing}
                                className="group flex items-center gap-2 px-8 py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isParsing ? 'Processing...' : 'Integrate Data'}
                                <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
