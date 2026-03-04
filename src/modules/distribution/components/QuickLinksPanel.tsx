import React from 'react';
import { Link2, Zap, Key } from 'lucide-react';

export function QuickLinksPanel() {
    const links = [
        { label: 'Connect Distributor', icon: Link2 },
        { label: 'Test Delivery', icon: Zap },
        { label: 'View API Keys', icon: Key },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Quick Actions</h3>
            <div className="space-y-1.5">
                {links.map((l) => (
                    <button key={l.label} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-dept-publishing/20 transition-all text-xs text-gray-300 hover:text-white">
                        <l.icon size={13} className="text-dept-publishing" />
                        {l.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
