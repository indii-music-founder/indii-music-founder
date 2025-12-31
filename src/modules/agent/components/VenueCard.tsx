import * as React from 'react';
import { Venue } from '../types';
import { MapPin, Users, Globe, Mail, Plus, AlertCircle, CheckCircle } from 'lucide-react';

interface VenueCardProps {
    venue: Venue;
    onAdd?: (venue: Venue) => void;
}

export const VenueCard: React.FC<VenueCardProps> = ({ venue, onAdd }) => {
    // Determine status color
    const getStatusColor = (status: Venue['status']) => {
        switch (status) {
            case 'active': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
            case 'closed': return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
            default: return 'text-slate-400 border-slate-700 bg-slate-800/50';
        }
    };

    return (
        <div className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-600 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-900/10">
            {/* Image Header */}
            <div className="h-32 bg-slate-800 relative overflow-hidden">
                {venue.imageUrl ? (
                    <React.Fragment>
                        <img
                            src={venue.imageUrl}
                            alt={venue.name}
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" // Reduced opacity for readability if text over it, though text is below
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                    </React.Fragment>
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
                        <MapPin className="text-slate-700 w-12 h-12" />
                    </div>
                )}

                {/* Fit Score Badge */}
                {venue.fitScore !== undefined && (
                    <div className="absolute top-2 right-2">
                        <div className={`
                            flex flex-col items-center justify-center w-12 h-12 rounded-full border-2 
                            backdrop-blur-md shadow-lg
                            ${venue.fitScore > 80 ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400' :
                                venue.fitScore > 50 ? 'bg-amber-500/20 border-amber-400 text-amber-400' :
                                    'bg-slate-500/20 border-slate-400 text-slate-400'}
                        `}>
                            <span className="text-xs font-bold leading-none">{venue.fitScore}</span>
                            <span className="text-[8px] uppercase tracking-tighter opacity-70">Fit</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Body */}
            <div className="p-4 relative">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="font-bold text-lg text-white group-hover:text-emerald-400 transition-colors leading-tight">
                            {venue.name}
                        </h3>
                        <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
                            <MapPin size={12} />
                            <span>{venue.city}, {venue.state}</span>
                        </div>
                    </div>

                    <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getStatusColor(venue.status)}`}>
                        {venue.status}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 my-4 text-xs text-slate-400">
                    <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded">
                        <Users size={14} className="text-slate-500" />
                        <span>Cap: <span className="text-slate-200">{venue.capacity}</span></span>
                    </div>
                    {venue.website && (
                        <a href={venue.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-800/50 p-2 rounded hover:bg-slate-800 transition-colors cursor-pointer">
                            <Globe size={14} className="text-slate-500" />
                            <span className="truncate">Website</span>
                        </a>
                    )}
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                    {venue.genres.slice(0, 3).map(g => (
                        <span key={g} className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full border border-slate-700">
                            {g}
                        </span>
                    ))}
                    {venue.genres.length > 3 && (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-500 rounded-full border border-slate-700">
                            +{venue.genres.length - 3}
                        </span>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-800">
                    <button
                        onClick={() => onAdd?.(venue)}
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
                    >
                        <Plus size={14} /> Add to Roster
                    </button>
                    {/* <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                        <Mail size={16} />
                    </button> */}
                </div>
            </div>
        </div>
    );
};
