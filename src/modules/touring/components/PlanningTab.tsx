import { MapPin, Truck, Loader2, Plus, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
                            <label className="block text-sm text-gray-400 mb-1 font-mono uppercase tracking-widest text-[10px]">Dates</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="date"
                                    aria-label="Start Date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-black/20 border border-gray-700 rounded-lg p-2 text-sm text-gray-300 focus:border-blue-500 outline-none w-full font-mono"
                                />
                                <input
                                    type="date"
                                    aria-label="End Date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-black/20 border border-gray-700 rounded-lg p-2 text-sm text-gray-300 focus:border-blue-500 outline-none w-full font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1 font-mono uppercase tracking-widest text-[10px]">Locations</label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={newLocation}
                                    onChange={(e) => setNewLocation(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
                                    placeholder="Add a city..."
                                    className="flex-1 bg-black/20 border border-gray-700 rounded-lg p-2 text-sm text-gray-300 focus:border-blue-500 outline-none"
                                />
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleAddLocation}
                                    aria-label="Add location"
                                    className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors"
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
                                            className="flex items-center gap-1 bg-gray-800 px-2 py-1 rounded text-sm text-gray-300 border border-gray-700"
                                        >
                                            {loc}
                                            <button onClick={() => handleRemoveLocation(idx)} aria-label={`Remove ${loc}`} className="hover:text-red-400">
                                                <Trash2 size={14} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleGenerateItinerary}
                            disabled={isGenerating || locations.length === 0 || !startDate || !endDate}
                            className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-900/20 uppercase tracking-widest text-sm"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Calculating Route...
                                </>
                            ) : (
                                <>
                                    <Truck size={20} />
                                    Generate Itinerary
                                </>
                            )}
                        </motion.button>
                    </div>
                </motion.div>
            </div>

            {/* Itinerary Display */}
            <div className="lg:col-span-2 space-y-6">
                {itinerary ? (
                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 relative overflow-hidden">
                        {/* Background Ambience */}
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-blue-900/10 pointer-events-none" />

                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <div>
                                <h2 className="text-3xl font-bold text-white tracking-tight">{itinerary.tourName}</h2>
                                <p className="text-gray-400 mt-1 flex items-center gap-2">
                                    <span className="bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-300 border border-gray-700">
                                        {itinerary.totalDistance}
                                    </span>
                                    <span className="text-gray-600">•</span>
                                    <span className="text-green-400 font-medium">{itinerary.estimatedBudget}</span>
                                </p>
                            </div>
                            <button
                                onClick={handleCheckLogistics}
                                disabled={isCheckingLogistics}
                                className="px-5 py-2.5 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg transition-all border border-gray-700/50 backdrop-blur-sm flex items-center gap-2 text-sm font-medium shadow-lg hover:shadow-xl"
                            >
                                {isCheckingLogistics ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} className="text-green-500" />}
                                Check Logistics
                            </button>
                        </div>

                        {logisticsReport && (
                            <div className={`mb-8 p-6 rounded-xl border backdrop-blur-md relative z-10 ${logisticsReport.isFeasible ? 'bg-green-950/30 border-green-500/30' : 'bg-red-950/30 border-red-500/30'}`}>
                                <h4 className={`text-lg font-bold mb-3 flex items-center gap-2 ${logisticsReport.isFeasible ? 'text-green-400' : 'text-red-400'}`}>
                                    {logisticsReport.isFeasible ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                                    Logistics Analysis
                                </h4>
                                {logisticsReport.issues.length > 0 && (
                                    <ul className="space-y-2 mb-4">
                                        {logisticsReport.issues.map((issue: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                                <span className="text-red-500 mt-0.5">•</span> {issue}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {logisticsReport.suggestions.length > 0 && (
                                    <ul className="space-y-2">
                                        {logisticsReport.suggestions.map((suggestion: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                                <span className="text-blue-500 mt-0.5">ℹ</span> {suggestion}
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
                            className="space-y-4 relative z-10"
                        >
                            {itinerary.stops.map((stop: any, idx: number) => {
                                // Determine vibe based on activity
                                const isShow = stop.activity === 'Show';
                                const isTravel = stop.activity === 'Travel';

                                // Placeholder gradients until images are generated
                                const vibeGradient = isShow
                                    ? 'from-purple-900/40 via-purple-900/20 to-transparent'
                                    : isTravel
                                        ? 'from-blue-900/40 via-blue-900/20 to-transparent'
                                        : 'from-gray-800/40 via-gray-900/20 to-transparent';

                                return (
                                    <motion.div
                                        key={idx}
                                        variants={{
                                            hidden: { y: 20, opacity: 0 },
                                            visible: { y: 0, opacity: 1 }
                                        }}
                                        className="group relative overflow-hidden rounded-xl border border-gray-800 hover:border-blue-500/50 transition-all duration-300"
                                    >
                                        {/* Card visual background */}
                                        <div className={`absolute inset-0 bg-gradient-to-r ${vibeGradient} opacity-50 group-hover:opacity-70 transition-opacity`} />

                                        <div className="relative p-5 flex gap-6 items-center">
                                            {/* Date Badge */}
                                            <div className="flex-shrink-0 w-16 text-center bg-black/40 rounded-lg p-2 border border-white/5 backdrop-blur-sm group-hover:border-blue-500/30 transition-colors">
                                                <div className="text-xs text-gray-400 uppercase tracking-wider font-mono">{new Date(stop.date).toLocaleDateString(undefined, { month: 'short' })}</div>
                                                <div className="text-2xl font-bold text-white font-mono">{new Date(stop.date).getDate()}</div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <h4 className="text-xl font-bold text-white truncate group-hover:text-blue-400 transition-colors tracking-tight">{stop.city}</h4>
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${isShow ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' :
                                                        isTravel ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' :
                                                            'bg-gray-700 text-gray-300'
                                                        }`}>
                                                        {stop.activity}
                                                    </span>
                                                </div>
                                                <p className="text-gray-300 text-sm font-medium mb-1 flex items-center gap-2">
                                                    {isShow ? '🏟️' : isTravel ? '🚌' : '📍 '}{stop.venue}
                                                </p>
                                                <p className="text-xs text-gray-500 italic truncate max-w-lg font-mono">
                                                    <span className="text-blue-500/50 mr-2 uppercase tracking-tighter">Note:</span>
                                                    {stop.notes}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </motion.div>
                    </div>
                ) : (
                    <div className="h-full relative overflow-hidden rounded-xl border border-gray-800 group">
                        {/* Immersive Empty State */}
                        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black z-0" />

                        {/* Abstract road lines visual since we lack the image */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none">
                            <div className="absolute left-1/2 bottom-0 w-1 h-1/2 bg-yellow-500/50 transform -translate-x-1/2 blur-[1px]" />
                            <div className="absolute left-1/4 bottom-0 w-32 h-64 bg-purple-500/10 rounded-full blur-3xl" />
                            <div className="absolute right-1/4 top-10 w-32 h-64 bg-blue-500/10 rounded-full blur-3xl" />
                        </div>

                        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center p-12">
                            <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-yellow-900/20 group-hover:scale-110 transition-transform duration-500 border border-white/5">
                                <Truck size={40} className="text-yellow-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Ready to hit the road?</h3>
                            <p className="text-gray-400 max-w-sm mx-auto leading-relaxed">
                                Enter your tour dates and locations to generate a comprehensive itinerary with logistics analysis.
                            </p>

                            {/* Decorative elements */}
                            <div className="mt-12 flex gap-4 opacity-30 grayscale group-hover:grayscale-0 transition-all duration-700">
                                <div className="h-24 w-16 bg-gray-800 rounded-lg border border-gray-700 transform -rotate-6" />
                                <div className="h-24 w-16 bg-gray-800 rounded-lg border border-gray-700 transform translate-y-4" />
                                <div className="h-24 w-16 bg-gray-800 rounded-lg border border-gray-700 transform rotate-6" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
