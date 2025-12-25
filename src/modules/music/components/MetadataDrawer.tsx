import React, { useState, useEffect } from 'react';
import { GoldenMetadata, RoyaltySplit } from '@/services/metadata/types';
import { ShieldCheck, Plus, Trash, AlertTriangle, FileText, CheckCircle, Save, AlertCircle, BookOpen, Scale, Fingerprint } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

import { UserService } from '@/services/UserService';
import { identifyPlatform } from '@/services/knowledge/SamplePlatforms';
import { licenseScannerService } from '@/services/knowledge/LicenseScannerService';
import { useStore } from '@/core/store';

interface MetadataDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    metadata: GoldenMetadata;
    onUpdate: (data: GoldenMetadata) => void;
}

export const MetadataDrawer: React.FC<MetadataDrawerProps> = ({ isOpen, onClose, metadata, onUpdate }) => {
    const toast = useToast();
    const { user } = useStore();
    const [splits, setSplits] = useState<RoyaltySplit[]>(metadata.splits);
    const [localData, setLocalData] = useState<GoldenMetadata>(metadata);
    const [artistType, setArtistType] = useState<'Solo' | 'Band' | 'Collective'>('Solo');
    const [isScanning, setIsScanning] = useState<number | null>(null); // Index of sample being scanned

    // Fetch User Profile on Mount
    useEffect(() => {
        if (user) {
            UserService.getUserProfile(user.uid).then(p => {
                if (p?.artistType) setArtistType(p.artistType);
                // Auto-fix splits if Solo and empty
                if (p?.artistType === 'Solo' && metadata.splits.length === 1 && metadata.splits[0].percentage !== 100) {
                    // Logic handled by user interaction, not auto-overwrite to avoid data loss
                }
            });
        }
    }, [user]);

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
        if (!localData.isrc) return false;
        if (!isValidSplits) return false;

        // Sample Clearance Validation
        if (localData.containsSamples) {
            const uncleared = localData.samples?.some(s => !s.cleared || !s.sourceName);
            if (uncleared) return false;
            if (!localData.samples?.length) return false; // If containsSamples is true, there must be samples
        }

        return true;
    };

    const handleAddSample = () => {
        const newSamples = [...(localData.samples || []), { sourceName: '', cleared: false }];
        setLocalData({ ...localData, samples: newSamples });
    };

    const updateSample = (index: number, field: string, value: any) => {
        const newSamples = [...(localData.samples || [])];
        if (newSamples[index]) {
            (newSamples[index] as any)[field] = value;

            // Auto-detect platform when source name changes
            if (field === 'sourceName') {
                const platform = identifyPlatform(value);
                if (platform) {
                    newSamples[index].cleared = platform.defaultLicenseType === 'Royalty-Free';
                    newSamples[index].clearanceDetails = {
                        licenseType: platform.defaultLicenseType,
                        termsSummary: platform.termsSummary,
                        platformId: platform.id
                    };
                }
            }

            setLocalData({ ...localData, samples: newSamples });
        }
    };

    const removeSample = (index: number) => {
        const newSamples = localData.samples?.filter((_, i) => i !== index);
        setLocalData({ ...localData, samples: newSamples });
    };

    const handleScanUrl = async (index: number, url: string) => {
        if (!url) return;
        setIsScanning(index);

        try {
            const analysis = await licenseScannerService.scanUrl(url);

            const newSamples = [...(localData.samples || [])];
            if (newSamples[index]) {
                newSamples[index].cleared = analysis.licenseType === 'Royalty-Free';
                newSamples[index].sourceName = analysis.platformName || newSamples[index].sourceName;
                newSamples[index].clearanceDetails = {
                    licenseType: analysis.licenseType,
                    termsSummary: analysis.termsSummary,
                    platformId: 'ai-scan'
                };
                setLocalData({ ...localData, samples: newSamples });
                toast.success('License Terms Extracted via AI');
            }
        } catch (error) {
            toast.error('Scan failed');
        } finally {
            setIsScanning(null);
        }
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

                    {/* Sonic Fingerprint (New) */}
                    {localData.masterFingerprint && (
                        <div className="mt-3 p-2 bg-purple-900/10 border border-purple-500/20 rounded flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Fingerprint size={14} className="text-purple-400" />
                                <div>
                                    <span className="block text-[10px] uppercase text-purple-400 font-bold tracking-wider">Sonic ID</span>
                                    <span className="block text-[10px] font-mono text-gray-400 truncate w-32" title={localData.masterFingerprint}>
                                        {localData.masterFingerprint}
                                    </span>
                                </div>
                            </div>
                            <span className="text-[9px] bg-purple-500/10 text-purple-300 px-1 py-0.5 rounded border border-purple-500/20">
                                COMPOSITE
                            </span>
                        </div>
                    )}
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
                                        <Trash size={12} />
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

                {/* 3. Sample Clearance (NEW) */}
                <section>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                        <span>3. Sample Clearance</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500">Contains Samples?</span>
                            <input
                                type="checkbox"
                                checked={localData.containsSamples}
                                onChange={(e) => setLocalData({ ...localData, containsSamples: e.target.checked })}
                                className="toggle-checkbox"
                            />
                        </div>
                    </h4>

                    {localData.containsSamples && (
                        <div className="space-y-3 bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                            {!localData.samples?.length && (
                                <div className="text-center p-4 border border-dashed border-gray-700 rounded">
                                    <AlertTriangle className="mx-auto text-yellow-500 mb-2" size={20} />
                                    <p className="text-xs text-gray-400 mb-2">Unclear samples cause copyright strikes.</p>
                                    <button onClick={handleAddSample} className="text-xs bg-gray-800 px-3 py-1 rounded text-white hover:bg-gray-700">
                                        + Add Sample Source
                                    </button>
                                </div>
                            )}

                            {localData.samples?.map((sample, idx) => (
                                <div key={idx} className="flex flex-col gap-2 p-2 bg-black/40 rounded border border-gray-700">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 space-y-2">
                                            <input
                                                className="w-full bg-[#0d1117] border border-gray-700 rounded p-1.5 text-xs text-white placeholder-gray-600 focus:border-purple-500 outline-none"
                                                placeholder="Sample Source / Platform (e.g. Splice)"
                                                value={sample.sourceName}
                                                onChange={(e) => updateSample(idx, 'sourceName', e.target.value)}
                                            />

                                            {/* AI Scan Input */}
                                            {!sample.cleared && (
                                                <div className="flex gap-2">
                                                    <input
                                                        className="flex-1 bg-[#0d1117] border border-gray-700 rounded p-1.5 text-[10px] text-gray-400 placeholder-gray-700 focus:border-blue-500 outline-none"
                                                        placeholder="Paste URL to Policy/Terms (AI Scan)"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleScanUrl(idx, e.currentTarget.value);
                                                        }}
                                                    />
                                                    <button
                                                        disabled={isScanning === idx}
                                                        className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] hover:bg-blue-500/20 transition-colors"
                                                        onClick={(e) => {
                                                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                                            handleScanUrl(idx, input.value);
                                                        }}
                                                    >
                                                        {isScanning === idx ? 'SCANNING...' : 'SCAN'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => removeSample(idx)} className="text-red-500 hover:text-red-400">
                                            <Trash size={14} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={sample.cleared}
                                                onChange={(e) => updateSample(idx, 'cleared', e.target.checked)}
                                            />
                                            <span>Cleared?</span>
                                        </label>
                                        {sample.cleared && <span className="text-xs text-green-500 flex items-center gap-1"><CheckCircle size={10} /> Valid</span>}
                                    </div>

                                    {/* Legal Footnote */}
                                    {sample.clearanceDetails && (
                                        <div className="mt-1 p-2 bg-blue-900/20 border border-blue-900/50 rounded flex gap-2 items-start">
                                            <Scale className="text-blue-400 shrink-0 mt-0.5" size={12} />
                                            <div>
                                                <div className="text-[10px] text-blue-300 font-bold uppercase tracking-wider flex items-center gap-1">
                                                    {sample.clearanceDetails.licenseType}
                                                    <span className="text-gray-500">•</span>
                                                    Verified Platform
                                                </div>
                                                <p className="text-[10px] text-gray-400 leading-tight">
                                                    {sample.clearanceDetails.termsSummary}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {localData.samples && localData.samples.length > 0 && (
                                <button onClick={handleAddSample} className="w-full py-1 text-xs text-gray-400 hover:text-white border border-gray-800 rounded">
                                    + Add Another
                                </button>
                            )}
                        </div>
                    )}
                </section>

                <div className="h-px bg-gray-800 my-2" />

                {/* 4. Rights & Admin */}
                <section>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">4. Rights Admin</h4>
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
