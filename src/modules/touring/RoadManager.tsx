import React, { useState } from 'react';
import { Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/core/context/ToastContext';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { PlanningTab } from './components/PlanningTab';
import { OnTheRoadTab } from './components/OnTheRoadTab';

import { useTouring } from './hooks/useTouring';
import { Itinerary, ItineraryStop } from './types';
import { MobileOnlyWarning } from '@/core/components/MobileOnlyWarning';

interface LogisticsReport {
    isFeasible: boolean;
    issues: string[];
    suggestions: string[];
}

const RoadManager: React.FC = () => {
    // Hooks must be called unconditionally before early returns
    const toast = useToast();
    const {
        currentItinerary: itinerary,
        setCurrentItinerary,
        saveItinerary,
        updateItineraryStop,
        vehicleStats,
        saveVehicleStats,
        loading: touringLoading
    } = useTouring();

    const [locations, setLocations] = useState<string[]>([]);
    const [newLocation, setNewLocation] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const [isCheckingLogistics, setIsCheckingLogistics] = useState(false);
    const [logisticsReport, setLogisticsReport] = useState<LogisticsReport | null>(null);

    const [activeTab, setActiveTab] = useState<'planning' | 'on-the-road'>('planning');

    // On the Road State
    const [currentLocation, setCurrentLocation] = useState('');
    const [nearbyPlaces, setNearbyPlaces] = useState<any[]>([]);
    const [isFindingPlaces, setIsFindingPlaces] = useState(false);

    // Fuel Stats managed by Firestore now
    // const [fuelStats, setFuelStats] = useState(...) -> replaced by vehicleStats

    const [fuelLogistics, setFuelLogistics] = useState<any>(null);
    const [isCalculatingFuel, setIsCalculatingFuel] = useState(false);

    // Check if device is mobile AFTER hooks are called
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    if (isMobile) {
        return (
            <MobileOnlyWarning
                featureName="Road Manager"
                reason="The calendar view and itinerary planning features require a larger screen for optimal tour scheduling and logistics management."
                suggestedModule="marketing"
            />
        );
    }

    const handleAddLocation = () => {
        if (newLocation.trim()) {
            setLocations([...locations, newLocation.trim()]);
            setNewLocation('');
        }
    };

    const handleRemoveLocation = (index: number) => {
        setLocations(locations.filter((_, i) => i !== index));
    };

    const handleGenerateItinerary = async () => {
        if (locations.length === 0 || !startDate || !endDate) {
            toast.error("Please provide locations and dates.");
            return;
        }

        setIsGenerating(true);
        // setItinerary(null); // Managed by hook now
        setLogisticsReport(null);

        try {
            const generateItinerary = httpsCallable(functions, 'generateItinerary');
            const response = await generateItinerary({ locations, dates: { start: startDate, end: endDate } });
            const result = response.data as Itinerary;

            await saveItinerary({
                ...result,
                tourName: `Tour ${startDate} - ${locations[0]}`
            });

            toast.success("Itinerary generated and saved");
        } catch (error) {
            // console.error("Itinerary Generation Failed:", error);
            toast.error("Failed to generate itinerary");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCheckLogistics = async () => {
        if (!itinerary) return;

        setIsCheckingLogistics(true);
        try {
            const checkLogistics = httpsCallable(functions, 'checkLogistics');
            const response = await checkLogistics({ itinerary });
            const result = response.data as LogisticsReport;
            setLogisticsReport(result);
            toast.success("Logistics check complete");
        } catch (error) {
            // console.error("Logistics Check Failed:", error);
            toast.error("Failed to check logistics");
        } finally {
            setIsCheckingLogistics(false);
        }
    };

    const handleFindGasStations = async () => {
        if (!currentLocation) {
            toast.error("Please enter a location");
            return;
        }
        setIsFindingPlaces(true);
        try {
            const findPlaces = httpsCallable(functions, 'findPlaces');
            const response = await findPlaces({ location: currentLocation, type: 'gas_station' });
            const result = response.data as any;
            setNearbyPlaces(result.places);
            toast.success("Found gas stations nearby");
        } catch (error) {
            // console.error("Find Places Failed:", error);
            toast.error("Failed to find gas stations");
        } finally {
            setIsFindingPlaces(false);
        }
    };

    const handleCalculateFuel = async () => {
        setIsCalculatingFuel(true);
        try {
            const calculateFuelLogistics = httpsCallable(functions, 'calculateFuelLogistics');
            const response = await calculateFuelLogistics(vehicleStats);
            const result = response.data as any;
            setFuelLogistics(result);
            toast.success("Fuel logistics calculated");
        } catch (error) {
            // console.error("Fuel Calc Failed:", error);
            toast.error("Failed to calculate fuel logistics");
        } finally {
            setIsCalculatingFuel(false);
        }
    };

    const handleUpdateStop = async (updatedStop: any) => {
        if (!itinerary) return;

        // Optimistic UI Update
        const newStops = itinerary.stops.map(s => {
            if (s.date === updatedStop.date) {
                return updatedStop;
            }
            return s;
        });
        setCurrentItinerary({ ...itinerary, stops: newStops });

        try {
             // Find index of stop
            const index = itinerary.stops.findIndex(s => s.date === updatedStop.date);
            if (index !== -1) {
                await updateItineraryStop(index, updatedStop);
                toast.success("Day sheet updated");
            }
        } catch (err) {
             console.error("Failed to update stop", err);
             toast.error("Failed to update stop");
             // Revert or fetch latest state could be added here if needed,
             // but strictly speaking, we are just connecting the API cleanly now.
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0d1117] text-white p-6 overflow-y-auto selection:bg-yellow-500/30">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between mb-10 pb-6 border-b border-gray-800/50"
            >
                <div>
                    <h1 className="text-4xl font-black mb-2 flex items-center gap-4 tracking-tighter uppercase font-mono italic">
                        <Truck className="text-yellow-500" size={36} />
                        Road Manager
                    </h1>
                    <p className="text-gray-500 font-mono text-xs uppercase tracking-[0.3em] font-bold">
                        Systems Overdrive <span className="text-yellow-500/50">::</span> Tour Logistics Shell V2.1
                    </p>
                </div>
                <div className="flex bg-black/40 backdrop-blur-xl rounded-xl p-1.5 border border-gray-800 shadow-2xl">
                    <button
                        onClick={() => setActiveTab('planning')}
                        className={`relative px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-300 z-10 ${activeTab === 'planning' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        {activeTab === 'planning' && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-gray-800 border border-gray-700 rounded-lg -z-10 shadow-lg"
                                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        Tour Planning
                    </button>
                    <button
                        onClick={() => setActiveTab('on-the-road')}
                        className={`relative px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-300 z-10 ${activeTab === 'on-the-road' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        {activeTab === 'on-the-road' && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-gray-800 border border-gray-700 rounded-lg -z-10 shadow-lg"
                                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        On The Road
                    </button>
                </div>
            </motion.div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: activeTab === 'planning' ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: activeTab === 'planning' ? 20 : -20 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="flex-1"
                >
                    {activeTab === 'planning' ? (
                        <PlanningTab
                            startDate={startDate}
                            setStartDate={setStartDate}
                            endDate={endDate}
                            setEndDate={setEndDate}
                            locations={locations}
                            newLocation={newLocation}
                            setNewLocation={setNewLocation}
                            handleAddLocation={handleAddLocation}
                            handleRemoveLocation={handleRemoveLocation}
                            handleGenerateItinerary={handleGenerateItinerary}
                            isGenerating={isGenerating}
                            itinerary={itinerary}
                            handleCheckLogistics={handleCheckLogistics}
                            isCheckingLogistics={isCheckingLogistics}
                            logisticsReport={logisticsReport}
                            onUpdateStop={handleUpdateStop}
                        />
                    ) : (
                        <OnTheRoadTab
                            currentLocation={currentLocation}
                            setCurrentLocation={setCurrentLocation}
                            handleFindGasStations={handleFindGasStations}
                            isFindingPlaces={isFindingPlaces}
                            nearbyPlaces={nearbyPlaces}
                            fuelStats={vehicleStats || { // Fallback to avoid crash if loading or null
                                milesDriven: 0,
                                fuelLevelPercent: 50,
                                tankSizeGallons: 15,
                                mpg: 8,
                                gasPricePerGallon: 3.50
                            }}
                            setFuelStats={saveVehicleStats}
                            handleCalculateFuel={handleCalculateFuel}
                            isCalculatingFuel={isCalculatingFuel}
                            fuelLogistics={fuelLogistics}
                            itinerary={itinerary}
                        />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default RoadManager;
