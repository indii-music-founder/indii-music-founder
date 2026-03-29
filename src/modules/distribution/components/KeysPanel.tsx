
import React, { useState } from 'react';
import { Loader2, CheckCircle, XCircle, FileText, Key, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { distributionService } from '@/services/distribution/DistributionService';
import { isrcService } from '@/services/distribution/ISRCService'; // Import ISRCService
import { MerlinReport, MerlinCheckData, MerlinTrack, BWarmWork } from '@/types/distribution';
import { ISRCRecordDocument } from '@/types/firestore';

import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';

export const KeysPanel: React.FC = () => {
    const { success, error } = useToast();
    const [loading, setLoading] = useState(false);
    const [statusReport, setStatusReport] = useState<MerlinReport | null>(null);
    const [bwarmCsv, setBwarmCsv] = useState<string | null>(null);
    const [catalog, setCatalog] = useState<ISRCRecordDocument[]>([]);
    const [dataLoaded, setDataLoaded] = useState(false);

    // Fetch catalog on mount
    React.useEffect(() => {
        const fetchCatalog = async () => {
            try {
                const results = await isrcService.getUserCatalog();
                setCatalog(results);
                setDataLoaded(true);
            } catch (err: unknown) {
                logger.error('[KeysPanel] Failed to load catalog:', err);
                error('Failed to load your ISRC catalog.');
            }
        };
        fetchCatalog();
    }, [error]);

    const handleCheckMerlin = async () => {
        setLoading(true);
        setStatusReport(null);
        try {
            if (catalog.length === 0) {
                success('No tracks in catalog to check. Please assign ISRCs first.');
                return;
            }

            // Map real catalog to MerlinTrack format
            const tracks: MerlinTrack[] = catalog.map(record => ({
                isrc: record.isrc,
                title: record.trackTitle,
                rights_holder: record.artistName, // Best guess mapping
                exclusive_rights: true // Default assumption for independent distribution
            }));

            const checkData: MerlinCheckData = {
                catalog_id: `CAT-${auth.currentUser?.uid?.substring(0, 8) || 'USER'}`,
                tracks: tracks
            };

            const report = await distributionService.checkMerlinStatus(checkData);
            setStatusReport(report);
            success(`Merlin Readiness Check Complete. Status: ${report.status}`);

        } catch (err: unknown) {
            error(err instanceof Error ? err.message : 'Unknown error during Merlin check');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateBWARM = async () => {
        setLoading(true);
        setBwarmCsv(null);
        try {
            if (catalog.length === 0) {
                success('No works to register. Please assign ISRCs first.');
                return;
            }

            // Map real catalog to BWarmWork format
            const works: BWarmWork[] = catalog.map(record => {
                // Attempt to find writers in metadata snapshot, fallback to artistName
                const writers = (record.metadataSnapshot?.writers as string[]) || [record.artistName];

                return {
                    title: record.trackTitle,
                    writers: writers,
                    isrc: record.isrc,
                    // Additional helpful metadata if available
                    artist: record.artistName
                };
            });

            // DistributionService.generateBWARM returns the CSV string directly (unwrapped)
            const csv = await distributionService.generateBWARM({ works });
            setBwarmCsv(csv);
            success('BWARM CSV Generated. Ready for download.');
        } catch (err: unknown) {
            error(err instanceof Error ? err.message : 'Unknown error during BWARM generation');
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = () => {
        if (!bwarmCsv) return;
        const blob = new Blob([bwarmCsv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `indiiOS_BWARM_Export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Merlin Readiness Card */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <ShieldCheck className="w-5 h-5 text-dept-creative" />
                        <h3 className="font-bold text-white">Merlin Network Compliance</h3>
                    </div>

                    {!statusReport ? (
                        <div className="text-center py-8 text-gray-500">
                            <p className="text-sm mb-4">
                                {dataLoaded
                                    ? `Check compliance for ${catalog.length} track${catalog.length === 1 ? '' : 's'} in your catalog.`
                                    : 'Loading catalog...'}
                            </p>
                            <button
                                data-testid="keys-run-compliance-audit"
                                onClick={handleCheckMerlin}
                                disabled={loading || !dataLoaded || catalog.length === 0}
                                className="px-4 py-2 bg-dept-creative hover:bg-dept-creative/80 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto disabled:cursor-not-allowed"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Run Compliance Audit
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span
                                    data-testid="keys-compliance-status"
                                    className={`text-sm font-bold ${statusReport.status === 'READY' ? 'text-dept-licensing' : 'text-dept-royalties'
                                        }`}>
                                    Status: {statusReport.status}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">
                                    Passed: {statusReport.passed_count} / Failed: {statusReport.failed_count}
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-dept-creative h-full rounded-full transition-all duration-500"
                                    style={{ width: `${(statusReport.passed_count / (statusReport.passed_count + statusReport.failed_count)) * 100}%` }}
                                />
                            </div>

                            <div className="bg-black/30 rounded-lg p-3 text-xs space-y-2 max-h-32 overflow-y-auto">
                                {statusReport.issues.length === 0 ? (
                                    <div className="flex items-center gap-2 text-dept-licensing">
                                        <CheckCircle className="w-4 h-4" />
                                        <span>All checks passed. Catalog is ready for registration.</span>
                                    </div>
                                ) : (
                                    statusReport.issues.map((check, i) => (
                                        <div key={i} className="flex items-start gap-2 text-red-300">
                                            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                            <span>{check}</span>
                                        </div>
                                    ))
                                )}
                            </div>

                            <button
                                data-testid="keys-run-check-again"
                                onClick={() => setStatusReport(null)}
                                className="w-full mt-4 px-4 py-2 border border-white/10 hover:bg-white/5 text-gray-300 rounded-lg text-sm transition-colors"
                            >
                                Run Check Again
                            </button>
                        </div>
                    )}
                </div>

                {/* MLC / Keys Card */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-dept-distribution/20 rounded-lg">
                            <Key className="w-6 h-6 text-dept-distribution" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">The MLC Bridge</h3>
                            <p className="text-sm text-gray-400">Mechanical Licensing Collective</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                            <h4 className="text-sm font-medium text-white mb-2">BWARM Generation</h4>
                            <p className="text-xs text-gray-400 mb-4">
                                Generate Bulk Works Registration (BWARM) CSV files compliant with The MLC standards for royalty collection.
                            </p>

                            {bwarmCsv ? (
                                <div className="space-y-3">
                                    <div className="p-3 bg-dept-licensing/10 border border-dept-licensing/20 rounded text-xs font-mono text-dept-licensing truncate">
                                        CSV Generated ({bwarmCsv.length} bytes)
                                    </div>
                                    <button
                                        data-testid="keys-download-bwarm-csv"
                                        onClick={downloadCSV}
                                        className="w-full px-3 py-2 bg-dept-licensing hover:bg-dept-licensing/80 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Download CSV
                                    </button>
                                    <button
                                        data-testid="keys-clear-bwarm-csv"
                                        onClick={() => setBwarmCsv(null)}
                                        className="w-full px-3 py-2 text-gray-400 hover:text-white text-xs transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>
                            ) : (
                                <button
                                    data-testid="keys-generate-bwarm-csv"
                                    onClick={handleGenerateBWARM}
                                    disabled={loading}
                                    className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium border border-white/10 transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                    Generate BWARM CSV
                                </button>
                            )}
                        </div>

                        <div className="pt-4 border-t border-gray-800">
                            <h4 className="text-sm font-medium text-white mb-2">External Connections</h4>
                            <div className="flex gap-2">
                                <button disabled className="flex-1 py-2 bg-white/5 text-gray-500 rounded border border-white/10 text-xs cursor-not-allowed">
                                    Connect MLC Account
                                </button>
                                <button disabled className="flex-1 py-2 bg-white/5 text-gray-500 rounded border border-white/10 text-xs cursor-not-allowed">
                                    Connect SoundExchange
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
