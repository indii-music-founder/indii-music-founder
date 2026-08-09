import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';

import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { PlanningTab } from './components/PlanningTab';
import { OnTheRoadTab } from './components/OnTheRoadTab';
import { TourBookTab } from './components/TourBookTab';
import { useTouring } from './hooks/useTouring';
import { Itinerary, ItineraryStop, NearbyPlace, ScheduleReview, EmergencyContact } from './types';

import { RoadMode } from './components/RoadMode';
import { useMobile } from '@/hooks/useMobile';
import { RoadManagerSidebar, TouringTab } from './components/RoadManagerSidebar';
import { Phone, Calendar, Navigation, Plus, Edit2, Trash2 } from 'lucide-react';
import { TourRouteOptimizer } from './components/TourRouteOptimizer';
import { SetlistAnalytics } from './components/SetlistAnalytics';
import { logger } from '@/utils/logger';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { resolveTouringTab } from '@/modules/handoffViews';
import { createTouringStopId } from './itinerary';

interface EmergencyContactsPanelProps {
    contacts: EmergencyContact[];
    onSave: (contact: { id?: string; name: string; phone: string; relationship: string }) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

interface RouteDraftResponse {
    status: 'route_draft';
    authority: 'user_inputs_only';
    stops: Array<{
        city: string;
        date: string;
        venue: '';
        activity: 'Planning';
        type: 'Planning';
        notes: '';
    }>;
    limitations: string[];
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isRouteDraftResponse(value: unknown): value is RouteDraftResponse {
    if (!value || typeof value !== 'object') return false;
    const draft = value as Record<string, unknown>;
    return draft.status === 'route_draft'
        && draft.authority === 'user_inputs_only'
        && isStringArray(draft.limitations)
        && Array.isArray(draft.stops)
        && draft.stops.length > 0
        && draft.stops.every((stop) => {
            if (!stop || typeof stop !== 'object') return false;
            const candidate = stop as Record<string, unknown>;
            return typeof candidate.city === 'string'
                && candidate.city.length > 0
                && typeof candidate.date === 'string'
                && DATE_ONLY_PATTERN.test(candidate.date)
                && candidate.venue === ''
                && candidate.activity === 'Planning'
                && candidate.type === 'Planning'
                && candidate.notes === '';
        });
}

function isScheduleReview(value: unknown): value is ScheduleReview {
    if (!value || typeof value !== 'object') return false;
    const review = value as Record<string, unknown>;
    return review.scope === 'schedule_only'
        && typeof review.hasConflicts === 'boolean'
        && isStringArray(review.issues)
        && isStringArray(review.suggestions)
        && typeof review.summary === 'string'
        && isStringArray(review.limitations);
}

function EmergencyContactsPanel({ contacts, onSave, onDelete }: EmergencyContactsPanelProps) {
    const { t } = useTranslation();
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
                            placeholder={t('touring.hints.contact_name_tour')}
                            className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs text-white focus:border-red-500 outline-none placeholder:text-gray-700 font-mono"
                            required
                        />
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder={t('touring.hints.phone_number')}
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
        emergencyContacts,
        saveEmergencyContact,
        deleteEmergencyContact,
    } = useTouring();
    const pendingTouringHandoff = useStore(state => state.pendingHandoffs.touring);

    // Core State
    const [locations, setLocations] = useState<string[]>([]);
    const [newLocation, setNewLocation] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isSavingRouteDraft, setIsSavingRouteDraft] = useState(false);

    // Feature Tabs
    const [activeTab, setActiveTab] = useState<TouringTab>('plan');

    useEffect(() => {
        if (!pendingTouringHandoff) return;
        const pendingTab = resolveTouringTab(pendingTouringHandoff.targetView);
        if (pendingTab && activeTab !== pendingTab) {
            setActiveTab(pendingTab);
        }
    }, [activeTab, pendingTouringHandoff]);

    const [isCheckingSchedule, setIsCheckingSchedule] = useState(false);
    const [scheduleReview, setScheduleReview] = useState<ScheduleReview | null>(null);

    // On the Road State
    const [currentLocation, setCurrentLocation] = useState('');
    const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
    const [isFindingPlaces, setIsFindingPlaces] = useState(false);

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

    const handleSaveRouteDraft = async () => {
        if (locations.length === 0 || !startDate || !endDate) {
            toast.error("Please provide locations and dates.");
            return;
        }
        if (startDate > endDate) {
            toast.error("End date must be on or after the start date.");
            return;
        }

        setIsSavingRouteDraft(true);
        setScheduleReview(null);

        try {
            const compileRouteDraft = httpsCallable(functions, 'generateItinerary');
            const response = await compileRouteDraft({ locations, dates: { start: startDate, end: endDate } });
            if (!isRouteDraftResponse(response.data)) {
                throw new Error('Route draft service returned an unsupported response');
            }
            const draftMatchesInputs = response.data.stops.length === locations.length
                && response.data.stops.every((stop, index) => (
                    stop.city === locations[index]
                    && stop.date >= startDate
                    && stop.date <= endDate
                ));
            if (!draftMatchesInputs) {
                throw new Error('Route draft service changed the submitted waypoints or date range');
            }

            const mappedStops: ItineraryStop[] = response.data.stops.map((stop) => ({
                id: createTouringStopId(),
                city: stop.city,
                date: stop.date,
                venue: stop.venue,
                activity: stop.activity,
                type: stop.type,
                notes: stop.notes,
            }));

            await saveItinerary({
                stops: mappedStops,
                totalDistance: 'Not calculated',
                tourName: `Route draft ${startDate} - ${locations[0]}`
            });

            toast.success("Route draft saved");
        } catch (error: unknown) {
            logger.error("Route Draft Save Failed:", error);
            toast.error("Failed to save route draft");
        } finally {
            setIsSavingRouteDraft(false);
        }
    };

    const handleCheckSchedule = async () => {
        if (!itinerary) return;

        setIsCheckingSchedule(true);
        try {
            const checkSchedule = httpsCallable(functions, 'checkLogistics');
            const response = await checkSchedule({ itinerary });
            if (!isScheduleReview(response.data)) {
                throw new Error('Schedule check service returned an unsupported response');
            }
            setScheduleReview(response.data);
            toast.success("Schedule check complete");
        } catch (error: unknown) {
            logger.error("Schedule Check Failed:", error);
            toast.error("Failed to check schedule");
        } finally {
            setIsCheckingSchedule(false);
        }
    };

    const handleFindNearbyPlaces = async (placeType: string = 'gas_station') => {
        if (!currentLocation) {
            toast.error("Please enter a location");
            return;
        }
        setIsFindingPlaces(true);
        try {
            const findPlaces = httpsCallable(functions, 'findPlaces');
            const response = await findPlaces({ location: currentLocation, type: placeType });
            const result = response.data as { places: NearbyPlace[] };
            setNearbyPlaces(result.places);
            const typeLabel = placeType.replace('_', ' ');
            toast.success(`Found ${typeLabel} nearby`);
        } catch (error: unknown) {
            logger.error("Find Places Failed:", error);
            toast.error("Failed to find nearby places");
        } finally {
            setIsFindingPlaces(false);
        }
    };

    const handleFindGasStations = async () => {
        await handleFindNearbyPlaces('gas_station');
    };



    const handleUpdateStop = async (updatedStop: Itinerary['stops'][number]) => {
        if (!itinerary) return;

        if (!updatedStop.id) {
            logger.error("Failed to update stop: missing stable stop id", updatedStop);
            toast.error("Failed to update stop");
            return;
        }

        const stopIndex = itinerary.stops.findIndex(s => s.id === updatedStop.id);

        if (stopIndex === -1) {
            logger.error("Failed to update stop: could not resolve itinerary index for stop", updatedStop);
            toast.error("Failed to update stop");
            return;
        }

        // Optimistic UI Update
        const newStops = itinerary.stops.map((s, index) => {
            if (index === stopIndex) {
                return updatedStop;
            }
            return s;
        });
        setCurrentItinerary({ ...itinerary, stops: newStops });

        try {
            await updateItineraryStop(stopIndex, updatedStop);
            toast.success("Day sheet updated");
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
                <div className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar selection:bg-yellow-500/30">
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
                                {activeTab === 'plan' && (
                                    <div className="flex gap-6 h-full">
                                        <div className="flex-1 overflow-y-auto custom-scrollbar">
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
                                                handleSaveRouteDraft={handleSaveRouteDraft}
                                                isSavingRouteDraft={isSavingRouteDraft}
                                                itinerary={itinerary}
                                                handleCheckSchedule={handleCheckSchedule}
                                                isCheckingSchedule={isCheckingSchedule}
                                                scheduleReview={scheduleReview}
                                                onUpdateStop={handleUpdateStop}
                                            />
                                        </div>
                                        <div className="hidden @6xl:flex w-96 flex-col border-l border-gray-800 p-6 overflow-y-auto custom-scrollbar flex-shrink-0">
                                            <h3 className="text-sm font-bold text-white mb-4">Route Optimization</h3>
                                            <TourRouteOptimizer />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'tour-book' && (
                                    <TourBookTab
                                        itinerary={itinerary}
                                        onUpdateStop={handleUpdateStop}
                                    />
                                )}

                                {activeTab === 'on-the-road' && (
                                    <OnTheRoadTab
                                        currentLocation={currentLocation}
                                        setCurrentLocation={setCurrentLocation}
                                        handleFindGasStations={handleFindGasStations}
                                        handleFindNearbyPlaces={handleFindNearbyPlaces}
                                        isFindingPlaces={isFindingPlaces}
                                        nearbyPlaces={nearbyPlaces}
                                        itinerary={itinerary}
                                    />
                                )}

                                {activeTab === 'insights' && (
                                    <div className="h-full p-6 overflow-y-auto">
                                        <SetlistAnalytics />
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </main>
                </div>

                {/* ── RIGHT PANEL — Tour Info ─────────────────────────── */}
                <aside className="hidden @6xl:flex w-72 @7xl:w-80 flex-col border-l border-dept-touring/20 overflow-y-auto p-3 gap-3 flex-shrink-0">
                    <ItinerarySummaryPanel itinerary={itinerary} />
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

export default RoadManager;
