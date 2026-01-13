import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Gauge, Zap, Fuel, Clock, ArrowRight, AlertTriangle, CheckCircle2, Crosshair } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Itinerary, ItineraryStop } from '../types';
import { TourMap } from './TourMap';

interface FuelStats {
    milesDriven: number;
    fuelLevelPercent: number;
    tankSizeGallons: number;
    mpg: number;
    gasPricePerGallon: number;
    userId?: string;
}

interface OnTheRoadTabProps {
    currentLocation: string;
    setCurrentLocation: (loc: string) => void;
    handleFindGasStations: () => void;
    isFindingPlaces: boolean;
    nearbyPlaces: any[];
    fuelStats: FuelStats;
    setFuelStats: (stats: FuelStats) => void;
    handleCalculateFuel: () => void;
    isCalculatingFuel: boolean;
    fuelLogistics: any;
    itinerary: Itinerary | null;
}

export const OnTheRoadTab: React.FC<OnTheRoadTabProps> = ({
    currentLocation,
    setCurrentLocation,
    handleFindGasStations,
    isFindingPlaces,
    nearbyPlaces,
    fuelStats,
    setFuelStats,
    handleCalculateFuel,
    isCalculatingFuel,
    fuelLogistics,
    itinerary
}) => {
    // Find next stop logic
    const today = new Date();
    const nextStop = itinerary?.stops.find((s: ItineraryStop) => new Date(s.date) >= today) || itinerary?.stops[0];

    // Simulate telemetry updates


    const handleLocateMe = () => {
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                // Format as string for the input
                setCurrentLocation(`${latitude}, ${longitude}`);
            },
            (error) => {
                console.error("Geolocation failed:", error);
            }
        );
    };

    const estimatedRange = fuelStats.tankSizeGallons * fuelStats.mpg * (fuelStats.fuelLevelPercent / 100);

    return (
        <div className="flex flex-col gap-6 h-full">
            {/* Top Row: Command Center & Map */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
                {/* Main Telemetry / Command Center */}
                <Card className="lg:col-span-1 bg-[#161b22] border-gray-800 shadow-2xl flex flex-col justify-between overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity z-10">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] text-green-500 font-mono uppercase tracking-widest">Live Feed</span>
                        </div>
                    </div>

                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                            <Navigation className="text-blue-500" size={20} />
                            Command Center
                        </CardTitle>
                        <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Mission Control</p>
                    </CardHeader>

                    <CardContent className="flex-1 flex flex-col justify-center gap-6">
                        <div className="bg-bg-dark p-4 rounded-lg border border-gray-800">
                            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Next Destination</label>
                            {nextStop ? (
                                <div>
                                    <div className="text-2xl font-black text-white">{nextStop.city}</div>
                                    <div className="text-sm text-blue-400 font-mono">{nextStop.venue || "Venue TBD"}</div>
                                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-400 font-mono">
                                        <Clock size={12} />
                                        <span>ETA: {new Date(nextStop.date).toLocaleDateString()} @ 16:00</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-600 italic text-sm">No itinerary active.</div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="bg-bg-dark p-3 rounded-lg border border-gray-800 text-center">
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Distance Rem.</div>
                                <div className="text-2xl font-mono text-white">{nextStop?.distance !== undefined ? nextStop.distance : '--'} <span className="text-xs text-gray-600">MI</span></div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Map Display */}
                <Card className="lg:col-span-2 bg-bg-dark border-gray-800 rounded-xl overflow-hidden relative shadow-2xl p-0">
                    <TourMap locations={nextStop ? [currentLocation || 'Current Location', nextStop.city] : []} />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 flex justify-between items-end backdrop-blur-sm">
                        <div>
                            <h3 className="text-white font-bold text-sm">Live Route Tracking</h3>
                            <p className="text-xs text-blue-400 font-mono">Satellite Uplink Active</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-[10px] font-mono font-bold uppercase">
                                GPS: Locked
                            </div>
                            <div className="px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[10px] font-mono font-bold uppercase">
                                Traffic: Clear
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Bottom Row: Fuel & Logistics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-[300px]">
                {/* Fuel Telemetry */}
                <Card className="bg-[#161b22] border-gray-800 shadow-xl flex flex-col gap-4">
                    <CardHeader className="pb-0 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                                <Gauge className="text-orange-500" size={18} />
                                Data Telemetry
                            </CardTitle>
                            <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Vehicle Stats</p>
                        </div>
                        <Button
                            onClick={handleCalculateFuel}
                            disabled={isCalculatingFuel}
                            variant="secondary"
                            size="sm"
                            className="text-xs uppercase font-bold tracking-wider"
                            isLoading={isCalculatingFuel}
                        >
                            {!isCalculatingFuel && <Zap size={14} className="text-orange-500 mr-2" />}
                            Recalculate
                        </Button>
                    </CardHeader>

                    <CardContent className="flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-bold uppercase">Fuel Level (%)</label>
                                <input
                                    type="number"
                                    value={fuelStats.fuelLevelPercent}
                                    onChange={(e) => setFuelStats({ ...fuelStats, fuelLevelPercent: Number(e.target.value) })}
                                    className="w-full bg-bg-dark border border-gray-700 rounded p-2 text-sm text-white font-mono focus:border-orange-500 outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-bold uppercase">MPG (Avg)</label>
                                <input
                                    type="number"
                                    value={fuelStats.mpg}
                                    onChange={(e) => setFuelStats({ ...fuelStats, mpg: Number(e.target.value) })}
                                    className="w-full bg-bg-dark border border-gray-700 rounded p-2 text-sm text-white font-mono focus:border-orange-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Calculated Stats */}
                        <div className="mt-auto bg-bg-dark/50 border border-gray-800 rounded-lg p-4 grid grid-cols-3 gap-2">
                            <div className="text-center">
                                <div className="text-[10px] text-gray-500 uppercase font-bold">Range</div>
                                <div className={`text-xl font-mono font-bold ${estimatedRange < 50 ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>
                                    {Math.round(estimatedRange)} <span className="text-[10px]">mi</span>
                                </div>
                            </div>
                            <div className="text-center border-l border-gray-800">
                                <div className="text-[10px] text-gray-500 uppercase font-bold">Status</div>
                                <div className="text-xl font-mono font-bold text-white">
                                    {estimatedRange < 50 ? 'LOW' : 'GOOD'}
                                </div>
                            </div>
                            <div className="text-center border-l border-gray-800">
                                <div className="text-[10px] text-gray-500 uppercase font-bold">Efficiency</div>
                                <div className="text-xl font-mono font-bold text-blue-400">92%</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Logistics Radar */}
                <Card className="bg-[#161b22] border-gray-800 shadow-xl flex flex-col gap-4">
                    <CardHeader className="pb-0">
                        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                            <Fuel className="text-purple-500" size={18} />
                            Logistics Radar
                        </CardTitle>
                        <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Nearby Services</p>
                    </CardHeader>

                    <CardContent className="flex-1 flex flex-col gap-4 h-full">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Current Location..."
                                value={currentLocation}
                                onChange={(e) => setCurrentLocation(e.target.value)}
                                className="flex-1 bg-bg-dark border border-gray-700 rounded-lg p-2 text-sm text-white focus:border-purple-500 outline-none"
                            />
                            <Button
                                onClick={handleLocateMe}
                                variant="secondary"
                                className="px-3"
                                title="Use Current Location"
                            >
                                <Crosshair size={18} />
                            </Button>
                            <Button
                                onClick={handleFindGasStations}
                                disabled={isFindingPlaces}
                                className="bg-purple-500 hover:bg-purple-600"
                            >
                                {isFindingPlaces ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Navigation size={18} /></motion.div> : <Navigation size={18} />}
                            </Button>
                        </div>

                        <div className="flex-1 bg-bg-dark border border-gray-800 rounded-lg overflow-y-auto custom-scrollbar p-2">
                            {nearbyPlaces.length > 0 ? (
                                <div className="space-y-2">
                                    {nearbyPlaces.map((place, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-gray-800/30 rounded border border-gray-800 hover:border-purple-500/50 transition-colors">
                                            <div>
                                                <div className="text-sm font-bold text-white">{place.name}</div>
                                                <div className="text-xs text-gray-500">{place.vicinity}</div>
                                            </div>
                                            <div className="text-xs text-green-400 font-mono font-bold">OPEN</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2">
                                    <Fuel size={32} className="opacity-20" />
                                    <span className="text-xs italic">Scan for nearby amenities</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
