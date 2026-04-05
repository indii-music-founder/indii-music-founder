import React, { useState } from 'react';
import { Music, Plus, Trash2, Download, BarChart3, DollarSign, Users, Calendar } from 'lucide-react';
import { secureRandomAlphanumeric } from '@/utils/crypto-random';

/* ================================================================== */
/*  Setlist Analytics — Live Performance Logger & PRO Royalty Tracker  */
/* ================================================================== */

const PRO_RATE_PER_SONG = 0.12; // $0.12 per song per attendee (mock BMI/ASCAP estimate)

interface Song {
    id: string;
    title: string;
}

interface Performance {
    id: string;
    venue: string;
    date: string;
    city: string;
    attendance: number;
    songs: Song[];
}

function generateId() {
    return secureRandomAlphanumeric(7);
}

function calcRoyalty(songs: Song[], attendance: number): number {
    return songs.length * attendance * PRO_RATE_PER_SONG;
}

export function SetlistAnalytics() {
    const [performances, setPerformances] = useState<Performance[]>([]);

    // Form state for new performance
    const [venue, setVenue] = useState('');
    const [date, setDate] = useState('');
    const [city, setCity] = useState('');
    const [attendance, setAttendance] = useState('');
    const [songs, setSongs] = useState<Song[]>([{ id: generateId(), title: '' }]);

    const handleAddSong = () => {
        setSongs(prev => [...prev, { id: generateId(), title: '' }]);
    };

    const handleRemoveSong = (id: string) => {
        setSongs(prev => prev.filter(s => s.id !== id));
    };

    const handleSongChange = (id: string, title: string) => {
        setSongs(prev => prev.map(s => s.id === id ? { ...s, title } : s));
    };

    const handleSubmit = () => {
        const filledSongs = songs.filter(s => s.title.trim());
        if (!venue.trim() || !date || !city.trim() || !attendance || filledSongs.length === 0) return;

        const perf: Performance = {
            id: generateId(),
            venue: venue.trim(),
            date,
            city: city.trim(),
            attendance: parseInt(attendance, 10),
            songs: filledSongs,
        };
        setPerformances(prev => [perf, ...prev]);

        // Reset form
        setVenue('');
        setDate('');
        setCity('');
        setAttendance('');
        setSongs([{ id: generateId(), title: '' }]);
    };

    const handleDeletePerformance = (id: string) => {
        setPerformances(prev => prev.filter(p => p.id !== id));
    };

    const totalRoyalties = performances.reduce((sum, p) => sum + calcRoyalty(p.songs, p.attendance), 0);
    const totalShows = performances.length;
    const totalSongs = performances.reduce((sum, p) => sum + p.songs.length, 0);

    const handleExportCSV = () => {
        if (performances.length === 0) return;
        const rows = [
            ['Venue', 'Date', 'City', 'Attendance', 'Songs Played', 'Song Titles', 'Estimated Royalty'],
            ...performances.map(p => [
                p.venue,
                p.date,
                p.city,
                p.attendance.toString(),
                p.songs.length.toString(),
                p.songs.map(s => s.title).join('; '),
                `$${calcRoyalty(p.songs, p.attendance).toFixed(2)}`,
            ]),
        ];
        const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'setlist-pro-submission.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const inputClass = 'w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500/50 transition-colors';
    const labelClass = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1';

    const isFormValid = venue.trim() && date && city.trim() && attendance && songs.some(s => s.title.trim());

    return (
        <div className="space-y-6 pb-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                        <Music size={16} className="text-yellow-400" />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-white uppercase tracking-tight">Setlist Analytics</h2>
                        <p className="text-[10px] text-gray-500">Log live performances for ASCAP/BMI royalty submission</p>
                    </div>
                </div>
                {performances.length > 0 && (
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-xs text-yellow-400 font-bold border border-yellow-500/20 transition-colors"
                    >
                        <Download size={12} />
                        Export CSV for PRO
                    </button>
                )}
            </div>

            {/* Stats Row */}
            {performances.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Total Shows', value: totalShows.toString(), icon: Calendar, color: 'text-yellow-400' },
                        { label: 'Total Songs Played', value: totalSongs.toString(), icon: Music, color: 'text-blue-400' },
                        { label: 'Est. PRO Royalties', value: `$${totalRoyalties.toFixed(2)}`, icon: DollarSign, color: 'text-emerald-400' },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center flex-shrink-0`}>
                                <stat.icon size={14} className={stat.color} />
                            </div>
                            <div>
                                <p className={`text-base font-black ${stat.color}`}>{stat.value}</p>
                                <p className="text-[10px] text-gray-500">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Log New Performance Form */}
                <div className="space-y-4 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Log a Performance</h3>

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

                    {/* Songs */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelClass}>Songs Performed</label>
                            <button onClick={handleAddSong} className="flex items-center gap-1 text-[10px] text-yellow-400 hover:text-yellow-300 font-bold">
                                <Plus size={10} />Add Song
                            </button>
                        </div>
                        <div className="space-y-2">
                            {songs.map((song, idx) => (
                                <div key={song.id} className="flex gap-2 items-center">
                                    <span className="text-[10px] text-gray-600 w-4 flex-shrink-0">{idx + 1}.</span>
                                    <input
                                        type="text"
                                        value={song.title}
                                        onChange={e => handleSongChange(song.id, e.target.value)}
                                        placeholder={`Song ${idx + 1}`}
                                        className={inputClass}
                                    />
                                    {songs.length > 1 && (
                                        <button onClick={() => handleRemoveSong(song.id)} className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Royalty Preview */}
                    {attendance && songs.filter(s => s.title.trim()).length > 0 && (
                        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Estimated PRO Credit</p>
                            <p className="text-xl font-black text-emerald-400">
                                ${calcRoyalty(songs.filter(s => s.title.trim()), parseInt(attendance || '0', 10)).toFixed(2)}
                            </p>
                            <p className="text-[10px] text-gray-600 mt-0.5">
                                {songs.filter(s => s.title.trim()).length} songs × {parseInt(attendance || '0', 10).toLocaleString()} attendees × $0.12
                            </p>
                        </div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={!isFormValid}
                        className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <BarChart3 size={14} />
                        Submit Setlist
                    </button>
                </div>

                {/* Submitted Setlists */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Submitted Setlists</h3>

                    {performances.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center">
                            <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                                <Music size={20} className="text-gray-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-500">No performances logged</p>
                                <p className="text-xs text-gray-600 mt-1">Log your first show to track PRO royalties</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 overflow-y-auto max-h-[500px]">
                            {performances.map(p => (
                                <div key={p.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-bold text-white">{p.venue}</p>
                                            <p className="text-[10px] text-gray-500">{p.city} · {new Date(p.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-right">
                                                <p className="text-xs font-black text-emerald-400">${calcRoyalty(p.songs, p.attendance).toFixed(2)}</p>
                                                <p className="text-[10px] text-gray-600">{p.attendance.toLocaleString()} attendees</p>
                                            </div>
                                            <button onClick={() => handleDeletePerformance(p.id)} className="text-gray-600 hover:text-red-400 transition-colors ml-1">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {p.songs.map((song, i) => (
                                            <span key={song.id} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/5 text-gray-400">
                                                {i + 1}. {song.title}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* PRO Note */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <BarChart3 size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-300/70 leading-relaxed">
                    Export your setlist data as CSV and submit to <strong>ASCAP</strong> (ascap.com/members/payment/concert-payments) or <strong>BMI</strong> (bmi.com/creators/performance-royalties) for live performance royalty credits. Rates are estimates only.
                </p>
            </div>
        </div>
    );
}
