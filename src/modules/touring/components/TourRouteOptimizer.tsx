/**
 * TourRouteOptimizer — Item 131 (PRODUCTION_200)
 * Plots geo-optimized tour routes based on regional Spotify listener density.
 * Greedy nearest-neighbor sort on mock city coordinates + listener weighting.
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Music2, Plus, X, ArrowRight, Zap, Users, Clock, Route } from 'lucide-react';

interface City {
    id: string;
    name: string;
    state: string;
    lat: number;
    lng: number;
    listeners: number; // mock Spotify monthly listeners in region
    avgTicketPrice: number;
    venues: number;
}

// Top 45 US touring markets — real coordinates, population-calibrated listener
// estimates, market-rate avg ticket prices, and rough venue counts.
// Listener figures use metro-population × ~0.35 streaming penetration × genre index.
const CITY_POOL: City[] = [
    { id: 'nyc', name: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060, listeners: 1420000, avgTicketPrice: 48, venues: 312 },
    { id: 'la', name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437, listeners: 1280000, avgTicketPrice: 45, venues: 287 },
    { id: 'chi', name: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298, listeners: 890000, avgTicketPrice: 38, venues: 196 },
    { id: 'hou', name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698, listeners: 740000, avgTicketPrice: 34, venues: 158 },
    { id: 'phx', name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740, listeners: 620000, avgTicketPrice: 32, venues: 124 },
    { id: 'phi', name: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652, listeners: 580000, avgTicketPrice: 36, venues: 141 },
    { id: 'sa', name: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936, listeners: 480000, avgTicketPrice: 29, venues: 98 },
    { id: 'sd', name: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611, listeners: 510000, avgTicketPrice: 35, venues: 112 },
    { id: 'dal', name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970, listeners: 670000, avgTicketPrice: 36, venues: 163 },
    { id: 'sj', name: 'San Jose', state: 'CA', lat: 37.3382, lng: -121.8863, listeners: 520000, avgTicketPrice: 42, venues: 89 },
    { id: 'aus', name: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431, listeners: 590000, avgTicketPrice: 38, venues: 247 },
    { id: 'jax', name: 'Jacksonville', state: 'FL', lat: 30.3322, lng: -81.6557, listeners: 340000, avgTicketPrice: 27, venues: 72 },
    { id: 'sf', name: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194, listeners: 780000, avgTicketPrice: 46, venues: 183 },
    { id: 'col', name: 'Columbus', state: 'OH', lat: 39.9612, lng: -82.9988, listeners: 390000, avgTicketPrice: 29, venues: 95 },
    { id: 'ind', name: 'Indianapolis', state: 'IN', lat: 39.7684, lng: -86.1581, listeners: 360000, avgTicketPrice: 28, venues: 86 },
    { id: 'sea', name: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321, listeners: 640000, avgTicketPrice: 41, venues: 157 },
    { id: 'den', name: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903, listeners: 560000, avgTicketPrice: 38, venues: 143 },
    { id: 'dc', name: 'Washington', state: 'DC', lat: 38.9072, lng: -77.0369, listeners: 680000, avgTicketPrice: 42, venues: 162 },
    { id: 'nas', name: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816, listeners: 520000, avgTicketPrice: 36, venues: 198 },
    { id: 'ok', name: 'Oklahoma City', state: 'OK', lat: 35.4676, lng: -97.5164, listeners: 280000, avgTicketPrice: 26, venues: 64 },
    { id: 'elp', name: 'El Paso', state: 'TX', lat: 31.7619, lng: -106.4850, listeners: 210000, avgTicketPrice: 22, venues: 42 },
    { id: 'bos', name: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589, listeners: 690000, avgTicketPrice: 44, venues: 168 },
    { id: 'por', name: 'Portland', state: 'OR', lat: 45.5051, lng: -122.6750, listeners: 480000, avgTicketPrice: 35, venues: 128 },
    { id: 'mem', name: 'Memphis', state: 'TN', lat: 35.1495, lng: -90.0490, listeners: 310000, avgTicketPrice: 26, venues: 88 },
    { id: 'det', name: 'Detroit', state: 'MI', lat: 42.3314, lng: -83.0458, listeners: 440000, avgTicketPrice: 31, venues: 104 },
    { id: 'lv', name: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398, listeners: 420000, avgTicketPrice: 52, venues: 218 },
    { id: 'lou', name: 'Louisville', state: 'KY', lat: 38.2527, lng: -85.7585, listeners: 290000, avgTicketPrice: 27, venues: 73 },
    { id: 'bal', name: 'Baltimore', state: 'MD', lat: 39.2904, lng: -76.6122, listeners: 360000, avgTicketPrice: 31, venues: 89 },
    { id: 'mil', name: 'Milwaukee', state: 'WI', lat: 43.0389, lng: -87.9065, listeners: 280000, avgTicketPrice: 27, venues: 78 },
    { id: 'alb', name: 'Albuquerque', state: 'NM', lat: 35.0844, lng: -106.6504, listeners: 220000, avgTicketPrice: 24, venues: 52 },
    { id: 'tuc', name: 'Tucson', state: 'AZ', lat: 32.2226, lng: -110.9747, listeners: 200000, avgTicketPrice: 23, venues: 48 },
    { id: 'fre', name: 'Fresno', state: 'CA', lat: 36.7378, lng: -119.7871, listeners: 180000, avgTicketPrice: 22, venues: 37 },
    { id: 'sac', name: 'Sacramento', state: 'CA', lat: 38.5816, lng: -121.4944, listeners: 390000, avgTicketPrice: 32, venues: 96 },
    { id: 'mia', name: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918, listeners: 620000, avgTicketPrice: 43, venues: 147 },
    { id: 'ral', name: 'Raleigh', state: 'NC', lat: 35.7796, lng: -78.6382, listeners: 380000, avgTicketPrice: 31, venues: 94 },
    { id: 'omh', name: 'Omaha', state: 'NE', lat: 41.2565, lng: -95.9345, listeners: 200000, avgTicketPrice: 25, venues: 56 },
    { id: 'cle', name: 'Cleveland', state: 'OH', lat: 41.4993, lng: -81.6944, listeners: 320000, avgTicketPrice: 28, venues: 84 },
    { id: 'min', name: 'Minneapolis', state: 'MN', lat: 44.9778, lng: -93.2650, listeners: 490000, avgTicketPrice: 35, venues: 122 },
    { id: 'atl', name: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880, listeners: 730000, avgTicketPrice: 40, venues: 182 },
    { id: 'no', name: 'New Orleans', state: 'LA', lat: 29.9511, lng: -90.0715, listeners: 340000, avgTicketPrice: 33, venues: 167 },
    { id: 'tam', name: 'Tampa', state: 'FL', lat: 27.9506, lng: -82.4572, listeners: 400000, avgTicketPrice: 32, venues: 98 },
    { id: 'pit', name: 'Pittsburgh', state: 'PA', lat: 40.4406, lng: -79.9959, listeners: 320000, avgTicketPrice: 29, venues: 86 },
    { id: 'slc', name: 'Salt Lake City', state: 'UT', lat: 40.7608, lng: -111.8910, listeners: 290000, avgTicketPrice: 30, venues: 71 },
    { id: 'cha', name: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431, listeners: 440000, avgTicketPrice: 33, venues: 107 },
    { id: 'kan', name: 'Kansas City', state: 'MO', lat: 39.0997, lng: -94.5786, listeners: 340000, avgTicketPrice: 30, venues: 91 },
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
        // Score = distance penalized, listener-weighted
        let bestIdx = 0;
        let bestScore = Infinity;
        unvisited.forEach((city, i) => {
            const dist = haversine(last, city);
            const listenerBonus = 1 - city.listeners / 1500000; // closer to 0 → more listeners
            const score = dist * (0.7 + 0.3 * listenerBonus);
            if (score < bestScore) { bestScore = score; bestIdx = i; }
        });
        route.push(unvisited.splice(bestIdx, 1)[0]!);
    }
    return route;
}

function driveHours(dist: number): string {
    const h = Math.round(dist / 55); // avg 55 mph
    if (h < 1) return '< 1 hr';
    return `${h} hr${h !== 1 ? 's' : ''}`;
}

function formatListeners(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    return `${Math.round(n / 1000)}K`;
}

export function TourRouteOptimizer() {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [optimized, setOptimized] = useState(false);

    const selected = CITY_POOL.filter(c => selectedIds.has(c.id));
    const available = CITY_POOL.filter(c => !selectedIds.has(c.id));

    const route = useMemo(() => optimized ? optimizeRoute(selected) : selected, [selected, optimized]);

    const totalDistance = useMemo(() => {
        let d = 0;
        for (let i = 0; i < route.length - 1; i++) d += haversine(route[i]!, route[i + 1]!);
        return Math.round(d);
    }, [route]);

    const totalListeners = route.reduce((s, c) => s + c.listeners, 0);
    const estimatedRevenue = route.reduce((s, c) => s + c.avgTicketPrice * Math.round(c.listeners * 0.002), 0);

    const toggleCity = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
        setOptimized(false);
    };

    return (
        <div className="flex gap-6 h-full">
            {/* Left — city picker */}
            <div className="w-56 flex-shrink-0 space-y-4">
                <div>
                    <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Add Cities</h4>
                    <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                        {available.map(city => (
                            <button
                                key={city.id}
                                onClick={() => toggleCity(city.id)}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/5 transition-all text-left group"
                            >
                                <div>
                                    <div className="text-xs font-bold text-neutral-300 group-hover:text-white">{city.name}</div>
                                    <div className="flex items-center gap-1 text-[9px] text-neutral-600 mt-0.5">
                                        <Users size={8} />
                                        <span>{formatListeners(city.listeners)}</span>
                                    </div>
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
                        <span className="text-neutral-600">Distance</span>
                        <span className="text-white font-bold">{totalDistance.toLocaleString()} mi</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-neutral-600">Reach</span>
                        <span className="text-white font-bold">{formatListeners(totalListeners)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-neutral-600">Est. Revenue</span>
                        <span className="text-[#FFE135] font-bold">${(estimatedRevenue / 1000).toFixed(0)}K</span>
                    </div>
                </div>
            </div>

            {/* Right — route display */}
            <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-bold text-white">Route Planner</h4>
                        <p className="text-[10px] text-neutral-500 mt-0.5">
                            {optimized ? 'Geo-optimized by listener density' : 'Add cities and optimize'}
                        </p>
                    </div>
                    <button
                        onClick={() => setOptimized(true)}
                        disabled={selected.length < 2}
                        className="flex items-center gap-2 px-4 py-2 bg-[#FFE135] text-black text-xs font-black rounded-xl hover:bg-[#FFD700] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Zap size={13} /> Optimize Route
                    </button>
                </div>

                {/* Route cards */}
                {route.length === 0 ? (
                    <div className="py-20 flex flex-col items-center gap-3 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
                            <MapPin size={20} className="text-neutral-500" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-neutral-300">No cities selected</p>
                            <p className="text-xs text-neutral-600 mt-1">Pick cities from the left panel — the optimizer will calculate the geo-efficient route by listener density.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <AnimatePresence>
                            {route.map((city, idx) => {
                                const nextCity = route[idx + 1];
                                const dist = nextCity ? Math.round(haversine(city, nextCity)) : null;
                                const maxListeners = Math.max(...route.map(c => c.listeners));
                                const barPct = Math.round((city.listeners / maxListeners) * 100);
                                return (
                                    <React.Fragment key={city.id}>
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
                                                    <span className="text-[9px] text-neutral-700">· {city.venues} venues</span>
                                                </div>
                                                {/* Listener density bar */}
                                                <div className="flex items-center gap-2">
                                                    <Music2 size={9} className="text-neutral-600 flex-shrink-0" />
                                                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-[#FFE135] rounded-full"
                                                            style={{ width: `${barPct}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[9px] text-neutral-500 font-mono flex-shrink-0">
                                                        {formatListeners(city.listeners)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Avg ticket */}
                                            <div className="text-right flex-shrink-0">
                                                <div className="text-xs font-bold text-[#FFE135]">${city.avgTicketPrice}</div>
                                                <div className="text-[9px] text-neutral-600">avg ticket</div>
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
                                                    <span>{dist.toLocaleString()} mi</span>
                                                    <ArrowRight size={9} />
                                                    <Clock size={9} />
                                                    <span>{driveHours(dist)}</span>
                                                </div>
                                                <div className="flex-1 h-px bg-white/5" />
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
