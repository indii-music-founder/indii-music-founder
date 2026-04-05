import React from 'react';
import { Brain, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { StatusLight } from './StatusLight';

export function QCQuickPanel() {
    const { releases, loading } = useStore(
        useShallow((s) => ({
            releases: s.distribution.releases,
            loading: s.distribution.loading,
        }))
    );

    if (loading && releases.length === 0) {
        return (
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">QC Status</h3>
                <div className="flex items-center justify-center py-4">
                    <Loader2 size={14} className="text-gray-600 animate-spin" />
                </div>
            </div>
        );
    }

    if (releases.length === 0) {
        return (
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">QC Status</h3>
                <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                    <Brain size={14} className="text-gray-600 mx-auto mb-1.5" />
                    <p className="text-[10px] text-gray-600">No releases to scan</p>
                    <p className="text-[10px] text-gray-700 mt-0.5">Submit a release to run QC</p>
                </div>
            </div>
        );
    }

    // Derive QC status from release deployment states
    const failedReleases = releases.filter((r) =>
        Object.values(r.deployments ?? {}).some((d) => d.status === 'failed' || d.status === 'rejected')
    );
    const pendingReleases = releases.filter((r) =>
        Object.values(r.deployments ?? {}).some((d) => d.status === 'validating' || d.status === 'in_review')
    );

    const allClear = failedReleases.length === 0 && pendingReleases.length === 0;
    const hasFailed = failedReleases.length > 0;

    const audioOk = !hasFailed;
    const metaOk = !hasFailed;
    const artOk = !hasFailed;

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">QC Status</h3>
            <div className={`p-3 rounded-lg ${hasFailed ? 'bg-red-500/5 border border-red-500/10' : allClear ? 'bg-green-500/5 border border-green-500/10' : 'bg-yellow-500/5 border border-yellow-500/10'}`}>
                <div className="flex items-center gap-2 mb-1">
                    {hasFailed
                        ? <AlertTriangle size={14} className="text-red-400" />
                        : allClear
                            ? <CheckCircle size={14} className="text-green-400" />
                            : <Brain size={14} className="text-yellow-400" />}
                    <span className={`text-xs font-bold ${hasFailed ? 'text-red-400' : allClear ? 'text-green-400' : 'text-yellow-400'}`}>
                        {hasFailed
                            ? `${failedReleases.length} Failed`
                            : allClear
                                ? 'All Clear'
                                : `${pendingReleases.length} In Review`}
                    </span>
                </div>
                <p className="text-[10px] text-gray-500">
                    {hasFailed
                        ? 'Check failed releases in Releases tab'
                        : allClear
                            ? `${releases.length} release${releases.length === 1 ? '' : 's'} healthy`
                            : 'Scan in progress'}
                </p>
                <div className="flex gap-2 mt-2">
                    <StatusLight label="Audio" ok={audioOk} />
                    <StatusLight label="Meta" ok={metaOk} />
                    <StatusLight label="Art" ok={artOk} />
                </div>
            </div>
        </div>
    );
}
