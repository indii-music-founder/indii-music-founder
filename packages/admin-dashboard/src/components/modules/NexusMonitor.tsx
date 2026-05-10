import React, { useEffect, useState } from 'react';
import { Activity, Globe, ShieldCheck } from 'lucide-react';

export const NexusMonitor: React.FC = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, we would fetch this from our Express backend
    // fetch('/api/dns/status', { headers: { Authorization: `Bearer ${token}` } })
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-[#121214] border border-white/5 p-6 rounded-3xl">
        <div>
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="text-blue-400 w-6 h-6" />
            DNS Propagation Status
          </h3>
          <p className="text-sm text-white/40 mt-1">Real-time monitoring of indii.music records.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
          <span className="text-sm font-bold text-green-500">All Systems Nominal</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {['SPF Record', 'DKIM Keys', 'DMARC Policy'].map((record, i) => (
          <div key={i} className="bg-[#1A1A1D] border border-white/5 p-6 rounded-2xl relative overflow-hidden group hover:border-white/10 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-[40px] pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
            
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                <ShieldCheck className="w-5 h-5 text-white/60" />
              </div>
              {loading ? (
                <div className="h-6 w-16 bg-white/10 rounded animate-pulse" />
              ) : (
                <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs font-bold rounded-lg border border-green-500/20">
                  Verified
                </span>
              )}
            </div>
            
            <h4 className="text-lg font-bold tracking-tight relative z-10">{record}</h4>
            <p className="text-xs text-white/40 mt-2 relative z-10">indii.music zone apex</p>
          </div>
        ))}
      </div>
      
      <div className="bg-[#121214] border border-white/5 rounded-3xl p-8">
        <h4 className="text-lg font-bold tracking-tight mb-6 flex items-center gap-2">
          <Activity className="text-blue-400 w-5 h-5" />
          Recent DNS Events
        </h4>
        <div className="space-y-4">
          {[
            { time: '10 mins ago', msg: 'TXT record verified for indii.music propagation check.', status: 'Success' },
            { time: '2 hours ago', msg: 'MX records updated to Google Workspace aliases.', status: 'Pending' },
            { time: '5 hours ago', msg: 'DMARC quarantine policy applied.', status: 'Success' },
          ].map((log, i) => (
            <div key={i} className="flex items-center gap-6 group p-4 hover:bg-white/5 rounded-2xl transition-colors border border-transparent hover:border-white/5">
              <div className="w-24 text-xs text-white/20 font-mono">{log.time}</div>
              <div className="flex-1 text-sm text-white/70 group-hover:text-white transition-colors">{log.msg}</div>
              <div className={`text-xs font-bold ${log.status === 'Success' ? 'text-green-500' : 'text-orange-500'}`}>{log.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
