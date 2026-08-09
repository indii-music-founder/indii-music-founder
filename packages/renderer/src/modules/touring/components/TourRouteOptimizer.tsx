import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Plus, X, Zap, Route, Info, BookOpen } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/core/context/ToastContext';
import { useTouring } from '../hooks/useTouring';
import { createTouringStopId } from '../itinerary';
import { TourMap } from './TourMap';

interface City {
    id: string;
    name: string;
    state: string;
    lat: number;
    lng: number;
}

// Reference city centers for geographic route sketches. Audience, venue,
// ticket-price, and revenue data must come from an authorized live source.
const CITY_POOL: City[] = [
    { id: 'nyc', name: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060 },
    { id: 'la', name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
    { id: 'chi', name: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
    { id: 'hou', name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
    { id: 'phx', name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 },
    { id: 'phi', name: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652 },
    { id: 'sa', name: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936 },
    { id: 'sd', name: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
    { id: 'dal', name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970 },
    { id: 'sj', name: 'San Jose', state: 'CA', lat: 37.3382, lng: -121.8863 },
    { id: 'aus', name: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431 },
    { id: 'jax', name: 'Jacksonville', state: 'FL', lat: 30.3322, lng: -81.6557 },
    { id: 'sf', name: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194 },
    { id: 'col', name: 'Columbus', state: 'OH', lat: 39.9612, lng: -82.9988 },
    { id: 'ind', name: 'Indianapolis', state: 'IN', lat: 39.7684, lng: -86.1581 },
    { id: 'sea', name: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321 },
    { id: 'den', name: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903 },
    { id: 'dc', name: 'Washington', state: 'DC', lat: 38.9072, lng: -77.0369 },
    { id: 'nas', name: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816 },
    { id: 'ok', name: 'Oklahoma City', state: 'OK', lat: 35.4676, lng: -97.5164 },
    { id: 'elp', name: 'El Paso', state: 'TX', lat: 31.7619, lng: -106.4850 },
    { id: 'bos', name: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589 },
    { id: 'por', name: 'Portland', state: 'OR', lat: 45.5051, lng: -122.6750 },
    { id: 'mem', name: 'Memphis', state: 'TN', lat: 35.1495, lng: -90.0490 },
    { id: 'det', name: 'Detroit', state: 'MI', lat: 42.3314, lng: -83.0458 },
    { id: 'lv', name: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398 },
    { id: 'lou', name: 'Louisville', state: 'KY', lat: 38.2527, lng: -85.7585 },
    { id: 'bal', name: 'Baltimore', state: 'MD', lat: 39.2904, lng: -76.6122 },
    { id: 'mil', name: 'Milwaukee', state: 'WI', lat: 43.0389, lng: -87.9065 },
    { id: 'alb', name: 'Albuquerque', state: 'NM', lat: 35.0844, lng: -106.6504 },
    { id: 'tuc', name: 'Tucson', state: 'AZ', lat: 32.2226, lng: -110.9747 },
    { id: 'fre', name: 'Fresno', state: 'CA', lat: 36.7378, lng: -119.7871 },
    { id: 'sac', name: 'Sacramento', state: 'CA', lat: 38.5816, lng: -121.4944 },
    { id: 'mia', name: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918 },
    { id: 'ral', name: 'Raleigh', state: 'NC', lat: 35.7796, lng: -78.6382 },
    { id: 'omh', name: 'Omaha', state: 'NE', lat: 41.2565, lng: -95.9345 },
    { id: 'cle', name: 'Cleveland', state: 'OH', lat: 41.4993, lng: -81.6944 },
    { id: 'min', name: 'Minneapolis', state: 'MN', lat: 44.9778, lng: -93.2650 },
    { id: 'atl', name: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880 },
    { id: 'no', name: 'New Orleans', state: 'LA', lat: 29.9511, lng: -90.0715 },
    { id: 'tam', name: 'Tampa', state: 'FL', lat: 27.9506, lng: -82.4572 },
    { id: 'pit', name: 'Pittsburgh', state: 'PA', lat: 40.4406, lng: -79.9959 },
    { id: 'slc', name: 'Salt Lake City', state: 'UT', lat: 40.7608, lng: -111.8910 },
    { id: 'cha', name: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431 },
    { id: 'kan', name: 'Kansas City', state: 'MO', lat: 39.0997, lng: -94.5786 },
];

function haversine(a: City, b: City): number {
    const R = 3958.8; // miles
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

function optimizeRoute(cities: City[]): City[] {
    if (cities.length <= 2) return [...cities];
    const unvisited = [...cities];
    const route: City[] = [unvisited.splice(0, 1)[0]!];
    while (unvisited.length > 0) {
        const last = route[route.length - 1]!;
        // Greedy nearest-neighbor over city-center distance. This is a route
        // sketch, not a road-distance or globally optimal TSP calculation.
        let bestIdx = 0;
        let bestDistance = Infinity;
        unvisited.forEach((city, i) => {
            const dist = haversine(last, city);
            if (dist < bestDistance) { bestDistance = dist; bestIdx = i; }
        });
        route.push(unvisited.splice(bestIdx, 1)[0]!);
    }
    return route;
}

function toDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

export function TourRouteOptimizer() {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [optimized, setOptimized] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [isSavingRouteDraft, setIsSavingRouteDraft] = useState(false);
    const toast = useToast();
    const { saveItinerary } = useTouring();

    const selected = CITY_POOL.filter(c => selectedIds.has(c.id));
    const available = CITY_POOL.filter(c => !selectedIds.has(c.id));

    const route = useMemo(() => optimized ? optimizeRoute(selected) : selected, [selected, optimized]);

    const totalDistance = useMemo(() => {
        let d = 0;
        for (let i = 0; i < route.length - 1; i++) d += haversine(route[i]!, route[i + 1]!);
        return Math.round(d);
    }, [route]);

    const handleSaveRouteDraft = async () => {
        if (route.length < 2 || isSavingRouteDraft) return;

        setIsSavingRouteDraft(true);
        try {
            const draftStartDate = new Date();
            const mappedStops = route.map((city, idx) => ({
                id: createTouringStopId(),
                date: toDateOnly(addDays(draftStartDate, idx)),
                city: `${city.name}, ${city.state}`,
                venue: '',
                activity: 'Planning stop',
                notes: 'Venue, schedule, and road routing not set.',
                type: 'Planning',
                coordinates: { lat: city.lat, lng: city.lng },
            }));

            await saveItinerary({
                tourName: `Route draft: ${route[0]?.name} to ${route[route.length - 1]?.name}`,
                stops: mappedStops,
                totalDistance: `${totalDistance} miles straight-line`,
            });

            toast.success('Route draft saved');
        } catch {
            toast.error('Failed to save route draft');
        } finally {
            setIsSavingRouteDraft(false);
        }
    };

    const toggleCity = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
        setOptimized(false);
    };

    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar">
                {/* Left — city picker */}
                <div className="w-full space-y-4">
                    <div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 cursor-help flex items-center gap-1 hover:text-neutral-300 transition-colors">
                                    Add Cities <Info size={10} className="opacity-60" />
                                </h4>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="bg-neutral-900 border border-white/10 text-white rounded-xl shadow-xl p-3 max-w-xs leading-relaxed">
                                <p className="font-bold text-[#FFE135] mb-1">City Reference List</p>
                                <p className="text-neutral-400 text-[10px]">Select city centers to sketch a geographic tour leg. This list contains coordinates only; it does not include audience, venue, ticket-price, or revenue data.</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    <div className="space-y-1 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                        {available.map(city => (
                            <button
                                key={city.id}
                                onClick={() => toggleCity(city.id)}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/5 transition-all text-left group"
                            >
                                <div>
                                    <div className="text-xs font-bold text-neutral-300 group-hover:text-white">{city.name}</div>
                                    <div className="text-[9px] text-neutral-600 mt-0.5">{city.state}</div>
                                </div>
                                <Plus size={12} className="text-neutral-600 group-hover:text-[#FFE135]" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-2 text-[10px]">
                    <div className="text-neutral-500 font-bold uppercase tracking-widest mb-1">Summary</div>
                    <div className="flex justify-between">
                        <span className="text-neutral-600">Stops</span>
                        <span className="text-white font-bold">{route.length}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-neutral-600">Straight-line distance</span>
                        <span className="text-white font-bold">{totalDistance.toLocaleString('en-US')} mi</span>
                    </div>
                </div>

            {/* Right — route display */}
            <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">Route Planner</h4>
                            <button
                                onClick={() => setIsGuideOpen(true)}
                                className="px-2 py-0.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-neutral-400 hover:text-white flex items-center gap-1 text-[9px] font-black tracking-wide uppercase"
                                title="Open User Guide"
                            >
                                <BookOpen size={9} className="text-[#FFE135]" /> User Guide
                            </button>
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-0.5">
                            {optimized ? 'Ordered by nearest city-center distance' : 'Add cities and optimize'}
                        </p>
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <button
                                    onClick={() => setOptimized(true)}
                                    disabled={selected.length < 2}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#FFE135] text-black text-xs font-black rounded-xl hover:bg-[#FFD700] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Zap size={13} /> Optimize Route
                                </button>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="end" className="bg-neutral-900 border border-white/10 text-white rounded-xl shadow-xl p-3 max-w-xs leading-relaxed">
                            <p className="font-bold text-[#FFE135] mb-0.5">Geographic Route Sketch</p>
                            <p className="text-neutral-400 text-[10px]">Orders selected city centers with a greedy nearest-neighbor Haversine calculation. It is a heuristic—not road routing, drive-time analysis, or a guarantee of the shortest possible tour.</p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSaveRouteDraft}
                        disabled={route.length < 2 || isSavingRouteDraft}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-white text-xs font-black uppercase tracking-widest hover:bg-white/[0.06] hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Plus size={13} />
                        {isSavingRouteDraft ? 'Saving Route Draft...' : 'Save Route Draft'}
                    </button>
                </div>

                <div className="h-56 overflow-hidden rounded-xl border border-white/5 bg-[#0b0b0b]">
                    {route.length > 0 ? (
                        <TourMap
                            locations={route.map(city => `${city.name}, ${city.state}`)}
                            markers={route.map((city, idx) => ({
                                position: { lat: city.lat, lng: city.lng },
                                title: `${city.name}, ${city.state}`,
                                type: 'venue' as const,
                                label: `${idx + 1}`,
                            }))}
                            center={route[0] ? { lat: route[0].lat, lng: route[0].lng } : undefined}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center text-xs text-neutral-500 uppercase tracking-[0.2em]">
                            Select cities to preview the route map
                        </div>
                    )}
                </div>

                {/* Route cards */}
                {route.length === 0 ? (
                    <div className="py-20 flex flex-col items-center gap-3 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
                            <MapPin size={20} className="text-neutral-500" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-neutral-300">No cities selected</p>
                            <p className="text-xs text-neutral-600 mt-1">Pick cities from the left panel to create a nearest-neighbor geographic route sketch.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <AnimatePresence>
                            {route.map((city, idx) => {
                                const nextCity = route[idx + 1];
                                const dist = nextCity ? Math.round(haversine(city, nextCity)) : null;
                                return (
                                    <div key={city.id}>
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            transition={{ duration: 0.2, delay: idx * 0.04 }}
                                            className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/10 transition-all group"
                                        >
                                            {/* Stop number */}
                                            <div className="w-7 h-7 rounded-full bg-[#FFE135]/10 border border-[#FFE135]/20 flex items-center justify-center flex-shrink-0">
                                                <span className="text-[11px] font-black text-[#FFE135]">{idx + 1}</span>
                                            </div>

                                            {/* City info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-bold text-white">{city.name}</span>
                                                    <span className="text-[10px] text-neutral-500">{city.state}</span>
                                                </div>
                                                <div className="text-[9px] text-neutral-600 font-mono">
                                                    {city.lat.toFixed(4)}, {city.lng.toFixed(4)}
                                                </div>
                                            </div>

                                            {/* Remove */}
                                            <button
                                                onClick={() => toggleCity(city.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-neutral-600 hover:text-red-400 transition-all"
                                            >
                                                <X size={12} />
                                            </button>
                                        </motion.div>

                                        {/* Leg connector */}
                                        {dist !== null && (
                                            <div className="flex items-center gap-2 px-4 py-0.5">
                                                <div className="flex-1 h-px bg-white/5" />
                                                <div className="flex items-center gap-1.5 text-[9px] text-neutral-600">
                                                    <Route size={9} />
                                                    <span>{dist.toLocaleString('en-US')} mi straight-line</span>
                                                </div>
                                                <div className="flex-1 h-px bg-white/5" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>

        {/* User Guide Modal */}
        <Modal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} titleId="guide-modal-title" maxWidth="max-w-xl" className="bg-[#0c0c0c]">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-[#FFE135]" />
                    <h3 id="guide-modal-title" className="text-sm font-black text-white uppercase tracking-wider">Tour Route Optimizer Guide</h3>
                </div>
                <button onClick={() => setIsGuideOpen(false)} className="text-neutral-500 hover:text-white transition-colors p-1 rounded hover:bg-white/5">
                    <X size={14} />
                </button>
            </div>
            <div className="p-6 space-y-4 text-xs text-neutral-400 leading-relaxed font-mono">
                <p>
                    The <span className="text-[#FFE135] font-bold">indii Route Optimizer</span> creates a geographic draft from selected U.S. city centers. It does not contain audience, venue, ticketing, or revenue intelligence.
                </p>
                <div>
                    <h4 className="text-white font-bold mb-1 uppercase tracking-wide text-[10px]">1. Pick Your Markets</h4>
                    <p>Select target city centers from the left panel. Use your own authorized analytics and venue research when deciding which markets belong on the tour.</p>
                </div>
                <div>
                    <h4 className="text-white font-bold mb-1 uppercase tracking-wide text-[10px]">2. Sketch the Order</h4>
                    <p><span className="text-[#FFE135] font-bold">Optimize Route</span> applies a greedy nearest-neighbor calculation to straight-line distances between city centers. It does not account for roads, borders, traffic, rest rules, or guarantee a globally shortest route.</p>
                </div>
                <div>
                    <h4 className="text-white font-bold mb-1 uppercase tracking-wide text-[10px]">3. Build and Review</h4>
                    <p>Save Route Draft stores the selected order with provisional daily dates and blank venues. Review every date, venue, road leg, budget, and contact before using it operationally.</p>
                </div>
            </div>
        </Modal>
        </TooltipProvider>
    );
}
