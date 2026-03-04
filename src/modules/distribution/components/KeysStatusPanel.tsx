import React from 'react';
import { Key } from 'lucide-react';

export function KeysStatusPanel() {
    const keys = [
        { label: 'Spotify API', status: 'Valid', exp: '180 days' },
        { label: 'Apple API', status: 'Valid', exp: '90 days' },
        { label: 'DDEX Cert', status: 'Expiring', exp: '15 days' },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Keys & Certs</h3>
            <div className="space-y-2">
                {keys.map((k) => (
                    <div key={k.label} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.02]">
                        <Key size={12} className={k.status === 'Expiring' ? 'text-amber-400' : 'text-green-400'} />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate">{k.label}</p>
                            <p className="text-[10px] text-gray-600">Expires in {k.exp}</p>
                        </div>
                        <span className={`text-[10px] font-bold ${k.status === 'Expiring' ? 'text-amber-400' : 'text-green-400'}`}>
                            {k.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
