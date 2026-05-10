import React from 'react';
import { ShieldCheck, HardDrive, Share2, AlertCircle } from 'lucide-react';

export const DDEXTracker: React.FC = () => {
  const deliveries = [
    { releaseId: 'REL-8910', title: 'Neon Nights EP', dst: 'Spotify', status: 'Delivered', time: '10 mins ago', type: 'ERN 4.2' },
    { releaseId: 'REL-8910', title: 'Neon Nights EP', dst: 'Apple Music', status: 'Delivered', time: '10 mins ago', type: 'ERN 4.2' },
    { releaseId: 'REL-8910', title: 'Neon Nights EP', dst: 'TIDAL', status: 'Failed', time: '12 mins ago', type: 'ERN 4.2' },
    { releaseId: 'REL-8909', title: 'Summer Anthem', dst: 'Amazon Music', status: 'Processing', time: '1 hour ago', type: 'ERN 4.1' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-[#121214] border border-white/5 p-6 rounded-3xl">
        <div>
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="text-green-400 w-6 h-6" />
            DDEX Delivery Tracker
          </h3>
          <p className="text-sm text-white/40 mt-1">Monitor XML metadata delivery to DSPs via the indii.music direct pipeline.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Total Delivered</p>
            <p className="text-lg font-bold text-white">142,091</p>
          </div>
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Failure Rate</p>
            <p className="text-lg font-bold text-red-400">0.02%</p>
          </div>
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
          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all">
            Filter by Failed
          </button>
        </div>
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
      </div>
    </div>
  );
};
