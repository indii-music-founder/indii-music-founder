
import React, { useState } from 'react';
import { Loader2, CheckCircle, XCircle, FileText, Key, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { distributionService } from '@/services/distribution/DistributionService';

interface MerlinReport {
    status: string; // 'READY' | 'NOT_READY'
    score: number;
    checks: string[];
    timestamp?: string;
}

interface BwarmResponse {
    success: boolean;
    csv?: string;
    report?: any;
    error?: string;
}

interface MerlinResponse {
    success: boolean;
    report?: MerlinReport;
    error?: string;
}

export const KeysPanel: React.FC = () => {
    const { success, error } = useToast();
    const [loading, setLoading] = useState(false);
    const [statusReport, setStatusReport] = useState<MerlinReport | null>(null);
    const [bwarmCsv, setBwarmCsv] = useState<string | null>(null);

    const handleCheckMerlin = async () => {
        setLoading(true);
        setStatusReport(null);
        try {
            // Mock catalog data for the check
            const mockCatalogData = {
                total_tracks: 55, // Mock > 50
                has_isrcs: true,
                has_upcs: true,
                exclusive_rights: true
            };

            // Cast response to known shape since service returns any/Promise<any>
            const response = await distributionService.checkMerlinStatus(mockCatalogData) as MerlinResponse;

            if (response.success && response.report) {
                setStatusReport(response.report);
                success(`Merlin Readiness Check Complete. Status: ${response.report.status}`);
            } else {
                throw new Error(response.error || 'Merlin check failed to return a report.');
            }
        } catch (err) {
            error(err instanceof Error ? err.message : 'Unknown error during Merlin check');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateBWARM = async () => {
        setLoading(true);
        setBwarmCsv(null);
        try {
            // Mock works data
            const mockWorks = [
                { title: 'Neon Highway', writer_last: 'Doe', writer_first: 'Jane', writer_ipi: '00123456789' },
                { title: 'Midnight Drive', writer_last: 'Smith', writer_first: 'John', writer_ipi: '00987654321' }
            ];

            const response = await distributionService.generateBWARM({ works: mockWorks }) as BwarmResponse;

            if (response.success && response.csv) {
                setBwarmCsv(response.csv);
                success('BWARM CSV Generated. Ready for download.');
            } else {
                throw new Error(response.error || 'BWARM generation failed.');
            }
        } catch (err) {
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
                <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-purple-900/20 rounded-lg">
                            <ShieldCheck className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Merlin Readiness</h3>
                            <p className="text-sm text-gray-400">Direct commercial terms qualification</p>
                        </div>
                    </div>

                    {!statusReport ? (
                        <div className="text-center py-8">
                            <p className="text-gray-400 mb-6">Verify if your catalog meets the requirements for direct Merlin membership.</p>
                            <button
                                onClick={handleCheckMerlin}
                                disabled={loading}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                Run Readiness Check
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className={`p-4 rounded-lg border ${statusReport.status === 'READY' ? 'bg-green-900/10 border-green-900/50' : 'bg-yellow-900/10 border-yellow-900/50'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    {statusReport.status === 'READY' ?
                                        <CheckCircle className="w-5 h-5 text-green-400" /> :
                                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                                    }
                                    <span className={`font-semibold ${statusReport.status === 'READY' ? 'text-green-400' : 'text-yellow-400'}`}>
                                        Status: {statusReport.status}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
                                    <div
                                        className={`h-2 rounded-full ${statusReport.status === 'READY' ? 'bg-green-500' : 'bg-yellow-500'}`}
                                        style={{ width: `${Math.min(statusReport.score, 100)}%` }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                {statusReport.checks.map((check: string, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                                        <CheckCircle className="w-4 h-4 text-gray-500" />
                                        <span>{check}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => setStatusReport(null)}
                                className="w-full mt-4 px-4 py-2 border border-gray-700 hover:bg-gray-800 text-gray-300 rounded-lg text-sm transition-colors"
                            >
                                Run Check Again
                            </button>
                        </div>
                    )}
                </div>

                {/* MLC / Keys Card */}
                <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-900/20 rounded-lg">
                            <Key className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">The MLC Bridge</h3>
                            <p className="text-sm text-gray-400">Mechanical Licensing Collective</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="p-4 bg-gray-900/80 rounded-lg border border-gray-700">
                            <h4 className="text-sm font-medium text-white mb-2">BWARM Generation</h4>
                            <p className="text-xs text-gray-400 mb-4">
                                Generate Bulk Works Registration (BWARM) CSV files compliant with The MLC standards for royalty collection.
                            </p>

                            {bwarmCsv ? (
                                <div className="space-y-3">
                                    <div className="p-3 bg-green-900/20 border border-green-900/30 rounded text-xs font-mono text-green-300 truncate">
                                        CSV Generated ({bwarmCsv.length} bytes)
                                    </div>
                                    <button
                                        onClick={downloadCSV}
                                        className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Download CSV
                                    </button>
                                    <button
                                        onClick={() => setBwarmCsv(null)}
                                        className="w-full px-3 py-2 text-gray-400 hover:text-white text-xs transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleGenerateBWARM}
                                    disabled={loading}
                                    className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                    Generate BWARM CSV
                                </button>
                            )}
                        </div>

                        <div className="pt-4 border-t border-gray-800">
                            <h4 className="text-sm font-medium text-white mb-2">External Connections</h4>
                            <div className="flex gap-2">
                                <button disabled className="flex-1 py-2 bg-gray-800 text-gray-500 rounded border border-gray-700 text-xs cursor-not-allowed">
                                    Connect MLC Account
                                </button>
                                <button disabled className="flex-1 py-2 bg-gray-800 text-gray-500 rounded border border-gray-700 text-xs cursor-not-allowed">
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
