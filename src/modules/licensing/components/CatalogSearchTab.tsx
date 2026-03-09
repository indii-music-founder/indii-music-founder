import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, SlidersHorizontal, Music, Play, Plus } from 'lucide-react';

interface CatalogTrack {
    id: string;
    title: string;
    artist: string;
    genre: string;
    mood: string;
    bpm: number;
    duration: string;
    isCleared: boolean;
}

// No hardcoded catalog — tracks are fetched from Firestore licensing collection.
// In production, populate via LicensingService.getCatalog().

interface CatalogSearchTabProps {
    catalog?: CatalogTrack[];
}

export function CatalogSearchTab({ catalog = [] }: CatalogSearchTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [activeGenre, setActiveGenre] = useState<string>('All');
    const [isLoading, setIsLoading] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
            setIsLoading(false);
        }, 400); // 400ms debounce
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Derived filtered generic data
    const filteredTracks = React.useMemo(() => {
        let results = catalog;
        if (debouncedQuery) {
            const lowerQuery = debouncedQuery.toLowerCase();
            results = results.filter(
                (track) =>
                    track.title.toLowerCase().includes(lowerQuery) ||
                    track.artist.toLowerCase().includes(lowerQuery) ||
                    track.mood.toLowerCase().includes(lowerQuery)
            );
        }
        if (activeGenre !== 'All') {
            results = results.filter((track) => track.genre === activeGenre);
        }
        return results;
    }, [debouncedQuery, activeGenre, catalog]);

    const genres = ['All', ...Array.from(new Set(catalog.map(t => t.genre)))];

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Search Bar & Filters Area */}
            <div className="flex flex-col gap-4 bg-white/[0.02] p-6 rounded-2xl border border-white/5">
                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search by track, artist, mood, keywords..."
                            value={searchQuery}
                            onChange={(e) => {
                                setIsLoading(true);
                                setSearchQuery(e.target.value);
                            }}
                            className="w-full bg-black/40 border border-white/10 text-white placeholder:text-gray-500 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-indigo-500/50 transition-colors"
                        />
                        {isLoading && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-indigo-500/20 border-t-indigo-400 animate-spin" />
                        )}
                    </div>
                    <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl border border-white/10 transition-colors h-full">
                        <SlidersHorizontal size={18} />
                        <span className="text-sm font-semibold">Filters</span>
                    </button>
                </div>

                {/* Genre Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {genres.map(genre => (
                        <button
                            key={genre}
                            onClick={() => setActiveGenre(genre)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeGenre === genre
                                ? 'bg-indigo-500 text-white border border-indigo-400'
                                : 'bg-white/5 text-gray-400 hover:text-white border border-transparent hover:border-white/10 hover:bg-white/10'
                                }`}
                        >
                            {genre}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results Header */}
            <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-bold text-white tracking-widest uppercase">
                    {filteredTracks.length} Results
                </h3>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-12">
                <AnimatePresence mode="popLayout">
                    {filteredTracks.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="col-span-full py-20 text-center"
                        >
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                                <Filter className="text-gray-500 w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">No tracks found</h3>
                            <p className="text-gray-400 text-sm">Try adjusting your search query or filters.</p>
                        </motion.div>
                    ) : (
                        filteredTracks.map((track, i) => (
                            <motion.div
                                key={track.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2, delay: i * 0.03 }}
                                className="group relative bg-[#0f0f0f]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-4 hover:border-indigo-500/30 transition-all cursor-pointer overflow-hidden flex flex-col"
                            >
                                {/* Background glow effect */}
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-transparent to-indigo-500/0 group-hover:from-indigo-500/5 group-hover:to-transparent transition-all pointer-events-none" />

                                <div className="relative z-10 flex gap-4 w-full">
                                    {/* Album Art Placeholder icon */}
                                    <div className="w-16 h-16 flex-shrink-0 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center relative overflow-hidden group-hover:border-indigo-500/30 transition-colors">
                                        <Music className="w-6 h-6 text-gray-500 group-hover:text-indigo-400 transition-colors" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Play className="w-6 h-6 text-white fill-white" />
                                        </div>
                                    </div>

                                    {/* Track Info */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="flex justify-between items-start w-full">
                                            <div className="min-w-0 pr-2">
                                                <h4 className="text-base font-bold text-white truncate group-hover:text-indigo-300 transition-colors">{track.title}</h4>
                                                <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                                            </div>
                                            <span className="text-xs font-mono text-gray-500 flex-shrink-0 mt-0.5">{track.duration}</span>
                                        </div>

                                        {/* Badges */}
                                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                                            {track.isCleared ? (
                                                <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold tracking-wider rounded">Pre-Cleared</span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] uppercase font-bold tracking-wider rounded">Needs Clearance</span>
                                            )}
                                            <span className="px-2 py-0.5 bg-white/5 text-gray-300 text-[10px] font-medium rounded">{track.genre}</span>
                                            <span className="px-2 py-0.5 bg-white/5 text-gray-300 text-[10px] font-medium rounded">{track.bpm} BPM</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="w-8 h-8 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
