import React from 'react';
import { MapPin, Loader2, AlertTriangle } from 'lucide-react';

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
}

export const OnTheRoadTab: React.FC<OnTheRoadTabProps> = ({
    currentLocation, setCurrentLocation, handleFindGasStations, isFindingPlaces, nearbyPlaces,
    fuelStats, setFuelStats, handleCalculateFuel, isCalculatingFuel, fuelLogistics
}) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gas Station Finder */}
            <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <MapPin className="text-red-500" size={20} />
                    Find Gas Stations
                </h3>
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={currentLocation}
                        onChange={(e) => setCurrentLocation(e.target.value)}
                        placeholder="Enter current city..."
                        className="flex-1 bg-black/20 border border-gray-700 rounded-lg p-2 text-sm text-gray-300 focus:border-blue-500 outline-none"
                    />
                    <button
                        onClick={handleFindGasStations}
                        disabled={isFindingPlaces}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isFindingPlaces ? <Loader2 className="animate-spin" size={20} /> : "Search"}
                    </button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {nearbyPlaces.map((place, i) => (
                        <div key={i} className="bg-black/20 p-3 rounded-lg border border-gray-800">
                            <div className="flex justify-between items-start">
                                <h4 className="font-bold text-white">{place.name}</h4>
                                <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">
                                    {place.rating} ★ ({place.user_ratings_total})
                                </span>
                            </div>
                            <p className="text-sm text-gray-400">{place.address}</p>
                            {place.open_now !== undefined && (
                                <p className={`text-xs mt-1 ${place.open_now ? 'text-green-400' : 'text-red-400'}`}>
                                    {place.open_now ? 'Open Now' : 'Closed'}
                                </p>
                            )}
                        </div>
                    ))}
                    {nearbyPlaces.length === 0 && !isFindingPlaces && (
                        <div className="text-center text-gray-500 py-8">
                            No gas stations found yet.
                        </div>
                    )}
                </div>
            </div>

            {/* Fuel Calculator */}
            <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="text-orange-500" size={20} />
                    Fuel & Logistics
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Miles Driven</label>
                        <input
                            type="number"
                            value={fuelStats.milesDriven}
                            onChange={(e) => setFuelStats({ ...fuelStats, milesDriven: Number(e.target.value) })}
                            className="w-full bg-black/20 border border-gray-700 rounded-lg p-2 text-sm text-gray-300"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Fuel Level (%)</label>
                        <input
                            type="number"
                            value={fuelStats.fuelLevelPercent}
                            onChange={(e) => setFuelStats({ ...fuelStats, fuelLevelPercent: Number(e.target.value) })}
                            className="w-full bg-black/20 border border-gray-700 rounded-lg p-2 text-sm text-gray-300"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Tank Size (Gal)</label>
                        <input
                            type="number"
                            value={fuelStats.tankSizeGallons}
                            onChange={(e) => setFuelStats({ ...fuelStats, tankSizeGallons: Number(e.target.value) })}
                            className="w-full bg-black/20 border border-gray-700 rounded-lg p-2 text-sm text-gray-300"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">MPG</label>
                        <input
                            type="number"
                            value={fuelStats.mpg}
                            onChange={(e) => setFuelStats({ ...fuelStats, mpg: Number(e.target.value) })}
                            className="w-full bg-black/20 border border-gray-700 rounded-lg p-2 text-sm text-gray-300"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs text-gray-400 mb-1">Gas Price ($/Gal)</label>
                        <input
                            type="number"
                            value={fuelStats.gasPricePerGallon}
                            onChange={(e) => setFuelStats({ ...fuelStats, gasPricePerGallon: Number(e.target.value) })}
                            className="w-full bg-black/20 border border-gray-700 rounded-lg p-2 text-sm text-gray-300"
                        />
                    </div>
                </div>

                <button
                    onClick={handleCalculateFuel}
                    disabled={isCalculatingFuel}
                    className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 mb-6"
                >
                    {isCalculatingFuel ? <Loader2 className="animate-spin" size={20} /> : "Calculate Logistics"}
                </button>

                {fuelLogistics && (
                    <div className="bg-black/30 rounded-xl p-4 border border-gray-700">
                        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                            <div className="bg-gray-800 p-2 rounded">
                                <div className="text-xs text-gray-400">Range</div>
                                <div className="text-lg font-bold text-white">{fuelLogistics.rangeRemaining} mi</div>
                            </div>
                            <div className="bg-gray-800 p-2 rounded">
                                <div className="text-xs text-gray-400">Fill Up</div>
                                <div className="text-lg font-bold text-white">{fuelLogistics.gallonsToFill} gal</div>
                            </div>
                            <div className="bg-gray-800 p-2 rounded">
                                <div className="text-xs text-gray-400">Cost</div>
                                <div className="text-lg font-bold text-green-400">${fuelLogistics.costToFill}</div>
                            </div>
                        </div>
                        <div className="text-sm text-gray-300 italic border-l-2 border-orange-500 pl-3">
                            "{fuelLogistics.commentary}"
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
