import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { PlanningTab } from './components/PlanningTab';
import { OnTheRoadTab } from './components/OnTheRoadTab';
import { useTouring } from './hooks/useTouring';
import { Itinerary } from './types';
import { MobileOnlyWarning } from '@/core/components/MobileOnlyWarning';
import { useMobile } from '@/hooks/useMobile';
import { RoadManagerSidebar, TouringTab } from './components/RoadManagerSidebar';
import { RiderChecklist } from './components/RiderChecklist';
import { MapPin, CloudSun, Phone, Fuel, Calendar, CheckSquare, AlertTriangle, Navigation } from 'lucide-react';
import { TourRouteOptimizer } from './components/TourRouteOptimizer';
import { TechnicalRiderGenerator } from './components/TechnicalRiderGenerator';
import { SetlistAnalytics } from './components/SetlistAnalytics';
import { VisaChecklist } from './components/VisaChecklist';
import { logger } from '@/utils/logger';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';

interface LogisticsReport {
    isFeasible: boolean;
    issues: string[];
    suggestions: string[];
}

interface NearbyPlace {
    name: string;
    vicinity: string;
    place_id: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        };
    };
}

interface FuelLogistics {
    currentRangeMiles: number;
    fullTankRangeMiles: number;
    costToFill: number;
    status: 'CRITICAL' | 'LOW' | 'OK';
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
    const [activeTab, setActiveTab] = useState<TouringTab>('planning');

    // Logistics State
    const [isCheckingLogistics, setIsCheckingLogistics] = useState(false);
    const [logisticsReport, setLogisticsReport] = useState<LogisticsReport | null>(null);

    // On the Road State
    const [currentLocation, setCurrentLocation] = useState('');
    const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
    const [isFindingPlaces, setIsFindingPlaces] = useState(false);
    const [fuelLogistics, setFuelLogistics] = useState<FuelLogistics | null>(null);
    const [isCalculatingFuel, setIsCalculatingFuel] = useState(false);

    // Reactive mobile detection via centralized hook
    const { isAnyPhone: isMobile } = useMobile();

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
            // logger.error("Itinerary Generation Failed:", error);
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
            // logger.error("Logistics Check Failed:", error);
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
            const result = response.data as { places: NearbyPlace[] };
            setNearbyPlaces(result.places);
            toast.success("Found gas stations nearby");
        } catch (error: unknown) {
            logger.error("Find Places Failed:", error);
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
            const result = response.data as FuelLogistics;
            setFuelLogistics(result);
            toast.success("Fuel logistics calculated");
        } catch (error: unknown) {
            logger.error("Fuel Calc Failed:", error);
            toast.error("Failed to calculate fuel logistics");
        } finally {
            setIsCalculatingFuel(false);
        }
    };

    const handleUpdateStop = async (updatedStop: Itinerary['stops'][number]) => {
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
            logger.error("Failed to update stop", err);
            toast.error("Failed to update stop");
        }
    };

    return (
        <ModuleErrorBoundary moduleName="Road Manager">
            <div className="absolute inset-0 flex text-white">
                {/* ── LEFT PANEL — Road Manager Sidebar ──────────────── */}
                <RoadManagerSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

                {/* ── CENTER — Main Content ──────────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0 overflow-y-auto selection:bg-yellow-500/30">
                    <main className="flex-1 p-6 md:p-8 w-full">
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
                                        fuelStats={vehicleStats || {
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

                                {activeTab === 'route-optimizer' && (
                                    <div className="h-full p-6 overflow-y-auto">
                                        <TourRouteOptimizer />
                                    </div>
                                )}

                                {activeTab === 'tech-rider' && (
                                    <div className="h-full p-6 overflow-y-auto">
                                        <TechnicalRiderGenerator />
                                    </div>
                                )}

                                {activeTab === 'setlist' && (
                                    <div className="h-full p-6 overflow-y-auto">
                                        <SetlistAnalytics />
                                    </div>
                                )}

                                {activeTab === 'visa' && (
                                    <div className="h-full p-6 overflow-y-auto">
                                        <VisaChecklist />
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </main>
                </div>

                {/* ── RIGHT PANEL — On The Road Info ─────────────────── */}
                <aside className="hidden lg:flex w-72 2xl:w-80 flex-col border-l border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                    <ItinerarySummaryPanel itinerary={itinerary} />
                    <VehicleStatusPanel vehicleStats={vehicleStats} fuelLogistics={fuelLogistics} />
                    <RiderQuickPanel />
                    <EmergencyContactsPanel />
                </aside>
            </div>
        </ModuleErrorBoundary>
    );
};

/* ================================================================== */
/*  Right Panel Widgets                                                 */
/* ================================================================== */

function ItinerarySummaryPanel({ itinerary }: { itinerary: Itinerary | null }) {
    if (!itinerary) {
        return (
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Itinerary</h3>
                <p className="text-xs text-gray-600 px-1">No itinerary loaded. Create one in Planning.</p>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Itinerary</h3>
            <div className="space-y-2">
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02]">
                    <Calendar size={14} className="text-yellow-400 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-white">{itinerary.stops?.length || 0} Stops</p>
                        <p className="text-[10px] text-gray-500">{itinerary.tourName || 'Unnamed Tour'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02]">
                    <Navigation size={14} className="text-blue-400 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-white">{itinerary.totalDistance || 'N/A'}</p>
                        <p className="text-[10px] text-gray-500">Total Distance</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function VehicleStatusPanel({ vehicleStats, fuelLogistics }: { vehicleStats: any; fuelLogistics: any }) {
    const fuelPct = vehicleStats?.fuelLevelPercent ?? 50;
    const fuelColor = fuelPct > 50 ? 'text-green-400' : fuelPct > 20 ? 'text-yellow-400' : 'text-red-400';

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Vehicle Status</h3>
            <div className="space-y-2">
                <div className="p-3 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-500 font-bold">Fuel Level</span>
                        <span className={`text-[10px] font-bold ${fuelColor}`}>{fuelPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${fuelPct > 50 ? 'bg-green-500' : fuelPct > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${fuelPct}%` }}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02]">
                    <Fuel size={14} className="text-gray-400 flex-shrink-0" />
                    <div>
                        <p className="text-xs text-white">{vehicleStats?.milesDriven?.toLocaleString() || '0'} mi driven</p>
                        <p className="text-[10px] text-gray-500">{vehicleStats?.mpg || 0} MPG</p>
                    </div>
                </div>
                {fuelLogistics && (
                    <div className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${fuelLogistics.status === 'CRITICAL' ? 'bg-red-500/10 border border-red-500/20 text-red-300' :
                        fuelLogistics.status === 'LOW' ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-300' :
                            'bg-green-500/10 border border-green-500/20 text-green-300'
                        }`}>
                        <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                        <span>Range: {fuelLogistics.currentRangeMiles} mi · ${fuelLogistics.costToFill} to fill</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function RiderQuickPanel() {
    // Rider checklist items should come from the Rider Checklist module
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Rider Checklist</h3>
            <div className="flex flex-col items-center justify-center py-3 text-center">
                <CheckSquare size={14} className="text-gray-600 mb-1.5" />
                <p className="text-[10px] text-gray-600">No active rider</p>
                <p className="text-[10px] text-gray-700 mt-0.5">Create a rider in the Rider tab</p>
            </div>
        </div>
    );
}

function EmergencyContactsPanel() {
    // Emergency contacts should be entered by the user for each tour
    return (
        <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-3">
            <h3 className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3 px-1">Emergency</h3>
            <div className="flex flex-col items-center justify-center py-3 text-center">
                <Phone size={14} className="text-red-400/50 mb-1.5" />
                <p className="text-[10px] text-gray-600">No contacts saved</p>
                <p className="text-[10px] text-gray-700 mt-0.5">Add emergency numbers in tour settings</p>
            </div>
        </div>
    );
}

export default RoadManager;
