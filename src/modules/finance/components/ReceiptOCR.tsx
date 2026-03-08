import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scan, Upload, FileImage, Plus, CheckCircle, Tag, Calendar, DollarSign, Store } from 'lucide-react';

/* ================================================================== */
/*  Item 160 — Expense Receipt OCR                                     */
/* ================================================================== */

interface ExtractedReceipt {
    merchant: string;
    amount: string;
    date: string;
    category: string;
}

interface SavedReceipt extends ExtractedReceipt {
    id: number;
    filename: string;
    addedAt: string;
}

const MOCK_EXTRACTIONS: ExtractedReceipt[] = [
    { merchant: 'Guitar Center', amount: '$289.99', date: '2026-03-05', category: 'Equipment' },
    { merchant: 'Adobe Creative Cloud', amount: '$54.99', date: '2026-03-04', category: 'Software' },
    { merchant: 'Sweetwater', amount: '$149.00', date: '2026-03-02', category: 'Equipment' },
    { merchant: 'Starbucks', amount: '$8.45', date: '2026-03-01', category: 'Meals' },
];

const RECENT_RECEIPTS: SavedReceipt[] = [
    { id: 1, merchant: 'B&H Photo Video', amount: '$420.00', date: '2026-02-28', category: 'Equipment', filename: 'receipt_bh_0228.jpg', addedAt: '2026-02-28' },
    { id: 2, merchant: 'Spotify for Artists', amount: '$9.99', date: '2026-02-20', category: 'Software', filename: 'spotify_invoice.pdf', addedAt: '2026-02-20' },
    { id: 3, merchant: 'Rehearsal Space NYC', amount: '$200.00', date: '2026-02-15', category: 'Studio', filename: 'rehearsal_02_15.png', addedAt: '2026-02-15' },
];

const CATEGORY_COLORS: Record<string, string> = {
    Equipment: 'text-blue-400 bg-blue-500/10',
    Software: 'text-purple-400 bg-purple-500/10',
    Studio: 'text-amber-400 bg-amber-500/10',
    Meals: 'text-green-400 bg-green-500/10',
    Travel: 'text-cyan-400 bg-cyan-500/10',
    Other: 'text-gray-400 bg-gray-500/10',
};

export function ReceiptOCR() {
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [extracted, setExtracted] = useState<ExtractedReceipt | null>(null);
    const [savedReceipts, setSavedReceipts] = useState<SavedReceipt[]>(RECENT_RECEIPTS);
    const [addedToExpenses, setAddedToExpenses] = useState(false);
    const [extractionIndex, setExtractionIndex] = useState(0);
    const fileRef = useRef<HTMLInputElement>(null);

    function handleFile(file: File) {
        setUploadedFile(file);
        setExtracted(null);
        setAddedToExpenses(false);
    }

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, []);

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    }

    function handleAnalyze() {
        if (!uploadedFile) return;
        setIsAnalyzing(true);
        setExtracted(null);

        // Simulate Gemini Vision API call
        setTimeout(() => {
            const mockResult = MOCK_EXTRACTIONS[extractionIndex % MOCK_EXTRACTIONS.length];
            setExtractionIndex((i) => i + 1);
            setExtracted(mockResult);
            setIsAnalyzing(false);
        }, 2200);
    }

    function handleAddToExpenses() {
        if (!extracted || !uploadedFile) return;
        const newReceipt: SavedReceipt = {
            id: Date.now(),
            ...extracted,
            filename: uploadedFile.name,
            addedAt: new Date().toISOString().slice(0, 10),
        };
        setSavedReceipts((prev) => [newReceipt, ...prev]);
        setAddedToExpenses(true);
        setUploadedFile(null);
        setExtracted(null);
        setTimeout(() => setAddedToExpenses(false), 3000);
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Scan size={14} className="text-emerald-400" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-white">Receipt OCR</h2>
                    <p className="text-[10px] text-gray-500">Powered by Gemini Vision</p>
                </div>
            </div>

            {/* Upload Area */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                    isDragOver
                        ? 'border-emerald-500/60 bg-emerald-500/5'
                        : uploadedFile
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                }`}
            >
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleFileChange}
                />
                {uploadedFile ? (
                    <div className="flex flex-col items-center gap-2">
                        <FileImage size={24} className="text-emerald-400" />
                        <p className="text-sm font-bold text-white">{uploadedFile.name}</p>
                        <p className="text-[10px] text-gray-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                        <p className="text-[10px] text-emerald-400">Click to replace</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <Upload size={24} className="text-gray-600" />
                        <p className="text-sm font-bold text-gray-400">Drop receipt here or click to upload</p>
                        <p className="text-[10px] text-gray-600">JPG, PNG, PDF supported</p>
                    </div>
                )}
            </div>

            {/* Analyze Button */}
            {uploadedFile && !extracted && (
                <motion.button
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-sm transition-colors disabled:opacity-60 border border-emerald-500/20"
                >
                    <Scan size={16} className={isAnalyzing ? 'animate-spin' : ''} />
                    {isAnalyzing ? 'Analyzing with Gemini Vision…' : 'Analyze with Gemini Vision'}
                </motion.button>
            )}

            {/* Analyzing State */}
            <AnimatePresence>
                {isAnalyzing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-4 rounded-xl bg-white/[0.02] border border-white/5"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <Scan size={16} className="text-emerald-400 animate-spin" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white">Gemini Vision processing…</p>
                                <p className="text-[10px] text-gray-500">Extracting merchant, amount, date, and category</p>
                            </div>
                        </div>
                        <div className="mt-3 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-emerald-500 rounded-full"
                                initial={{ width: '0%' }}
                                animate={{ width: '90%' }}
                                transition={{ duration: 2, ease: 'easeOut' }}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Extracted Data */}
            <AnimatePresence>
                {extracted && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20"
                    >
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">Extracted Data</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                                <Store size={12} className="text-gray-500 flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] text-gray-500">Merchant</p>
                                    <p className="text-xs font-bold text-white">{extracted.merchant}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <DollarSign size={12} className="text-gray-500 flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] text-gray-500">Amount</p>
                                    <p className="text-xs font-bold text-green-400">{extracted.amount}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar size={12} className="text-gray-500 flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] text-gray-500">Date</p>
                                    <p className="text-xs font-bold text-white">{extracted.date}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Tag size={12} className="text-gray-500 flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] text-gray-500">Category</p>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CATEGORY_COLORS[extracted.category] || CATEGORY_COLORS.Other}`}>
                                        {extracted.category}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleAddToExpenses}
                            disabled={addedToExpenses}
                            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs transition-colors disabled:opacity-60"
                        >
                            {addedToExpenses ? (
                                <>
                                    <CheckCircle size={14} />
                                    Added to Expenses
                                </>
                            ) : (
                                <>
                                    <Plus size={14} />
                                    Add to Expenses
                                </>
                            )}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Success notification */}
            <AnimatePresence>
                {addedToExpenses && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400"
                    >
                        <CheckCircle size={14} />
                        <span className="text-xs font-bold">Receipt logged to expense tracker</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Recent Receipts */}
            <div>
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Recent Receipts</h3>
                <div className="space-y-2">
                    {savedReceipts.slice(0, 5).map((receipt) => (
                        <motion.div
                            key={receipt.id}
                            layout
                            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.03] transition-colors"
                        >
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                                <FileImage size={14} className="text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white truncate">{receipt.merchant}</p>
                                <p className="text-[10px] text-gray-500 truncate">{receipt.filename}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-xs font-bold text-green-400">{receipt.amount}</p>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CATEGORY_COLORS[receipt.category] || CATEGORY_COLORS.Other}`}>
                                    {receipt.category}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
