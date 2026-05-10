import React from 'react';
import { Mail, Plus, Trash2, Edit2, ShieldAlert } from 'lucide-react';

export const EmailManager: React.FC = () => {
  const aliases = [
    { email: 'admin@indii.music', destination: 'the.walking.agency.det@gmail.com', status: 'Active', type: 'Core' },
    { email: 'support@indii.music', destination: 'the.walking.agency.det@gmail.com', status: 'Active', type: 'Core' },
    { email: 'info@indii.music', destination: 'the.walking.agency.det@gmail.com', status: 'Pending DNS', type: 'Routing' },
    { email: 'agent@indii.music', destination: 'Webhook (server.ts)', status: 'Active', type: 'System' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-[#121214] border border-white/5 p-6 rounded-3xl">
        <div>
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="text-purple-400 w-6 h-6" />
            Workspace Email Manager
          </h3>
          <p className="text-sm text-white/40 mt-1">Manage indii.music routing rules and aliases.</p>
        </div>
        <button className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
          <Plus className="w-4 h-4" />
          New Alias
        </button>
      </div>

      <div className="bg-[#121214] border border-white/5 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Alias</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Destination</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Type</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Status</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {aliases.map((alias, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-white/90">{alias.email}</span>
                  </td>
                  <td className="px-6 py-4 text-white/50 text-sm">
                    {alias.destination}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-white/5 rounded text-[10px] font-bold text-white/40 border border-white/5">
                      {alias.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${alias.status === 'Active' ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`} />
                      <span className={`text-xs font-bold ${alias.status === 'Active' ? 'text-green-500' : 'text-orange-500'}`}>
                        {alias.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 hover:bg-red-500/20 rounded-lg text-white/40 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-6 flex items-start gap-4">
        <ShieldAlert className="w-6 h-6 text-orange-400 shrink-0" />
        <div>
          <h4 className="text-sm font-bold text-orange-400 mb-1">DNS Propagation Warning</h4>
          <p className="text-sm text-orange-400/80">
            Google Workspace MX records are still propagating globally. Email routing may experience up to 48 hours of intermittent delays. Wait for propagation to complete before relying on these aliases for production critical flows.
          </p>
        </div>
      </div>
    </div>
  );
};
