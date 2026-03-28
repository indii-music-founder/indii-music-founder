import React, { useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle, XCircle, FileText, Youtube } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { distributionService } from '@/services/distribution/DistributionService';
import type { ValidationReport } from '@/types/distribution';
import { secureRandomInt } from '@/utils/crypto-random';

interface QCError {
    field: string;
    message: string;
}

export const QCPanel: React.FC = () => {
    const { success, error: toastError } = useToast();
    const [metadata, setMetadata] = useState({
        title: '',
        artist: '',
        artwork_url: '',
        version: '',
        isrc: ''
    });
    const [loading, setLoading] = useState<'qc' | 'cid' | null>(null);
    const [qcResult, setQcResult] = useState<ValidationReport | null>(null);
    const [csvOutput, setCsvOutput] = useState<string | null>(null);

    const handleValidate = async () => {
        setLoading('qc');
        setQcResult(null);
        try {
            // Map flat state to DDEXMetadata structure
            const ddexMetadata: import('@/types/distribution').DDEXMetadata = {
                releaseId: `qc-${Date.now()}`,
                title: metadata.title,
                artists: [metadata.artist],
                tracks: [], // QC usually checks release-level metadata first
                label: 'Indii Records'
            };
            const report = await distributionService.validateReleaseMetadata(ddexMetadata);
            setQcResult(report);
            if (report.valid) {
                success('Metadata passed QC validation');
            } else {
                toastError(`QC Failed: ${report.errors.length} error(s)`);
            }
        } catch (error) {
            toastError(error instanceof Error ? error.message : 'QC validation failed');
        } finally {
            setLoading(null);
        }
    };

    const handleGenerateCID = async () => {
        setLoading('cid');
        setCsvOutput(null);
        try {
            const cidPayload: import('@/types/distribution').ContentIdData = {
                tracks: [{
                    title: metadata.title || 'Test Track',
                    isrc: metadata.isrc || `US-S1Z-25-${secureRandomInt(0, 99999).toString().padStart(5, '0')}`,
                    asset_id: `ASSET-${Date.now()}`
                }]
            };
            // Service returns the CSV string directly or handles the error
            const csvData = await distributionService.generateContentIdAssets(cidPayload);
            setCsvOutput(csvData);
            success('YouTube Content ID CSV generated');
        } catch (error) {
            toastError(error instanceof Error ? error.message : 'CID generation failed');
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-white">Brain Layer: QC & Compliance</h2>
                <p className="text-gray-400">
                    Validate metadata against Apple/Spotify style guides and generate YouTube Content ID bulk CSVs.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-dept-distribution mb-4">
                        <FileText className="w-5 h-5" />
                        <span className="font-bold uppercase tracking-wider text-sm">Metadata Input</span>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">ISRC (Optional)</label>
                            <input
                                data-testid="qc-input-isrc"
                                type="text"
                                value={metadata.isrc}
                                onChange={(e) => setMetadata(prev => ({ ...prev, isrc: e.target.value }))}
                                placeholder="US-XXX-25-XXXXX (Leave empty to auto-generate)"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-dept-distribution/50 transition-colors placeholder:text-zinc-600 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Track/Release Title</label>
                            <input
                                data-testid="qc-input-title"
                                type="text"
                                value={metadata.title}
                                onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Enter title (avoid feat/prod in title)"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-dept-distribution/50 transition-colors placeholder:text-zinc-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Primary Artist</label>
                            <input
                                data-testid="qc-input-artist"
                                type="text"
                                value={metadata.artist}
                                onChange={(e) => setMetadata(prev => ({ ...prev, artist: e.target.value }))}
                                placeholder="Avoid generic names (Chill Beats, etc.)"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-dept-distribution/50 transition-colors placeholder:text-zinc-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Artwork URL</label>
                            <input
                                data-testid="qc-input-artwork"
                                type="text"
                                value={metadata.artwork_url}
                                onChange={(e) => setMetadata(prev => ({ ...prev, artwork_url: e.target.value }))}
                                placeholder="https://..."
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-dept-distribution/50 transition-colors placeholder:text-zinc-600"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                data-testid="qc-run-validation"
                                onClick={handleValidate}
                                disabled={loading === 'qc'}
                                className="bg-dept-distribution hover:bg-dept-distribution/80 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                {loading === 'qc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                Run QC
                            </button>
                            <button
                                data-testid="qc-generate-cid"
                                onClick={handleGenerateCID}
                                disabled={loading === 'cid'}
                                className="bg-dept-marketing hover:bg-dept-marketing/80 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                {loading === 'cid' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Youtube className="w-4 h-4" />}
                                Gen CID CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* Output Panel */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 relative overflow-hidden backdrop-blur-sm">
                    {!qcResult && !csvOutput ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4 min-h-[300px]">
                            <div className="p-4 rounded-full bg-white/5">
                                <FileText className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="text-sm font-medium">Awaiting Validation/Generation</p>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {qcResult && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                        <span
                                            data-testid="qc-status-badge"
                                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${qcResult.valid ? 'bg-dept-licensing/10 text-dept-licensing border border-dept-licensing/20' : 'bg-dept-marketing/10 text-dept-marketing border border-dept-marketing/20'
                                                }`}>
                                            {qcResult.valid ? 'PASSED' : 'FAILED'}
                                        </span>
                                        <span className="text-xs text-gray-500">{qcResult.summary}</span>
                                    </div>

                                    {qcResult.errors.length > 0 && (
                                        <div className="space-y-2">
                                            <span className="text-xs font-bold text-dept-marketing uppercase tracking-widest">Errors</span>
                                            {qcResult.errors.map((err, i) => (
                                                <div key={i} className="flex items-start gap-2 p-3 bg-dept-marketing/10 border border-dept-marketing/20 rounded-lg">
                                                    <XCircle className="w-4 h-4 text-dept-marketing mt-0.5 flex-shrink-0" />
                                                    <span className="text-xs text-dept-marketing/80">{err}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {(qcResult.warnings?.length ?? 0) > 0 && (
                                        <div className="space-y-2">
                                            <span className="text-xs font-bold text-dept-royalties uppercase tracking-widest">Warnings</span>
                                            {qcResult.warnings?.map((warn, i) => (
                                                <div key={i} className="flex items-start gap-2 p-3 bg-dept-royalties/10 border border-dept-royalties/20 rounded-lg">
                                                    <AlertTriangle className="w-4 h-4 text-dept-royalties mt-0.5 flex-shrink-0" />
                                                    <span className="text-xs text-dept-royalties/80">{warn}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {csvOutput && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-dept-marketing uppercase tracking-widest">YouTube Content ID CSV</span>
                                        <button
                                            data-testid="qc-copy-cid"
                                            onClick={() => navigator.clipboard.writeText(csvOutput)}
                                            className="text-xs text-gray-500 hover:text-white transition-colors"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    <pre
                                        data-testid="qc-cid-output"
                                        className="p-4 bg-black/40 rounded-lg overflow-x-auto text-xs text-dept-licensing font-mono max-h-48 overflow-y-auto custom-scrollbar"
                                    >
                                        {csvOutput}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
