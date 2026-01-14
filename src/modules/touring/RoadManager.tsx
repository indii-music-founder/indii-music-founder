import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/core/context/ToastContext';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { PlanningTab } from './components/PlanningTab';
import { OnTheRoadTab } from './components/OnTheRoadTab';
import { useTouring } from './hooks/useTouring';
import { Itinerary } from './types';
import { MobileOnlyWarning } from '@/core/components/MobileOnlyWarning';
import { RoadManagerSidebar } from './components/RoadManagerSidebar';
import { RiderChecklist } from './components/RiderChecklist';

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

    // Core State
    const [locations, setLocations] = useState<string[]>([]);
    const [newLocation, setNewLocation] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Feature Tabs
    const [activeTab, setActiveTab] = useState<'planning' | 'on-the-road' | 'rider'>('planning');

    // Logistics State
    const [isCheckingLogistics, setIsCheckingLogistics] = useState(false);
    const [logisticsReport, setLogisticsReport] = useState<LogisticsReport | null>(null);

    // On the Road State
    const [currentLocation, setCurrentLocation] = useState('');
    const [nearbyPlaces, setNearbyPlaces] = useState<any[]>([]);
    const [isFindingPlaces, setIsFindingPlaces] = useState(false);
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
        }
    };

    return (
        <div className="h-full flex bg-[#0f0f0f] text-white overflow-hidden">
            {/* Sidebar */}
            <RoadManagerSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto selection:bg-yellow-500/30">
                <main className="flex-1 p-6 md:p-8 max-w-[1600px] mx-auto w-full">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="h-full"
                        >
                            {activeTab === 'planning' && (
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
                            )}

                            {activeTab === 'on-the-road' && (
                                <OnTheRoadTab
                                    currentLocation={currentLocation}
                                    setCurrentLocation={setCurrentLocation}
                                    handleFindGasStations={handleFindGasStations}
                                    isFindingPlaces={isFindingPlaces}
                                    nearbyPlaces={nearbyPlaces}
                                    fuelStats={vehicleStats || { // Fallback
                                        milesDriven: 0,
                                        fuelLevelPercent: 50,
                                        tankSizeGallons: 15,
                                        mpg: 8,
                                        gasPricePerGallon: 3.50,
                                        userId: ''
                                    }}
                                    setFuelStats={saveVehicleStats}
                                    handleCalculateFuel={handleCalculateFuel}
                                    isCalculatingFuel={isCalculatingFuel}
                                    fuelLogistics={fuelLogistics}
                                    itinerary={itinerary}
                                />
                            )}

                            {activeTab === 'rider' && (
                                <div className="h-full">
                                    <RiderChecklist />
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};

export default RoadManager;
