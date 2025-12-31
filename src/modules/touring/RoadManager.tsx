import React, { useState } from 'react';
import { Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/core/context/ToastContext';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { PlanningTab } from './components/PlanningTab';
import { OnTheRoadTab } from './components/OnTheRoadTab';

interface ItineraryStop {
    date: string;
    city: string;
    venue: string;
    activity: string;
    notes: string;
}

interface Itinerary {
    tourName: string;
    stops: ItineraryStop[];
    totalDistance: string;
    estimatedBudget: string;
}

interface LogisticsReport {
    isFeasible: boolean;
    issues: string[];
    suggestions: string[];
}

const RoadManager: React.FC = () => {
    const toast = useToast();
    const [locations, setLocations] = useState<string[]>([]);
    const [newLocation, setNewLocation] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [itinerary, setItinerary] = useState<Itinerary | null>(null);
    const [isCheckingLogistics, setIsCheckingLogistics] = useState(false);
    const [logisticsReport, setLogisticsReport] = useState<LogisticsReport | null>(null);

    const [activeTab, setActiveTab] = useState<'planning' | 'on-the-road'>('planning');

    // On the Road State
    const [currentLocation, setCurrentLocation] = useState('');
    const [nearbyPlaces, setNearbyPlaces] = useState<any[]>([]);
    const [isFindingPlaces, setIsFindingPlaces] = useState(false);

    const [fuelStats, setFuelStats] = useState({
        milesDriven: 0,
        fuelLevelPercent: 50,
        tankSizeGallons: 15,
        mpg: 12, // Junkie truck MPG
        gasPricePerGallon: 3.50
    });
    const [fuelLogistics, setFuelLogistics] = useState<any>(null);
    const [isCalculatingFuel, setIsCalculatingFuel] = useState(false);

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
        setItinerary(null);
        setLogisticsReport(null);

        try {
            const generateItinerary = httpsCallable(functions, 'generateItinerary');
            const response = await generateItinerary({ locations, dates: { start: startDate, end: endDate } });
            const result = response.data as Itinerary;
            setItinerary(result);
            toast.success("Itinerary generated");
        } catch (error) {
            console.error("Itinerary Generation Failed:", error);
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
            console.error("Logistics Check Failed:", error);
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
            console.error("Find Places Failed:", error);
            toast.error("Failed to find gas stations");
        } finally {
            setIsFindingPlaces(false);
        }
    };

    const handleCalculateFuel = async () => {
        setIsCalculatingFuel(true);
        try {
            const calculateFuelLogistics = httpsCallable(functions, 'calculateFuelLogistics');
            const response = await calculateFuelLogistics(fuelStats);
            const result = response.data as any;
            setFuelLogistics(result);
            toast.success("Fuel logistics calculated");
        } catch (error) {
            console.error("Fuel Calc Failed:", error);
            toast.error("Failed to calculate fuel logistics");
        } finally {
            setIsCalculatingFuel(false);
        }
    };

    const handleUpdateStop = (updatedStop: any) => {
        if (!itinerary) return;
        const newStops = itinerary.stops.map(s => {
            // Match by date or some ID. Assuming date is unique for now.
            if (s.date === updatedStop.date) {
                return updatedStop;
            }
            return s;
        });
        setItinerary({ ...itinerary, stops: newStops });
        toast.success("Day sheet updated");
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
                            fuelStats={fuelStats}
                            setFuelStats={setFuelStats}
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
