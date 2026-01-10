import React from 'react';
import { Train, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/core/store';

export default function TripStarter() {
    const { setModule } = useStore();

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
                onClick={() => setModule('road')}
                className="group relative overflow-hidden bg-[#090b0e] border border-white/5 hover:border-yellow-500/50 rounded-lg p-6 transition-all duration-300 text-left"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-md bg-yellow-500/10 flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform flex-shrink-0 ring-1 ring-yellow-500/20">
                        <Train size={28} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-yellow-400 transition-colors font-display tracking-tight">Transit</h3>
                        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Launch Route</p>
                    </div>
                </div>
            </button>

            <button
                onClick={() => setModule('road')}
                className="group relative overflow-hidden bg-[#090b0e] border border-white/5 hover:border-blue-500/50 rounded-lg p-6 transition-all duration-300 text-left"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform flex-shrink-0 ring-1 ring-blue-500/20">
                        <MapPin size={28} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors font-display tracking-tight">Location</h3>
                        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Check Logistics</p>
                    </div>
                </div>
            </button>
        </div>
    );
}
