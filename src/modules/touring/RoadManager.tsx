import React, { useState } from 'react';
import { Truck } from 'lucide-react';
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

    return (
        <div className="h-full flex flex-col bg-[#0d1117] text-white p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <Truck className="text-yellow-500" />
                        Road Manager
                    </h1>
                    <p className="text-gray-400">Plan your tour logistics and manage life on the road.</p>
                </div>
                <div className="flex bg-gray-800 rounded-lg p-1">
                    <button
                        onClick={() => setActiveTab('planning')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'planning' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        Planning
                    </button>
                    <button
                        onClick={() => setActiveTab('on-the-road')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'on-the-road' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        On the Road
                    </button>
                </div>
            </div>

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
                />
            )}
        </div>
    );
};

export default RoadManager;
