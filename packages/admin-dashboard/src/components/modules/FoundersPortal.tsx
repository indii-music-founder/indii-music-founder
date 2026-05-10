import React from 'react';
import { Users, Crown, Key, Clock } from 'lucide-react';

export const FoundersPortal: React.FC = () => {
  const users = [
    { name: 'Alice Cooper', email: 'alice@example.com', tier: 'Alpha Founder', status: 'Active', joined: 'Oct 2025' },
    { name: 'Bob Dylan', email: 'bob@example.com', tier: 'Beta Tester', status: 'Invited', joined: 'Pending' },
    { name: 'Charlie Puth', email: 'charlie@example.com', tier: 'Standard', status: 'Active', joined: 'Jan 2026' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-[#121214] border border-white/5 p-6 rounded-3xl">
        <div>
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="text-orange-400 w-6 h-6" />
            Founders Portal CRM
          </h3>
          <p className="text-sm text-white/40 mt-1">Manage early access, alpha keys, and founder tier users.</p>
        </div>
        <button className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
          <Key className="w-4 h-4" />
          Generate Invite Key
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-[#1A1A1D] border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Crown className="w-5 h-5 text-orange-400" />
            <h4 className="font-bold text-white/70">Alpha Founders</h4>
          </div>
          <p className="text-3xl font-bold text-white">124</p>
          <p className="text-xs text-white/40 mt-1">Capacity: 500</p>
        </div>
        <div className="bg-[#1A1A1D] border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-blue-400" />
            <h4 className="font-bold text-white/70">Beta Waitlist</h4>
          </div>
          <p className="text-3xl font-bold text-white">8,402</p>
          <p className="text-xs text-white/40 mt-1">Growing 12% MoM</p>
        </div>
        <div className="bg-[#1A1A1D] border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Key className="w-5 h-5 text-green-400" />
            <h4 className="font-bold text-white/70">Active Keys</h4>
          </div>
          <p className="text-3xl font-bold text-white">45</p>
          <p className="text-xs text-white/40 mt-1">Unredeemed invites</p>
        </div>
      </div>

      <div className="bg-[#121214] border border-white/5 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h4 className="text-lg font-bold tracking-tight">Recent Users</h4>
          <input 
            type="text" 
            placeholder="Search email..." 
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-orange-500/50 transition-colors"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Name</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Email</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Tier</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Status</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-semibold text-sm text-white/90">
                    {user.name}
                  </td>
                  <td className="px-6 py-4 text-white/50 text-sm">
                    {user.email}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 bg-white/5 rounded text-[10px] font-bold border border-white/5 ${user.tier.includes('Alpha') ? 'text-orange-400 border-orange-500/20 bg-orange-500/10' : 'text-white/40'}`}>
                      {user.tier}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold ${user.status === 'Active' ? 'text-green-500' : 'text-yellow-500'}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-white/40 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {user.joined}
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
