import React, { useState } from 'react';

import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { PlanningTab } from './components/PlanningTab';
import { OnTheRoadTab } from './components/OnTheRoadTab';
import { useTouring } from './hooks/useTouring';
import { Itinerary, ItineraryStop, NearbyPlace, FuelLogistics, LogisticsReport, EmergencyContact } from './types';

import { RoadMode } from './components/RoadMode';
import { useMobile } from '@/hooks/useMobile';
import { RoadManagerSidebar, TouringTab } from './components/RoadManagerSidebar';
import { RiderChecklist } from './components/RiderChecklist';
import { Phone, Fuel, Calendar, CheckSquare, AlertTriangle, Navigation, Plus, Edit2, Trash2 } from 'lucide-react';
import { TourRouteOptimizer } from './components/TourRouteOptimizer';
import { TechnicalRiderGenerator } from './components/TechnicalRiderGenerator';
import { SetlistAnalytics } from './components/SetlistAnalytics';
import { VisaChecklist } from './components/VisaChecklist';
import { logger } from '@/utils/logger';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';

interface EmergencyContactsPanelProps {
    contacts: EmergencyContact[];
    onSave: (contact: { id?: string; name: string; phone: string; relationship: string }) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

function EmergencyContactsPanel({ contacts, onSave, onDelete }: EmergencyContactsPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [relationship, setRelationship] = useState('Manager');

    const handleOpenAdd = () => {
        setEditingContact(null);
        setName('');
        setPhone('');
        setRelationship('Manager');
        setIsOpen(true);
    };

    const handleOpenEdit = (contact: EmergencyContact) => {
        setEditingContact(contact);
        setName(contact.name);
        setPhone(contact.phone);
        setRelationship(contact.relationship);
        setIsOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !phone.trim() || !relationship.trim()) return;

        await onSave({
            id: editingContact?.id,
            name: name.trim(),
            phone: phone.trim(),
            relationship: relationship.trim()
        });

        setIsOpen(false);
    };

    return (
        <div className="rounded-xl bg-red-950/10 border border-red-500/20 p-3 relative overflow-hidden flex flex-col transition-all duration-300 hover:border-red-500/30">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-2xl rounded-full pointer-events-none" />

            <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1.5 italic">
                    <Phone className="text-red-500" size={10} />
                    Emergency
                </h3>
                {!isOpen && (
                    <button
                        onClick={handleOpenAdd}
                        className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-mono uppercase tracking-wider transition-all flex items-center gap-1 focus:ring-1 focus:ring-red-500/50 outline-none cursor-pointer"
                    >
                        <Plus size={10} />
                        Add
                    </button>
                )}
            </div>

            {isOpen ? (
                <form onSubmit={handleSubmit} className="space-y-2 bg-[#161b22]/50 p-2.5 rounded-lg border border-red-500/10 z-10">
                    <h4 className="text-[9px] font-mono uppercase tracking-widest text-red-400 font-bold">
                        {editingContact ? 'Edit Emergency Contact' : 'New Emergency Contact'}
                    </h4>
                    <div className="space-y-1.5">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Contact Name"
                            className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs text-white focus:border-red-500 outline-none placeholder:text-gray-700 font-mono"
                            required
                        />
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Phone Number"
                            className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs text-white focus:border-red-500 outline-none placeholder:text-gray-700 font-mono"
                            required
                        />
                        <select
                            value={relationship}
                            onChange={(e) => setRelationship(e.target.value)}
                            className="w-full bg-[#0d1117] border border-gray-800 rounded px-1.5 py-1 text-xs text-gray-400 focus:border-red-500 outline-none cursor-pointer uppercase font-bold tracking-wider font-mono"
                        >
                            <option value="Manager">Manager</option>
                            <option value="Venue">Venue</option>
                            <option value="Promoter">Promoter</option>
                            <option value="Band">Band/Crew</option>
                            <option value="Spouse/Family">Spouse/Family</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div className="flex gap-1.5 justify-end pt-1">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="p-1 px-2 text-[10px] text-gray-500 hover:text-gray-300 font-mono uppercase transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="p-1 px-2.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-mono uppercase transition-all shadow-[0_0_10px_rgba(239,68,68,0.2)] cursor-pointer"
                        >
                            Save
                        </button>
                    </div>
                </form>
            ) : contacts.length === 0 ? (
                <div
                    onClick={handleOpenAdd}
                    className="group border border-dashed border-red-950 rounded-lg py-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-red-500/5 hover:border-red-500/40 z-10"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleOpenAdd();
                        }
                    }}
                >
                    <Phone size={16} className="text-red-500/40 mb-1.5 group-hover:text-red-400 group-hover:scale-110 transition-all duration-300" />
                    <p className="text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors uppercase font-mono tracking-wider">No contacts saved</p>
                    <p className="text-[9px] text-red-500/50 mt-1 uppercase font-mono tracking-widest font-black underline underline-offset-2">Click here to add one</p>
                </div>
            ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1 z-10">
                    {contacts.map((contact) => (
                        <div
                            key={contact.id}
                            className="group flex items-center justify-between p-2 rounded-lg bg-red-500/[0.02] border border-red-500/5 hover:border-red-500/20 hover:bg-red-500/[0.04] transition-all duration-300"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-white truncate max-w-[120px] font-mono leading-none">
                                        {contact.name}
                                    </span>
                                    <span className="text-[8px] px-1 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-bold uppercase tracking-wide scale-90 origin-left font-mono">
                                        {contact.relationship}
                                    </span>
                                </div>
                                <a
                                    href={`tel:${contact.phone}`}
                                    className="text-[10px] text-gray-500 hover:text-white transition-colors flex items-center gap-1 mt-1 font-mono outline-none"
                                >
                                    {contact.phone}
                                </a>
                            </div>

                            <div className="flex items-center gap-1">
                                <a
                                    href={`tel:${contact.phone}`}
                                    className="p-1 text-gray-500 hover:text-green-400 hover:bg-green-500/10 rounded transition-all focus-visible:opacity-100 outline-none cursor-pointer"
                                    title="Call contact"
                                >
                                    <Phone size={11} />
                                </a>
                                <button
                                    onClick={() => handleOpenEdit(contact)}
                                    className="p-1 text-gray-600 hover:text-yellow-400 hover:bg-yellow-500/10 rounded transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 outline-none cursor-pointer"
                                    title="Edit contact"
                                >
                                    <Edit2 size={11} />
                                </button>
                                <button
                                    onClick={() => onDelete(contact.id)}
                                    className="p-1 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 outline-none cursor-pointer"
                                    title="Delete contact"
                                >
                                    <Trash2 size={11} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
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
        emergencyContacts,
        saveEmergencyContact,
        deleteEmergencyContact,
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
            <ModuleErrorBoundary moduleName="Road Manager">
                <RoadMode />
            </ModuleErrorBoundary>
        );
    }

    const handleAddLocation = () => {
        if (newLocation.trim()) {
            const rawParts = newLocation.split(',').map(p => p.trim()).filter(Boolean);
            const parsed: string[] = [];
            for (let i = 0; i < rawParts.length; i++) {
                const part = (rawParts[i] || '').trim();
                const nextPart = (rawParts[i + 1] || '').trim();
                if (nextPart && nextPart.length === 2 && /^[A-Za-z]{2}$/.test(nextPart)) {
                    parsed.push(`${part}, ${nextPart.toUpperCase()}`);
                    i++;
                } else {
                    parsed.push(part);
                }
            }
            if (parsed.length > 0) {
                setLocations([...locations, ...parsed]);
            }
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
            const rawResult = response.data as any;

            const mappedStops: ItineraryStop[] = (rawResult.stops || []).map((stop: any) => ({
                city: stop.city || '',
                date: stop.date || '',
                venue: stop.venue || '',
                activity: stop.activity || '',
                type: stop.type || 'Travel',
                notes: stop.notes || '',
            }));

            await saveItinerary({
                stops: mappedStops,
                totalDistance: rawResult.totalDistanceMiles ? `${rawResult.totalDistanceMiles} miles` : '0 miles',
                estimatedBudget: 'TBD',
                tourName: `Tour ${startDate} - ${locations[0]}`
            });

            toast.success("Itinerary generated and saved");
        } catch (_error: unknown) {
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
        } catch (_error: unknown) {
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
        } catch (err: unknown) {
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
                    <RiderQuickPanel onNavigate={() => setActiveTab('rider')} />
                    <EmergencyContactsPanel
                        contacts={emergencyContacts}
                        onSave={saveEmergencyContact}
                        onDelete={deleteEmergencyContact}
                    />
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

interface VehicleStatsShape { fuelLevelPercent?: number; milesDriven?: number; mpg?: number }

function VehicleStatusPanel({ vehicleStats, fuelLogistics }: { vehicleStats: VehicleStatsShape | null; fuelLogistics: FuelLogistics | null }) {

    const isConfigured = vehicleStats !== null;
    const fuelPct = vehicleStats?.fuelLevelPercent ?? 0;
    const fuelColor = fuelPct > 50 ? 'text-green-400' : fuelPct > 20 ? 'text-yellow-400' : 'text-red-400';

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Vehicle Status</h3>
            <div className="space-y-2">
                {!isConfigured ? (
                    <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                        <p className="text-[10px] text-gray-600">Not configured</p>
                        <p className="text-[10px] text-gray-700 mt-0.5">Set up vehicle stats in On The Road</p>
                    </div>
                ) : (
                    <>
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
                    </>
                )}
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

function RiderQuickPanel({ onNavigate }: { onNavigate?: () => void }) {
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Rider Checklist</h3>
            <div className="flex flex-col items-center justify-center py-3 text-center">
                <CheckSquare size={14} className="text-gray-600 mb-1.5" />
                <p className="text-[10px] text-gray-600">No active rider</p>
                {onNavigate ? (
                    <button
                        onClick={onNavigate}
                        className="text-[10px] text-yellow-500/70 hover:text-yellow-400 mt-1 transition-colors underline underline-offset-2"
                    >
                        Create one in Rider tab →
                    </button>
                ) : (
                    <p className="text-[10px] text-gray-700 mt-0.5">Create a rider in the Rider tab</p>
                )}
            </div>
        </div>
    );
}

export default RoadManager;
