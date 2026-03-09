import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, Download, Radio, Filter, ChevronDown, Loader2, InboxIcon } from 'lucide-react';
import { db, auth } from '@/services/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { logger } from '@/utils/logger';

/* ================================================================== */
/*  Item 158 — Audit Logs GUI                                          */
/*  Data sourced from Firestore 'audit_logs' collection — zero mocks.  */
/* ================================================================== */

type LogStatus = 'success' | 'failure';

interface LogEntry {
    id: string;
    timestamp: string;
    user: string;
    agent: string;
    action: string;
    resource: string;
    status: LogStatus;
}

export function AuditLogsPanel() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(!!auth.currentUser);
    const [isLive, setIsLive] = useState(false);
    const [agentFilter, setAgentFilter] = useState('ALL');
    const [actionFilter, setActionFilter] = useState('ALL');

    // Subscribe to audit_logs collection from Firestore
    useEffect(() => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const q = query(
            collection(db, 'audit_logs'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc'),
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const entries: LogEntry[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    timestamp: data.timestamp instanceof Timestamp
                        ? data.timestamp.toDate().toISOString().replace('T', ' ').slice(0, 19)
                        : data.timestamp || '',
                    user: data.user || 'system',
                    agent: data.agent || 'none',
                    action: data.action || '',
                    resource: data.resource || '',
                    status: data.status === 'failure' ? 'failure' : 'success',
                };
            });
            setLogs(entries);
            setLoading(false);
        }, (error) => {
            logger.error('[AuditLogsPanel] Subscription error:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Derive filter options from loaded data
    const actionTypes = useMemo(() => {
        return ['ALL', ...Array.from(new Set(logs.map(l => l.action)))];
    }, [logs]);

    const agentNames = useMemo(() => {
        return ['ALL', ...Array.from(new Set(logs.map(l => l.agent)))];
    }, [logs]);

    const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
            if (agentFilter !== 'ALL' && log.agent !== agentFilter) return false;
            if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
            return true;
        });
    }, [logs, agentFilter, actionFilter]);

    function handleExportCSV() {
        const headers = ['Timestamp', 'User', 'Agent', 'Action', 'Resource', 'Status'];
        const rows = filteredLogs.map((l) =>
            [l.timestamp, l.user, l.agent, l.action, l.resource, l.status].join(',')
        );
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                        <Shield size={14} className="text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white">Audit Logs</h2>
                        <p className="text-[10px] text-gray-500">{filteredLogs.length} entries</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Live Toggle */}
                    <button
                        onClick={() => setIsLive((v) => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${isLive
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        <Radio size={10} className={isLive ? 'animate-pulse' : ''} />
                        {isLive ? 'Live' : 'Live Off'}
                    </button>
                    {/* Export */}
                    <button
                        onClick={handleExportCSV}
                        disabled={filteredLogs.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] font-bold transition-colors disabled:opacity-50"
                    >
                        <Download size={10} />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <Filter size={11} className="text-gray-500 flex-shrink-0" />

                {/* Agent Filter */}
                <div className="relative">
                    <select
                        value={agentFilter}
                        onChange={(e) => setAgentFilter(e.target.value)}
                        className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                    >
                        {agentNames.map((a) => (
                            <option key={a} value={a}>{a === 'ALL' ? 'All Agents' : a}</option>
                        ))}
                    </select>
                    <ChevronDown size={9} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>

                {/* Action Filter */}
                <div className="relative">
                    <select
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                    >
                        {actionTypes.map((a) => (
                            <option key={a} value={a}>{a === 'ALL' ? 'All Actions' : a}</option>
                        ))}
                    </select>
                    <ChevronDown size={9} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
            </div>

            {/* Loading / Empty / Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-gray-500" />
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <InboxIcon size={32} className="text-gray-700 mb-3" />
                    <p className="text-sm font-bold text-gray-500">No Audit Logs</p>
                    <p className="text-[10px] text-gray-600 mt-1">System events and agent actions will appear here as they occur.</p>
                </div>
            ) : (
                <div className="rounded-xl border border-white/5 overflow-hidden overflow-x-auto">
                    <table className="w-full text-xs min-w-[700px]">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Timestamp</th>
                                <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">User</th>
                                <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Agent</th>
                                <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Action</th>
                                <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Resource</th>
                                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map((log, i) => (
                                <motion.tr
                                    key={log.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                                >
                                    <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{log.timestamp}</td>
                                    <td className="px-3 py-2 text-gray-400 max-w-[120px] truncate">
                                        {log.user === 'system' ? (
                                            <span className="text-purple-400">system</span>
                                        ) : (
                                            <span className="truncate" title={log.user}>
                                                {log.user.split('@')[0]}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        {log.agent !== 'none' ? (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400">
                                                {log.agent}
                                            </span>
                                        ) : (
                                            <span className="text-gray-600">—</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-cyan-400 text-[10px]">{log.action}</td>
                                    <td className="px-3 py-2 text-gray-400 max-w-[180px] truncate font-mono text-[10px]" title={log.resource}>
                                        {log.resource}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${log.status === 'success'
                                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                            }`}>
                                            {log.status}
                                        </span>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Live mode indicator */}
            {isLive && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-[10px] text-red-400"
                >
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Real-time mode active — new events will appear here
                </motion.div>
            )}
        </div>
    );
}
