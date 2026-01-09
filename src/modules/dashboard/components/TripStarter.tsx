import React from 'react';
import { Train, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TripStarter() {
    const navigate = useNavigate();

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
                onClick={() => navigate('/touring')}
                className="group relative overflow-hidden bg-[#161b22]/80 backdrop-blur-md border border-white/5 hover:border-yellow-500/50 rounded-xl p-4 transition-all duration-300 text-left"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform flex-shrink-0">
                        <Train size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-0.5 group-hover:text-yellow-400 transition-colors">Transit</h3>
                        <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Launch Route</p>
                    </div>
                </div>
            </button>

            <button
                onClick={() => navigate('/touring')}
                className="group relative overflow-hidden bg-[#161b22]/80 backdrop-blur-md border border-white/5 hover:border-blue-500/50 rounded-xl p-4 transition-all duration-300 text-left"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform flex-shrink-0">
                        <MapPin size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-0.5 group-hover:text-blue-400 transition-colors">Location</h3>
                        <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Check Logistics</p>
                    </div>
                </div>
            </button>
        </div>
    );
}
