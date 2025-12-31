import React, { useState, useEffect } from 'react';
import { GoldenMetadata, RoyaltySplit } from '@/services/metadata/types';
import { ShieldCheck, Plus, Trash2, AlertTriangle, FileText, CheckCircle, Save, AlertCircle, BookOpen, Scale, Fingerprint } from 'lucide-react';
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
    const { userProfile } = useStore();
    const [splits, setSplits] = useState<RoyaltySplit[]>(metadata.splits);
    const [localData, setLocalData] = useState<GoldenMetadata>(metadata);
    const [artistType, setArtistType] = useState<'Solo' | 'Band' | 'Collective'>('Solo');
    const [isScanning, setIsScanning] = useState<number | null>(null); // Index of sample being scanned

    // Fetch User Profile on Mount
    useEffect(() => {
        if (userProfile) {
            UserService.getUserProfile(userProfile.id).then(p => {
                if (p?.artistType) setArtistType(p.artistType);
                // Auto-fix splits if Solo and empty
                if (p?.artistType === 'Solo' && metadata.splits.length === 1 && metadata.splits[0].percentage !== 100) {
                    // Logic handled by user interaction, not auto-overwrite to avoid data loss
                }
            });
        }
    }, [userProfile]);

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
        if (!localData.labelName) return false;
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
        <div className="fixed inset-y-0 right-0 w-96 bg-card glass-panel border-l border-border shadow-2xl z-50 transform transition-transform duration-300 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-background to-card">
                <div className="flex items-center gap-2">
                    <ShieldCheck className={localData.isGolden ? "text-green-500" : "text-muted-foreground"} size={20} />
                    <h3 className="text-foreground font-bold font-sans tracking-tight">Metadata Fortress</h3>
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {/* 1. Core Identity */}
                <section>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">1. Core Identity</h4>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] text-muted-foreground mb-1 font-mono uppercase">Track Title</label>
                            <input
                                className="w-full bg-secondary/50 border border-border rounded-lg p-2 text-sm text-foreground focus:border-primary outline-none transition-colors"
                                value={localData.trackTitle}
                                onChange={(e) => setLocalData({ ...localData, trackTitle: e.target.value })}
                                placeholder="e.g. Midnight City"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-muted-foreground mb-1 font-mono uppercase">Artist Name</label>
                            <input
                                className="w-full bg-secondary/50 border border-border rounded-lg p-2 text-sm text-foreground focus:border-primary outline-none transition-colors"
                                value={localData.artistName}
                                onChange={(e) => setLocalData({ ...localData, artistName: e.target.value })}
                                placeholder="Legal Artist Name"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-muted-foreground mb-1 font-mono uppercase flex justify-between">
                                <span>ISRC Code</span>
                                <span className="text-[9px] text-primary cursor-pointer hover:underline">AUTO-GENERATE</span>
                            </label>
                            <input
                                className="w-full bg-secondary/50 border border-border rounded-lg p-2 text-sm font-mono text-primary focus:border-primary outline-none transition-colors tracking-widest"
                                value={localData.isrc}
                                onChange={(e) => setLocalData({ ...localData, isrc: e.target.value.toUpperCase() })}
                                placeholder="US-XXX-24-00001"
                            />
                        </div>
                    </div>

                    {/* Sonic Fingerprint (New) */}
                    {localData.masterFingerprint && (
                        <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Fingerprint size={16} className="text-primary glow-text-yellow" />
                                <div>
                                    <span className="block text-[9px] uppercase text-primary font-bold tracking-wider">Sonic ID</span>
                                    <span className="block text-[10px] font-mono text-foreground/70 truncate w-32" title={localData.masterFingerprint}>
                                        {localData.masterFingerprint}
                                    </span>
                                </div>
                            </div>
                            <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full border border-primary/20 font-bold">
                                COMPOSITE
                            </span>
                        </div>
                    )}
                </section>

                {/* 2. Royalty Splits */}
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">2. Ownership Stake</h4>
                        <span className={`text-xs font-mono font-bold ${isValidSplits ? 'text-green-500' : 'text-destructive'}`}>
                            {totalSplit}%
                        </span>
                    </div>

                    <div className="space-y-2">
                        {splits.map((split, idx) => (
                            <div key={idx} className="bg-secondary/30 p-3 rounded-xl border border-border flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 bg-transparent border-b border-border text-xs text-foreground p-1 outline-none focus:border-primary transition-colors"
                                        value={split.legalName}
                                        onChange={(e) => {
                                            const newSplits = [...splits];
                                            newSplits[idx].legalName = e.target.value;
                                            setSplits(newSplits);
                                        }}
                                        placeholder="Legal Name"
                                    />
                                    <div className="flex items-center gap-1">
                                        <input
                                            className="w-12 bg-transparent border-b border-border text-xs text-right text-foreground p-1 outline-none focus:border-primary"
                                            type="number"
                                            value={split.percentage}
                                            onChange={(e) => {
                                                const newSplits = [...splits];
                                                newSplits[idx].percentage = parseFloat(e.target.value);
                                                setSplits(newSplits);
                                            }}
                                        />
                                        <span className="text-muted-foreground text-[10px]">%</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <select
                                        className="bg-transparent text-[10px] text-muted-foreground outline-none border-none cursor-pointer"
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
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={() => setSplits([...splits, { legalName: '', role: 'songwriter', percentage: 0, email: '' }])}
                            className="w-full py-2 border border-dashed border-border text-muted-foreground text-[10px] rounded-xl hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-1 uppercase tracking-widest font-bold"
                        >
                            <Plus size={12} /> Add Stakeholder
                        </button>
                    </div>
                </section>

                {/* 3. Sample Clearance */}
                <section>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center justify-between">
                        <span>3. Sample Clearance</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-muted-foreground">Interpolated?</span>
                            <div
                                onClick={() => setLocalData({ ...localData, containsSamples: !localData.containsSamples })}
                                className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${localData.containsSamples ? 'bg-primary' : 'bg-secondary'}`}
                            >
                                <div className={`w-3 h-3 bg-white rounded-full transition-transform ${localData.containsSamples ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                        </div>
                    </h4>

                    {localData.containsSamples && (
                        <div className="space-y-3 bg-background/50 p-4 rounded-xl border border-border">
                            {!localData.samples?.length && (
                                <div className="text-center p-4 border border-dashed border-border rounded-lg">
                                    <AlertTriangle className="mx-auto text-primary mb-2" size={20} />
                                    <p className="text-[10px] text-muted-foreground mb-3 font-mono">UNCLEARED SAMPLES = BLACK BOX ROYALTIES</p>
                                    <button onClick={handleAddSample} className="text-[10px] bg-secondary px-4 py-2 rounded-lg text-foreground hover:bg-muted font-bold transition-colors">
                                        ADD SOURCE
                                    </button>
                                </div>
                            )}

                            {localData.samples?.map((sample, idx) => (
                                <div key={idx} className="flex flex-col gap-3 p-3 bg-card border border-border rounded-xl">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 space-y-2">
                                            <input
                                                className="w-full bg-secondary/50 border border-border rounded-lg p-2 text-[11px] text-foreground placeholder-muted-foreground focus:border-primary outline-none"
                                                placeholder="Source / Platform (e.g. Splice)"
                                                value={sample.sourceName}
                                                onChange={(e) => updateSample(idx, 'sourceName', e.target.value)}
                                            />

                                            {/* AI Scan Input */}
                                            {!sample.cleared && (
                                                <div className="flex gap-2">
                                                    <input
                                                        className="flex-1 bg-secondary/30 border border-border rounded-lg p-2 text-[10px] text-muted-foreground placeholder-muted-foreground/30 focus:border-primary outline-none"
                                                        placeholder="URL to Terms (AI Vision Scan)"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleScanUrl(idx, e.currentTarget.value);
                                                        }}
                                                    />
                                                    <button
                                                        disabled={isScanning === idx}
                                                        className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-[9px] hover:scale-105 active:scale-95 transition-all font-bold disabled:opacity-50"
                                                        onClick={(e) => {
                                                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                                            handleScanUrl(idx, input.value);
                                                        }}
                                                    >
                                                        {isScanning === idx ? 'SCAN' : 'SCAN'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => removeSample(idx)} className="text-muted-foreground hover:text-destructive ml-2 transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="w-3 h-3 rounded border-border text-primary focus:ring-primary bg-secondary/50"
                                                checked={sample.cleared}
                                                onChange={(e) => updateSample(idx, 'cleared', e.target.checked)}
                                            />
                                            <span>Full Legal Clearance</span>
                                        </label>
                                        {sample.cleared && <span className="text-[10px] text-green-500 font-bold flex items-center gap-1 ml-auto"><CheckCircle size={10} /> VERIFIED</span>}
                                    </div>

                                    {/* Legal Footnote */}
                                    {sample.clearanceDetails && (
                                        <div className="p-2 bg-primary/5 border border-primary/20 rounded-lg flex gap-3 items-start">
                                            <Scale className="text-primary shrink-0 mt-0.5" size={14} />
                                            <div>
                                                <div className="text-[9px] text-primary font-bold uppercase tracking-widest flex items-center gap-1">
                                                    {sample.clearanceDetails.licenseType}
                                                    <span className="text-muted-foreground opacity-30">•</span>
                                                    SONIC GUARD
                                                </div>
                                                <p className="text-[10px] text-foreground/70 leading-tight mt-1 font-sans">
                                                    {sample.clearanceDetails.termsSummary}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {localData.samples && localData.samples.length > 0 && (
                                <button onClick={handleAddSample} className="w-full py-2 text-[10px] text-muted-foreground hover:text-foreground border border-border rounded-xl font-bold uppercase tracking-widest transition-all">
                                    + Source
                                </button>
                            )}
                        </div>
                    )}
                </section>

                {/* 4. Rights Admin */}
                <section>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">4. Rights Administration</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] text-muted-foreground mb-1 font-mono uppercase">PRO</label>
                            <select
                                className="w-full bg-secondary/50 border border-border rounded-lg p-2 text-sm text-foreground outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
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
                            <label className="block text-[10px] text-muted-foreground mb-1 font-mono uppercase">Publisher</label>
                            <input
                                className="w-full bg-secondary/50 border border-border rounded-lg p-2 text-sm text-foreground outline-none focus:border-primary transition-colors"
                                value={localData.publisher}
                                onChange={(e) => setLocalData({ ...localData, publisher: e.target.value })}
                            />
                        </div>
                    </div>
                </section>

                {/* 5. DDEX Compliance */}
                <section>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                        <BookOpen size={14} /> 5. Global Distribution
                    </h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] text-muted-foreground mb-1 font-mono uppercase">Label / Party Name</label>
                            <input
                                className="w-full bg-secondary/50 border border-border rounded-lg p-2 text-sm text-foreground focus:border-primary outline-none transition-colors"
                                value={localData.labelName}
                                onChange={(e) => setLocalData({ ...localData, labelName: e.target.value })}
                                placeholder="e.g. IndiiOS Records"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-muted-foreground mb-1 font-mono uppercase flex justify-between">
                                <span>DPID (DDEX)</span>
                                <ShieldCheck size={12} className="text-primary" />
                            </label>
                            <input
                                className="w-full bg-secondary/50 border border-border rounded-lg p-2 text-sm font-mono text-primary focus:border-primary outline-none transition-colors"
                                value={localData.dpid || ''}
                                onChange={(e) => setLocalData({ ...localData, dpid: e.target.value.toUpperCase() })}
                                placeholder="PA-DPIDA-XXXXXXXXXX-X"
                            />
                            <p className="text-[9px] text-muted-foreground mt-2 font-sans italic">
                                Your unique identifier for global sonic distribution and rights tracking.
                            </p>
                        </div>
                    </div>
                </section>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border bg-card/80 backdrop-blur-xl">
                <button
                    onClick={handleSave}
                    className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold transition-all shadow-xl active:scale-95 bg-primary text-primary-foreground hover:scale-[1.02] shadow-primary/20"
                >
                    <Save size={18} /> SAVE & VERIFY
                </button>
                {!localData.isGolden && (
                    <p className="text-[10px] text-center text-destructive mt-4 flex items-center justify-center gap-2 font-bold uppercase tracking-tighter">
                        <AlertCircle size={12} /> INCOMPLETE DATA DETECTED • VERIFICATION FAILED
                    </p>
                )}
            </div>
        </div>
    );
};
