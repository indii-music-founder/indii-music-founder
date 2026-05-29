import React, { useState, useEffect, useRef } from 'react';
import { Music, Plus, Trash2, Download, BarChart3, DollarSign, Users, Calendar, Disc, Sparkles, AlertCircle, FileText, Check } from 'lucide-react';
import { secureRandomAlphanumeric } from '@/utils/crypto-random';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';
import { db } from '@/services/firebase';
import { collection, doc, deleteDoc, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';

/* ================================================================== */
/*  Setlist Analytics — Live Performance Logger & PRO Royalty Tracker  */
/* ================================================================== */

const PRO_RATE_PER_SONG = 0.12; // $0.12 per song per attendee

export type SetlistCategory = 'original' | 'dj' | 'cover';
export type TrackType = 'original' | 'remix' | 'cover' | 'other';

export interface Song {
    id: string;
    title: string;
    originalArtist?: string;
    type: TrackType;
}

export interface Performance {
    id: string;
    venue: string;
    date: string;
    city: string;
    attendance: number;
    songs: Song[];
    category: SetlistCategory;
    createdAt?: string;
}

const CATEGORY_PRESETS = [
    {
        id: 'original' as SetlistCategory,
        label: 'Original Set',
        icon: Sparkles,
        description: 'Bands & Solo Acts playing original songs. Direct 100% PRO songwriter royalties.',
        color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40'
    },
    {
        id: 'dj' as SetlistCategory,
        label: 'DJ Set / Mix',
        icon: Disc,
        description: 'Electronic acts mixing originals, remixes/edits, and other artist tracks.',
        color: 'text-violet-400 border-violet-500/20 bg-violet-500/5 hover:border-violet-500/40'
    },
    {
        id: 'cover' as SetlistCategory,
        label: 'Cover / Tribute Set',
        icon: Music,
        description: 'Live performance of covers. PRO songwriter royalties pay original authors.',
        color: 'text-amber-400 border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40'
    }
] as const;

function generateId() {
    return secureRandomAlphanumeric(7);
}

// Calculate royalties based on specific category rules
function calcSingleSongRoyalty(type: TrackType, category: SetlistCategory, attendance: number): number {
    if (category === 'original') {
        return attendance * PRO_RATE_PER_SONG;
    }
    
    if (category === 'dj') {
        if (type === 'original') return attendance * PRO_RATE_PER_SONG;
        if (type === 'remix') return attendance * PRO_RATE_PER_SONG * 0.5; // 50% split for custom edits
        return 0; // Other artist tracks earn crowd energy, not direct royalty to the DJ
    }
    
    if (category === 'cover') {
        if (type === 'original') return attendance * PRO_RATE_PER_SONG;
        return 0; // Cover songs pay the original writer, not the performing cover band
    }
    
    return 0;
}

function calcTotalRoyalty(songs: Song[], category: SetlistCategory, attendance: number): number {
    return songs.reduce((sum, s) => sum + calcSingleSongRoyalty(s.type, category, attendance), 0);
}

// Calculate the total ASCAP/BMI payout generated for original songwriters (used for cover bands educational visualization)
function calcGrossSongwriterRoyalties(songs: Song[], category: SetlistCategory, attendance: number): number {
    if (category === 'cover') {
        // All songs (even covers) generate royalties for their respective writers
        return songs.length * attendance * PRO_RATE_PER_SONG;
    }
    return calcTotalRoyalty(songs, category, attendance);
}

export function SetlistAnalytics() {
    const { userProfile } = useStore(useShallow(state => ({ userProfile: state.userProfile })));
    const toast = useToast();
    const [performances, setPerformances] = useState<Performance[]>([]);
    const [loading, setLoading] = useState(true);
    const hasInitializedRef = useRef(false);

    // Form state for new performance
    const [category, setCategory] = useState<SetlistCategory>('original');
    const [venue, setVenue] = useState('');
    const [date, setDate] = useState('');
    const [city, setCity] = useState('');
    const [attendance, setAttendance] = useState('');
    const [songs, setSongs] = useState<Song[]>([{ id: generateId(), title: '', type: 'original' }]);

    // Auto-detect performer style from User Profile on mount
    useEffect(() => {
        if (userProfile && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
            let defaultCat: SetlistCategory = 'original';
            
            const bio = userProfile.bio?.toLowerCase() || '';
            const desc = userProfile.brandKit?.brandDescription?.toLowerCase() || '';
            const genre = userProfile.brandKit?.releaseDetails?.genre?.toLowerCase() || '';

            if (bio.includes('dj') || desc.includes('dj') || genre.includes('techno') || genre.includes('house') || genre.includes('electronic')) {
                defaultCat = 'dj';
            } else if (bio.includes('cover') || desc.includes('cover') || bio.includes('tribute') || bio.includes('wedding band')) {
                defaultCat = 'cover';
            } else if (userProfile.artistType === 'Solo' || userProfile.artistType === 'Band') {
                defaultCat = 'original';
            }

            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCategory(defaultCat);
            // Default first track to align with category
             
            setSongs([{ id: generateId(), title: '', type: defaultCat === 'dj' ? 'original' : 'original' }]);
        }
    }, [userProfile]);

    // Firestore Integration: Load setlists in real-time
    useEffect(() => {
        const userId = userProfile?.uid || userProfile?.id;
        if (!userId || userId === 'pending') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(false);
            return;
        }

        try {
            const setlistsRef = collection(db, `users/${userId}/setlists`);
            const q = query(setlistsRef, orderBy('createdAt', 'desc'));
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const loaded: Performance[] = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    loaded.push({
                        id: docSnap.id,
                        venue: data.venue || '',
                        date: data.date || '',
                        city: data.city || '',
                        attendance: Number(data.attendance || 0),
                        songs: (data.songs || []).map((s: any, idx: number) => ({
                            id: s.id || `s-${idx}`,
                            title: s.title || s.name || '',
                            originalArtist: s.originalArtist || '',
                            type: s.type || 'original'
                        })),
                        category: data.category || 'original',
                        createdAt: data.createdAt
                    });
                });
                setPerformances(loaded);
                 
                setLoading(false);
            }, (error) => {
                logger.error('[SetlistAnalytics] Firestore subscription failed:', error);
                 
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (err) {
            logger.error('[SetlistAnalytics] Failed to setup Firestore connection:', err);
             
            setLoading(false);
        }
    }, [userProfile]);

    // Reset song input models dynamically when category changes
    const handleCategoryChange = (newCat: SetlistCategory) => {
        setCategory(newCat);
        setSongs([{ 
            id: generateId(), 
            title: '', 
            originalArtist: '', 
            type: newCat === 'original' ? 'original' : (newCat === 'dj' ? 'other' : 'cover') 
        }]);
    };

    const handleAddSong = () => {
        setSongs(prev => [
            ...prev, 
            { 
                id: generateId(), 
                title: '', 
                originalArtist: '', 
                type: category === 'original' ? 'original' : (category === 'dj' ? 'other' : 'cover') 
            }
        ]);
    };

    const handleRemoveSong = (id: string) => {
        setSongs(prev => prev.filter(s => s.id !== id));
    };

    const handleSongChange = (id: string, updates: Partial<Song>) => {
        setSongs(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const handleSubmit = async () => {
        const filledSongs = songs.filter(s => s.title.trim());
        if (!venue.trim() || !date || !city.trim() || !attendance || filledSongs.length === 0) return;

        const perf: Performance = {
            id: generateId(),
            venue: venue.trim(),
            date,
            city: city.trim(),
            attendance: parseInt(attendance, 10),
            songs: filledSongs,
            category,
            createdAt: new Date().toISOString()
        };

        const userId = userProfile?.uid || userProfile?.id;
        if (userId && userId !== 'pending') {
            try {
                // Save to Firestore
                await setDoc(doc(db, `users/${userId}/setlists`, perf.id), {
                    venue: perf.venue,
                    date: perf.date,
                    city: perf.city,
                    attendance: perf.attendance,
                    category: perf.category,
                    songs: perf.songs.map(s => ({
                        id: s.id,
                        title: s.title,
                        originalArtist: s.originalArtist || '',
                        type: s.type
                    })),
                    createdAt: perf.createdAt
                });
                toast.success("Setlist saved & synced with cloud");
            } catch (err) {
                logger.error('[SetlistAnalytics] Failed to save setlist:', err);
                toast.error("Failed to sync setlist to cloud. Setlist was not saved.");
                return;
            }
        } else {
            toast.error("Sign in to save setlists.");
            return;
        }

        // Reset form
        setVenue('');
        setDate('');
        setCity('');
        setAttendance('');
        setSongs([{ id: generateId(), title: '', type: category === 'dj' ? 'other' : (category === 'cover' ? 'cover' : 'original') }]);
    };

    const handleDeletePerformance = async (id: string) => {
        const userId = userProfile?.uid || userProfile?.id;
        if (userId && userId !== 'pending') {
            try {
                await deleteDoc(doc(db, `users/${userId}/setlists`, id));
                toast.success("Setlist removed from cloud");
            } catch (err) {
                logger.error('[SetlistAnalytics] Failed to delete setlist:', err);
                toast.error("Failed to delete setlist");
            }
        } else {
            setPerformances(prev => prev.filter(p => p.id !== id));
            toast.success("Setlist removed");
        }
    };

    const totalRoyalties = performances.reduce((sum, p) => sum + calcTotalRoyalty(p.songs, p.category, p.attendance), 0);
    const totalGrossSongwriterRoyalties = performances.reduce((sum, p) => sum + calcGrossSongwriterRoyalties(p.songs, p.category, p.attendance), 0);
    const totalShows = performances.length;
    const totalSongs = performances.reduce((sum, p) => sum + p.songs.length, 0);

    const handleExportCSV = () => {
        if (performances.length === 0) return;
        const rows = [
            ['Venue', 'Date', 'City', 'Attendance', 'Artist Category', 'Songs Played', 'Song Titles', 'Original Artists', 'Track Types', 'Estimated Payout'],
            ...performances.map(p => [
                p.venue,
                p.date,
                p.city,
                p.attendance.toString(),
                p.category.toUpperCase(),
                p.songs.length.toString(),
                p.songs.map(s => s.title).join('; '),
                p.songs.map(s => s.originalArtist || 'Original Artist').join('; '),
                p.songs.map(s => s.type.toUpperCase()).join('; '),
                `$${calcTotalRoyalty(p.songs, p.category, p.attendance).toFixed(2)}`,
            ]),
        ];
        const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `indii-setlist-pro-payout-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Setlist data exported successfully!");
    };

    const inputClass = 'w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500/50 transition-all font-mono';
    const labelClass = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1';

    const isFormValid = venue.trim() && date && city.trim() && attendance && songs.some(s => s.title.trim());

    return (
        <div className="space-y-6 pb-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center border border-yellow-500/10 shadow-lg shadow-yellow-500/5">
                        <Music size={20} className="text-yellow-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white uppercase tracking-tight italic">Setlist Analytics</h2>
                        <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mt-0.5">Live Performance Logger & PRO Royalty Tracker</p>
                    </div>
                </div>
                {performances.length > 0 && (
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFE135] hover:bg-[#FFE135]/90 text-black font-black text-xs transition-all duration-200 border border-[#FFE135]/20 shadow-lg shadow-[#FFE135]/10"
                    >
                        <Download size={13} strokeWidth={3} />
                        Export CSV for PRO Submission
                    </button>
                )}
            </div>

            {/* Classification Presets Section */}
            <div className="space-y-3">
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider">Performer Classification Mode</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {CATEGORY_PRESETS.map((preset) => {
                        const Icon = preset.icon;
                        const isSelected = category === preset.id;
                        return (
                            <button
                                key={preset.id}
                                onClick={() => handleCategoryChange(preset.id)}
                                className={`flex flex-col items-start p-3 text-left rounded-xl border transition-all duration-300 ${
                                    isSelected
                                        ? 'bg-white/[0.04] border-[#FFE135]/50 shadow-lg shadow-yellow-500/5 scale-[1.01]'
                                        : 'bg-black/30 border-white/5 hover:border-white/10 hover:bg-white/[0.01]'
                                }`}
                            >
                                <div className={`p-2 rounded-lg mb-2 border transition-all duration-300 ${
                                    isSelected 
                                        ? 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10' 
                                        : 'text-gray-500 border-white/5 bg-white/[0.02]'
                                }`}>
                                    <Icon size={16} />
                                </div>
                                <h3 className={`text-xs font-bold tracking-wide transition-colors ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                                    {preset.label}
                                </h3>
                                <p className="text-[9px] text-gray-500 mt-1 leading-normal">
                                    {preset.description}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Stats Row */}
            {performances.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                        { label: 'Total Logged Shows', value: totalShows.toString(), icon: Calendar, color: 'text-yellow-400 bg-yellow-500/5 border-yellow-500/10' },
                        { label: 'Total Songs Played', value: totalSongs.toString(), icon: Music, color: 'text-sky-400 bg-sky-500/5 border-sky-500/10' },
                        { 
                            label: category === 'cover' ? 'Est. Songwriter Payout' : 'Est. PRO Royalties', 
                            value: `$${(category === 'cover' ? totalGrossSongwriterRoyalties : totalRoyalties).toFixed(2)}`, 
                            icon: DollarSign, 
                            color: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10' 
                        },
                    ].map((stat, idx) => (
                        <div key={idx} className={`border rounded-xl p-3.5 flex items-center gap-3.5 bg-black/40 ${stat.color}`}>
                            <div className="w-9 h-9 rounded-xl bg-white/[0.03] flex items-center justify-center flex-shrink-0">
                                <stat.icon size={16} className="text-white" />
                            </div>
                            <div>
                                <p className="text-lg font-black tracking-tight">{stat.value}</p>
                                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mt-0.5">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Log New Performance Form */}
                <div className="lg:col-span-7 space-y-4 bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col h-fit">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                        <BarChart3 size={14} className="text-yellow-400" />
                        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest">Log a Performance</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className={labelClass}>Venue Name</label>
                            <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="The Fillmore" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>City</label>
                            <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Detroit, MI" className={inputClass} />
                        </div>
                        <div className="col-span-2">
                            <label className={labelClass}>
                                <Users size={10} className="inline mr-1" />Attendance
                            </label>
                            <input type="number" min="1" value={attendance} onChange={e => setAttendance(e.target.value)} placeholder="500" className={inputClass} />
                        </div>
                    </div>

                    {/* Songs performed */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between border-t border-white/5 pt-3">
                            <label className={labelClass}>Songs Performed ({songs.length})</label>
                            <button onClick={handleAddSong} className="flex items-center gap-1 text-[10px] text-yellow-400 hover:text-yellow-300 font-bold bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-md transition-colors">
                                <Plus size={10} />Add Song
                            </button>
                        </div>
                        
                        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                            {songs.map((song, idx) => (
                                <div key={song.id} className="bg-black/35 border border-white/5 rounded-xl p-3 space-y-2">
                                    <div className="flex gap-2 items-center justify-between">
                                        <span className="text-[10px] font-bold text-gray-500 font-mono">Song #{idx + 1}</span>
                                        {songs.length > 1 && (
                                            <button onClick={() => handleRemoveSong(song.id)} className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div>
                                            <input
                                                type="text"
                                                value={song.title}
                                                onChange={e => handleSongChange(song.id, { title: e.target.value })}
                                                placeholder={category === 'dj' ? "Track/Song Title" : "Song Title"}
                                                className={inputClass}
                                            />
                                        </div>

                                        {category !== 'original' && (
                                            <div>
                                                <input
                                                    type="text"
                                                    value={song.originalArtist || ''}
                                                    onChange={e => handleSongChange(song.id, { originalArtist: e.target.value })}
                                                    placeholder={category === 'dj' ? "Original Artist / Composer" : "Original Artist"}
                                                    className={inputClass}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Additional parameters for DJ Set & Cover Sets */}
                                    {category === 'dj' && (
                                        <div className="flex gap-1.5 pt-1">
                                            {[
                                                { id: 'original' as TrackType, label: 'My Original' },
                                                { id: 'remix' as TrackType, label: 'My Remix / Edit' },
                                                { id: 'other' as TrackType, label: 'Other Artist Track' }
                                            ].map((btn) => (
                                                <button
                                                    key={btn.id}
                                                    onClick={() => handleSongChange(song.id, { type: btn.id })}
                                                    className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all duration-200 border ${
                                                        song.type === btn.id
                                                            ? 'bg-violet-500/10 border-violet-500/35 text-violet-400'
                                                            : 'bg-transparent border-white/5 text-gray-500 hover:text-white'
                                                    }`}
                                                >
                                                    {btn.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {category === 'cover' && (
                                        <div className="flex gap-1.5 pt-1">
                                            {[
                                                { id: 'cover' as TrackType, label: 'Cover Song' },
                                                { id: 'original' as TrackType, label: 'My Original Song' }
                                            ].map((btn) => (
                                                <button
                                                    key={btn.id}
                                                    onClick={() => handleSongChange(song.id, { type: btn.id })}
                                                    className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all duration-200 border ${
                                                        song.type === btn.id
                                                            ? 'bg-amber-500/10 border-amber-500/35 text-amber-400'
                                                            : 'bg-transparent border-white/5 text-gray-500 hover:text-white'
                                                    }`}
                                                >
                                                    {btn.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Royalty Preview Box */}
                    {attendance && songs.filter(s => s.title.trim()).length > 0 && (
                        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-1">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest font-mono">
                                {category === 'cover' ? 'Estimated Payout generated for Songwriters' : 'Estimated Payout to you'}
                            </p>
                            
                            {category === 'cover' ? (
                                <>
                                    <p className="text-xl font-black text-amber-400">
                                        ${calcGrossSongwriterRoyalties(songs.filter(s => s.title.trim()), category, parseInt(attendance, 10)).toFixed(2)}
                                    </p>
                                    <p className="text-[9px] text-gray-500 leading-normal">
                                        This performance generates royalties paid to the original authors. Your direct performer payout is <strong>$0.00</strong>.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-xl font-black text-emerald-400">
                                        ${calcTotalRoyalty(songs.filter(s => s.title.trim()), category, parseInt(attendance, 10)).toFixed(2)}
                                    </p>
                                    <div className="text-[9px] text-gray-500 space-y-0.5 leading-normal">
                                        <p>
                                            {songs.filter(s => s.title.trim()).length} tracks played to {parseInt(attendance, 10).toLocaleString()} attendees.
                                        </p>
                                        {category === 'dj' && (
                                            <p className="text-[8px] text-gray-600">
                                                (Originals credit 100%, remixes/edits credit 50%, other artist tracks credit 0% to performer)
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={!isFormValid}
                        className="w-full py-3 bg-[#FFE135] hover:bg-[#FFE135]/90 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                    >
                        <BarChart3 size={14} strokeWidth={2.5} />
                        Submit Setlist
                    </button>
                </div>

                {/* Submitted Setlists Column */}
                <div className="lg:col-span-5 bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
                        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest">Submitted Setlists</h3>
                        {performances.length > 0 && (
                            <span className="text-[9px] text-gray-500 font-mono font-bold bg-white/5 px-2 py-0.5 rounded-full">
                                {performances.length} logged
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs text-gray-600 uppercase tracking-widest animate-pulse font-mono">Syncing setlists...</p>
                        </div>
                    ) : performances.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center shadow-inner">
                                <Music size={22} className="text-gray-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-500">No performances logged</p>
                                <p className="text-xs text-gray-600 mt-1">Log your first show to track PRO royalties</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 overflow-y-auto max-h-[560px] pr-1">
                            {performances.map(p => {
                                const directRoyalty = calcTotalRoyalty(p.songs, p.category, p.attendance);
                                const songwriterRoyalty = calcGrossSongwriterRoyalties(p.songs, p.category, p.attendance);
                                
                                return (
                                    <div key={p.id} className="bg-black/30 border border-white/5 rounded-xl p-3.5 space-y-3 hover:border-white/10 transition-colors relative overflow-hidden group">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <p className="text-sm font-bold text-white leading-tight">{p.venue}</p>
                                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                                                        p.category === 'dj'
                                                            ? 'text-violet-400 bg-violet-400/5 border-violet-400/10'
                                                            : (p.category === 'cover' ? 'text-amber-400 bg-amber-400/5 border-amber-400/10' : 'text-emerald-400 bg-emerald-400/5 border-emerald-400/10')
                                                    }`}>
                                                        {p.category === 'dj' ? 'DJ Mix' : (p.category === 'cover' ? 'Cover Set' : 'Original Set')}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-gray-500 font-mono mt-1">
                                                    {p.city} · {new Date(p.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="text-right">
                                                    <p className={`text-sm font-black ${p.category === 'cover' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                        ${(p.category === 'cover' ? songwriterRoyalty : directRoyalty).toFixed(2)}
                                                    </p>
                                                    <p className="text-[9px] text-gray-600 font-mono">{p.attendance.toLocaleString()} attendees</p>
                                                </div>
                                                <button onClick={() => handleDeletePerformance(p.id)} className="text-gray-600 hover:text-red-400 p-1 rounded-md hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 ml-1">
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-1 border-t border-white/[0.04] pt-2">
                                            {p.songs.map((song, i) => (
                                                <span key={song.id} className="text-[9px] px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/5 text-gray-400 flex items-center gap-1">
                                                    <span className="text-gray-600 font-mono font-bold">{i + 1}.</span>
                                                    <span>{song.title}</span>
                                                    {song.originalArtist && (
                                                        <span className="text-[8px] text-gray-500">by {song.originalArtist}</span>
                                                    )}
                                                    {p.category === 'dj' && (
                                                        <span className={`text-[7px] font-bold uppercase ${
                                                            song.type === 'original' ? 'text-emerald-400' : (song.type === 'remix' ? 'text-violet-400' : 'text-gray-500')
                                                        }`}>
                                                            ({song.type})
                                                        </span>
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Educational Info Note */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 animate-pulse">
                <AlertCircle size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <h4 className="text-[11px] font-bold text-blue-300 uppercase tracking-widest font-mono">ASCAP & BMI Live Performance Credit Guidelines</h4>
                    <p className="text-[10px] text-blue-300/60 leading-relaxed font-mono">
                        ASCAP OnStage and BMI Live allow musicians to earn royalties when they play live shows at licensed venues. To claim credit, you must submit complete setlists specifying original composers. cover songs generate royalties directly to their original songwriters rather than the performing act. Rates are calculated using average licensed PRO venue estimates.
                    </p>
                </div>
            </div>
        </div>
    );
}
