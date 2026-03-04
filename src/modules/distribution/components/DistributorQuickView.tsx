import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export function DistributorQuickView() {
    const distributors = [
        { name: 'Spotify', connected: true },
        { name: 'Apple Music', connected: true },
        { name: 'Amazon', connected: true },
        { name: 'YouTube Music', connected: false },
        { name: 'Tidal', connected: false },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Distributors</h3>
            <div className="space-y-1.5">
                {distributors.map((d) => (
                    <div key={d.name} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${d.connected ? 'bg-green-500/10' : 'bg-gray-800'}`}>
                            {d.connected ? <Wifi size={11} className="text-green-400" /> : <WifiOff size={11} className="text-gray-600" />}
                        </div>
                        <span className="text-xs text-gray-300 flex-1">{d.name}</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${d.connected ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]' : 'bg-gray-700'}`} />
                    </div>
                ))}
            </div>
        </div>
    );
}
