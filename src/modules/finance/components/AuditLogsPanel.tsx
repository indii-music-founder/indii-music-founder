import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Shield, Download, Radio, Filter, ChevronDown } from 'lucide-react';

/* ================================================================== */
/*  Item 158 — Audit Logs GUI                                          */
/* ================================================================== */

type LogStatus = 'success' | 'failure';

interface LogEntry {
    id: number;
    timestamp: string;
    user: string;
    agent: string;
    action: string;
    resource: string;
    status: LogStatus;
}

const MOCK_LOGS: LogEntry[] = [
    { id: 1, timestamp: '2026-03-07 09:41:02', user: 'system', agent: 'DistributionAgent', action: 'DDEX_UPLOAD', resource: 'release/midnight-circuit-v2', status: 'success' },
    { id: 2, timestamp: '2026-03-07 09:38:45', user: 'the.walking.agency.det@gmail.com', agent: 'none', action: 'LOGIN', resource: 'auth/session', status: 'success' },
    { id: 3, timestamp: '2026-03-07 09:35:12', user: 'system', agent: 'FinanceAgent', action: 'ROYALTY_CALC', resource: 'finance/payout-march', status: 'success' },
    { id: 4, timestamp: '2026-03-07 09:30:04', user: 'system', agent: 'DistributionAgent', action: 'SFTP_PUSH', resource: 'distributor/TuneCore', status: 'failure' },
    { id: 5, timestamp: '2026-03-07 09:28:33', user: 'the.walking.agency.det@gmail.com', agent: 'none', action: 'FILE_UPLOAD', resource: 'storage/audio/glass-waves.wav', status: 'success' },
    { id: 6, timestamp: '2026-03-07 09:22:18', user: 'system', agent: 'LicensingAgent', action: 'SYNC_LICENSE_CHECK', resource: 'license/track-3942', status: 'success' },
    { id: 7, timestamp: '2026-03-07 09:18:07', user: 'system', agent: 'PublicistAgent', action: 'PRESS_RELEASE_SEND', resource: 'marketing/pr-midnight-circuit', status: 'success' },
    { id: 8, timestamp: '2026-03-07 09:15:44', user: 'system', agent: 'FinanceAgent', action: 'STRIPE_PAYOUT_INIT', resource: 'payment/payout-4421', status: 'failure' },
    { id: 9, timestamp: '2026-03-07 09:10:22', user: 'the.walking.agency.det@gmail.com', agent: 'none', action: 'RELEASE_CREATE', resource: 'distribution/release/GlassWaves-EP', status: 'success' },
    { id: 10, timestamp: '2026-03-07 09:05:55', user: 'system', agent: 'SocialAgent', action: 'INSTAGRAM_POST', resource: 'social/post-82937', status: 'success' },
    { id: 11, timestamp: '2026-03-06 23:59:01', user: 'system', agent: 'DistributionAgent', action: 'ISRC_ASSIGN', resource: 'release/neon-drift', status: 'success' },
    { id: 12, timestamp: '2026-03-06 22:44:30', user: 'system', agent: 'FinanceAgent', action: 'TAX_FORM_REQUEST', resource: 'tax/w8ben-sofia-almeida', status: 'success' },
    { id: 13, timestamp: '2026-03-06 21:33:15', user: 'system', agent: 'AudioAgent', action: 'FIDELITY_AUDIT', resource: 'audio/midnight-circuit-master.wav', status: 'success' },
    { id: 14, timestamp: '2026-03-06 20:22:08', user: 'the.walking.agency.det@gmail.com', agent: 'none', action: 'CONTRACT_SIGN', resource: 'legal/contract-8821', status: 'success' },
    { id: 15, timestamp: '2026-03-06 19:11:40', user: 'system', agent: 'MarketingAgent', action: 'CAMPAIGN_LAUNCH', resource: 'marketing/campaign-spring2026', status: 'failure' },
    { id: 16, timestamp: '2026-03-06 18:00:22', user: 'system', agent: 'LicensingAgent', action: 'SYNC_PITCH', resource: 'licensing/pitch-4492', status: 'success' },
    { id: 17, timestamp: '2026-03-06 17:45:11', user: 'system', agent: 'VideoAgent', action: 'VEO_RENDER', resource: 'video/visualizer-midnight', status: 'success' },
    { id: 18, timestamp: '2026-03-06 16:30:05', user: 'the.walking.agency.det@gmail.com', agent: 'none', action: 'EXPORT_CSV', resource: 'finance/ledger-export', status: 'success' },
    { id: 19, timestamp: '2026-03-06 15:20:49', user: 'system', agent: 'DistributionAgent', action: 'DDEX_VALIDATE', resource: 'release/glass-waves-ep', status: 'failure' },
    { id: 20, timestamp: '2026-03-06 14:10:33', user: 'system', agent: 'PublicistAgent', action: 'MEDIA_LIST_UPDATE', resource: 'contacts/press-list-march', status: 'success' },
];

const ACTION_TYPES = ['ALL', ...Array.from(new Set(MOCK_LOGS.map((l) => l.action)))];
const AGENT_NAMES = ['ALL', ...Array.from(new Set(MOCK_LOGS.map((l) => l.agent)))];

export function AuditLogsPanel() {
    const [isLive, setIsLive] = useState(false);
    const [dateFilter, setDateFilter] = useState('ALL');
    const [agentFilter, setAgentFilter] = useState('ALL');
    const [actionFilter, setActionFilter] = useState('ALL');

    const filteredLogs = useMemo(() => {
        return MOCK_LOGS.filter((log) => {
            if (agentFilter !== 'ALL' && log.agent !== agentFilter) return false;
            if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
            if (dateFilter === '2026-03-07' && !log.timestamp.startsWith('2026-03-07')) return false;
            if (dateFilter === '2026-03-06' && !log.timestamp.startsWith('2026-03-06')) return false;
            return true;
        });
    }, [agentFilter, actionFilter, dateFilter]);

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
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                            isLive
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] font-bold transition-colors"
                    >
                        <Download size={10} />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <Filter size={11} className="text-gray-500 flex-shrink-0" />

                {/* Date Filter */}
                <div className="relative">
                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                    >
                        <option value="ALL">All Dates</option>
                        <option value="2026-03-07">Mar 7</option>
                        <option value="2026-03-06">Mar 6</option>
                    </select>
                    <ChevronDown size={9} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>

                {/* Agent Filter */}
                <div className="relative">
                    <select
                        value={agentFilter}
                        onChange={(e) => setAgentFilter(e.target.value)}
                        className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                    >
                        {AGENT_NAMES.map((a) => (
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
                        {ACTION_TYPES.map((a) => (
                            <option key={a} value={a}>{a === 'ALL' ? 'All Actions' : a}</option>
                        ))}
                    </select>
                    <ChevronDown size={9} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
            </div>

            {/* Table */}
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
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                        log.status === 'success'
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
