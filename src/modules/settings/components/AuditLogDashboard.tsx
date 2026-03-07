import React, { useState } from 'react';
import { ShieldAlert, Database, FileText, ArrowRight } from 'lucide-react';

export const AuditLogDashboard: React.FC = () => {
    // Mock Audit Logs GUI (Item 158)
    const [logs] = useState([
        { id: '1', timestamp: new Date(Date.now() - 500000).toISOString(), agent: 'Finance Agent', action: 'Initiate Escrow', resource: 'Track: Neon Nights', status: 'Success' },
        { id: '2', timestamp: new Date(Date.now() - 3600000).toISOString(), agent: 'System', action: 'API Sync', resource: 'Spotify API', status: 'Success' },
        { id: '3', timestamp: new Date(Date.now() - 86400000).toISOString(), agent: 'Legal Agent', action: 'Generate Contract', resource: 'Split Sheet: Midnight Drive', status: 'Success' },
        { id: '4', timestamp: new Date(Date.now() - 172800000).toISOString(), agent: 'User (You)', action: 'Update Permissions', resource: 'Project: Alpha', status: 'Success' },
    ]);

    return (
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 text-gray-200">
            <div className="flex items-center gap-3 mb-6">
                <ShieldAlert className="text-purple-400" size={24} />
                <h2 className="text-xl font-bold font-mono">System Audit Logs</h2>
                <span className="px-2 py-0.5 ml-auto text-xs bg-purple-900/30 text-purple-400 border border-purple-500/30 rounded">Immutable View</span>
            </div>

            <p className="text-sm text-gray-400 mb-6">
                Non-repudiable audit trails of all agent commands, API actions, and system events.
            </p>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-gray-800 text-gray-500">
                            <th className="pb-3 font-medium">Timestamp</th>
                            <th className="pb-3 font-medium">Actor / Agent</th>
                            <th className="pb-3 font-medium">Action</th>
                            <th className="pb-3 font-medium">Resource</th>
                            <th className="pb-3 font-medium text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log, idx) => (
                            <tr key={log.id} className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${idx % 2 === 0 ? 'bg-gray-900/50' : ''}`}>
                                <td className="py-3 font-mono text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="py-3 font-medium text-purple-300">{log.agent}</td>
                                <td className="py-3">{log.action}</td>
                                <td className="py-3 text-gray-400">{log.resource}</td>
                                <td className="py-3 text-right text-green-400">{log.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex justify-end">
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium rounded-lg border border-gray-700 transition-colors">
                    <Database size={16} /> Export CSV
                </button>
            </div>
        </div>
    );
};
