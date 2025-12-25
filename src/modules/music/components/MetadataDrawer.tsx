
import React, { useState, useEffect } from 'react';
import { GoldenMetadata, RoyaltySplit } from '@/services/metadata/types';
import { CheckCircle, ShieldCheck, AlertCircle, Plus, Trash2, Save } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

interface MetadataDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    metadata: GoldenMetadata;
    onUpdate: (data: GoldenMetadata) => void;
}

export const MetadataDrawer: React.FC<MetadataDrawerProps> = ({ isOpen, onClose, metadata, onUpdate }) => {
    const toast = useToast();
    const [splits, setSplits] = useState<RoyaltySplit[]>(metadata.splits);
    const [localData, setLocalData] = useState<GoldenMetadata>(metadata);

    // Sync external changes
    useEffect(() => {
        setLocalData(metadata);
        setSplits(metadata.splits);
    }, [metadata]);

    const totalSplit = splits.reduce((acc, curr) => acc + Number(curr.percentage), 0);
    const isValidSplits = Math.abs(totalSplit - 100) < 0.1; // Float tolerance

    // Validation Logic
    const validate = (): boolean => {
        if (!localData.trackTitle || !localData.artistName) return false;
        if (!localData.isrc) return false; // ISRC is mandatory effectively
        if (!isValidSplits) return false;
        return true;
    };

    const handleSave = () => {
        const isGolden = validate();
        const updated = { ...localData, splits, isGolden };
        onUpdate(updated);

        if (isGolden) {
            toast.success("Golden Metadata Verified! Track is safe from 'Black Box'.");
            onClose();
        } else {
            toast.error("Validation Failed: Check ISRC and Split math (must equal 100%).");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-[#0d1117] border-l border-gray-800 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-gray-900 to-[#0d1117]">
                <div className="flex items-center gap-2">
                    <ShieldCheck className={localData.isGolden ? "text-green-500" : "text-gray-500"} size={20} />
                    <h3 className="text-white font-bold">Metadata Fortress</h3>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {/* 1. Core Identity */}
                <section>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">1. Core Identity</h4>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Track Title</label>
                            <input
                                className="w-full bg-[#161b22] border border-gray-700 rounded p-2 text-sm text-white focus:border-purple-500 outline-none transition-colors"
                                value={localData.trackTitle}
                                onChange={(e) => setLocalData({ ...localData, trackTitle: e.target.value })}
                                placeholder="e.g. Midnight City"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Artist Name</label>
                            <input
                                className="w-full bg-[#161b22] border border-gray-700 rounded p-2 text-sm text-white focus:border-purple-500 outline-none transition-colors"
                                value={localData.artistName}
                                onChange={(e) => setLocalData({ ...localData, artistName: e.target.value })}
                                placeholder="Legal Artist Name"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 flex justify-between">
                                <span>ISRC Code</span>
                                <span className="text-[10px] text-purple-400 cursor-pointer hover:underline">Generate new?</span>
                            </label>
                            <input
                                className="w-full bg-[#161b22] border border-gray-700 rounded p-2 text-sm font-mono text-green-400 focus:border-green-500 outline-none transition-colors"
                                value={localData.isrc}
                                onChange={(e) => setLocalData({ ...localData, isrc: e.target.value.toUpperCase() })}
                                placeholder="US-XXX-24-00001"
                            />
                        </div>
                    </div>
                </section>

                {/* 2. Royalty Splits */}
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">2. Who Gets Paid?</h4>
                        <span className={`text-xs font-mono font-bold ${isValidSplits ? 'text-green-500' : 'text-red-500'}`}>
                            {totalSplit}%
                        </span>
                    </div>

                    <div className="space-y-2">
                        {splits.map((split, idx) => (
                            <div key={idx} className="bg-gray-800/30 p-2 rounded border border-gray-800 flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 bg-transparent border-b border-gray-700 text-xs text-white p-1 outline-none"
                                        value={split.legalName}
                                        onChange={(e) => {
                                            const newSplits = [...splits];
                                            newSplits[idx].legalName = e.target.value;
                                            setSplits(newSplits);
                                        }}
                                        placeholder="Legal Name"
                                    />
                                    <input
                                        className="w-16 bg-transparent border-b border-gray-700 text-xs text-right text-white p-1 outline-none"
                                        type="number"
                                        value={split.percentage}
                                        onChange={(e) => {
                                            const newSplits = [...splits];
                                            newSplits[idx].percentage = parseFloat(e.target.value);
                                            setSplits(newSplits);
                                        }}
                                    />
                                    <span className="text-gray-500 text-xs pt-1">%</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <select
                                        className="bg-transparent text-[10px] text-gray-400 outline-none"
                                        value={split.role}
                                        onChange={(e) => {
                                            const newSplits = [...splits];
                                            newSplits[idx].role = e.target.value as any;
                                            setSplits(newSplits);
                                        }}
                                    >
                                        <option value="songwriter">Songwriter</option>
                                        <option value="producer">Producer</option>
                                        <option value="performer">Performer</option>
                                    </select>
                                    <button
                                        onClick={() => setSplits(splits.filter((_, i) => i !== idx))}
                                        className="text-red-900 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={() => setSplits([...splits, { legalName: '', role: 'songwriter', percentage: 0, email: '' }])}
                            className="w-full py-1 border border-dashed border-gray-700 text-gray-500 text-xs rounded hover:border-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-1"
                        >
                            <Plus size={12} /> Add Split
                        </button>
                    </div>
                </section>

                {/* 3. Rights Admin */}
                <section>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">3. Collections</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">PRO</label>
                            <select
                                className="w-full bg-[#161b22] border border-gray-700 rounded p-2 text-sm text-white outline-none"
                                value={localData.pro}
                                onChange={(e) => setLocalData({ ...localData, pro: e.target.value as any })}
                            >
                                <option value="None">None</option>
                                <option value="ASCAP">ASCAP</option>
                                <option value="BMI">BMI</option>
                                <option value="SESAC">SESAC</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Publisher</label>
                            <input
                                className="w-full bg-[#161b22] border border-gray-700 rounded p-2 text-sm text-white outline-none"
                                value={localData.publisher}
                                onChange={(e) => setLocalData({ ...localData, publisher: e.target.value })}
                            />
                        </div>
                    </div>
                </section>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-800 bg-[#0d1117]">
                <button
                    onClick={handleSave}
                    className="w-full py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all shadow-lg active:scale-95 bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500"
                >
                    <Save size={16} /> Save & Verify
                </button>
                {!localData.isGolden && (
                    <p className="text-[10px] text-center text-red-400 mt-2 flex items-center justify-center gap-1">
                        <AlertCircle size={10} /> Metadata incomplete. Export locked.
                    </p>
                )}
            </div>
        </div>
    );
};
