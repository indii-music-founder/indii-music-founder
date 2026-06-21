import React from 'react';
import { MapPinOff, Map as MapIcon } from 'lucide-react';
import type { MapMarker } from '../types';

interface TourMapProps {
    locations?: string[];
    markers?: MapMarker[];
    center?: { lat: number; lng: number } | string;
    currentLocation?: { lat: number; lng: number } | string;
    rangeRadiusMiles?: number;
}

export const TourMap: React.FC<TourMapProps> = () => {
    return (
        <div className="w-full h-full bg-[#161b22] flex flex-col items-center justify-center rounded-xl border border-gray-800 text-gray-500 gap-4 p-8 text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="absolute inset-0 bg-linear-to-b from-transparent to-[#161b22]" />
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                <MapIcon size={320} strokeWidth={0.5} />
            </div>

            <MapPinOff size={48} className="text-gray-700 relative z-10 group-hover:text-yellow-500/50 transition-colors duration-500" />
            <div className="relative z-10">
                <h3 className="text-lg font-bold text-gray-300">Map Visualization Disabled</h3>
                <p className="text-xs font-mono mt-2 max-w-xs mx-auto text-gray-500">
                    Live map features require a secured backend Maps proxy before browser rendering can be enabled.
                </p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-24 h-24 rounded-full border border-gray-800 animate-ping opacity-10" />
            </div>
        </div>
    );
};
