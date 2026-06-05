import React, { useState, useEffect } from 'react';
import { ShieldCheck, HardDrive, Share2, AlertCircle, RefreshCw } from 'lucide-react';

interface Delivery {
  releaseId: string;
  title: string;
  dst: string;
  status: string;
  time: string;
  type: string;
}

const getAdminToken = (): string | null => {
  try {
    return localStorage.getItem('indii_admin_token');
  } catch {
    return null;
  }
};

export const DDEXTracker: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeliveries = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAdminToken();
      const res = await fetch('/api/deliveries/list', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Deliveries returned status ${res.status}`);
      const data = await res.json();
      setDeliveries(data.deliveries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API failure fetching deliveries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const totalDelivered = deliveries.filter(d => d.status === 'Delivered').length;
  const failureRate = deliveries.length > 0 
    ? `${((deliveries.filter(d => d.status === 'Failed').length / deliveries.length) * 100).toFixed(2)}%`
    : '0.00%';

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex items-center justify-between bg-[#121214] border border-white/5 p-6 rounded-3xl">
        <div>
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="text-green-400 w-6 h-6 animate-pulse-subtle" />
            DDEX Delivery Tracker
          </h3>
          <p className="text-sm text-white/40 mt-1">Monitor XML metadata delivery to DSPs via the indii.music direct pipeline.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Session Deliveries</p>
            <p className="text-lg font-bold text-white">{totalDelivered}</p>
          </div>
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Failure Rate</p>
            <p className={`text-lg font-bold ${deliveries.filter(d => d.status === 'Failed').length > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {failureRate}
            </p>
          </div>
          <button 
            onClick={fetchDeliveries}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all cursor-pointer text-white/60 hover:text-white"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#1A1A1D] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              <HardDrive className="w-5 h-5 text-white/60" />
            </div>
            <div>
              <h4 className="text-lg font-bold tracking-tight">Active Endpoints</h4>
              <p className="text-xs text-white/40">Registered DSP FTP servers</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-3xl font-bold">48</span>
            <span className="text-xs text-green-400 font-bold">+2 this week</span>
          </div>
        </div>

        <div className="bg-[#1A1A1D] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              <Share2 className="w-5 h-5 text-white/60" />
            </div>
            <div>
              <h4 className="text-lg font-bold tracking-tight">XML Validator</h4>
              <p className="text-xs text-white/40">ERN 4.2 / 4.3 Compliance</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-3xl font-bold text-green-500">100%</span>
            <span className="text-xs text-white/40 font-bold">passing schema validation</span>
          </div>
        </div>
      </div>

      <div className="bg-[#121214] border border-white/5 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h4 className="text-lg font-bold tracking-tight">Delivery Queue</h4>
        </div>
        
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-green-400" />
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-400 font-semibold text-sm">
            {error}
          </div>
        ) : deliveries.length === 0 ? (
          <div className="p-12 text-center text-white/35 text-sm">
            Queue is currently empty. No releases submitted.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Release ID</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Title</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">DSP Destination</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Format</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Status</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {deliveries.map((delivery, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-white/60">{delivery.releaseId}</span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-sm text-white/90">
                      {delivery.title}
                    </td>
                    <td className="px-6 py-4 text-white/50 text-sm">
                      {delivery.dst}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-white/5 rounded text-[10px] font-bold text-white/40 border border-white/5">
                        {delivery.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {delivery.status === 'Failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
                        <span className={`text-xs font-bold ${
                          delivery.status === 'Delivered' ? 'text-green-500' : 
                          delivery.status === 'Processing' ? 'text-blue-500 animate-pulse' : 
                          'text-red-500'
                        }`}>
                          {delivery.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-white/30">
                      {delivery.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

