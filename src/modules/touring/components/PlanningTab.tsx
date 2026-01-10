import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Truck, Plus, Trash2, Save, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Itinerary } from '../types';
import { TourMap } from './TourMap';

interface PlanningTabProps {
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
    locations: string[];
    newLocation: string;
    setNewLocation: (location: string) => void;
    handleAddLocation: () => void;
    handleRemoveLocation: (index: number) => void;
    handleGenerateItinerary: () => void;
    isGenerating: boolean;
    itinerary: Itinerary | null;
    handleCheckLogistics: () => void;
    isCheckingLogistics: boolean;
    logisticsReport: any;
    onUpdateStop: (stop: any) => void;
}

export const PlanningTab: React.FC<PlanningTabProps> = ({
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    locations,
    newLocation,
    setNewLocation,
    handleAddLocation,
    handleRemoveLocation,
    handleGenerateItinerary,
    isGenerating,
    itinerary,
    handleCheckLogistics,
    isCheckingLogistics,
    logisticsReport,
    onUpdateStop
}) => {
    const [selectedStop, setSelectedStop] = useState<any | null>(null);

    const hasLogisticsIssue = logisticsReport && !logisticsReport.isFeasible;

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Top Area: Map & Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px] min-h-[500px]">
                {/* Left: Input Controls */}
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar shadow-2xl">
                    <div>
                        <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                            <Calendar className="text-yellow-500" size={18} />
                            Tour Parameters
                        </h2>
                        <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Define Constraints</p>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor="startDate" className="text-xs text-gray-400 font-bold uppercase tracking-wider">Start Date</label>
                                <input
                                    id="startDate"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="endDate" className="text-xs text-gray-400 font-bold uppercase tracking-wider">End Date</label>
                                <input
                                    id="endDate"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Route Waypoints</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newLocation}
                                    onChange={(e) => setNewLocation(e.target.value)}
                                    placeholder="Enter City, State (e.g. Austin, TX)"
                                    className="flex-1 bg-[#0d1117] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 outline-none transition-all font-mono"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
                                />
                                <button
                                    onClick={handleAddLocation}
                                    className="bg-yellow-500 hover:bg-yellow-400 text-black p-2.5 rounded-lg transition-colors flex items-center justify-center"
                                    aria-label="Add location"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Location List */}
                        <div className="flex-1 bg-[#0d1117] border border-gray-800 rounded-lg p-3 overflow-y-auto max-h-[150px] custom-scrollbar">
                            {locations.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-xs text-gray-600 italic">
                                    No waypoints added
                                </div>
                            ) : (
                                <ul className="space-y-2">
                                    <AnimatePresence>
                                        {locations.map((loc, index) => (
                                            <motion.li
                                                key={`${loc}-${index}`}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                className="flex items-center justify-between text-sm group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center text-[10px] font-mono border border-gray-700">
                                                        {index + 1}
                                                    </span>
                                                    <span className="text-gray-300 font-mono">{loc}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveLocation(index)}
                                                    className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                    aria-label={`Remove ${loc}`}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </motion.li>
                                        ))}
                                    </AnimatePresence>
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-gray-800">
                        <button
                            onClick={handleGenerateItinerary}
                            disabled={isGenerating || locations.length === 0 || !startDate || !endDate}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-black font-bold uppercase tracking-widest text-xs py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(234,179,8,0.2)] hover:shadow-[0_0_30px_rgba(234,179,8,0.4)]"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    <span>Calculating Route...</span>
                                </>
                            ) : (
                                <>
                                    <Truck size={16} />
                                    <span>Initialize Route</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right: Interactive Map */}
                <div className="lg:col-span-2 bg-[#161b22] border border-gray-800 rounded-xl p-1 shadow-2xl relative group overflow-hidden">
                    <TourMap locations={selectedStop ? [selectedStop.city] : locations} />

                    {/* Floating Info Overlay */}
                    {locations.length > 0 && (
                        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md border border-gray-700 rounded-lg p-3 text-right">
                            <div className="text-[10px] text-gray-400 uppercase tracking-widest">Total Waypoints</div>
                            <div className="text-xl font-bold text-white font-mono">{locations.length}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Area: Itinerary Data & Logistics */}
            {itinerary && (
                <div className="flex-1 bg-[#161b22] border border-gray-800 rounded-xl p-6 shadow-2xl flex flex-col gap-6 min-h-[400px]">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Calendar className="text-blue-500" size={20} />
                                Generated Itinerary
                            </h2>
                            <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mt-1">
                                {itinerary.tourName}
                            </p>
                        </div>
                        <button
                            onClick={handleCheckLogistics}
                            disabled={isCheckingLogistics}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${hasLogisticsIssue
                                ? 'bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30'
                                : logisticsReport?.isFeasible
                                    ? 'bg-green-500/20 text-green-500 border border-green-500/50'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                                }`}
                        >
                            {isCheckingLogistics ? (
                                <Loader2 className="animate-spin" size={14} />
                            ) : hasLogisticsIssue ? (
                                <AlertTriangle size={14} />
                            ) : logisticsReport?.isFeasible ? (
                                <CheckCircle2 size={14} />
                            ) : (
                                <Truck size={14} />
                            )}

                            {isCheckingLogistics
                                ? "Analyzing..."
                                : hasLogisticsIssue
                                    ? "Logistics Issues Found"
                                    : logisticsReport?.isFeasible
                                        ? "Logistics Verified"
                                        : "Run Logistics Check"}
                        </button>
                    </div>

                    {/* Itinerary Data Table */}
                    <div className="flex-1 overflow-auto rounded-lg border border-gray-800 bg-[#0d1117] custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-800/50 text-xs text-gray-400 uppercase tracking-widest font-mono border-b border-gray-700 sticky top-0 z-10 backdrop-blur-md">
                                    <th className="p-4 font-semibold">Date</th>
                                    <th className="p-4 font-semibold">City</th>
                                    <th className="p-4 font-semibold">Venue</th>
                                    <th className="p-4 font-semibold">Activity</th>
                                    <th className="p-4 font-semibold">Est. Drive</th>
                                    <th className="p-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm font-mono text-gray-300 divide-y divide-gray-800">
                                {itinerary.stops.map((stop, index) => (
                                    <tr
                                        key={index}
                                        className="hover:bg-white/5 transition-colors cursor-pointer group"
                                        onClick={() => setSelectedStop(stop)}
                                    >
                                        <td className="p-4 text-white font-bold">{new Date(stop.date).toLocaleDateString()}</td>
                                        <td className="p-4">{stop.city}</td>
                                        <td className="p-4 text-blue-400 group-hover:text-blue-300 transition-colors">{stop.venue || "TBD"}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${stop.type === 'Show' ? 'bg-purple-500/20 text-purple-400' :
                                                stop.type === 'Travel' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-gray-700 text-gray-400'
                                                }`}>
                                                {stop.type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-500">
                                            {stop.distance ? `${stop.distance} mi` : '--'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                className="text-gray-500 hover:text-white p-1.5 rounded-md hover:bg-gray-700 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedStop(stop);
                                                }}
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Edit Stop Modal (Simplified) */}
            <AnimatePresence>
                {selectedStop && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#161b22] border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg p-6 relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50" />

                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <MapPin className="text-yellow-500" size={20} />
                                    Edit Logistics
                                </h3>
                                <button
                                    onClick={() => setSelectedStop(null)}
                                    className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">City</label>
                                    <input
                                        value={selectedStop.city}
                                        onChange={(e) => setSelectedStop({ ...selectedStop, city: e.target.value })}
                                        className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-sm text-white focus:border-yellow-500 outline-none transition-colors"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Venue</label>
                                    <input
                                        value={selectedStop.venue}
                                        onChange={(e) => setSelectedStop({ ...selectedStop, venue: e.target.value })}
                                        className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-sm text-white focus:border-yellow-500 outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Activity Type</label>
                                    <select
                                        value={selectedStop.type}
                                        onChange={(e) => setSelectedStop({ ...selectedStop, type: e.target.value })}
                                        className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-sm text-white focus:border-yellow-500 outline-none transition-colors"
                                    >
                                        <option value="Show">Show</option>
                                        <option value="Travel">Travel</option>
                                        <option value="Day Off">Day Off</option>
                                        <option value="Promo">Promo</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                                <button
                                    onClick={() => setSelectedStop(null)}
                                    className="px-4 py-2 rounded text-sm text-gray-400 hover:bg-gray-800 transition-colors uppercase font-bold tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        onUpdateStop(selectedStop);
                                        setSelectedStop(null);
                                    }}
                                    className="px-4 py-2 rounded text-sm font-bold bg-yellow-500 text-black hover:bg-yellow-400 transition-colors flex items-center gap-2 uppercase tracking-wider shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                                >
                                    <Save size={16} />
                                    Save Changes
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Loader Component Helper */}
            {/* Loader2 provided by lucide-react */}
        </div>
    );
};
