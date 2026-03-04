import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, FileText, AlertCircle, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';
import FileUpload from '@/components/kokonutui/file-upload';
import { dsrService } from '@/services/ddex/DSRService';
import { type DSRReport } from '@/services/ddex/types/dsr';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';

interface DSRUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (report: DSRReport) => Promise<void>;
}

export const DSRUploadModal: React.FC<DSRUploadModalProps> = ({ isOpen, onClose, onProcess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parsedReport, setParsedReport] = useState<DSRReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();

    const handleFileChange = async (files: File[]) => {
        if (files.length === 0) return;
        const selectedFile = files[0];
        setFile(selectedFile);
        setError(null);
        setParsedReport(null);

        setIsParsing(true);
        try {
            // Read file as text
            const text = await selectedFile.text();

            // Basic parsing logic simulation matching dsrService capabilities
            const result = await dsrService.ingestFlatFile(text);

            if (result.success && result.data) {
                setParsedReport(result.data);
                toast.success('Report parsed successfully');
            } else {
                setError(result.error || 'Failed to parse DSR report.');
                toast.error('Parsing failed');
            }
        } catch (err: any) {
            logger.error('Error parsing DSR:', err);
            setError(err.message || 'Failed to parse DSR report. Ensure it follows DDEX standards.');
            toast.error('Parsing failed');
        } finally {
            setIsParsing(false);
        }
    };

    const handleProcess = async () => {
        if (!parsedReport) return;

        setIsParsing(true);
        try {
            await onProcess(parsedReport);
            toast.success('Royalty data integrated into dashboard');
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to process report data.');
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
                        {!parsedReport ? (
                            <div className="space-y-4">
                                <FileUpload
                                    onFilesSelected={handleFileChange}
                                />

                                {isParsing && (
                                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                                        <Loader2 size={32} className="text-blue-500 animate-spin" />
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">Analyzing Data Structure...</p>
                                    </div>
                                )}

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

                                {/* Preview Stats */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-900/30 border border-gray-800 rounded-xl">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Transactions</p>
                                        <p className="text-2xl font-black text-white">{parsedReport.transactions.length.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-gray-900/30 border border-gray-800 rounded-xl">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Estimated Revenue</p>
                                        <p className="text-2xl font-black text-green-400">${parsedReport.summary.totalRevenue.toFixed(2)}</p>
                                    </div>
                                </div>

                                {/* Data Preview Table */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Preview (First 5 Rows)</h4>
                                    <div className="border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-gray-900/80 text-gray-400 font-bold uppercase tracking-tighter">
                                                <tr>
                                                    <th className="px-4 py-2 border-b border-gray-800">ISRC</th>
                                                    <th className="px-4 py-2 border-b border-gray-800">Streams</th>
                                                    <th className="px-4 py-2 border-b border-gray-800">Revenue</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-800/50">
                                                {parsedReport.transactions.slice(0, 5).map((row, i) => (
                                                    <tr key={i} className="text-gray-300">
                                                        <td className="px-4 py-2 font-mono">{row.resourceId.isrc}</td>
                                                        <td className="px-4 py-2">{row.usageCount.toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-green-500/80">${row.revenueAmount.toFixed(4)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
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

                        {parsedReport && (
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
