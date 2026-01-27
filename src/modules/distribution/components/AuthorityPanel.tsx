import React, { useState } from 'react';
import { distributionService } from '@/services/distribution/DistributionService';
import { Loader2, Key, Barcode, FileCode, Send } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { DistributionSyncService } from '@/services/distribution/DistributionSyncService';

export const AuthorityPanel: React.FC = () => {
    const { success, error: toastError } = useToast();
    const { distribution } = useStore();
    const { releases } = distribution;
    const [selectedReleaseId, setSelectedReleaseId] = useState<string>('');
    const [isrc, setIsrc] = useState<string | undefined>(undefined);
    const [upc, setUpc] = useState<string | undefined>(undefined);
    const [ddexXml, setDdexXml] = useState<string | null>(null);
    const [loading, setLoading] = useState<'isrc' | 'upc' | 'ddex' | null>(null);

    const handleGenerateISRC = async () => {
        setLoading('isrc');
        try {
            const result = await distributionService.assignISRCs();
            setIsrc(result);
            success(`ISRC Generated: ${result}`);
        } catch (error) {
            toastError(error instanceof Error ? error.message : 'ISRC generation failed');
        } finally {
            setLoading(null);
        }
    };

    const handleGenerateUPC = async () => {
        setLoading('upc');
        try {
            const result = await distributionService.generateUPC();
            setUpc(result);
            success(`UPC Generated: ${result}`);
        } catch (error) {
            toastError(error instanceof Error ? error.message : 'UPC generation failed');
        } finally {
            setLoading(null);
        }
    };

    const handleGenerateDDEX = async () => {
        if (!selectedReleaseId) {
            toastError('Please select a release first');
            return;
        }

        setLoading('ddex');
        try {
            // Fetch full release data
            const releaseData = await DistributionSyncService.getRelease(selectedReleaseId);
            if (!releaseData) {
                throw new Error('Release not found');
            }

            // Auto-generate identifiers if not already present
            let activeIsrc = isrc;
            let activeUpc = upc;

            if (!activeIsrc && (!releaseData.metadata.tracks || releaseData.metadata.tracks.some(t => !t.isrc))) {
                activeIsrc = await distributionService.assignISRCs();
                setIsrc(activeIsrc);
            }

            if (!activeUpc && !releaseData.metadata.upc) {
                activeUpc = await distributionService.generateUPC();
                setUpc(activeUpc);
            }

            const releasePayload = {
                releaseId: releaseData.id,
                title: releaseData.metadata.releaseTitle || releaseData.metadata.trackTitle,
                artists: [releaseData.metadata.artistName],
                tracks: (releaseData.metadata.tracks && releaseData.metadata.tracks.length > 0) ? releaseData.metadata.tracks.map((t, idx) => {
                    const trackIsrc = t.isrc || activeIsrc;
                    if (!trackIsrc) throw new Error(`Missing ISRC for track ${idx + 1}: ${t.trackTitle}`);
                    return {
                        id: String(idx + 1),
                        title: t.trackTitle,
                        isrc: trackIsrc
                    };
                }) : (() => {
                    // Fallback for single-track releases stored without a tracks array
                    const singleTrackIsrc = releaseData.metadata.isrc || activeIsrc;
                    if (!singleTrackIsrc) throw new Error('Missing ISRC for single track release');
                    return [{
                        id: '1',
                        title: releaseData.metadata.trackTitle,
                        isrc: singleTrackIsrc
                    }];
                })(),
                upc: releaseData.metadata.upc || activeUpc,
                label: releaseData.metadata.labelName
            };

            if (!releasePayload.upc) {
                throw new Error('Missing UPC for release');
            }

            const result = await distributionService.generateDDEX(releasePayload);
            setDdexXml(result);
            success('DDEX ERN 4.3 Message Generated');
        } catch (error) {
            toastError(error instanceof Error ? error.message : 'DDEX generation failed');
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-white">Authority Layer</h2>
                <p className="text-gray-400">
                    Industrial identity management. Generate ISRCs, UPCs, and DDEX ERN 4.3 messages for direct DSP delivery.
                </p>
            </div>

            {/* Release Selector */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                    Select Active Release
                </label>
                <select
                    value={selectedReleaseId}
                    onChange={(e) => setSelectedReleaseId(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-dept-royalties/50"
                >
                    <option value="">-- Select Release for DDEX Generation --</option>
                    {releases.map((release) => (
                        <option key={release.id} value={release.id}>
                            {release.title} ({release.artist})
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* ISRC Generator */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-dept-creative">
                        <Key className="w-5 h-5" />
                        <span className="font-bold uppercase tracking-wider text-sm">ISRC Manager</span>
                    </div>
                    <p className="text-xs text-gray-500">International Standard Recording Code. Unique identity for each sound recording.</p>

                    <button
                        onClick={handleGenerateISRC}
                        disabled={loading === 'isrc'}
                        className="w-full bg-dept-creative hover:bg-dept-creative/80 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {loading === 'isrc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                        Generate ISRC
                    </button>

                    {isrc && (
                        <div className="p-3 bg-dept-creative/10 border border-dept-creative/20 rounded-lg text-center">
                            <span className="font-mono text-dept-creative text-lg">{isrc}</span>
                        </div>
                    )}
                </div>

                {/* UPC Generator */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-dept-distribution">
                        <Barcode className="w-5 h-5" />
                        <span className="font-bold uppercase tracking-wider text-sm">UPC Registry</span>
                    </div>
                    <p className="text-xs text-gray-500">Universal Product Code. Required for album/single retail distribution.</p>

                    <button
                        onClick={handleGenerateUPC}
                        disabled={loading === 'upc'}
                        className="w-full bg-dept-distribution hover:bg-dept-distribution/80 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {loading === 'upc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Barcode className="w-4 h-4" />}
                        Generate UPC
                    </button>

                    {upc && (
                        <div className="p-3 bg-dept-distribution/10 border border-dept-distribution/20 rounded-lg text-center">
                            <span className="font-mono text-dept-distribution text-lg">{upc}</span>
                        </div>
                    )}
                </div>

                {/* DDEX Generator */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-dept-royalties">
                        <FileCode className="w-5 h-5" />
                        <span className="font-bold uppercase tracking-wider text-sm">DDEX Packager</span>
                    </div>
                    <p className="text-xs text-gray-500">Generate ERN 4.3 XML for direct ingestion by Apple, Spotify, and Amazon.</p>

                    <button
                        onClick={handleGenerateDDEX}
                        disabled={loading === 'ddex'}
                        className="w-full bg-dept-royalties hover:bg-dept-royalties/80 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {loading === 'ddex' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Generate DDEX
                    </button>
                </div>
            </div>

            {/* DDEX Output */}
            {ddexXml && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-dept-royalties uppercase tracking-widest">DDEX ERN 4.3 Output</span>
                        <button
                            onClick={() => navigator.clipboard.writeText(ddexXml)}
                            className="text-xs text-gray-500 hover:text-white transition-colors"
                        >
                            Copy to Clipboard
                        </button>
                    </div>
                    <pre className="p-4 bg-black/40 rounded-lg overflow-x-auto text-xs text-dept-licensing font-mono max-h-64 overflow-y-auto custom-scrollbar">
                        {ddexXml}
                    </pre>
                </div>
            )}
        </div>
    );
};
