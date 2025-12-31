import React from 'react';
import { MapPin, Loader2, AlertTriangle, Calendar, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiderChecklist } from './RiderChecklist';

interface OnTheRoadTabProps {
    currentLocation: string;
    setCurrentLocation: (loc: string) => void;
    handleFindGasStations: () => void;
    isFindingPlaces: boolean;
    nearbyPlaces: any[];
    fuelStats: any;
    setFuelStats: (stats: any) => void;
    handleCalculateFuel: () => void;
    isCalculatingFuel: boolean;
    fuelLogistics: any;
    itinerary: any | null;
}

export const OnTheRoadTab: React.FC<OnTheRoadTabProps> = ({
    currentLocation, setCurrentLocation, handleFindGasStations, isFindingPlaces, nearbyPlaces,
    fuelStats, setFuelStats, handleCalculateFuel, isCalculatingFuel, fuelLogistics, itinerary
}) => {
    // Mock "Today's" stop for UI purposes if itinerary exists
    const currentStop = itinerary?.stops?.[0];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
            {/* Left Column: Navigation & Fuel */}
            <div className="lg:col-span-2 space-y-6">

                {/* Dashboard Header */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="bg-gradient-to-r from-blue-900/40 to-black border border-blue-900/30 rounded-xl p-6 relative overflow-hidden"
                >
                    <div className="relative z-10">
                        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <Navigation className="text-blue-400" />
                            Command Center
                        </h2>
                        {currentStop ? (
                            <motion.div
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex items-center gap-6 mt-4"
                            >
                                <div>
                                    <div className="text-xs text-blue-300 uppercase font-bold tracking-wider">Next Stop</div>
                                    <div className="text-3xl font-bold text-white">{currentStop.city}</div>
                                    <div className="text-sm text-gray-300">{currentStop.venue}</div>
                                </div>
                                <div className="h-12 w-px bg-blue-500/30"></div>
                                <div>
                                    <div className="text-xs text-blue-300 uppercase font-bold tracking-wider">Doors</div>
                                    <div className="text-2xl font-mono text-white">19:00</div>
                                </div>
                                <div>
                                    <div className="text-xs text-blue-300 uppercase font-bold tracking-wider">Set</div>
                                    <div className="text-2xl font-mono text-white">21:00</div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="mt-2 text-gray-400 flex items-center gap-2">
                                <Loader2 className="animate-spin" size={16} />
                                <span className="text-sm">Awaiting itinerary data...</span>
                            </div>
                        )}
                    </div>
                    {/* Decorative background elements for header */}
                    <motion.div
                        animate={{
                            opacity: [0.1, 0.2, 0.1],
                            x: [0, 5, 0]
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-blue-600/10 to-transparent skew-x-12"
                    />
                </motion.div>

                {/* Main Content Grid (Gas Station + Fuel) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full relative">
                    {/* Background Ambience tailored for "On The Road" */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-900/10 via-black to-black pointer-events-none" />

                    {/* Gas Station Finder - "Radar" Style */}
                    <div className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-xl p-6 flex flex-col relative overflow-hidden group">
                        {/* Radar Sweep Animation */}
                        <motion.div
                            animate={{
                                left: ["-100%", "100%"]
                            }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            className="absolute top-0 w-1/2 h-full bg-gradient-to-r from-transparent via-blue-500/10 to-transparent skew-x-12 pointer-events-none"
                        />
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />

                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3 tracking-wide">
                            <div className="relative">
                                <MapPin className="text-blue-500 relative z-10" size={24} />
                                <div className="absolute inset-0 bg-blue-500 blur-md opacity-40 animate-pulse" />
                            </div>
                            LOGISTICS RADAR
                        </h3>

                        <div className="flex gap-2 mb-6">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={currentLocation}
                                    onChange={(e) => setCurrentLocation(e.target.value)}
                                    placeholder="Enter current city..."
                                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg py-3 px-4 text-sm text-gray-100 focus:border-blue-500 outline-none transition-all placeholder:text-gray-600 font-mono"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleFindGasStations}
                                disabled={isFindingPlaces}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isFindingPlaces ? <Loader2 className="animate-spin" size={20} /> : "SCAN"}
                            </motion.button>
                        </div>

                        <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
                            <AnimatePresence mode="popLayout">
                                {nearbyPlaces.map((place, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="group/item bg-gray-800/30 hover:bg-gray-800/50 p-4 rounded-lg border border-gray-800 hover:border-blue-500/30 transition-all cursor-default relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                        <div className="flex justify-between items-start relative z-10">
                                            <h4 className="font-bold text-gray-200 group-hover/item:text-blue-400 transition-colors uppercase tracking-tight">{place.name}</h4>
                                            <span className="text-xs font-mono bg-black/40 px-2 py-1 rounded text-yellow-500 border border-yellow-500/20">
                                                {place.rating} ★
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-400 mt-1 font-mono text-xs opacity-70">{place.address}</p>
                                        <div className="flex items-center gap-2 mt-3">
                                            <div className={`h-1.5 w-1.5 rounded-full ${place.open_now ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
                                            <span className={`text-[10px] uppercase font-bold tracking-wider ${place.open_now ? 'text-green-500' : 'text-red-500'}`}>
                                                {place.open_now ? 'Operational' : 'Closed'}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {nearbyPlaces.length === 0 && !isFindingPlaces && (
                                <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50 py-12">
                                    <div className="w-16 h-16 border-2 border-gray-700 rounded-full flex items-center justify-center mb-4">
                                        <div className="w-1 h-8 bg-gray-700 rotate-45 transform origin-bottom animate-[spin_4s_linear_infinite]" />
                                    </div>
                                    <p className="font-mono text-xs uppercase tracking-widest">Radar Idle</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Fuel Calculator - "Cockpit" Style */}
                    <div className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-xl p-8 relative overflow-hidden flex flex-col">
                        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-transparent via-orange-500 to-transparent opacity-50" />

                        <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3 tracking-wide">
                            <div className="relative">
                                <AlertTriangle className="text-orange-500 relative z-10" size={24} />
                                <div className="absolute inset-0 bg-orange-500 blur-md opacity-40 animate-pulse" />
                            </div>
                            FUEL TELEMETRY
                        </h3>

                        <div className="grid grid-cols-2 gap-x-8 gap-y-8 mb-8">
                            <div className="relative group">
                                <label className="text-[10px] text-orange-500/70 font-mono uppercase tracking-widest absolute -top-3 left-0 bg-[#0d1117] px-1">Odometer (mi)</label>
                                <input
                                    type="number"
                                    value={fuelStats.milesDriven}
                                    onChange={(e) => setFuelStats({ ...fuelStats, milesDriven: Number(e.target.value) })}
                                    className="w-full bg-transparent border-b-2 border-gray-700 focus:border-orange-500 text-2xl font-mono text-white py-2 outline-none transition-colors text-right"
                                />
                            </div>
                            <div className="relative group">
                                <label className="text-[10px] text-orange-500/70 font-mono uppercase tracking-widest absolute -top-3 left-0 bg-[#0d1117] px-1">Fuel Level (%)</label>
                                <input
                                    type="number"
                                    value={fuelStats.fuelLevelPercent}
                                    onChange={(e) => setFuelStats({ ...fuelStats, fuelLevelPercent: Number(e.target.value) })}
                                    className="w-full bg-transparent border-b-2 border-gray-700 focus:border-orange-500 text-2xl font-mono text-white py-2 outline-none transition-colors text-right"
                                />
                                {/* Visual bar for fuel level */}
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, Math.max(0, fuelStats.fuelLevelPercent))}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="absolute bottom-0 left-0 h-1 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"
                                />
                            </div>
                            <div className="relative group">
                                <label className="text-[10px] text-gray-500 font-mono uppercase tracking-widest absolute -top-3 left-0 bg-[#0d1117] px-1">Tank Cap (Gal)</label>
                                <input
                                    type="number"
                                    value={fuelStats.tankSizeGallons}
                                    onChange={(e) => setFuelStats({ ...fuelStats, tankSizeGallons: Number(e.target.value) })}
                                    className="w-full bg-transparent border-b border-gray-800 focus:border-gray-500 text-xl font-mono text-gray-400 py-2 outline-none transition-colors text-right"
                                />
                            </div>
                            <div className="relative group">
                                <label className="text-[10px] text-gray-500 font-mono uppercase tracking-widest absolute -top-3 left-0 bg-[#0d1117] px-1">Consumption (MPG)</label>
                                <input
                                    type="number"
                                    value={fuelStats.mpg}
                                    onChange={(e) => setFuelStats({ ...fuelStats, mpg: Number(e.target.value) })}
                                    className="w-full bg-transparent border-b border-gray-800 focus:border-gray-500 text-xl font-mono text-gray-400 py-2 outline-none transition-colors text-right"
                                />
                            </div>
                            <div className="col-span-2 relative group mt-2">
                                <label className="text-[10px] text-green-500/70 font-mono uppercase tracking-widest absolute -top-3 left-0 bg-[#0d1117] px-1">Market Price ($/Gal)</label>
                                <input
                                    type="number"
                                    value={fuelStats.gasPricePerGallon}
                                    onChange={(e) => setFuelStats({ ...fuelStats, gasPricePerGallon: Number(e.target.value) })}
                                    className="w-full bg-transparent border-b-2 border-gray-700 focus:border-green-500 text-2xl font-mono text-green-400 py-2 outline-none transition-colors text-right"
                                />
                            </div>
                        </div>

                        <div className="mt-auto">
                            <motion.button
                                whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleCalculateFuel}
                                disabled={isCalculatingFuel}
                                className="w-full py-4 bg-gradient-to-r from-orange-700 to-red-700 hover:from-orange-600 hover:to-red-600 text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-orange-900/40 border border-white/10 flex items-center justify-center gap-3 uppercase tracking-wider mb-8 group"
                            >
                                {isCalculatingFuel ? <Loader2 className="animate-spin" size={24} /> : (
                                    <>
                                        <span className="group-hover:scale-110 transition-transform">RUN DIAGNOSTICS</span>
                                    </>
                                )}
                            </motion.button>

                            <AnimatePresence>
                                {fuelLogistics && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="bg-black/60 rounded-xl border border-gray-800 relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
                                        <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800">
                                            <div className="p-4 text-center">
                                                <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1">Range</div>
                                                <div className="text-xl font-bold text-white font-mono">{fuelLogistics.rangeRemaining} <span className="text-xs text-gray-600">mi</span></div>
                                            </div>
                                            <div className="p-4 text-center">
                                                <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1">Refuel</div>
                                                <div className="text-xl font-bold text-orange-400 font-mono">{fuelLogistics.gallonsToFill} <span className="text-xs text-orange-600/70">gal</span></div>
                                            </div>
                                            <div className="p-4 text-center">
                                                <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1">Est. Cost</div>
                                                <div className="text-xl font-bold text-green-400 font-mono">${fuelLogistics.costToFill}</div>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-orange-900/10">
                                            <p className="text-sm text-orange-200/80 italic font-mono leading-relaxed">
                                                {">"} SYSTEM_MSG: "{fuelLogistics.commentary}"
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Rider Checklist */}
            <div className="space-y-6">
                {/* Rider Checklist Component */}
                <RiderChecklist />

                {/* Additional "On The Road" Widgets could go here */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 0.6, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="bg-[#161b22] border border-gray-800 rounded-xl p-6"
                >
                    <div className="flex items-center gap-2 mb-4 text-gray-400">
                        <Calendar size={18} />
                        <h3 className="font-semibold text-sm uppercase tracking-wider">Day Sheet</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="p-3 bg-black/40 rounded border border-gray-800 flex justify-between items-center">
                            <span className="text-xs text-gray-500">Lobibay Call</span>
                            <span className="text-sm font-mono text-gray-300">11:00 AM</span>
                        </div>
                        <div className="p-3 bg-black/40 rounded border border-gray-800 flex justify-between items-center">
                            <span className="text-xs text-gray-500">Soundcheck</span>
                            <span className="text-sm font-mono text-gray-300">4:00 PM</span>
                        </div>
                        <div className="p-3 bg-black/40 rounded border border-gray-800 flex justify-between items-center">
                            <span className="text-xs text-gray-500">Dinner</span>
                            <span className="text-sm font-mono text-gray-300">6:00 PM</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};
