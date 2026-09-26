import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
    ErrorReportTriageService,
    type ErrorReportRecord,
    type ErrorReportStatus,
} from '@/services/security/ErrorReportTriageService';

/**
 * Founder-only triage surface for agent error reports (ISSUE-1446).
 * Reads and status transitions travel through the founder-gated Admin SDK
 * callables (listErrorReports / updateErrorReportStatus) — this panel holds
 * no data-access logic of its own and renders exactly what the server
 * returns, including real failures.
 */

const STATUS_FILTERS: Array<'all' | ErrorReportStatus> = ['all', 'open', 'acknowledged', 'resolved'];

function statusTone(status: ErrorReportStatus | undefined): string {
    switch (status) {
        case 'open':
            return 'bg-red-500/10 text-red-300 border-red-500/20';
        case 'acknowledged':
            return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
        case 'resolved':
            return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        default:
            return 'bg-slate-700/50 text-slate-400 border-white/10';
    }
}

export const ErrorReportsPanel: React.FC = () => {
    const [reports, setReports] = useState<ErrorReportRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | ErrorReportStatus>('all');
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async (statusFilter: 'all' | ErrorReportStatus) => {
        setLoading(true);
        setError(null);
        try {
            const rows = await ErrorReportTriageService.list(
                statusFilter === 'all' ? undefined : statusFilter,
            );
            setReports(rows);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load error reports.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(filter);
    }, [load, filter]);

    const transition = useCallback(async (report: ErrorReportRecord, status: ErrorReportStatus) => {
        setBusyId(report.id);
        try {
            await ErrorReportTriageService.setStatus(report.id, status);
            setReports(prev => prev.map(r => (r.id === report.id ? { ...r, status } : r)));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Status update failed.');
        } finally {
            setBusyId(null);
        }
    }, []);

    return (
        <div className="p-5 rounded-xl border border-white/5 bg-white/1">
            <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                    <h3 className="text-sm font-black uppercase text-white mb-1">Agent Error Reports</h3>
                    <p className="text-xs text-gray-400 max-w-xl">
                        Subscriber-filed failure reports with fix-team technical detail. Founder-only; served by the
                        founder-gated listErrorReports callable.
                    </p>
                </div>
                <button
                    onClick={() => void load(filter)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-bold text-gray-300 hover:text-white hover:border-white/20 disabled:opacity-50"
                >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            <div className="flex gap-2 mb-4">
                {STATUS_FILTERS.map(s => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`px-2.5 py-1 rounded border text-[10px] font-black uppercase tracking-wider ${
                            filter === s
                                ? 'border-white/25 text-white bg-white/5'
                                : 'border-white/10 text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {error && (
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-300 mb-4">
                    {error}
                </div>
            )}

            {loading && reports.length === 0 && (
                <div className="h-24 flex items-center justify-center text-xs text-slate-500">Loading reports…</div>
            )}

            {!loading && !error && reports.length === 0 && (
                <div className="h-24 flex items-center justify-center text-xs text-slate-500 border border-dashed border-white/10 rounded-lg">
                    No error reports filed yet.
                </div>
            )}

            <div className="space-y-3">
                {reports.map(report => (
                    <div key={report.id} className="p-3.5 rounded-lg border border-white/5 bg-black/40">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                        className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider ${
                                            statusTone(report.status as ErrorReportStatus)
                                        }`}
                                    >
                                        {report.status ?? 'unknown'}
                                    </span>
                                    <span className="text-[10px] font-mono text-gray-500">{report.reportId ?? report.id}</span>
                                    {report.agentId && (
                                        <span className="text-[10px] text-gray-500 font-mono">agent: {report.agentId}</span>
                                    )}
                                    {report.surface && (
                                        <span className="text-[10px] text-gray-500 font-mono">surface: {report.surface}</span>
                                    )}
                                </div>
                                <p className="text-xs font-bold text-gray-200 mt-2">{report.summary ?? '(no summary)'}</p>
                            </div>
                            <div className="flex flex-col gap-1.5 shrink-0">
                                {report.status !== 'acknowledged' && report.status !== 'resolved' && (
                                    <button
                                        onClick={() => void transition(report, 'acknowledged')}
                                        disabled={busyId === report.id}
                                        className="px-2.5 py-1 rounded border border-amber-500/30 text-[10px] font-black uppercase text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                                    >
                                        Acknowledge
                                    </button>
                                )}
                                {report.status !== 'resolved' && (
                                    <button
                                        onClick={() => void transition(report, 'resolved')}
                                        disabled={busyId === report.id}
                                        className="px-2.5 py-1 rounded border border-emerald-500/30 text-[10px] font-black uppercase text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                                    >
                                        Resolve
                                    </button>
                                )}
                            </div>
                        </div>
                        {report.detail && (
                            <details className="mt-2.5">
                                <summary className="text-[10px] font-black uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-300">
                                    Technical detail (fix team)
                                </summary>
                                <pre className="mt-2 p-2.5 rounded bg-black/50 border border-white/5 text-[10px] font-mono text-gray-400 whitespace-pre-wrap break-all max-h-40 overflow-y-auto custom-scrollbar">
                                    {report.detail}
                                </pre>
                            </details>
                        )}
                        <div className="mt-2 flex gap-4 text-[10px] text-gray-600 font-mono">
                            {report.createdAt && <span>filed {new Date(report.createdAt).toLocaleString()}</span>}
                            {report.reviewedAt && <span>reviewed {new Date(report.reviewedAt).toLocaleString()}</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
