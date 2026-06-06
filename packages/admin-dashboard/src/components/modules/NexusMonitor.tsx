import React, { useEffect, useState, useCallback } from 'react';
import { Activity, Globe, ShieldCheck, RefreshCw } from 'lucide-react';

interface DNSStatus {
  domain: string;
  spf: string;
  dkim: string;
  dmarc: string;
}

interface NexusLog {
  time: string;
  msg: string;
  status: string;
}

const getAdminToken = (): string | null => {
  try {
    return localStorage.getItem('indii_admin_token');
  } catch {
    return null;
  }
};

export const NexusMonitor: React.FC = () => {
  const [dns, setDns] = useState<DNSStatus | null>(null);
  const [logs, setLogs] = useState<NexusLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNexusData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAdminToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Fetch DNS status
      const dnsRes = await fetch('/api/dns/status', { headers });
      if (!dnsRes.ok) throw new Error(`DNS API returned status ${dnsRes.status}`);
      const dnsData = await dnsRes.json();
      setDns(dnsData);

      // Fetch Nexus logs
      const logsRes = await fetch('/api/nexus/logs', { headers });
      if (!logsRes.ok) throw new Error(`Logs API returned status ${logsRes.status}`);
      const logsData = await logsRes.json();
      setLogs(logsData.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query system status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.resolve();
      fetchNexusData();
    };
    init();
  }, [fetchNexusData]);

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex items-center justify-between bg-[#121214] border border-white/5 p-6 rounded-3xl">
        <div>
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="text-blue-400 w-6 h-6" />
            DNS &amp; System Propagation Status
          </h3>
          <p className="text-sm text-white/40 mt-1">Real-time validation of indii.music apex zone records and system events.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchNexusData}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all cursor-pointer text-white/60 hover:text-white"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
          <span className="text-sm font-bold text-green-500">All Systems Nominal</span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-6 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#1A1A1D] border border-white/5 p-6 rounded-2xl h-36" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 bg-red-500/5 border border-red-500/10 rounded-2xl text-red-400 text-sm font-semibold text-center">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {[
            { label: 'SPF Record', val: dns?.spf },
            { label: 'DKIM Keys', val: dns?.dkim },
            { label: 'DMARC Policy', val: dns?.dmarc }
          ].map((record, i) => (
            <div key={i} className="bg-[#1A1A1D] border border-white/5 p-6 rounded-2xl relative overflow-hidden group hover:border-white/10 transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-[40px] pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
              
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                  <ShieldCheck className="w-5 h-5 text-white/60" />
                </div>
                <span className={`px-2 py-1 text-xs font-bold rounded-lg border uppercase tracking-wider ${
                  record.val === 'verified'
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                }`}>
                  {record.val || 'Unverified'}
                </span>
              </div>
              
              <h4 className="text-lg font-bold tracking-tight relative z-10">{record.label}</h4>
              <p className="text-xs text-white/40 mt-2 relative z-10">{dns?.domain || 'indii.music'} zone apex</p>
            </div>
          ))}
        </div>
      )}
      
      <div className="bg-[#121214] border border-white/5 rounded-3xl p-8">
        <h4 className="text-lg font-bold tracking-tight mb-6 flex items-center gap-2">
          <Activity className="text-blue-400 w-5 h-5" />
          Recent DNS &amp; Webhook Events
        </h4>
        
        {loading ? (
          <div className="p-12 flex justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-white/35 text-sm text-center py-6">No recent events recorded.</p>
        ) : (
          <div className="space-y-4">
            {logs.map((log, i) => (
              <div key={i} className="flex items-center gap-6 group p-4 hover:bg-white/5 rounded-2xl transition-colors border border-transparent hover:border-white/5">
                <div className="w-24 text-xs text-white/20 font-mono shrink-0">{log.time}</div>
                <div className="flex-1 text-sm text-white/70 group-hover:text-white transition-colors truncate">{log.msg}</div>
                <div className={`text-xs font-bold shrink-0 ${log.status === 'Success' ? 'text-green-500' : 'text-orange-500'}`}>{log.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

