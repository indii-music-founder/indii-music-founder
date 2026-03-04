import React from 'react';
import { Shield, Activity, Send } from 'lucide-react';

export function AuthorityInfoPanel() {
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Authority</h3>
            <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <Shield size={12} className="text-blue-400" />
                        <span className="text-xs text-gray-300">Account Tier</span>
                    </div>
                    <span className="text-xs font-bold text-white">Professional</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <Activity size={12} className="text-purple-400" />
                        <span className="text-xs text-gray-300">API Calls</span>
                    </div>
                    <span className="text-xs font-bold text-white">2.4k / 10k</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <Send size={12} className="text-emerald-400" />
                        <span className="text-xs text-gray-300">Deliveries</span>
                    </div>
                    <span className="text-xs font-bold text-white">48 / Unlimited</span>
                </div>
            </div>
        </div>
    );
}
