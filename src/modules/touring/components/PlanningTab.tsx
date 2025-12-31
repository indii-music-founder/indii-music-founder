import React, { useState } from 'react';
import { MapPin, X, Truck, Loader2, Plus, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DaySheetModal } from './DaySheetModal';

interface PlanningTabProps {
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
    locations: string[];
    newLocation: string;
    setNewLocation: (loc: string) => void;
    handleAddLocation: () => void;
    handleRemoveLocation: (index: number) => void;
    handleGenerateItinerary: () => void;
    isGenerating: boolean;
    itinerary: any;
    handleCheckLogistics: () => void;
    isCheckingLogistics: boolean;
    logisticsReport: any;
    onUpdateStop: (updatedStop: any) => void;
}

export const PlanningTab: React.FC<PlanningTabProps> = ({
    startDate, setStartDate, endDate, setEndDate,
    locations, newLocation, setNewLocation, handleAddLocation, handleRemoveLocation,
    handleGenerateItinerary, isGenerating, itinerary,
    handleCheckLogistics, isCheckingLogistics, logisticsReport, onUpdateStop
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStop, setSelectedStop] = useState<any>(null);

    const handleStopClick = (stop: any) => {
        setSelectedStop(stop);
        setIsModalOpen(true);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
            {/* Input Section */}
            <div className="lg:col-span-1 space-y-6">
                <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="bg-[#161b22] border border-gray-800 rounded-xl p-6"
                >
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <MapPin className="text-blue-500" size={20} />
                        Tour Details
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1 font-mono uppercase tracking-[0.2em] text-[10px] font-black">Dates</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="date"
                                    aria-label="Start Date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-black/20 border border-gray-700/50 rounded-lg p-2 text-sm text-gray-300 focus:border-blue-500 outline-none w-full font-mono transition-all"
                                />
                                <input
                                    type="date"
                                    aria-label="End Date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-black/20 border border-gray-700/50 rounded-lg p-2 text-sm text-gray-300 focus:border-blue-500 outline-none w-full font-mono transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1 font-mono uppercase tracking-[0.2em] text-[10px] font-black">Locations</label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={newLocation}
                                    onChange={(e) => setNewLocation(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
                                    placeholder="Add a city..."
                                    className="flex-1 bg-black/20 border border-gray-700/50 rounded-lg p-2 text-sm text-gray-300 focus:border-blue-500 outline-none placeholder:text-gray-700"
                                />
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleAddLocation}
                                    aria-label="Add location"
                                    className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors shadow-lg shadow-blue-500/20"
                                >
                                    <Plus size={20} />
                                </motion.button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <AnimatePresence mode="popLayout">
                                    {locations.map((loc, idx) => (
                                        <motion.div
                                            key={`${loc}-${idx}`}
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0.8, opacity: 0 }}
                                            className="flex items-center gap-1 bg-gray-900 border border-gray-800 px-3 py-1 rounded-full text-xs text-gray-400 font-mono tracking-tighter"
                                        >
                                            {loc}
                                            <button onClick={() => handleRemoveLocation(idx)} aria-label={`Remove ${loc}`} className="ml-1 hover:text-red-500 transition-colors">
                                                <X size={12} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleGenerateItinerary}
                            disabled={isGenerating || locations.length === 0 || !startDate || !endDate}
                            className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(202,138,4,0.15)] uppercase tracking-[0.2em] text-[10px]"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    Synchronizing...
                                </>
                            ) : (
                                <>
                                    <Truck size={16} />
                                    Launch Route Generator
                                </>
                            )}
                        </motion.button>
                    </div>
                </motion.div>
            </div>

            {/* Itinerary Display */}
            <div className="lg:col-span-2 space-y-6">
                {itinerary ? (
                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-8 relative overflow-hidden">
                        {/* Background Ambience */}
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/5 to-blue-900/5 pointer-events-none" />
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full -mr-32 -mt-32 pointer-events-none" />

                        <div className="flex items-center justify-between mb-8 relative z-10">
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">{itinerary.tourName}</h2>
                                <p className="text-xs font-mono text-gray-500 mt-2 flex items-center gap-3 uppercase tracking-widest font-black">
                                    <span className="bg-gray-800/50 px-2 py-0.5 rounded text-blue-400 border border-blue-500/10">
                                        {itinerary.totalDistance}
                                    </span>
                                    <span className="text-gray-800">::</span>
                                    <span className="text-green-500/80">{itinerary.estimatedBudget}</span>
                                </p>
                            </div>
                            <button
                                onClick={handleCheckLogistics}
                                disabled={isCheckingLogistics}
                                className="px-6 py-2.5 bg-black/40 hover:bg-gray-800 text-white rounded-xl transition-all border border-gray-800 backdrop-blur-xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest shadow-2xl group"
                            >
                                {isCheckingLogistics ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} className="text-green-500 group-hover:scale-110 transition-transform" />}
                                Check Logistics
                            </button>
                        </div>

                        {logisticsReport && (
                            <div className={`mb-8 p-6 rounded-2xl border backdrop-blur-md relative z-10 overflow-hidden ${logisticsReport.isFeasible ? 'bg-green-950/10 border-green-500/20' : 'bg-red-950/10 border-red-500/20'}`}>
                                <div className={`absolute top-0 left-0 w-1 h-full ${logisticsReport.isFeasible ? 'bg-green-500' : 'bg-red-500'}`} />
                                <h4 className={`text-xs font-black mb-4 flex items-center gap-3 uppercase tracking-[0.3em] ${logisticsReport.isFeasible ? 'text-green-400' : 'text-red-400'}`}>
                                    {logisticsReport.isFeasible ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                                    Feasibility Report
                                </h4>
                                {logisticsReport.issues.length > 0 && (
                                    <ul className="space-y-2 mb-4">
                                        {logisticsReport.issues.map((issue: string, i: number) => (
                                            <li key={i} className="flex items-start gap-3 text-xs text-gray-400 font-mono italic">
                                                <span className="text-red-500 mt-0.5">{'!!'}</span> {issue}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {logisticsReport.suggestions.length > 0 && (
                                    <ul className="space-y-2">
                                        {logisticsReport.suggestions.map((suggestion: string, i: number) => (
                                            <li key={i} className="flex items-start gap-3 text-xs text-gray-400 font-mono">
                                                <span className="text-blue-500 mt-0.5">{'>>'}</span> {suggestion}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={{
                                visible: {
                                    transition: {
                                        staggerChildren: 0.1
                                    }
                                }
                            }}
                            className="space-y-3 relative z-10"
                        >
                            {itinerary.stops.map((stop: any, idx: number) => {
                                const isShow = stop.activity === 'Show';
                                const isTravel = stop.activity === 'Travel';
                                const vibeGradient = isShow
                                    ? 'from-purple-500/10 via-purple-500/5 to-transparent'
                                    : isTravel
                                        ? 'from-blue-500/10 via-blue-500/5 to-transparent'
                                        : 'from-gray-500/10 via-gray-500/5 to-transparent';

                                return (
                                    <motion.div
                                        key={idx}
                                        variants={{
                                            hidden: { y: 20, opacity: 0 },
                                            visible: { y: 0, opacity: 1 }
                                        }}
                                        onClick={() => handleStopClick(stop)}
                                        className="group relative overflow-hidden rounded-xl border border-gray-800 hover:border-blue-500/30 transition-all duration-300 cursor-pointer bg-black/40 hover:bg-gray-800/20"
                                    >
                                        <div className={`absolute inset-0 bg-gradient-to-r ${vibeGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                                        <div className="relative p-4 flex gap-6 items-center">
                                            {/* Date Badge */}
                                            <div className="flex-shrink-0 w-16 h-16 text-center bg-black/60 rounded-xl flex flex-col items-center justify-center border border-white/5 shadow-inner group-hover:border-blue-500/20 transition-colors">
                                                <div className="text-[10px] text-gray-500 uppercase font-black font-mono tracking-tighter">{new Date(stop.date).toLocaleDateString(undefined, { month: 'short' })}</div>
                                                <div className="text-2xl font-black text-white font-mono leading-none mt-1">{new Date(stop.date).getDate()}</div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <h4 className="text-lg font-black text-white truncate group-hover:text-blue-400 transition-colors tracking-tighter uppercase italic">{stop.city}</h4>
                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em] border ${isShow ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]' :
                                                        isTravel ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]' :
                                                            'bg-gray-800 text-gray-500 border-gray-700'
                                                        }`}>
                                                        {stop.activity}
                                                    </span>
                                                </div>
                                                <p className="text-gray-400 text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 mb-2 font-bold">
                                                    <span className="text-gray-600">@</span> {stop.venue}
                                                </p>
                                                <p className="text-[10px] text-gray-600 italic truncate max-w-lg font-mono flex items-center gap-2">
                                                    <span className="w-1 h-1 rounded-full bg-blue-500/40" />
                                                    {stop.notes}
                                                </p>
                                            </div>

                                            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                                                <motion.div
                                                    animate={{ x: [0, 5, 0] }}
                                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                                    className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20"
                                                >
                                                    <Plus size={14} className="text-blue-400" />
                                                </motion.div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </motion.div>
                    </div>
                ) : (
                    <div className="h-full relative overflow-hidden rounded-2xl border border-gray-800 group bg-black">
                        {/* Immersive Empty State */}
                        <div className="absolute inset-0 bg-gradient-to-b from-gray-900/40 to-black z-0" />

                        {/* Abstract road lines visual */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
                            <div className="absolute left-1/2 bottom-0 w-[1px] h-full bg-yellow-500/50 transform -translate-x-1/2 skew-x-[15deg] blur-[2px]" />
                            <div className="absolute left-1/2 bottom-0 w-[1px] h-full bg-yellow-500/50 transform -translate-x-1/2 skew-x-[-15deg] blur-[2px]" />
                            <div className="absolute left-0 bottom-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent blur-xl" />
                        </div>

                        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center p-16">
                            <motion.div
                                animate={{ y: [0, -10, 0], scale: [1, 1.05, 1] }}
                                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                                className="w-24 h-24 bg-gray-800/30 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-yellow-500/5 group-hover:shadow-yellow-500/20 transition-all duration-700 border border-white/5"
                            >
                                <Truck size={48} className="text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                            </motion.div>
                            <h3 className="text-3xl font-black text-white mb-4 uppercase italic tracking-tighter">Ready to hit the road?</h3>
                            <p className="text-gray-500 max-w-xs mx-auto leading-relaxed text-sm font-medium">
                                Initialize your tour parameters to generate an advanced logistics grid.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Layer */}
            {selectedStop && (
                <DaySheetModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    stop={selectedStop}
                    onSave={onUpdateStop}
                />
            )}
        </motion.div>
    );
};
